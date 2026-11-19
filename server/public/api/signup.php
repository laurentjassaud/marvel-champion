<?php
/**
 * POST /api/signup.php — enregistre le nom et l'e-mail d'un visiteur.
 *
 * Corps attendu (JSON) :
 *   { "name": "…", "email": "…", "consent": true, "website": "", "elapsedMs": 4200, "source": "marvel-champions" }
 *
 * Réponses :
 *   200 { ok: true }
 *   422 { ok: false, message, errors: { name?, email?, consent? } }
 *   400 / 403 / 405 / 413 / 415 / 429 / 500 { ok: false, message }
 */
declare(strict_types=1);

use function GameboxHero\Signup\{check_rate, config, confirmation_template, db, ip_hash, save, send_confirmation, validate};
use const GameboxHero\Signup\BODY_MAX;

// Dossier privé (lib.php, config.php, base) : à côté de la racine web sur le VPS. Réglable par
// « SetEnv GAMEBOX_PRIVATE_DIR … » dans le vhost Apache.
$privateDir = $_SERVER['GAMEBOX_PRIVATE_DIR'] ?? getenv('GAMEBOX_PRIVATE_DIR') ?: '/home/prod/gamebox-private';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $body, array $headers = []): never
{
    http_response_code($status);
    foreach ($headers as $header) {
        header($header);
    }
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Envoie la réponse et ferme la connexion : la suite du travail (le mail de confirmation) ne fait pas attendre le visiteur. */
function respond_and_continue(int $status, array $body): void
{
    http_response_code($status);
    $json = (string) json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    ignore_user_abort(true);
    header('Content-Length: ' . strlen($json));
    header('Connection: close');
    echo $json;
    if (function_exists('fastcgi_finish_request')) { // PHP-FPM
        fastcgi_finish_request();
        return;
    }
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();
}

try {
    if (!is_file($privateDir . '/lib.php')) {
        throw new RuntimeException("lib.php introuvable dans $privateDir (vérifier GAMEBOX_PRIVATE_DIR)");
    }
    require $privateDir . '/lib.php';
    $config = config();

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        respond(405, ['ok' => false, 'message' => 'Méthode non autorisée.'], ['Allow: POST']);
    }

    // Les navigateurs envoient toujours Origin sur un POST : on refuse ce qui ne vient pas du site.
    if (!in_array($_SERVER['HTTP_ORIGIN'] ?? '', $config['allowed_origins'], true)) {
        respond(403, ['ok' => false, 'message' => 'Origine non autorisée.']);
    }

    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') {
        respond(415, ['ok' => false, 'message' => 'Format attendu : JSON.']);
    }

    $raw = file_get_contents('php://input', false, null, 0, BODY_MAX + 1);
    if ($raw === false || strlen($raw) > BODY_MAX) {
        respond(413, ['ok' => false, 'message' => 'Requête trop volumineuse.']);
    }

    try {
        $in = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        $in = null;
    }
    if (!is_array($in)) {
        respond(400, ['ok' => false, 'message' => 'Requête mal formée.']);
    }

    $pdo = db();

    // Anti-spam 1 : chaque tentative compte, valide ou non.
    $limit = $config['rate_limit'];
    $wait = check_rate($pdo, ip_hash($_SERVER['REMOTE_ADDR'] ?? '', $config['ip_salt']), (int) $limit['max'], (int) $limit['window'], time());
    if ($wait > 0) {
        respond(429, ['ok' => false, 'message' => 'Trop de tentatives depuis votre connexion. Réessayez plus tard.'], ["Retry-After: $wait"]);
    }

    // Anti-spam 2 : champ piège invisible pour un humain. Faux succès pour ne rien apprendre au robot.
    $honeypot = $in['website'] ?? '';
    if ($honeypot !== '' && $honeypot !== null) {
        respond(200, ['ok' => true]);
    }

    // Anti-spam 3 : un humain met plus d'une seconde et demie à remplir le formulaire.
    $elapsed = $in['elapsedMs'] ?? null;
    if (!(is_int($elapsed) || is_float($elapsed)) || $elapsed < (int) $config['min_elapsed_ms']) {
        respond(422, ['ok' => false, 'message' => 'Envoi trop rapide : patientez une seconde puis réessayez.']);
    }

    [$data, $errors] = validate($in, $config);
    if ($errors) {
        respond(422, ['ok' => false, 'message' => 'Certains champs sont à corriger.', 'errors' => $errors]);
    }

    // Même réponse que l'adresse soit nouvelle ou déjà connue : on ne révèle pas qui est inscrit.
    $isNew = save($pdo, $data, gmdate('Y-m-d\TH:i:s\Z'));

    // Mail de confirmation, avec le lien de désinscription : seulement pour une nouvelle adresse (une adresse
    // réinscrite n'en reçoit pas d'autre, le formulaire ne peut pas servir à inonder une boîte), et après la
    // réponse. Un échec est noté (bin/signups.php echecs confirmation-inscription) sans toucher à l'inscription.
    $template = $isNew ? confirmation_template($config) : null;
    if ($template === null) {
        respond(200, ['ok' => true]);
    }
    respond_and_continue(200, ['ok' => true]);
    try {
        require_once $privateDir . '/mail.php';
        send_confirmation($pdo, $data['email'], $template);
    } catch (Throwable $e) {
        error_log('[gamebox-signup] ' . $e->getMessage());
    }
    exit;
} catch (Throwable $e) {
    error_log('[gamebox-signup] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    respond(500, ['ok' => false, 'message' => 'Le service est momentanément indisponible. Réessayez plus tard.']);
}
