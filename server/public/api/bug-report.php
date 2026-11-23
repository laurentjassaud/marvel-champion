<?php
/**
 * POST /api/bug-report.php — « Signaler un bug » de Marvel Champions Table : envoie le rapport par e-mail à
 * l'auteur de l'appli (réglage « bug_report.to », sinon « notify »), la partie en cours en pièce jointe. Rien
 * n'est enregistré, sauf l'empreinte de l'IP pour l'anti-spam (private/bug-report.php).
 *
 * Corps attendu (JSON) :
 *   { "title": "…", "description": "…", "email": "" | "…", "context": [["Partie", "…"], …], "journal": ["08:15 …", …],
 *     "version": "0.2.1 · 1679dc1", "game": "<la partie enregistrée, en JSON>", "website": "", "elapsedMs": 4200 }
 *
 * Réponses :
 *   200 { ok: true }
 *   422 { ok: false, message, errors: { title?, email? } }
 *   502 { ok: false, message }   le mail n'est pas parti (SMTP)
 *   503 { ok: false, message }   service fermé : aucune adresse de réception, ou bloc « mail » non rempli
 *   400 / 403 / 405 / 413 / 415 / 429 / 500 { ok: false, message }
 */
declare(strict_types=1);

use function GameboxHero\BugReport\{rate_limit, recipients, send, validate};
use function GameboxHero\Signup\{check_rate, config, db, ip_hash};
use const GameboxHero\BugReport\BODY_MAX;

// Dossier privé (lib.php, bug-report.php, config.php, base) : à côté de la racine web sur le VPS. Réglable par
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

/** Le navigateur du joueur, pour le mail : une ligne, 300 caractères au plus. */
function clean_user_agent(string $userAgent): string
{
    return mb_substr(GameboxHero\Signup\clean_text($userAgent), 0, 300);
}

try {
    if (!is_file($privateDir . '/bug-report.php')) {
        throw new RuntimeException("bug-report.php introuvable dans $privateDir (vérifier GAMEBOX_PRIVATE_DIR)");
    }
    require $privateDir . '/bug-report.php';
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
        respond(413, ['ok' => false, 'message' => 'Rapport trop volumineux.']);
    }

    try {
        $in = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        $in = null;
    }
    if (!is_array($in)) {
        respond(400, ['ok' => false, 'message' => 'Requête mal formée.']);
    }

    $to = recipients($config);
    if (!$to) {
        respond(503, ['ok' => false, 'message' => "L'envoi des rapports n'est pas disponible pour le moment."]);
    }

    // Anti-spam 1 : chaque tentative compte, valide ou non ; un compteur à part de celui de l'inscription.
    $limit = rate_limit($config);
    $ipKey = ip_hash('bug-report|' . ($_SERVER['REMOTE_ADDR'] ?? ''), $config['ip_salt']);
    $wait = check_rate(db(), $ipKey, $limit['max'], $limit['window'], time());
    if ($wait > 0) {
        respond(429, ['ok' => false, 'message' => 'Trop de rapports envoyés depuis votre connexion. Réessayez plus tard.'], ["Retry-After: $wait"]);
    }

    // Anti-spam 2 : champ piège invisible pour un humain. Faux succès pour ne rien apprendre au robot.
    $honeypot = $in['website'] ?? '';
    if ($honeypot !== '' && $honeypot !== null) {
        respond(200, ['ok' => true]);
    }

    // Anti-spam 3 : un humain met plus d'une seconde et demie à écrire son rapport.
    $elapsed = $in['elapsedMs'] ?? null;
    if (!(is_int($elapsed) || is_float($elapsed)) || $elapsed < (int) ($config['min_elapsed_ms'] ?? 1500)) {
        respond(422, ['ok' => false, 'message' => 'Envoi trop rapide : patientez une seconde puis réessayez.']);
    }

    [$report, $errors] = validate($in);
    if ($errors) {
        respond(422, ['ok' => false, 'message' => 'Certains champs sont à corriger.', 'errors' => $errors]);
    }

    // Envoyé avant de répondre : le joueur sait si son rapport est parti, sinon il peut l'envoyer autrement.
    try {
        send($report, $to, $config['mail'], clean_user_agent($_SERVER['HTTP_USER_AGENT'] ?? ''), new DateTimeImmutable());
    } catch (Throwable $e) {
        error_log('[gamebox-bug-report] rapport non envoyé : ' . $e->getMessage());
        respond(502, ['ok' => false, 'message' => "Le rapport n'a pas pu partir. Réessayez plus tard, ou envoyez-le depuis votre messagerie."]);
    }
    respond(200, ['ok' => true]);
} catch (Throwable $e) {
    error_log('[gamebox-bug-report] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    respond(500, ['ok' => false, 'message' => 'Le service est momentanément indisponible. Réessayez plus tard.']);
}
