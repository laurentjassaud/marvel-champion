<?php
/**
 * Test de bout en bout du relais MC4DB (public/api/mc4db.php) : vraie page, faux MC4DB (mc4db-fake.php). Vérifie
 * les cinq demandes et les adresses demandées à MC4DB, les images, le cache (une seule demande, puis plus rien ;
 * l'ancienne réponse quand MC4DB tombe), le ménagement de MC4DB (demandes espacées, « 429 » retenté une fois),
 * les refus (demande inconnue, valeurs piégées, méthode), les erreurs de MC4DB et la limite par connexion. Ne
 * contacte jamais le vrai MC4DB, ne touche pas à ta base.
 *
 *   php server/tests/mc4db-test.php
 */
declare(strict_types=1);

$root = dirname(__DIR__);
$fakePort = 22000 + random_int(0, 499);
$webPort = 22500 + random_int(0, 499);

// ── Environnement temporaire ────────────────────────────────────────────────

$tmp = sys_get_temp_dir() . '/gbh-mc4db-test-' . bin2hex(random_bytes(4));
mkdir("$tmp/private", 0777, true);
mkdir("$tmp/fake");
foreach (['lib.php', 'mc4db.php'] as $f) {
    copy("$root/private/$f", "$tmp/private/$f");
}
$site = "http://127.0.0.1:$fakePort";

/** @param array<string, mixed> $override */
function write_config(array $override = []): void
{
    global $tmp, $site;
    file_put_contents("$tmp/private/config.php", '<?php return ' . var_export(array_replace([
        'db_path' => "$tmp/private/data/signups.sqlite",
        'allowed_origins' => ['https://gameboxheroes.fr'],
        'ip_salt' => 'sel-de-test',
        'rate_limit' => ['max' => 100, 'window' => 3600],
        'mc4db' => ['site' => $site, 'rate_limit' => ['max' => 100, 'window' => 3600]],
    ], $override), true) . ';');
}
write_config();

/**
 * Ce que le faux MC4DB répond : chemin et requête → [statut, corps] (JSON), ou une réponse complète
 * (['base64' => …, 'type' => …], ['sequence' => [...]] : mc4db-fake.php).
 */
function fake_routes(array $routes): void
{
    global $tmp;
    $json = [];
    foreach ($routes as $path => $route) {
        $json[$path] = array_is_list($route) ? ['status' => $route[0], 'body' => $route[1]] : $route;
    }
    file_put_contents("$tmp/fake/routes.json", json_encode($json, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

const DECK_58 = '{"id":58,"name":"Mystique","hero_code":"70301a","slots":{"70302":1,"01088":1}}';
const CARD = '{"code":"70302","name":"Métamorphose","pack_code":"mystique_by_merlin"}';
const PACK = '[{"code":"70301a","name":"Mystique"},{"code":"70310","name":"Obligation"}]';
const DECKS = '{"ok":true,"data":[{"id":321,"name":"Venompool Deck"}],"meta":{"total_items":1}}';
// une petite image WebP (son en-tête : RIFF, taille, WEBP), comme celles de MC4DB
define('WEBP', 'RIFF' . pack('V', 24) . 'WEBPVP8 ' . random_bytes(16));
$image = fn (string $bytes, string $type = 'image/webp') => ['status' => 200, 'base64' => base64_encode($bytes), 'type' => $type];
fake_routes([
    '/api/public/decklist/58.json' => [200, DECK_58],
    '/api/public/card/70302.json?locale=fr' => [200, CARD],
    '/api/public/cards/mystique_by_merlin.json?locale=fr' => [200, PACK],
    '/api/public/decks?page=1&limit=100&author=M%C3%A9rlin+D' => [200, DECKS],
    '/bundles/cards/EN/mystique_by_merlin/70302.webp' => $image(WEBP),
    '/bundles/cards/EN/mystique_by_merlin/70303.webp' => $image('<html>Page</html>', 'text/html'),
    '/api/public/decklist/999.json' => [404, '{"error":"Decklist not found"}'],
    '/api/public/decklist/500.json' => [500, '{"error":"boom"}'],
    '/api/public/decklist/501.json' => [200, 'pas du JSON'],
    '/api/public/decklist/502.json' => [200, '[' . str_repeat('1,', 2_100_000) . '1]'],
    // MC4DB qui demande de ralentir : une fois (la deuxième tentative passe), puis deux fois
    '/api/public/card/70400.json?locale=fr' => ['sequence' => [['status' => 429, 'body' => '{}', 'retry_after' => 1], ['status' => 200, 'body' => CARD]]],
    '/api/public/card/70401.json?locale=fr' => ['sequence' => [['status' => 429, 'body' => '{}', 'retry_after' => 1]]],
]);

$procs = [];
$procs[] = proc_open([PHP_BINARY, '-S', "127.0.0.1:$fakePort", __DIR__ . '/mc4db-fake.php'], [1 => ['file', '/dev/null', 'w'], 2 => ['file', "$tmp/fake.log", 'w']], $p1, null, ['FAKE_DIR' => "$tmp/fake"] + getenv());
$procs[] = proc_open([PHP_BINARY, '-d', 'opcache.enable=0', '-S', "127.0.0.1:$webPort", '-t', "$root/public"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', "$tmp/web.log", 'w']], $p2, null, ['GAMEBOX_PRIVATE_DIR' => "$tmp/private", 'PHP_CLI_SERVER_WORKERS' => '4'] + getenv());
register_shutdown_function(function () use (&$procs, $tmp) {
    foreach ($procs as $p) {
        proc_terminate($p);
    }
    exec('rm -rf ' . escapeshellarg($tmp));
});
foreach ([$fakePort, $webPort] as $port) {
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

/** @return array{0: int, 1: string, 2: array<string, string>} [statut, corps, en-têtes] */
function relay(string $query, string $method = 'GET'): array
{
    global $webPort;
    $ctx = stream_context_create(['http' => ['method' => $method, 'ignore_errors' => true, 'timeout' => 30]]);
    $body = (string) file_get_contents("http://127.0.0.1:$webPort/api/mc4db.php" . ($query === '' ? '' : "?$query"), false, $ctx);
    $headers = [];
    foreach (array_slice($http_response_header, 1) as $h) {
        [$k, $v] = array_map('trim', explode(':', $h, 2)) + [1 => ''];
        $headers[strtolower($k)] = $v;
    }
    return [(int) explode(' ', $http_response_header[0])[1], $body, $headers];
}

/** Les demandes reçues par le faux MC4DB : [chemin, User-Agent, heure][]. */
function requests(): array
{
    global $tmp;
    $lines = array_filter(explode("\n", (string) @file_get_contents("$tmp/fake/requests.log")));
    return array_map(fn ($line) => explode("\t", $line, 3) + [1 => '', 2 => '0'], array_values($lines));
}

/** Les demandes reçues pour ce chemin. */
function requests_to(string $path): array
{
    return array_values(array_filter(requests(), fn ($request) => $request[0] === $path));
}

/** La dernière demande reçue par le faux MC4DB. */
function last_request(): array
{
    $all = requests();
    return $all ? $all[count($all) - 1] : ['', '', '0'];
}

function message(string $body): string
{
    return (string) (json_decode($body, true)['message'] ?? '');
}

function reset_rate(): void
{
    global $tmp;
    (new PDO("sqlite:$tmp/private/data/signups.sqlite"))->exec('DELETE FROM rate_hits');
}

// ── Les cinq demandes ───────────────────────────────────────────────────────

echo "Demandes\n";

[$s, $b, $h] = relay('decklist=58');
check('decklist → 200, le JSON de MC4DB tel quel', $s === 200 && $b === DECK_58, "statut $s $b");
check('… demandé à MC4DB à la bonne adresse, avec le nom de l\'appli', array_slice(requests()[0] ?? [], 0, 2) === ['/api/public/decklist/58.json', 'MarvelChampionsTable (gameboxheroes.fr)'], json_encode(requests()));
check('… X-Cache MISS, gardé 5 min par le navigateur', ($h['x-cache'] ?? '') === 'MISS' && ($h['cache-control'] ?? '') === 'public, max-age=300', json_encode($h));
check('… en JSON, sans autorisation pour d\'autres sites', str_starts_with($h['content-type'] ?? '', 'application/json') && !isset($h['access-control-allow-origin']) && ($h['x-content-type-options'] ?? '') === 'nosniff');

[$s, $b, $h] = relay('decklist=58');
check('la même decklist → servie par le cache, MC4DB n\'est pas redemandé', $s === 200 && $b === DECK_58 && ($h['x-cache'] ?? '') === 'HIT' && count(requests()) === 1, ($h['x-cache'] ?? '') . ' ' . count(requests()));

[$s, $b, $h] = relay('card=70302');
check('carte → en français (locale=fr), gardée un jour', $s === 200 && $b === CARD && last_request()[0] === '/api/public/card/70302.json?locale=fr' && ($h['cache-control'] ?? '') === 'public, max-age=86400', json_encode(last_request()));

[$s, $b] = relay('pack=mystique_by_merlin');
check('cartes d\'une boîte → en français', $s === 200 && $b === PACK && last_request()[0] === '/api/public/cards/mystique_by_merlin.json?locale=fr', json_encode(last_request()));

[$s, $b, $h] = relay('author=' . rawurlencode('Mérlin D'));
check('decks d\'un auteur (accent, espace) → les decks publics, gardés 10 min', $s === 200 && $b === DECKS && last_request()[0] === '/api/public/decks?page=1&limit=100&author=M%C3%A9rlin+D' && ($h['cache-control'] ?? '') === 'public, max-age=600', json_encode(last_request()));

[$s, $b, $h] = relay('image=mystique_by_merlin/70302');
check('image → l\'image anglaise de MC4DB, intacte, en image/webp', $s === 200 && $b === WEBP && ($h['content-type'] ?? '') === 'image/webp' && last_request()[0] === '/bundles/cards/EN/mystique_by_merlin/70302.webp', ($h['content-type'] ?? '') . ' ' . json_encode(last_request()));
check('… gardée un mois', ($h['cache-control'] ?? '') === 'public, max-age=2592000' && ($h['x-cache'] ?? '') === 'MISS');
$before = count(requests());
[$s, $b, $h] = relay('image=mystique_by_merlin/70302');
check('la même image → servie par le cache', $s === 200 && $b === WEBP && ($h['x-cache'] ?? '') === 'HIT' && ($h['content-type'] ?? '') === 'image/webp' && count(requests()) === $before);
[$s] = relay('image=mystique_by_merlin/70303');
check('une « image » qui n\'en est pas une (page HTML) → 502', $s === 502, "statut $s");

// ── Ménager MC4DB ───────────────────────────────────────────────────────────

echo "Ménager MC4DB\n";

[$s, $b, $h] = relay('card=70400');
$tries = requests_to('/api/public/card/70400.json?locale=fr');
check('« 429 » une fois → retenté, et la carte arrive', $s === 200 && $b === CARD && count($tries) === 2, "statut $s, " . count($tries) . ' demande(s)');
check('… après avoir attendu (Retry-After : 1 s)', count($tries) === 2 && (float) $tries[1][2] - (float) $tries[0][2] >= 0.95, json_encode($tries));
[$s, $b, $h] = relay('card=70401');
check('« 429 » deux fois → 503 « ralentir », avec Retry-After, sans plus insister', $s === 503 && str_contains(message($b), 'ralentir') && (int) ($h['retry-after'] ?? 0) > 0 && count(requests_to('/api/public/card/70401.json?locale=fr')) === 2, "statut $s $b");
// deux demandes envoyées coup sur coup : MC4DB les reçoit espacées
$first = relay('card=70500');
$second = relay('card=70501');
$a = requests_to('/api/public/card/70500.json?locale=fr')[0][2] ?? '0';
$z = requests_to('/api/public/card/70501.json?locale=fr')[0][2] ?? '0';
check('deux demandes coup sur coup → espacées d\'au moins 0,25 s chez MC4DB', (float) $z - (float) $a >= 0.24, sprintf('%.3f s', (float) $z - (float) $a));

// ── Refus ───────────────────────────────────────────────────────────────────

echo "Refus\n";
$before = count(requests());

$refused = [
    '' => 'aucune demande',
    'user=1' => 'une page de compte',
    'url=' . rawurlencode('https://example.com/') => 'une adresse libre',
    'decklist=abc' => 'decklist non numérique',
    'decklist=1e3' => 'decklist « 1e3 »',
    'card=' . rawurlencode('../user/1') => 'carte « ../user/1 »',
    'card=' . rawurlencode('70302.json?x=1') => 'carte avec une requête',
    'pack=' . rawurlencode('Core Set') => 'boîte avec majuscules et espace',
    'pack=' . rawurlencode('../../user') => 'boîte « ../../user »',
    'author=' . rawurlencode(str_repeat('a', 41)) => 'auteur de 41 caractères',
    'author=' . rawurlencode('a&limit=99999') => 'auteur qui ajoute un paramètre',
    'image=' . rawurlencode('../../api/public/user/1') => 'image « ../../api/public/user/1 »',
    'image=' . rawurlencode('mystique_by_merlin/../../x') => 'image qui remonte les dossiers',
    'image=' . rawurlencode('Mystique/70302') => 'image avec une majuscule',
    'decklist[]=58' => 'decklist en tableau',
];
foreach ($refused as $query => $label) {
    [$s, $b, $h] = relay($query);
    check("$label → 400", $s === 400 && ($h['cache-control'] ?? '') === 'no-store' && message($b) !== '', "statut $s $b");
}
check('… et rien n\'a été demandé à MC4DB', count(requests()) === $before, (string) (count(requests()) - $before));

[$s, , $h] = relay('decklist=58', 'POST');
check('POST → 405 + Allow: GET', $s === 405 && ($h['allow'] ?? '') === 'GET');

// ── Réponses de MC4DB ───────────────────────────────────────────────────────

echo "Réponses de MC4DB\n";

[$s, $b] = relay('decklist=999');
check('deck inconnu de MC4DB → 404 « Introuvable »', $s === 404 && message($b) === 'Introuvable sur MC4DB.', "statut $s $b");
[$s, $b] = relay('decklist=500');
check('MC4DB en erreur, rien en cache → 502', $s === 502 && str_contains(message($b), 'MC4DB ne répond pas'), "statut $s $b");
[$s] = relay('decklist=501');
check('réponse qui n\'est pas du JSON → 502', $s === 502, "statut $s");
[$s] = relay('decklist=502');
check('réponse de plus de 4 Mo → 502', $s === 502, "statut $s");

// la decklist 58, gardée il y a longtemps, et MC4DB qui tombe : l'ancienne réponse sert encore
$cacheFile = "$tmp/private/data/mc4db-cache/" . sha1("$site/api/public/decklist/58.json") . '.cache';
touch($cacheFile, time() - 3600);
fake_routes(['/api/public/decklist/58.json' => [500, '{"error":"boom"}']]);
[$s, $b, $h] = relay('decklist=58');
check('cache périmé et MC4DB en panne → l\'ancienne réponse (X-Cache STALE)', $s === 200 && $b === DECK_58 && ($h['x-cache'] ?? '') === 'STALE', "statut $s " . ($h['x-cache'] ?? ''));
fake_routes(['/api/public/decklist/58.json' => [200, str_replace('Mystique', 'Mystique v2', DECK_58)]]);
[$s, $b, $h] = relay('decklist=58');
check('MC4DB revenu → la réponse est rafraîchie', $s === 200 && str_contains($b, 'Mystique v2') && ($h['x-cache'] ?? '') === 'MISS', $b);

write_config(['mc4db' => ['site' => 'http://127.0.0.1:18996']]);
[$s, $b] = relay('card=11111');
check('MC4DB injoignable → 502, sans détail interne', $s === 502 && !str_contains($b, $tmp) && !str_contains($b, '18996'), $b);
write_config();

// ── Limite par connexion ────────────────────────────────────────────────────

echo "Limite par connexion\n";

write_config(['mc4db' => ['site' => $site, 'rate_limit' => ['max' => 3, 'window' => 3600]]]);
reset_rate();
$codes = [];
foreach (['card=11111', 'card=22222', 'card=33333', 'card=44444'] as $query) {
    [$s, , $h] = relay($query);
    $codes[] = $s;
}
check('3 demandes envoyées à MC4DB, puis 429', $codes === [404, 404, 404, 429], implode(',', $codes));
check('429 avec Retry-After', (int) ($h['retry-after'] ?? 0) > 0);
[$s, , $h] = relay('pack=mystique_by_merlin');
check('une réponse en cache reste servie malgré la limite', $s === 200 && ($h['x-cache'] ?? '') === 'HIT', "statut $s");
$hashes = (new PDO("sqlite:$tmp/private/data/signups.sqlite"))->query('SELECT ip_hash FROM rate_hits')->fetchAll(PDO::FETCH_COLUMN);
check("l'IP n'est pas stockée en clair", $hashes && array_filter($hashes, fn ($hash) => strlen($hash) !== 64 || str_contains($hash, '127.0.0.1')) === []);

rename("$tmp/private/config.php", "$tmp/private/config.off");
[$s, $b] = relay('decklist=58');
check('config absente → 500 JSON générique', $s === 500 && !str_contains($b, $tmp), $b);
rename("$tmp/private/config.off", "$tmp/private/config.php");

echo PHP_EOL . "$passed réussi(s), $failed échec(s)" . PHP_EOL;
exit($failed ? 1 : 0);
