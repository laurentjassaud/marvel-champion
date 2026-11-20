<?php
/**
 * Test de bout en bout de la mailing list : faux serveur SMTP, vrai script d'envoi,
 * vraie page de désinscription. Ne touche ni à ta base ni à ton SMTP.
 *
 *   php server/tests/mailing-test.php
 */
declare(strict_types=1);

$root = dirname(__DIR__);
$smtpPort = 19000 + random_int(0, 499);
$webPort = 19500 + random_int(0, 499);
$deadPort = 18999;

// ── Environnement temporaire ────────────────────────────────────────────────

$tmp = sys_get_temp_dir() . '/gbh-mailing-test-' . bin2hex(random_bytes(4));
mkdir("$tmp/private/bin", 0777, true);
mkdir("$tmp/inbox");
mkdir("$tmp/tpl");
copy("$root/private/lib.php", "$tmp/private/lib.php");
copy("$root/private/mail.php", "$tmp/private/mail.php");
foreach (['signups.php', 'mailing.php'] as $f) {
    copy("$root/private/bin/$f", "$tmp/private/bin/$f");
}
exec('cp -r ' . escapeshellarg("$root/private/vendor") . ' ' . escapeshellarg("$tmp/private/vendor"));
copy("$root/private/templates/exemple-nouveautes.html", "$tmp/tpl/exemple-nouveautes.html");

function write_config(int $smtpPort): void
{
    global $tmp, $webPort;
    file_put_contents("$tmp/private/config.php", '<?php return ' . var_export([
        'db_path' => "$tmp/private/data/signups.sqlite",
        'allowed_origins' => ['https://gameboxheroes.fr'],
        'allowed_sources' => ['marvel-champions', 'gamebox-hero'],
        'default_source' => 'marvel-champions',
        'ip_salt' => 'sel-de-test',
        'rate_limit' => ['max' => 20, 'window' => 3600],
        'min_elapsed_ms' => 1500,
        'check_mx' => false,
        'site_url' => "http://127.0.0.1:$webPort",
        'unsubscribe_secret' => 'secret-de-test',
        'mail' => [
            'transport' => 'smtp', 'host' => '127.0.0.1', 'port' => $smtpPort, 'encryption' => '',
            'username' => 'gbh', 'password' => 'mot-de-passe',
            'from_email' => 'nouvelles@gameboxheroes.fr', 'from_name' => 'Gamebox Hero', 'reply_to' => 'laurent@gameboxheroes.fr',
            'per_minute' => 6000, 'dkim' => null,
        ],
    ], true) . ';');
}
write_config($smtpPort);

// Template de test : toutes les variables, une image jointe, une image distante, un lien avec &.
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
file_put_contents("$tmp/tpl/logo.png", $png);
file_put_contents("$tmp/tpl/annonce.html", <<<'HTML'
    <!doctype html><html><head><meta charset="utf-8"><title>Annonce spéciale : l’été des héros</title></head>
    <body>
    <img src="logo.png" alt="Gamebox Hero"><img src="https://cdn.example.com/banniere.jpg" alt="">
    <h1>Bonjour {{ prenom }} !</h1>
    <p>Nom complet : {{nom}}<br>Adresse : {{email}}</p>
    <p><a href="https://gameboxheroes.fr/?a=1&amp;b=2">Jouer</a></p>
    <p><a href="{{desinscription}}">Se désinscrire</a></p>
    </body></html>
    HTML);

$procs = [];
$procs[] = proc_open([PHP_BINARY, __DIR__ . '/smtp-sink.php', (string) $smtpPort, "$tmp/inbox"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', "$tmp/sink.log", 'w']], $p1);
$procs[] = proc_open([PHP_BINARY, '-d', 'opcache.enable=0', '-S', "127.0.0.1:$webPort", '-t', "$root/public"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $p2, null, ['GAMEBOX_PRIVATE_DIR' => "$tmp/private"] + getenv());
register_shutdown_function(function () use (&$procs, $tmp) {
    foreach ($procs as $p) {
        proc_terminate($p);
    }
    exec('rm -rf ' . escapeshellarg($tmp));
});
foreach ([$smtpPort, $webPort] as $port) {
    for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $port); $i++) {
        usleep(100_000);
    }
}

// Inscrits de départ, via la bibliothèque elle-même.
require "$tmp/private/lib.php";
$pdo = GameboxHero\Signup\db();
foreach ([
    ['peter@example.com', 'Peter Parker', 'marvel-champions'],
    ['carol@example.com', 'Carol Danvers', 'marvel-champions'],
    ['tom@example.com', 'Tom & Jerry', 'marvel-champions'],
    ['jennifer@example.com', 'Jennifer Walters', 'gamebox-hero'],
    ['refuse@example.com', 'Adresse Refusée', 'marvel-champions'],
] as [$email, $name, $source]) {
    GameboxHero\Signup\save($pdo, compact('email', 'name', 'source'), gmdate('c'));
}

// ── Outils ──────────────────────────────────────────────────────────────────

$passed = 0;
$failed = 0;
function check(string $label, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    $ok ? $passed++ : $failed++;
    echo ($ok ? '  ok    ' : '  ÉCHEC ') . $label . ($ok || $detail === '' ? '' : " — $detail") . PHP_EOL;
}

/** @return array{0: int, 1: string} [code de sortie, sortie standard + erreurs] */
function mailing(string ...$args): array
{
    global $tmp;
    $proc = proc_open([PHP_BINARY, "$tmp/private/bin/mailing.php", ...$args], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['redirect', 1]], $pipes);
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    return [proc_close($proc), $out];
}

function inbox(): array
{
    global $tmp;
    $files = glob("$tmp/inbox/*.eml");
    sort($files);
    return array_map(fn ($f) => parse_mail((string) file_get_contents($f)), $files);
}

function clear_inbox(): void
{
    global $tmp;
    array_map('unlink', glob("$tmp/inbox/*.eml"));
}

function parse_mail(string $raw): array
{
    [$head, $body] = explode("\r\n\r\n", $raw, 2) + [1 => ''];
    $head = preg_replace("/\r\n[ \t]+/", ' ', $head);
    $headers = [];
    foreach (explode("\r\n", $head) as $line) {
        [$k, $v] = explode(':', $line, 2) + [1 => ''];
        $headers[strtolower(trim($k))][] = trim($v);
    }
    return ['headers' => $headers, 'body' => $body];
}

function header_of(array $part, string $name): string
{
    return $part['headers'][strtolower($name)][0] ?? '';
}

/** Parties finales d'un message MIME, décodées. */
function parts(array $part): array
{
    $type = header_of($part, 'content-type');
    if (preg_match('~^multipart/.*boundary="?([^";]+)"?~i', $type, $m)) {
        $out = [];
        $chunks = explode('--' . $m[1], $part['body']);
        array_shift($chunks);
        foreach ($chunks as $chunk) {
            if (str_starts_with($chunk, '--')) {
                break;
            }
            $out = array_merge($out, parts(parse_mail(ltrim($chunk, "\r\n"))));
        }
        return $out;
    }
    $enc = strtolower(header_of($part, 'content-transfer-encoding'));
    $part['decoded'] = match ($enc) {
        'quoted-printable' => quoted_printable_decode($part['body']),
        'base64' => (string) base64_decode($part['body']),
        default => $part['body'],
    };
    $part['type'] = strtolower(trim(explode(';', $type)[0])) ?: 'text/plain';
    return [$part];
}

function part_of(array $msg, string $type): ?array
{
    foreach (parts($msg) as $p) {
        if ($p['type'] === $type) {
            return $p;
        }
    }
    return null;
}

function to_of(array $msg): string
{
    return header_of($msg, 'x-sink-rcpt');
}

function subject_of(array $msg): string
{
    return mb_decode_mimeheader(header_of($msg, 'subject'));
}

function sends(): array
{
    global $pdo;
    return $pdo->query('SELECT email, status, error FROM mailing_sends ORDER BY email')->fetchAll(PDO::FETCH_ASSOC);
}

/** @return array{0: int, 1: string, 2: array} */
function web(string $method, string $url, string $body = '', array $headers = []): array
{
    $ctx = stream_context_create(['http' => ['method' => $method, 'content' => $body, 'header' => implode("\r\n", $headers), 'ignore_errors' => true, 'timeout' => 5]]);
    $raw = (string) file_get_contents($url, false, $ctx);
    $hdrs = [];
    foreach (array_slice($http_response_header, 1) as $h) {
        [$k, $v] = array_map('trim', explode(':', $h, 2)) + [1 => ''];
        $hdrs[strtolower($k)] = $v;
    }
    return [(int) explode(' ', $http_response_header[0])[1], $raw, $hdrs];
}

$tpl = "$tmp/tpl/annonce.html";

// ── Contrôles avant envoi ───────────────────────────────────────────────────

echo "Contrôles avant envoi\n";

[$code, $out] = mailing();
check('sans template → usage', $code === 1 && str_contains($out, 'Usage'), $out);

[$code, $out] = mailing($tpl, '--sujett=x');
check('option mal orthographiée → refus', $code === 1 && str_contains($out, 'Option inconnue : --sujett'), $out);

[$code, $out] = mailing($tpl, '--limite=0');
check('--limite=0 → refus', $code === 1 && str_contains($out, 'entier positif'), $out);

file_put_contents("$tmp/tpl/faute.html", '<title>X</title><p>Bonjour {{nmo}}</p><a href="{{desinscription}}">x</a>');
[$code, $out] = mailing("$tmp/tpl/faute.html", '--oui');
check('variable mal orthographiée → refus avant envoi', $code === 1 && str_contains($out, 'Variable inconnue : {{nmo}}') && !inbox(), $out);

file_put_contents("$tmp/tpl/sans-titre.html", '<p>Bonjour</p>');
[$code, $out] = mailing("$tmp/tpl/sans-titre.html", '--oui');
check('ni <title> ni --sujet → refus', $code === 1 && str_contains($out, 'Sujet manquant'), $out);

[$code, $out] = mailing("$tmp/tpl/absent.html");
check('template absent → refus', $code === 1 && str_contains($out, 'Template introuvable'), $out);

[$code, $out] = mailing($tpl);
check('sans terminal ni --oui → refus, rien envoyé', $code === 1 && str_contains($out, 'ajoutez --oui') && !inbox(), $out);

// ── Simulation ──────────────────────────────────────────────────────────────

echo "Simulation\n";

[$code, $out] = mailing($tpl, '--simulation');
check('simulation : code 0', $code === 0, $out);
check('simulation : 5 destinataires annoncés', str_contains($out, 'À envoyer   : 5'), $out);
check('simulation : sujet lu dans <title>', str_contains($out, 'Sujet       : Annonce spéciale : l’été des héros'), $out);
check('simulation : connexion SMTP vérifiée', str_contains($out, 'Connexion SMTP : ok'), $out);
check('simulation : aucun message envoyé', !inbox());
$preview = (string) @file_get_contents("$tmp/tpl/annonce.apercu.html");
check('simulation : aperçu HTML personnalisé', str_contains($preview, 'Bonjour Peter !'), substr($preview, 0, 200));
check('simulation : aperçu texte', str_contains((string) @file_get_contents("$tmp/tpl/annonce.apercu.txt"), 'Sujet : Annonce spéciale'));
check('simulation : aucune campagne créée', (int) $pdo->query('SELECT COUNT(*) FROM mailings')->fetchColumn() === 0);

// ── Envoi de test ───────────────────────────────────────────────────────────

echo "Envoi de test\n";

[$code, $out] = mailing($tpl, '--test=moi@example.com');
$box = inbox();
check('test : un seul message, à moi', $code === 0 && count($box) === 1 && to_of($box[0]) === 'moi@example.com', $out);
check('test : sujet préfixé [Test]', subject_of($box[0] ?? ['headers' => []]) === '[Test] Annonce spéciale : l’été des héros');
check('test : adresse non inscrite signalée', str_contains($out, "n'est pas inscrite"), $out);
check('test : rien enregistré', !sends());
clear_inbox();

[$code, $out] = mailing($tpl, '--test=carol@example.com');
$html = part_of(inbox()[0], 'text/html')['decoded'] ?? '';
check('test vers un inscrit : son vrai nom', str_contains($html, 'Nom complet : Carol Danvers'), $html);
clear_inbox();

// ── Envoi réel, en deux fois ────────────────────────────────────────────────

echo "Envoi\n";

[$code, $out] = mailing($tpl, '--oui', '--limite=2');
check('--limite=2 : 2 messages', $code === 0 && count(inbox()) === 2, $out);
check('--limite=2 : 3 restants annoncés', str_contains($out, 'restants : 3'), $out);
check('ordre d’inscription respecté', array_map('to_of', inbox()) === ['peter@example.com', 'carol@example.com']);

[$code, $out] = mailing($tpl, '--oui');
$box = inbox();
check('reprise : seulement les 3 suivants', count($box) === 4 && str_contains($out, 'Campagne    : annonce (reprise)') && str_contains($out, 'Déjà servis : 2'), $out);
check('reprise : adresse refusée → échec signalé, code 2', $code === 2 && str_contains($out, 'ÉCHEC  refuse@example.com') && str_contains($out, 'échecs : 1'), $out);
$refused = array_column(sends(), null, 'email')['refuse@example.com'] ?? [];
check('reprise : échec enregistré avec la raison', ($refused['status'] ?? '') === 'failed' && str_contains((string) ($refused['error'] ?? ''), '550'), json_encode($refused));

$tom = null;
foreach ($box as $m) {
    if (to_of($m) === 'tom@example.com') {
        $tom = $m;
    }
}
$html = part_of($tom, 'text/html')['decoded'] ?? '';
$text = part_of($tom, 'text/plain')['decoded'] ?? '';
$png = part_of($tom, 'image/png');
$unsub = header_of($tom, 'list-unsubscribe');

echo "Contenu d'un message\n";

check('expéditeur', header_of($tom, 'from') === 'Gamebox Hero <nouvelles@gameboxheroes.fr>', header_of($tom, 'from'));
check('destinataire avec son nom', str_contains(mb_decode_mimeheader(header_of($tom, 'to')), 'Tom & Jerry') && str_contains(header_of($tom, 'to'), '<tom@example.com>'), header_of($tom, 'to'));
check('Reply-To', header_of($tom, 'reply-to') === 'laurent@gameboxheroes.fr', header_of($tom, 'reply-to'));
check('sujet accentué intact', subject_of($tom) === 'Annonce spéciale : l’été des héros', subject_of($tom));
check('authentification SMTP utilisée', header_of($tom, 'x-sink-auth') === '|gbh|mot-de-passe', header_of($tom, 'x-sink-auth'));
check('pas d’en-tête X-Mailer', header_of($tom, 'x-mailer') === '');
check('Message-ID présent', header_of($tom, 'message-id') !== '');
check('List-Unsubscribe vers la page signée', (bool) preg_match('~^<http://127\.0\.0\.1:\d+/api/unsubscribe\.php\?u=3&t=[a-f0-9]{32}>$~', $unsub), $unsub);
check('List-Unsubscribe-Post (un clic)', header_of($tom, 'list-unsubscribe-post') === 'List-Unsubscribe=One-Click');
check('HTML : {{prenom}} avec espaces remplacé', str_contains($html, 'Bonjour Tom !'), $html);
check('HTML : nom échappé (&amp;)', str_contains($html, 'Nom complet : Tom &amp; Jerry'), $html);
check('HTML : lien de désinscription échappé dans href', str_contains($html, 'href="' . htmlspecialchars(trim($unsub, '<>')) . '"'), $html);
check('HTML : image locale jointe (cid:)', (bool) preg_match('~<img src="cid:[^"]+" alt="Gamebox Hero">~', $html) && $png !== null && $png['decoded'] === base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), $html);
check('HTML : image distante laissée telle quelle', str_contains($html, 'src="https://cdn.example.com/banniere.jpg"'));
check('texte : nom non échappé', str_contains($text, 'Nom complet : Tom & Jerry'), $text);
check('texte : lien avec son URL', str_contains($text, 'Jouer (https://gameboxheroes.fr/?a=1&b=2)'), $text);
check('texte : lien de désinscription', str_contains($text, 'Se désinscrire (' . trim($unsub, '<>') . ')'), $text);
check('texte : pas de balises', !str_contains($text, '<'), $text);

echo "Relance\n";

clear_inbox();
[$code, $out] = mailing($tpl, '--oui');
check('relance : seul l’échec est retenté', count(inbox()) === 0 && str_contains($out, 'À envoyer   : 1') && $code === 2, $out);

$admin = fn (string ...$a) => (string) shell_exec(implode(' ', array_map('escapeshellarg', [PHP_BINARY, "$tmp/private/bin/signups.php", ...$a])) . ' 2>&1');
$out = $admin('campagnes');
check('suivi : campagnes avec compteurs', (bool) preg_match('/annonce\s+envoyés\s+4\s+échecs\s+1\s+en cours/u', $out), $out);
$out = $admin('echecs', 'annonce');
check('suivi : adresses en échec avec la raison', str_contains($out, 'refuse@example.com') && str_contains($out, '550') && str_contains($out, '1 échec(s)'), $out);
$out = (string) shell_exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg("$tmp/private/bin/signups.php") . ' supprimer refuse@example.com');
check('suppression RGPD en ligne de commande', str_contains($out, 'supprimée'), $out);
check('suppression RGPD : historique d’envoi effacé aussi', !in_array('refuse@example.com', array_column(sends(), 'email'), true), json_encode(sends()));

[$code, $out] = mailing($tpl, '--oui');
check('campagne complète : plus personne', $code === 0 && str_contains($out, 'Personne à qui envoyer'), $out);
check('campagne marquée terminée', $pdo->query("SELECT finished_at FROM mailings WHERE campaign = 'annonce'")->fetchColumn() !== null);

// ── Désinscription ──────────────────────────────────────────────────────────

echo "Désinscription\n";

$carolUrl = GameboxHero\Signup\unsubscribe_url(2, 'carol@example.com');
[$s, $body, $h] = web('GET', $carolUrl);
check('GET : page de confirmation avec l’adresse', $s === 200 && str_contains($body, 'carol@example.com') && str_contains($body, '<form method="post"'), "$s");
check('GET : ne désinscrit pas (antivirus)', in_array('carol@example.com', $pdo->query('SELECT email FROM signups')->fetchAll(PDO::FETCH_COLUMN), true));
check('GET : CSP anti-iframe et no-referrer', str_contains($h['content-security-policy'] ?? '', "frame-ancestors 'none'") && ($h['referrer-policy'] ?? '') === 'no-referrer');
[$s, $body] = web('GET', preg_replace('/t=[a-f0-9]{32}/', 't=' . str_repeat('0', 32), $carolUrl));
check('GET jeton faux : message neutre', $s === 200 && str_contains($body, 'n’est pas ou plus inscrite') && !str_contains($body, 'carol@'), "$s");
[$s] = web('GET', "http://127.0.0.1:$webPort/api/unsubscribe.php?u=abc");
check('GET lien tronqué → 400', $s === 400);
[$s, $body] = web('POST', $carolUrl, '', ['Content-Type: application/x-www-form-urlencoded']);
check('POST : désinscrit', $s === 200 && str_contains($body, 'Vous êtes désinscrit'), "$s");
check('POST : inscrit et historique effacés', !in_array('carol@example.com', $pdo->query('SELECT email FROM signups')->fetchAll(PDO::FETCH_COLUMN), true)
    && !in_array('carol@example.com', array_column(sends(), 'email'), true));
[$s, $body] = web('POST', $carolUrl);
check('POST répété : message neutre, 200', $s === 200 && str_contains($body, 'n’est pas ou plus inscrite'));
[$s] = web('POST', GameboxHero\Signup\unsubscribe_url(1, 'peter@example.com'), 'List-Unsubscribe=One-Click', ['Content-Type: application/x-www-form-urlencoded']);
check('un clic depuis la messagerie (RFC 8058)', $s === 200 && !in_array('peter@example.com', $pdo->query('SELECT email FROM signups')->fetchAll(PDO::FETCH_COLUMN), true));
[$s] = web('PUT', $carolUrl);
check('PUT → 405', $s === 405);

// ── Template d'exemple livré ────────────────────────────────────────────────

echo "Template d'exemple\n";

clear_inbox();
[$code, $out] = mailing("$tmp/tpl/exemple-nouveautes.html", '--oui');
$box = inbox();
check('exemple : envoyé aux inscrits restants seulement', $code === 0 && array_map('to_of', $box) === ['tom@example.com', 'jennifer@example.com'], $out);
check('exemple : aucun avertissement', !str_contains($out, 'Attention'), $out);
$text = part_of($box[1], 'text/plain')['decoded'] ?? '';
check('exemple : texte sans le texte d’aperçu caché', !str_contains($text, 'surprise pour les joueurs solo'), $text);
check('exemple : texte avec liste et liens', str_contains($text, "Bonjour Jennifer,") && str_contains($text, '- De nouveaux decks') && str_contains($text, 'Lancer une partie (https://www.gameboxheroes.fr/marvel-champions-table/)'), $text);
check('exemple : {{email}} dans le pied de page', str_contains(part_of($box[1], 'text/html')['decoded'] ?? '', '(jennifer@example.com)'));

clear_inbox();
[$code, $out] = mailing("$tmp/tpl/exemple-nouveautes.html", '--oui', '--campagne=exemple-bis', '--source=gamebox-hero');
check('--source : seulement Jennifer', $code === 0 && array_map('to_of', inbox()) === ['jennifer@example.com'], $out);

// ── Cas particuliers ────────────────────────────────────────────────────────

echo "Cas particuliers\n";

clear_inbox();
file_put_contents("$tmp/tpl/sans-lien.html", '<html><head><title>Sans lien</title></head><body><p>Bonjour {{prenom}}</p></body></html>');
[$code, $out] = mailing("$tmp/tpl/sans-lien.html", '--test=tom@example.com');
$m = inbox()[0];
check('sans {{desinscription}} : avertissement', str_contains($out, 'pied de page avec le lien a été ajouté'), $out);
check('sans {{desinscription}} : lien ajouté au HTML et au texte', str_contains(part_of($m, 'text/html')['decoded'], 'Se désinscrire</a>') && str_contains(part_of($m, 'text/plain')['decoded'], 'Se désinscrire (http'));

clear_inbox();
file_put_contents("$tmp/tpl/avec-texte.html", '<title>Avec texte</title><p>HTML {{prenom}}</p><a href="{{desinscription}}">x</a>');
file_put_contents("$tmp/tpl/avec-texte.txt", "Version texte écrite à la main pour {{nom}}.\nDésinscription : {{desinscription}}\n");
mailing("$tmp/tpl/avec-texte.html", '--test=tom@example.com');
$text = part_of(inbox()[0], 'text/plain')['decoded'] ?? '';
check('fichier .txt voisin utilisé comme version texte', str_starts_with($text, 'Version texte écrite à la main pour Tom & Jerry.'), $text);

clear_inbox();
[$code, $out] = mailing($tpl, '--oui', '--campagne=sujet-perso', '--sujet=Salut {{prenom}} !', '--limite=1');
check('--sujet personnalisé', subject_of(inbox()[0]) === 'Salut Tom !', subject_of(inbox()[0]));

// Cadence : 300/min → 0,2 s entre deux messages.
foreach (range(1, 6) as $i) {
    GameboxHero\Signup\save($pdo, ['email' => "joueur$i@example.com", 'name' => "Joueur $i", 'source' => 'marvel-champions'], gmdate('c'));
}
clear_inbox();
$t0 = microtime(true);
mailing($tpl, '--oui', '--campagne=cadence', '--par-minute=300', '--limite=4');
$elapsed = microtime(true) - $t0;
check('cadence respectée (4 messages à 300/min ≥ 0,6 s)', count(inbox()) === 4 && $elapsed >= 0.6, sprintf('%.2f s', $elapsed));

// Verrou : un seul envoi à la fois.
$lock = fopen("$tmp/private/data/mailing.lock", 'c');
flock($lock, LOCK_EX);
[$code, $out] = mailing($tpl, '--oui', '--campagne=verrou');
check('deuxième envoi simultané refusé', $code === 1 && str_contains($out, 'déjà en cours'), $out);
flock($lock, LOCK_UN);

// SMTP injoignable : arrêt après 5 échecs de suite, message en français.
write_config($deadPort);
[$code, $out] = mailing($tpl, '--oui', '--campagne=panne');
check('SMTP en panne : arrêt après 5 échecs', $code === 2 && substr_count($out, 'ÉCHEC') === 5 && str_contains($out, 'Arrêt : 5 échecs de suite'), $out);
check('SMTP en panne : erreur en français', str_contains($out, 'SMTP'), $out);
[$code, $out] = mailing($tpl, '--simulation', '--campagne=panne');
check('simulation : SMTP en panne détecté', $code === 1 && str_contains($out, 'Erreur'), $out);
write_config($smtpPort);
[$code, $out] = mailing($tpl, '--oui', '--campagne=panne');
check('après réparation : la campagne repart et finit', $code === 0 && str_contains($out, 'restants : 0'), $out);

echo PHP_EOL . "$passed réussi(s), $failed échec(s)" . PHP_EOL;
exit($failed ? 1 : 0);
