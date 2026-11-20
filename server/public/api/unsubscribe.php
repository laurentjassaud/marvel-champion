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
 *
 * Les pages suivent la maquette Figma (« Frame 12 » à « Frame 14 ») : le bleu nuit du mail de
 * confirmation, son fond de comics en haut (/mail/fond-entete.jpg, du dossier public/mail),
 * « MARVEL CHAMPIONS TABLE », le titre, puis une colonne de 580 px.
 */
declare(strict_types=1);

use function GameboxHero\Signup\{db, delete_subscriber, unsubscribe_token};

$privateDir = $_SERVER['GAMEBOX_PRIVATE_DIR'] ?? getenv('GAMEBOX_PRIVATE_DIR') ?: '/home/prod/gamebox-private';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");

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
        <title>$title · Marvel Champions Table</title>
        <style>
          /* le bleu nuit ; en haut, le fond de comics (960 × 460, qui s'y fond par le bas) et, sur un écran plus
             large que lui, ses bords qui s'effacent aussi. Sur html, qui couvre toute la fenêtre (body n'est pas
             plus haut que son texte) ; le texte à 42 px du haut, sur 580 px */
          html {
            background:
              linear-gradient(to right, #02153a, rgb(2 21 58 / 0) 12%, rgb(2 21 58 / 0) 88%, #02153a) center top / 960px 460px no-repeat,
              url('/mail/fond-entete.jpg') center top / 960px 460px no-repeat,
              #02153a;
          }
          body { margin: 0; padding: 42px 20px 64px; color: #fff; font: 16px/1.35 Arial, Helvetica, sans-serif; }
          main { max-width: 580px; margin: 0 auto; }
          p { margin: 0; }
          .brand { text-transform: uppercase; }
          h1 { margin: 0; font-size: 40px; line-height: 1.35; font-weight: 700; }
          .actions { margin-top: 31px; }
          .back { margin-top: 22px; font-weight: 700; }
          /* le bouton rouge des mails : 24 px tout autour, texte gras de 21 px */
          button {
            padding: 24px; border: 0; border-radius: 4px; background: #d94040; color: #fff;
            font: 700 21px/1.35 Arial, Helvetica, sans-serif; cursor: pointer; transition: background-color 150ms ease;
          }
          button:hover { background: #c53434; }
          button:focus-visible, a:focus-visible { outline: 3px solid #ffd54f; outline-offset: 2px; }
          a { color: inherit; }
          @media (max-width: 620px) {
            body { padding-top: 32px; }
            h1 { font-size: 32px; }
          }
        </style>
        </head>
        <body>
        <main>
        <p class="brand">Marvel Champions Table</p>
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
        page(200, 'Vous êtes désinscrit', "<p><strong>$safeEmail</strong> ne recevra plus les newsletters de MARVEL CHAMPIONS TABLE, "
            . 'et votre nom et votre adresse ont été effacés de notre liste.</p>'
            . '<p class="back"><a href="/">Retour au site</a></p>');
    }

    $action = htmlspecialchars('?' . http_build_query(['u' => $id, 't' => $token]));
    page(200, 'Se désinscrire', "<p>Vous ne recevrez plus les newsletters de MARVEL CHAMPIONS TABLE<br>à l’adresse $safeEmail.</p>"
        . "<form method=\"post\" action=\"$action\" class=\"actions\"><button type=\"submit\">Confirmer la désinscription</button></form>");
} catch (Throwable $e) {
    error_log('[gamebox-unsubscribe] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    page(500, 'Service indisponible', '<p>La désinscription n’a pas pu être enregistrée. Réessayez dans quelques minutes, '
        . 'ou répondez à notre message en demandant la désinscription.</p>');
}
