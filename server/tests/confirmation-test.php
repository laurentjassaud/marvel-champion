<?php
/**
 * Test de bout en bout du mail de confirmation : vraie page d'inscription, faux serveur SMTP, vraie page
 * de désinscription. Ne touche ni à ta base ni à ton SMTP.
 *
 *   php server/tests/confirmation-test.php
 */
declare(strict_types=1);

$root = dirname(__DIR__);
$smtpPort = 20000 + random_int(0, 499);
$webPort = 20500 + random_int(0, 499);
$deadPort = 18998;
$origin = 'https://gameboxheroes.fr';

// ── Environnement temporaire ────────────────────────────────────────────────

$tmp = sys_get_temp_dir() . '/gbh-confirmation-test-' . bin2hex(random_bytes(4));
mkdir("$tmp/private/bin", 0777, true);
mkdir("$tmp/private/templates");
mkdir("$tmp/inbox");
foreach (['lib.php', 'mail.php', 'templates/confirmation.html', 'bin/signups.php'] as $f) {
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
$procs[] = proc_open([PHP_BINARY, '-d', 'opcache.enable=0', '-S', "127.0.0.1:$webPort", '-t', "$root/public"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', "$tmp/web.log", 'w']], $p2, null, ['GAMEBOX_PRIVATE_DIR' => "$tmp/private", 'PHP_CLI_SERVER_WORKERS' => '6'] + getenv());
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

/** @return array{0: int, 1: string} */
function web(string $method, string $url, string $body = '', array $headers = []): array
{
    $ctx = stream_context_create(['http' => ['method' => $method, 'content' => $body, 'header' => implode("\r\n", $headers), 'ignore_errors' => true, 'timeout' => 15]]);
    $raw = (string) file_get_contents($url, false, $ctx);
    return [(int) explode(' ', $http_response_header[0])[1], $raw];
}

/** Une inscription par le formulaire, comme le ferait l'appli. @return array{0: int, 1: array} */
function signup(string $email, string $name = 'Peter Parker'): array
{
    global $webPort, $origin;
    [$status, $body] = web('POST', "http://127.0.0.1:$webPort/api/signup.php", json_encode([
        'name' => $name, 'email' => $email, 'consent' => true, 'website' => '', 'elapsedMs' => 4000, 'source' => 'marvel-champions',
    ]), ['Origin: ' . $origin, 'Content-Type: application/json']);
    return [$status, json_decode($body, true) ?? []];
}

function inbox(): array
{
    global $tmp;
    $files = glob("$tmp/inbox/*.eml");
    sort($files);
    return array_map(fn ($f) => parse_mail((string) file_get_contents($f)), $files);
}

/** Attend qu'il y ait $count messages (le mail part après la réponse). */
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

function part_of(array $msg, string $type): string
{
    $ctype = header_of($msg, 'content-type');
    if (preg_match('~^multipart/.*boundary="?([^";]+)"?~i', $ctype, $m)) {
        foreach (array_slice(explode('--' . $m[1], $msg['body']), 1) as $chunk) {
            if (str_starts_with($chunk, '--')) {
                break;
            }
            $found = part_of(parse_mail(ltrim($chunk, "\r\n")), $type);
            if ($found !== '') {
                return $found;
            }
        }
        return '';
    }
    if (strtolower(trim(explode(';', $ctype)[0])) !== $type) {
        return '';
    }
    return strtolower(header_of($msg, 'content-transfer-encoding')) === 'quoted-printable'
        ? quoted_printable_decode($msg['body']) : $msg['body'];
}

function sends(): array
{
    global $tmp;
    $pdo = new PDO("sqlite:$tmp/private/data/signups.sqlite");
    return $pdo->query("SELECT s.email, s.status, s.error FROM mailing_sends s JOIN mailings m ON m.id = s.mailing_id
        WHERE m.campaign = 'confirmation-inscription' ORDER BY s.email")->fetchAll(PDO::FETCH_ASSOC);
}

function admin(string ...$args): string
{
    global $tmp;
    return (string) shell_exec(implode(' ', array_map('escapeshellarg', [PHP_BINARY, "$tmp/private/bin/signups.php", ...$args])) . ' 2>&1');
}

// ── Nouvelle inscription ────────────────────────────────────────────────────

echo "Nouvelle inscription\n";

[$status, $json] = signup('peter@example.com', 'Peter Parker');
check('inscription : 200, ok', $status === 200 && ($json['ok'] ?? false) === true, "$status " . json_encode($json));
$mails = wait_inbox(1);
check('un mail de confirmation', count($mails) === 1, (string) count($mails));
$m = $mails[0] ?? ['headers' => [], 'body' => ''];
check('destinataire', header_of($m, 'x-sink-rcpt') === 'peter@example.com', header_of($m, 'x-sink-rcpt'));
check('sujet : le <title> du template', mb_decode_mimeheader(header_of($m, 'subject')) === 'Votre inscription à Marvel Champions Table');
check('expéditeur', str_contains(header_of($m, 'from'), 'nouvelles@gameboxheroes.fr'));
$unsub = header_of($m, 'list-unsubscribe');
check('List-Unsubscribe : lien signé vers la page de désinscription', (bool) preg_match('~^<http://127\.0\.0\.1:\d+/api/unsubscribe\.php\?u=1&t=[a-f0-9]{32}>$~', $unsub), $unsub);
check('List-Unsubscribe-Post (un clic)', header_of($m, 'list-unsubscribe-post') === 'List-Unsubscribe=One-Click');
$html = part_of($m, 'text/html');
check('HTML : prénom et adresse', str_contains($html, 'Bienvenue Peter !') && str_contains($html, 'peter@example.com'));
check('HTML : lien de désinscription', str_contains($html, 'href="' . htmlspecialchars(trim($unsub, '<>')) . '"'));
$text = part_of($m, 'text/plain');
check('texte : lien de désinscription', str_contains($text, 'Se désinscrire (' . trim($unsub, '<>') . ')'), $text);
check('suivi : envoi noté', sends() === [['email' => 'peter@example.com', 'status' => 'sent', 'error' => null]], json_encode(sends()));
check('suivi : visible dans « campagnes »', str_contains(admin('campagnes'), 'confirmation-inscription'), admin('campagnes'));

// ── Adresse déjà inscrite ───────────────────────────────────────────────────

echo "Adresse déjà inscrite\n";

[$status] = signup('PETER@example.com', 'Peter B. Parker');
check('réinscription : même réponse', $status === 200);
usleep(800_000);
check('réinscription : pas de second mail', count(inbox()) === 1, (string) count(inbox()));

// ── Échecs : refus du destinataire, SMTP en panne ───────────────────────────

echo "Échecs d'envoi\n";

[$status] = signup('refuse@example.com', 'Adresse Refusée');
check('destinataire refusé : inscription quand même enregistrée', $status === 200 && str_contains(admin('liste'), 'refuse@example.com'));
for ($i = 0; $i < 30 && count(sends()) < 2; $i++) {
    usleep(100_000);
}
$refused = array_values(array_filter(sends(), fn ($r) => $r['email'] === 'refuse@example.com'))[0] ?? [];
check('destinataire refusé : échec noté avec la raison', ($refused['status'] ?? '') === 'failed' && ($refused['error'] ?? '') !== '', json_encode($refused));
check('destinataire refusé : visible dans « echecs »', str_contains(admin('echecs', 'confirmation-inscription'), 'refuse@example.com'));

write_config(['mail' => ['transport' => 'smtp', 'host' => '127.0.0.1', 'port' => $deadPort, 'encryption' => '', 'username' => '', 'password' => '',
    'from_email' => 'nouvelles@gameboxheroes.fr', 'from_name' => 'Gamebox Hero', 'reply_to' => '', 'per_minute' => 30, 'dkim' => null]]);
$start = microtime(true);
[$status, $json] = signup('carol@example.com', 'Carol Danvers');
check('SMTP en panne : inscription quand même acceptée', $status === 200 && ($json['ok'] ?? false) === true, "$status");
for ($i = 0; $i < 30 && count(sends()) < 3; $i++) {
    usleep(100_000);
}
$carol = array_values(array_filter(sends(), fn ($r) => $r['email'] === 'carol@example.com'))[0] ?? [];
check('SMTP en panne : échec noté', ($carol['status'] ?? '') === 'failed', json_encode($carol));

// ── Réglages : pas de confirmation ──────────────────────────────────────────

echo "Réglages\n";

write_config(['confirmation' => false]);
signup('jennifer@example.com', 'Jennifer Walters');
usleep(800_000);
check("'confirmation' => false : aucun mail", count(inbox()) === 1 && !in_array('jennifer@example.com', array_column(sends(), 'email'), true));

write_config(['mail' => ['transport' => 'smtp', 'host' => 'smtp.exemple.fr', 'port' => 587, 'encryption' => 'tls', 'username' => '', 'password' => '',
    'from_email' => 'nouvelles@gameboxheroes.fr', 'from_name' => 'Gamebox Hero', 'reply_to' => '', 'per_minute' => 30, 'dkim' => null]]);
$start = microtime(true);
[$status] = signup('wanda@example.com', 'Wanda Maximoff');
check("bloc « mail » de l'exemple : inscription sans mail ni échec", $status === 200 && microtime(true) - $start < 2
    && !in_array('wanda@example.com', array_column(sends(), 'email'), true));

$config = require "$tmp/private/config.php";
unset($config['mail']);
file_put_contents("$tmp/private/config.php", '<?php return ' . var_export($config, true) . ';');
[$status] = signup('stephen@example.com', 'Stephen Strange');
check('sans bloc « mail » : inscription sans mail', $status === 200 && !in_array('stephen@example.com', array_column(sends(), 'email'), true));

// ── Désinscription depuis le mail ───────────────────────────────────────────

echo "Désinscription\n";

write_config();
[$status, $body] = web('GET', trim($unsub, '<>'));
check('lien du mail : page de confirmation, sans désinscrire', $status === 200 && str_contains(admin('liste'), 'peter@example.com'));
[$status, $body] = web('POST', trim($unsub, '<>'), 'List-Unsubscribe=One-Click', ['Content-Type: application/x-www-form-urlencoded']);
check('un clic (List-Unsubscribe-Post) : désinscrit', $status === 200 && !str_contains(admin('liste'), 'peter@example.com'), "$status");
check('désinscrit : historique des envois effacé', !in_array('peter@example.com', array_column(sends(), 'email'), true));

[$status] = signup('peter@example.com', 'Peter Parker');
check('réinscription après désinscription : nouveau mail de confirmation', $status === 200 && count(wait_inbox(2)) === 2, (string) count(inbox()));

// ── Envois simultanés de la même adresse ────────────────────────────────────

echo "Envois simultanés\n";

// Deux onglets, un double envoi, un robot : plusieurs requêtes pour la même adresse au même moment, traitées
// en parallèle par le serveur (PHP_CLI_SERVER_WORKERS). Une seule doit compter comme nouvelle inscription.
$body = json_encode(['name' => 'Miles Morales', 'email' => 'miles@example.com', 'consent' => true, 'website' => '', 'elapsedMs' => 4000, 'source' => 'marvel-champions']);
$request = "POST /api/signup.php HTTP/1.1\r\nHost: 127.0.0.1:$webPort\r\nOrigin: $origin\r\nContent-Type: application/json\r\n"
    . 'Content-Length: ' . strlen($body) . "\r\nConnection: close\r\n\r\n$body";
$sockets = [];
for ($i = 0; $i < 6; $i++) {
    $sockets[] = stream_socket_client("tcp://127.0.0.1:$webPort", $errno, $errstr, 5);
}
foreach ($sockets as $s) {
    fwrite($s, $request);
}
$codes = [];
foreach ($sockets as $s) {
    $codes[] = (int) (explode(' ', (string) fgets($s))[1] ?? 0);
    fclose($s);
}
check('6 envois simultanés : tous acceptés', $codes === array_fill(0, 6, 200), json_encode($codes));
wait_inbox(3);
usleep(1_500_000);
$toMiles = array_filter(inbox(), fn ($m) => header_of($m, 'x-sink-rcpt') === 'miles@example.com');
check('6 envois simultanés : un seul mail de confirmation', count($toMiles) === 1, (string) count($toMiles));
check('6 envois simultanés : une seule inscription', substr_count(admin('liste'), 'miles@example.com') === 1, admin('liste'));

// ── Avis de nouvelle inscription (réglage « notify ») ───────────────────────

echo "Avis au propriétaire du site\n";

/** Les messages arrivés pour ce destinataire. */
function mails_to(string $rcpt): array
{
    return array_values(array_filter(inbox(), fn ($m) => header_of($m, 'x-sink-rcpt') === $rcpt));
}

write_config(['notify' => 'contact@gameboxheroes.fr']);
$before = count(inbox());
[$status] = signup('natasha@example.com', 'Natasha Romanoff');
wait_inbox($before + 2);
$notices = mails_to('contact@gameboxheroes.fr');
check('nouvelle inscription : confirmation à l\'inscrite et avis au propriétaire', $status === 200 && count(mails_to('natasha@example.com')) === 1 && count($notices) === 1, count(inbox()) - $before . ' mail(s)');
$n = $notices[0] ?? ['headers' => [], 'body' => ''];
$nText = part_of($n, 'text/plain');
check('avis : sujet avec le nom et l\'adresse', mb_decode_mimeheader(header_of($n, 'subject')) === 'Nouvelle inscription : Natasha Romanoff (natasha@example.com)', mb_decode_mimeheader(header_of($n, 'subject')));
check('avis : « Répondre » écrit à l\'inscrite', str_contains(header_of($n, 'reply-to'), 'natasha@example.com'), header_of($n, 'reply-to'));
check('avis : pas de réponse automatique', header_of($n, 'auto-submitted') === 'auto-generated');
check('avis : nom, adresse, source, heure de Paris', str_contains($nText, 'Natasha Romanoff') && str_contains($nText, 'E-mail  : natasha@example.com')
    && str_contains($nText, 'Source  : marvel-champions') && str_contains($nText, '(heure de Paris)'), $nText);
check('avis : confirmation envoyée', str_contains($nText, 'Mail de confirmation : envoyé'), $nText);
check('avis : nombre d\'inscrits', (bool) preg_match('/Inscrits en tout : \d+/', $nText), $nText);
check('avis : pas de lien de désinscription (il n\'est pas pour un inscrit)', header_of($n, 'list-unsubscribe') === '' && !str_contains($nText, 'unsubscribe.php'));

$before = count(inbox());
signup('natasha@example.com', 'Natasha A. Romanoff');
usleep(800_000);
check('réinscription : ni confirmation ni avis', count(inbox()) === $before, (string) (count(inbox()) - $before));

write_config(['notify' => 'contact@gameboxheroes.fr', 'confirmation' => false]);
$before = count(inbox());
signup('bruce@example.com', 'Bruce Banner');
wait_inbox($before + 1);
usleep(500_000);
$bruce = array_values(array_filter(mails_to('contact@gameboxheroes.fr'), fn ($m) => str_contains(part_of($m, 'text/plain'), 'bruce@example.com')));
check('confirmation désactivée : avis quand même, qui le dit', count(inbox()) === $before + 1 && count($bruce) === 1
    && str_contains(part_of($bruce[0], 'text/plain'), 'Mail de confirmation : pas envoyé'), (string) (count(inbox()) - $before));

write_config(['notify' => 'contact@gameboxheroes.fr']);
$before = count(inbox());
signup('refuse-thor@example.com', 'Thor Odinson');
wait_inbox($before + 1);
usleep(500_000);
$thor = array_values(array_filter(mails_to('contact@gameboxheroes.fr'), fn ($m) => str_contains(part_of($m, 'text/plain'), 'refuse-thor@example.com')));
check('confirmation refusée : l\'avis signale l\'échec', count($thor) === 1 && str_contains(part_of($thor[0], 'text/plain'), 'Mail de confirmation : ÉCHEC'), $thor ? part_of($thor[0], 'text/plain') : 'aucun avis');

write_config(['notify' => ['contact@gameboxheroes.fr', 'pas-une-adresse', 'laurent@gameboxheroes.fr']]);
$before = count(inbox());
signup('wade@example.com', 'Wade Wilson');
wait_inbox($before + 2);
usleep(500_000);
$wade = array_values(array_filter(inbox(), fn ($m) => str_contains(mb_decode_mimeheader(header_of($m, 'subject')), 'wade@example.com')));
check('liste d\'adresses : un avis à chacune, adresse invalide ignorée', count($wade) === 1
    && header_of($wade[0], 'x-sink-rcpt') === 'contact@gameboxheroes.fr,laurent@gameboxheroes.fr', $wade ? header_of($wade[0], 'x-sink-rcpt') : 'aucun avis');

write_config(['notify' => '']);
$before = count(inbox());
signup('logan@example.com', 'Logan Howlett');
wait_inbox($before + 1);
usleep(500_000);
check("'notify' => '' : confirmation seule", count(inbox()) === $before + 1 && count(mails_to('logan@example.com')) === 1, (string) (count(inbox()) - $before));

echo PHP_EOL . "$passed réussi(s), $failed échec(s)" . PHP_EOL;
exit($failed ? 1 : 0);
