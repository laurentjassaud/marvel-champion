<?php
/**
 * Test de bout en bout du script d'inscription, sans dépendance :
 * lance un serveur PHP local sur une copie temporaire, envoie de vraies requêtes HTTP,
 * vérifie la base puis l'outil en ligne de commande.
 *
 *   php server/tests/api-test.php
 */
declare(strict_types=1);

$root = dirname(__DIR__);
$port = 18000 + random_int(0, 999);
$base = "http://127.0.0.1:$port/api/signup.php";
$origin = 'https://gameboxheroes.fr';

// Copie temporaire du dossier privé avec une configuration de test.
$tmp = sys_get_temp_dir() . '/gbh-signup-test-' . bin2hex(random_bytes(4));
mkdir("$tmp/bin", 0777, true);
copy("$root/private/lib.php", "$tmp/lib.php");
copy("$root/private/bin/signups.php", "$tmp/bin/signups.php");
file_put_contents("$tmp/config.php", '<?php return ' . var_export([
    'db_path' => "$tmp/data/signups.sqlite",
    'allowed_origins' => [$origin],
    'allowed_sources' => ['marvel-champions', 'gamebox-hero'],
    'default_source' => 'marvel-champions',
    'ip_salt' => 'sel-de-test',
    'rate_limit' => ['max' => 20, 'window' => 3600],
    'min_elapsed_ms' => 1500,
    'check_mx' => false,
], true) . ';');

$server = proc_open(
    [PHP_BINARY, '-d', 'opcache.enable=0', '-S', "127.0.0.1:$port", '-t', "$root/public"],
    [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
    $pipes,
    null,
    ['GAMEBOX_PRIVATE_DIR' => $tmp] + getenv(),
);
register_shutdown_function(function () use ($server, $tmp) {
    proc_terminate($server);
    exec('rm -rf ' . escapeshellarg($tmp));
});
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $port); $i++) {
    usleep(100_000);
}

$passed = 0;
$failed = 0;
function check(string $label, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    $ok ? $passed++ : $failed++;
    echo ($ok ? "  ok   " : "  ÉCHEC ") . $label . ($ok || $detail === '' ? '' : " — $detail") . PHP_EOL;
}

/** @return array{0: int, 1: ?array, 2: array<string,string>} [statut, corps JSON, en-têtes] */
function http(string $method, string $url, ?string $body = null, array $headers = []): array
{
    $ctx = stream_context_create(['http' => [
        'method' => $method,
        'header' => implode("\r\n", $headers),
        'content' => $body ?? '',
        'ignore_errors' => true,
        'timeout' => 5,
    ]]);
    $raw = file_get_contents($url, false, $ctx);
    $status = (int) explode(' ', $http_response_header[0])[1];
    $hdrs = [];
    foreach (array_slice($http_response_header, 1) as $h) {
        [$k, $v] = array_map('trim', explode(':', $h, 2)) + [1 => ''];
        $hdrs[strtolower($k)] = $v;
    }
    return [$status, json_decode((string) $raw, true), $hdrs];
}

function post(array $payload, array $extraHeaders = [], ?string $origin = 'https://gameboxheroes.fr'): array
{
    global $base;
    $headers = ['Content-Type: application/json'];
    if ($origin !== null) {
        $headers[] = "Origin: $origin";
    }
    return http('POST', $base, json_encode($payload), array_merge($headers, $extraHeaders));
}

function valid(array $override = []): array
{
    return $override + ['name' => 'Peter Parker', 'email' => 'peter@example.com', 'consent' => true, 'website' => '', 'elapsedMs' => 4200, 'source' => 'marvel-champions'];
}

function rows(): array
{
    global $tmp;
    $pdo = new PDO("sqlite:$tmp/data/signups.sqlite");
    return $pdo->query('SELECT email, name, source FROM signups ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
}

function resetRate(): void
{
    global $tmp;
    (new PDO("sqlite:$tmp/data/signups.sqlite"))->exec('DELETE FROM rate_hits');
}

echo "API\n";

[$s, $b] = post(valid());
check('inscription valide → 200 ok', $s === 200 && ($b['ok'] ?? false) === true, "statut $s " . json_encode($b));
check('ligne enregistrée en base', rows() === [['email' => 'peter@example.com', 'name' => 'Peter Parker', 'source' => 'marvel-champions']], json_encode(rows()));

[$s, $b] = post(valid(['name' => '  Peter   B.  Parker ', 'email' => '  PETER@Example.COM ']));
check('même e-mail en majuscules → 200, pas de doublon', $s === 200 && count(rows()) === 1, json_encode(rows()));
check('nom mis à jour et nettoyé', rows()[0]['name'] === 'Peter B. Parker', rows()[0]['name']);

[$s, $b] = post(valid(['email' => 'carol@example.com', 'name' => 'Carol Danvers', 'source' => 'inconnue']));
check('source inconnue → source par défaut', $s === 200 && rows()[1]['source'] === 'marvel-champions', json_encode(rows()));

[$s, $b] = post(valid(['email' => 'jennifer@example.com', 'name' => 'Jennifer Walters', 'source' => 'gamebox-hero']));
check('source autorisée conservée', $s === 200 && rows()[2]['source'] === 'gamebox-hero');

[$s, $b] = post(valid(['email' => 'pas-un-email']));
check('e-mail invalide → 422 + erreur email', $s === 422 && isset($b['errors']['email']), json_encode($b));

[$s, $b] = post(valid(['name' => '   ']));
check('nom vide → 422 + erreur name', $s === 422 && isset($b['errors']['name']), json_encode($b));

[$s, $b] = post(valid(['name' => str_repeat('a', 81)]));
check('nom de 81 caractères → 422', $s === 422 && isset($b['errors']['name']));

[$s, $b] = post(valid(['name' => 'Gagnez https://spam.example']));
check('lien dans le nom → 422', $s === 422 && isset($b['errors']['name']));

[$s, $b] = post(valid(['name' => 'Élodie Ç’est-à-dire Ñúñez', 'email' => 'elodie@example.com']));
check('nom accentué accepté', $s === 200, json_encode($b));

[$s, $b] = post(valid(['consent' => false]));
check('sans consentement → 422 + erreur consent', $s === 422 && isset($b['errors']['consent']));

[$s, $b] = post(valid(['consent' => 'true']));
check('consentement "true" (chaîne) refusé', $s === 422 && isset($b['errors']['consent']));

$before = count(rows());
[$s, $b] = post(valid(['email' => 'robot@example.com', 'website' => 'http://spam.example']));
check('champ piège rempli → faux succès 200', $s === 200 && ($b['ok'] ?? false) === true);
check('… et rien enregistré', count(rows()) === $before);

[$s, $b] = post(valid(['email' => 'rapide@example.com', 'elapsedMs' => 300]));
check('envoi trop rapide → 422', $s === 422 && count(rows()) === $before, json_encode($b));

[$s, $b] = post(valid(['email' => 'sansduree@example.com', 'elapsedMs' => null]));
check('durée absente → 422', $s === 422);

[$s] = post(valid(), [], 'https://pirate.example');
check('mauvaise origine → 403', $s === 403);

[$s] = post(valid(), [], null);
check('sans en-tête Origin → 403', $s === 403);

[$s, , $h] = http('GET', $base);
check('GET → 405 + Allow: POST', $s === 405 && ($h['allow'] ?? '') === 'POST');

[$s] = http('POST', $base, http_build_query(valid()), ["Origin: $origin", 'Content-Type: application/x-www-form-urlencoded']);
check('formulaire non JSON → 415', $s === 415);

[$s] = http('POST', $base, '{"name": ', ["Origin: $origin", 'Content-Type: application/json']);
check('JSON cassé → 400', $s === 400);

[$s] = http('POST', $base, '"juste une chaîne"', ["Origin: $origin", 'Content-Type: application/json']);
check('JSON non objet → 400', $s === 400);

[$s] = http('POST', $base, json_encode(valid(['name' => str_repeat('x', 5000)])), ["Origin: $origin", 'Content-Type: application/json']);
check('corps > 4 Ko → 413', $s === 413);

[$s, , $h] = post(valid());
check('en-têtes no-store et nosniff', ($h['cache-control'] ?? '') === 'no-store' && ($h['x-content-type-options'] ?? '') === 'nosniff');
check('réponse en JSON UTF-8', str_starts_with($h['content-type'] ?? '', 'application/json'));

resetRate();
$codes = [];
for ($i = 0; $i < 22; $i++) {
    [$s, , $h] = post(valid(['email' => "flood$i@example.com"]));
    $codes[] = $s;
}
check('limite par IP : 20 acceptés puis 429', count(array_filter($codes, fn ($c) => $c === 200)) === 20 && $codes[20] === 429 && $codes[21] === 429, implode(',', $codes));
check('429 avec Retry-After', (int) ($h['retry-after'] ?? 0) > 0);

$pdo = new PDO("sqlite:$tmp/data/signups.sqlite");
$ipCol = $pdo->query("SELECT ip_hash FROM rate_hits LIMIT 1")->fetchColumn();
check("l'IP n'est pas stockée en clair", is_string($ipCol) && strlen($ipCol) === 64 && !str_contains($ipCol, '127.0.0.1'));

// Mauvaise configuration : le visiteur reçoit un message propre, pas une erreur PHP.
rename("$tmp/config.php", "$tmp/config.off");
[$s, $b] = post(valid());
check('config absente → 500 JSON générique', $s === 500 && ($b['ok'] ?? null) === false && !str_contains(json_encode($b), $tmp), json_encode($b));
rename("$tmp/config.off", "$tmp/config.php");

echo "Ligne de commande\n";

$cli = fn (string ...$a) => shell_exec(implode(' ', array_map('escapeshellarg', [PHP_BINARY, "$tmp/bin/signups.php", ...$a])) . ' 2>&1') ?? '';

$out = $cli('compte');
check('compte', (bool) preg_match('/total\s+24/', $out), $out);

$out = $cli('liste', '--source=gamebox-hero');
check('liste filtrée par source', str_contains($out, 'jennifer@example.com') && !str_contains($out, 'peter@example.com') && str_contains($out, '1 inscription(s)'), $out);

$pdo->exec("UPDATE signups SET name = '=HYPERLINK(1)' WHERE email = 'carol@example.com'");
$csvFile = "$tmp/export.csv";
$out = $cli('export', $csvFile);
$csv = (string) file_get_contents($csvFile);
check('export CSV avec BOM et en-tête', str_starts_with($csv, "\xEF\xBB\xBFnom;email;source;consentement;inscription;mise_a_jour"), substr($csv, 0, 80));
check('export : 24 lignes + en-tête', count(array_filter(explode("\n", $csv))) === 25);
check('export : formule neutralisée', str_contains($csv, "'=HYPERLINK(1)"));
check('export : accents intacts', str_contains($csv, 'Élodie Ç’est-à-dire Ñúñez'));

$out = $cli('supprimer', 'PETER@example.com');
check('supprimer (insensible à la casse)', str_contains($out, 'supprimée') && !in_array('peter@example.com', array_column(rows(), 'email'), true), $out);

$out = $cli('supprimer', 'personne@example.com');
check('supprimer une adresse absente', str_contains($out, "n'est pas inscrite"), $out);

$out = $cli('inconnue');
check('commande inconnue signalée', str_contains($out, 'Commande inconnue'), $out);

echo PHP_EOL . "$passed réussi(s), $failed échec(s)" . PHP_EOL;
exit($failed ? 1 : 0);
