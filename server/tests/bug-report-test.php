<?php
/**
 * Test de bout en bout des rapports de bug (« Signaler un bug ») : vraie page public/api/bug-report.php, faux
 * serveur SMTP (smtp-sink.php). Vérifie le mail reçu (destinataires, sujet, « Répondre », texte, partie jointe),
 * les refus (champs, anti-spam, origine, format, taille), les pannes (SMTP, service fermé) et la limite par
 * connexion, à part de celle de l'inscription. Ne touche ni à ta base ni à ton SMTP.
 *
 *   php server/tests/bug-report-test.php
 */
declare(strict_types=1);

$root = dirname(__DIR__);
$smtpPort = 21000 + random_int(0, 499);
$webPort = 21500 + random_int(0, 499);
$deadPort = 18997;
$origin = 'https://gameboxheroes.fr';

// ── Environnement temporaire ────────────────────────────────────────────────

$tmp = sys_get_temp_dir() . '/gbh-bug-report-test-' . bin2hex(random_bytes(4));
mkdir("$tmp/private", 0777, true);
mkdir("$tmp/inbox");
foreach (['lib.php', 'mail.php', 'bug-report.php'] as $f) {
    copy("$root/private/$f", "$tmp/private/$f");
}
exec('cp -r ' . escapeshellarg("$root/private/vendor") . ' ' . escapeshellarg("$tmp/private/vendor"));

/** @param array<string, mixed> $override */
function write_config(array $override = []): void
{
    global $tmp, $webPort, $smtpPort, $origin;
    file_put_contents("$tmp/private/config.php", '<?php return ' . var_export(array_replace([
        'db_path' => "$tmp/private/data/signups.sqlite",
        'allowed_origins' => [$origin],
        'allowed_sources' => ['marvel-champions', 'gamebox-hero'],
        'default_source' => 'marvel-champions',
        'ip_salt' => 'sel-de-test',
        'rate_limit' => ['max' => 100, 'window' => 3600],
        'min_elapsed_ms' => 1500,
        'check_mx' => false,
        'site_url' => "http://127.0.0.1:$webPort",
        'unsubscribe_secret' => 'secret-de-test',
        'confirmation' => false,
        'notify' => 'contact@gameboxheroes.fr',
        'bug_report' => ['to' => 'bugs@gameboxheroes.fr', 'rate_limit' => ['max' => 100, 'window' => 3600]],
        'mail' => [
            'transport' => 'smtp', 'host' => '127.0.0.1', 'port' => $smtpPort, 'encryption' => '',
            'username' => '', 'password' => '',
            'from_email' => 'nouvelles@gameboxheroes.fr', 'from_name' => 'Gamebox Hero', 'reply_to' => '',
            'per_minute' => 6000, 'dkim' => null,
        ],
    ], $override), true) . ';');
}
write_config();

$procs = [];
$procs[] = proc_open([PHP_BINARY, __DIR__ . '/smtp-sink.php', (string) $smtpPort, "$tmp/inbox"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', "$tmp/sink.log", 'w']], $p1);
$procs[] = proc_open([PHP_BINARY, '-d', 'opcache.enable=0', '-S', "127.0.0.1:$webPort", '-t', "$root/public"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', "$tmp/web.log", 'w']], $p2, null, ['GAMEBOX_PRIVATE_DIR' => "$tmp/private", 'PHP_CLI_SERVER_WORKERS' => '4'] + getenv());
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

// ── Outils ──────────────────────────────────────────────────────────────────

$passed = 0;
$failed = 0;
function check(string $label, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    $ok ? $passed++ : $failed++;
    echo ($ok ? '  ok    ' : '  ÉCHEC ') . $label . ($ok || $detail === '' ? '' : " — $detail") . PHP_EOL;
}

/** @return array{0: int, 1: ?array, 2: array<string, string>} [statut, corps JSON, en-têtes] */
function web(string $method, string $path, string $body = '', array $headers = []): array
{
    global $webPort;
    $ctx = stream_context_create(['http' => ['method' => $method, 'content' => $body, 'header' => implode("\r\n", $headers), 'ignore_errors' => true, 'timeout' => 30]]);
    $raw = (string) file_get_contents("http://127.0.0.1:$webPort$path", false, $ctx);
    $hdrs = [];
    foreach (array_slice($http_response_header, 1) as $h) {
        [$k, $v] = array_map('trim', explode(':', $h, 2)) + [1 => ''];
        $hdrs[strtolower($k)] = $v;
    }
    return [(int) explode(' ', $http_response_header[0])[1], json_decode($raw, true), $hdrs];
}

const GAME = '{"version":2,"cards":[{"id":"a1","definitionId":"bw-01","zone":"table"}],"log":[{"time":"08:15","text":"Début"}]}';

/** Un rapport complet, comme l'envoie l'appli ; `$override` en remplace des champs. */
function report(array $override = []): array
{
    return array_replace([
        'title' => 'Carte bloquée sur la table',
        'description' => "Elle ne se retourne plus.\nLigne 2 : après un double-clic.",
        'email' => 'joueur@example.com',
        'context' => [['Partie', 'Spider-Man contre Rhino'], ['Situation', 'round 2, phase du héros']],
        'journal' => ['08:15 ★ Mise en place', '08:16 Spider-Man pioche'],
        'version' => '0.2.1 · abc1234',
        'game' => GAME,
        'website' => '',
        'elapsedMs' => 4200,
    ], $override);
}

function post_report(array $payload, ?string $origin = 'https://gameboxheroes.fr', string $type = 'application/json'): array
{
    $headers = ["Content-Type: $type", 'User-Agent: Test-Agent/1.0'];
    if ($origin !== null) {
        $headers[] = "Origin: $origin";
    }
    return web('POST', '/api/bug-report.php', json_encode($payload), $headers);
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

/** Attend qu'il y ait $count messages (le mail d'avis d'une inscription part après la réponse). */
function wait_inbox(int $count): array
{
    for ($i = 0; $i < 50 && count(inbox()) < $count; $i++) {
        usleep(100_000);
    }
    return inbox();
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

/** Les parties finales d'un message (multipart déplié). @return array[] */
function mime_parts(array $msg): array
{
    if (!preg_match('~^multipart/.*boundary="?([^";]+)"?~i', header_of($msg, 'content-type'), $m)) {
        return [$msg];
    }
    $parts = [];
    foreach (array_slice(explode('--' . $m[1], $msg['body']), 1) as $chunk) {
        if (str_starts_with($chunk, '--')) {
            break;
        }
        array_push($parts, ...mime_parts(parse_mail(ltrim($chunk, "\r\n"))));
    }
    return $parts;
}

function decoded(array $part): string
{
    return match (strtolower(header_of($part, 'content-transfer-encoding'))) {
        'quoted-printable' => quoted_printable_decode($part['body']),
        'base64' => (string) base64_decode(preg_replace('/\s+/', '', $part['body'])),
        default => $part['body'],
    };
}

function text_of(array $msg): string
{
    foreach (mime_parts($msg) as $part) {
        if (str_starts_with(strtolower(header_of($part, 'content-type')), 'text/plain')) {
            return str_replace("\r\n", "\n", decoded($part));
        }
    }
    return '';
}

/** La pièce jointe : ['name' => …, 'content' => …], ou null. */
function attachment_of(array $msg): ?array
{
    foreach (mime_parts($msg) as $part) {
        if (preg_match('~attachment;\s*filename="?([^";]+)"?~i', header_of($part, 'content-disposition'), $m)) {
            return ['name' => $m[1], 'type' => header_of($part, 'content-type'), 'content' => decoded($part)];
        }
    }
    return null;
}

function rate_rows(): array
{
    global $tmp;
    return (new PDO("sqlite:$tmp/private/data/signups.sqlite"))->query('SELECT ip_hash FROM rate_hits')->fetchAll(PDO::FETCH_COLUMN);
}

function reset_rate(): void
{
    global $tmp;
    (new PDO("sqlite:$tmp/private/data/signups.sqlite"))->exec('DELETE FROM rate_hits');
}

// ── Le rapport et son mail ──────────────────────────────────────────────────

echo "Rapport envoyé\n";

[$s, $b] = post_report(report());
check('rapport complet → 200 ok', $s === 200 && ($b['ok'] ?? false) === true, "statut $s " . json_encode($b));
$mails = wait_inbox(1);
check('un seul mail', count($mails) === 1, (string) count($mails));
$mail = $mails[0] ?? ['headers' => [], 'body' => ''];
$text = text_of($mail);
check('envoyé à « bug_report.to »', header_of($mail, 'x-sink-rcpt') === 'bugs@gameboxheroes.fr', header_of($mail, 'x-sink-rcpt'));
check('sujet « [Bug] titre »', mb_decode_mimeheader(header_of($mail, 'subject')) === '[Bug] Carte bloquée sur la table', mb_decode_mimeheader(header_of($mail, 'subject')));
check('« Répondre » écrit au joueur', str_contains(header_of($mail, 'reply-to'), 'joueur@example.com'), header_of($mail, 'reply-to'));
check('marqué automatique (pas de réponse d\'absence)', header_of($mail, 'auto-submitted') === 'auto-generated');
check('texte : titre et e-mail', str_contains($text, 'Titre    : Carte bloquée sur la table') && str_contains($text, 'E-mail   : joueur@example.com'), $text);
check('texte : description sur deux lignes', str_contains($text, "Elle ne se retourne plus.\nLigne 2 : après un double-clic."), $text);
check('texte : contexte, version et navigateur', str_contains($text, '- Partie : Spider-Man contre Rhino') && str_contains($text, '- Version : 0.2.1 · abc1234') && str_contains($text, '- Navigateur : Test-Agent/1.0'), $text);
check('texte : journal', str_contains($text, "08:15 ★ Mise en place\n08:16 Spider-Man pioche"), $text);
$attachment = attachment_of($mail);
check('partie jointe, nommée bug-report_mc-table_<date>_<heure>.json', (bool) preg_match('/^bug-report_mc-table_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/', $attachment['name'] ?? ''), json_encode($attachment['name'] ?? null));
check('… en JSON, intacte', str_starts_with($attachment['type'] ?? '', 'application/json') && ($attachment['content'] ?? '') === GAME, substr($attachment['content'] ?? '', 0, 80));
check('texte : comment rouvrir la partie', str_contains($text, "localStorage.setItem('mc-table-vue-v1'"), $text);

clear_inbox();
[$s] = post_report(report(['email' => '']));
$mail = wait_inbox(1)[0] ?? ['headers' => [], 'body' => ''];
check('sans e-mail → 200, « non donné », pas de « Répondre » au joueur', $s === 200 && str_contains(text_of($mail), 'E-mail   : non donné') && !str_contains(header_of($mail, 'reply-to'), 'joueur'), header_of($mail, 'reply-to'));

clear_inbox();
[$s] = post_report(report(['game' => '{pas du JSON']));
$mail = wait_inbox(1)[0] ?? ['headers' => [], 'body' => ''];
check('partie illisible → 200, envoyé sans pièce jointe, en le disant', $s === 200 && attachment_of($mail) === null && str_contains(text_of($mail), 'partie illisible'), text_of($mail));

clear_inbox();
[$s] = post_report(report(['game' => null]));
$mail = wait_inbox(1)[0] ?? ['headers' => [], 'body' => ''];
check('sans partie → 200, « aucune partie en cours »', $s === 200 && attachment_of($mail) === null && str_contains(text_of($mail), 'aucune partie en cours'));

clear_inbox();
[$s] = post_report(report(['title' => "Bug\u{0007}  étrange", 'description' => "Un\r\n\tdeux\n\n\n\ntrois", 'journal' => ['ok', 42, '']]));
$mail = wait_inbox(1)[0] ?? ['headers' => [], 'body' => ''];
$text = text_of($mail);
check('caractères de contrôle retirés, lignes vides en trop resserrées', $s === 200 && mb_decode_mimeheader(header_of($mail, 'subject')) === '[Bug] Bug étrange' && str_contains($text, "Un\n deux\n\ntrois"), $text);
check('journal : seules les lignes de texte', str_contains($text, "Journal (1 derniers messages") && !str_contains($text, "\n42\n"), $text);

// ── Refus ───────────────────────────────────────────────────────────────────

echo "Refus\n";
clear_inbox();

[$s, $b] = post_report(report(['title' => '   ']));
check('sans titre → 422 + erreur title', $s === 422 && isset($b['errors']['title']), json_encode($b));
[$s, $b] = post_report(report(['email' => 'pas-un-email']));
check('e-mail invalide → 422 + erreur email', $s === 422 && isset($b['errors']['email']), json_encode($b));
[$s, $b] = post_report(report(['website' => 'http://spam.example']));
check('champ piège rempli → faux succès 200', $s === 200 && ($b['ok'] ?? false) === true);
[$s, $b] = post_report(report(['elapsedMs' => 300]));
check('envoi trop rapide → 422', $s === 422, json_encode($b));
check('… et aucun de ces envois n\'a fait de mail', count(inbox()) === 0, (string) count(inbox()));

[$s] = post_report(report(), 'https://pirate.example');
check('mauvaise origine → 403', $s === 403);
[$s] = post_report(report(), null);
check('sans en-tête Origin → 403', $s === 403);
[$s, , $h] = web('GET', '/api/bug-report.php');
check('GET → 405 + Allow: POST', $s === 405 && ($h['allow'] ?? '') === 'POST');
[$s] = post_report(report(), $origin, 'application/x-www-form-urlencoded');
check('format non JSON → 415', $s === 415);
[$s] = web('POST', '/api/bug-report.php', '{"title": ', ["Origin: $origin", 'Content-Type: application/json']);
check('JSON cassé → 400', $s === 400);
[$s, $b] = post_report(report(['game' => str_repeat('x', 1_100_000)]));
check('corps > 1 Mo → 413', $s === 413, json_encode($b));
[$s, , $h] = post_report(report(['title' => '']));
check('en-têtes no-store et nosniff, réponse JSON', ($h['cache-control'] ?? '') === 'no-store' && ($h['x-content-type-options'] ?? '') === 'nosniff' && str_starts_with($h['content-type'] ?? '', 'application/json'));
check('… toujours aucun mail', count(inbox()) === 0);

// ── Réglages et pannes ──────────────────────────────────────────────────────

echo "Réglages et pannes\n";

reset_rate();
clear_inbox();
write_config(['bug_report' => ['rate_limit' => ['max' => 100, 'window' => 3600]]]);
[$s] = post_report(report());
check('sans « bug_report.to » → les adresses de « notify »', $s === 200 && header_of(wait_inbox(1)[0] ?? ['headers' => []], 'x-sink-rcpt') === 'contact@gameboxheroes.fr');

clear_inbox();
write_config(['mail' => ['transport' => 'smtp', 'host' => 'smtp.exemple.fr', 'port' => 587, 'from_email' => 'nouvelles@gameboxheroes.fr']]);
[$s, $b] = post_report(report());
check('bloc « mail » non rempli → 503, rien d\'envoyé', $s === 503 && ($b['ok'] ?? null) === false && count(inbox()) === 0, json_encode($b));

write_config(['mail' => [
    'transport' => 'smtp', 'host' => '127.0.0.1', 'port' => $deadPort, 'encryption' => '', 'username' => '', 'password' => '',
    'from_email' => 'nouvelles@gameboxheroes.fr', 'from_name' => 'Gamebox Hero', 'reply_to' => '', 'per_minute' => 6000, 'dkim' => null,
]]);
[$s, $b] = post_report(report());
check('SMTP injoignable → 502 JSON, sans détail interne', $s === 502 && ($b['ok'] ?? null) === false && !str_contains(json_encode($b), $tmp) && str_contains($b['message'] ?? '', 'messagerie'), json_encode($b));

rename("$tmp/private/config.php", "$tmp/private/config.off");
[$s, $b] = post_report(report());
check('config absente → 500 JSON générique', $s === 500 && ($b['ok'] ?? null) === false && !str_contains(json_encode($b), $tmp), json_encode($b));
rename("$tmp/private/config.off", "$tmp/private/config.php");

// ── Limite par connexion ────────────────────────────────────────────────────

echo "Limite par connexion\n";

write_config(['bug_report' => ['to' => 'bugs@gameboxheroes.fr', 'rate_limit' => ['max' => 3, 'window' => 3600]]]);
reset_rate();
clear_inbox();
$codes = [];
for ($i = 0; $i < 5; $i++) {
    [$s, , $h] = post_report(report(['title' => "Rapport $i"]));
    $codes[] = $s;
}
check('3 rapports acceptés, puis 429', $codes === [200, 200, 200, 429, 429], implode(',', $codes));
check('429 avec Retry-After', (int) ($h['retry-after'] ?? 0) > 0);
check('3 mails seulement', count(wait_inbox(3)) === 3, (string) count(inbox()));
check("l'IP n'est pas stockée en clair", array_filter(rate_rows(), fn ($row) => strlen($row) !== 64 || str_contains($row, '127.0.0.1')) === []);
[$s] = web('POST', '/api/signup.php', json_encode(['name' => 'Peter Parker', 'email' => 'peter@example.com', 'consent' => true, 'website' => '', 'elapsedMs' => 4000]),
    ["Origin: $origin", 'Content-Type: application/json']);
check("l'inscription garde son propre compteur", $s === 200, "statut $s");

echo PHP_EOL . "$passed réussi(s), $failed échec(s)" . PHP_EOL;
exit($failed ? 1 : 0);
