<?php
/**
 * Désinscription de la mailing list.
 *
 *   GET  /api/unsubscribe.php?u=ID&t=JETON   page de confirmation (un bouton)
 *   POST /api/unsubscribe.php?u=ID&t=JETON   désinscrit
 *
 * Le GET ne désinscrit pas : les antivirus de messagerie ouvrent les liens des e-mails
 * et désinscriraient tout le monde. Le POST sert aussi au désabonnement en un clic des
 * messageries (en-tête List-Unsubscribe-Post, RFC 8058).
 */
declare(strict_types=1);

use function GameboxHero\Signup\{db, delete_subscriber, unsubscribe_token};

$privateDir = $_SERVER['GAMEBOX_PRIVATE_DIR'] ?? getenv('GAMEBOX_PRIVATE_DIR') ?: '/home/prod/gamebox-private';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");

function page(int $status, string $title, string $body): never
{
    http_response_code($status);
    $title = htmlspecialchars($title);
    echo <<<HTML
        <!doctype html>
        <html lang="fr">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <title>$title · Gamebox Hero</title>
        <style>
          body { margin: 0; padding: 2rem 1rem; background: #14161d; color: #f1f1f1; font: 1rem/1.5 system-ui, sans-serif; }
          main { max-width: 32rem; margin: 0 auto; }
          h1 { font-size: 1.5rem; line-height: 1.2; }
          .brand { margin: 0 0 2rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #ff6b6b; }
          button { min-height: 2.75rem; padding: .6rem 1.25rem; border: 0; border-radius: 6px; background: #c8102e; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
          button:focus-visible, a:focus-visible { outline: 3px solid #ffd54f; outline-offset: 2px; }
          a { color: inherit; }
        </style>
        </head>
        <body>
        <main>
        <p class="brand">Gamebox Hero</p>
        <h1>$title</h1>
        $body
        </main>
        </body>
        </html>
        HTML;
    exit;
}

$neutral = fn () => page(
    200,
    'Lien de désinscription',
    '<p>Cette adresse n’est pas ou plus inscrite, ou le lien est incomplet. '
    . 'Si vous recevez encore nos messages, répondez simplement à l’un d’eux en demandant la désinscription.</p>'
);

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method !== 'GET' && $method !== 'POST') {
        header('Allow: GET, POST');
        page(405, 'Méthode non autorisée', '');
    }

    $id = filter_var($_GET['u'] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $token = $_GET['t'] ?? '';
    if ($id === false || !is_string($token) || !preg_match('/^[a-f0-9]{32}$/', $token)) {
        page(400, 'Lien incomplet', '<p>Ce lien de désinscription est incomplet. Copiez-le en entier depuis le message reçu.</p>');
    }

    if (!is_file($privateDir . '/lib.php')) {
        throw new RuntimeException("lib.php introuvable dans $privateDir (vérifier GAMEBOX_PRIVATE_DIR)");
    }
    require $privateDir . '/lib.php';

    $pdo = db();
    $st = $pdo->prepare('SELECT email FROM signups WHERE id = ?');
    $st->execute([$id]);
    $email = $st->fetchColumn();
    $st->closeCursor(); // voir db() dans lib.php : la désinscription écrit juste après

    // Même réponse pour un inscrit introuvable ou un jeton faux : le lien ne révèle rien.
    if (!is_string($email) || !hash_equals(unsubscribe_token($id, $email), $token)) {
        $neutral();
    }

    $safeEmail = htmlspecialchars($email);

    if ($method === 'POST') {
        delete_subscriber($pdo, $email);
        page(200, 'Vous êtes désinscrit', "<p><strong>$safeEmail</strong> ne recevra plus les nouvelles de Gamebox Hero, "
            . 'et votre nom et votre adresse ont été effacés de notre liste.</p>'
            . '<p><a href="/">Retour au site</a></p>');
    }

    $action = htmlspecialchars('?' . http_build_query(['u' => $id, 't' => $token]));
    page(200, 'Se désinscrire', "<p>Vous ne recevrez plus les nouvelles de Gamebox Hero à l’adresse <strong>$safeEmail</strong>.</p>"
        . "<form method=\"post\" action=\"$action\"><button type=\"submit\">Confirmer la désinscription</button></form>");
} catch (Throwable $e) {
    error_log('[gamebox-unsubscribe] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    page(500, 'Service indisponible', '<p>La désinscription n’a pas pu être enregistrée. Réessayez dans quelques minutes, '
        . 'ou répondez à notre message en demandant la désinscription.</p>');
}
