<?php
/**
 * GET /api/mc4db.php — relais vers MC4DB, que l'appli ne peut pas lire directement (private/mc4db.php décrit les
 * demandes, le cache, le ménagement de MC4DB et les réglages). Une seule demande par appel :
 *   ?decklist=58   ?card=70302   ?pack=mystique_by_merlin   ?author=pseudo   ?image=mystique_by_merlin/70302
 *
 * Réponses :
 *   200 le JSON de MC4DB tel quel, ou l'image (en-tête X-Cache : MISS, HIT, ou STALE quand MC4DB ne répond pas et
 *       que la dernière réponse gardée sert)
 *   400 { ok: false, message }   demande inconnue, ou valeur d'une forme inattendue
 *   404 { ok: false, message }   MC4DB ne connaît pas ce deck, cette carte, cette boîte, cette image
 *   503 { ok: false, message }   MC4DB demande de ralentir (429), même après une nouvelle tentative ; Retry-After
 *   405 / 429 / 500 / 502 { ok: false, message }
 * Pas d'en-tête Access-Control-Allow-Origin : seules les pages du site peuvent lire ce relais.
 */
declare(strict_types=1);

use function GameboxHero\Mc4db\{cache_dir, cache_file, cache_store, fetch_politely, image_type, is_valid_body, purge_cache, rate_limit, route, site_url};
use function GameboxHero\Signup\{check_rate, config, db, ip_hash};

// Dossier privé (lib.php, mc4db.php, config.php, base) : à côté de la racine web sur le VPS. Réglable par
// « SetEnv GAMEBOX_PRIVATE_DIR … » dans le vhost Apache.
$privateDir = $_SERVER['GAMEBOX_PRIVATE_DIR'] ?? getenv('GAMEBOX_PRIVATE_DIR') ?: '/home/prod/gamebox-private';

header('X-Content-Type-Options: nosniff');

function fail(int $status, string $message, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    foreach ($headers as $header) {
        header($header);
    }
    echo json_encode(['ok' => false, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Renvoie la réponse de MC4DB telle quelle (JSON ou image), que le navigateur peut garder `ttl` secondes. */
function relay(string $body, string $kind, string $cacheState, int $ttl): never
{
    header('Content-Type: ' . ($kind === 'image' ? (image_type($body) ?? 'application/octet-stream') : 'application/json; charset=utf-8'));
    header("X-Cache: $cacheState");
    header("Cache-Control: public, max-age=$ttl");
    echo $body;
    exit;
}

try {
    if (!is_file($privateDir . '/mc4db.php')) {
        throw new RuntimeException("mc4db.php introuvable dans $privateDir (vérifier GAMEBOX_PRIVATE_DIR)");
    }
    require $privateDir . '/mc4db.php';
    $config = config();
} catch (Throwable $e) {
    error_log('[gamebox-mc4db] ' . $e::class . ': ' . $e->getMessage());
    fail(500, 'Le service est momentanément indisponible. Réessayez plus tard.');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    fail(405, 'Méthode non autorisée.', ['Allow: GET']);
}

// 1. Liste blanche : une des cinq demandes, à la valeur vérifiée
$request = route($_GET);
if ($request === null) {
    fail(400, 'Demande inconnue : decklist, card, pack, author ou image attendu.');
}
['ttl' => $ttl, 'kind' => $kind] = $request;
$url = site_url($config) . $request['path'];

try {
    // 2. Le cache : une réponse récente est renvoyée sans rien demander à MC4DB
    $cacheDir = cache_dir($config);
    $cacheFile = cache_file($cacheDir, $url);
    $cachedAt = is_file($cacheFile) ? (int) filemtime($cacheFile) : null;
    if ($cachedAt !== null && time() - $cachedAt < $ttl) {
        relay((string) file_get_contents($cacheFile), $kind, 'HIT', $ttl);
    }

    // 3. Anti-abus : au plus N demandes envoyées à MC4DB par connexion (le cache ne compte pas), à part de
    //    l'inscription et des rapports de bug
    $limit = rate_limit($config);
    $wait = check_rate(db(), ip_hash('mc4db|' . ($_SERVER['REMOTE_ADDR'] ?? ''), $config['ip_salt']), $limit['max'], $limit['window'], time());
    if ($wait > 0) {
        fail(429, 'Trop de demandes depuis votre connexion. Réessayez plus tard.', ["Retry-After: $wait"]);
    }

    // 4. La demande à MC4DB, une à la fois pour tout le serveur, espacées
    [$status, $body] = fetch_politely($url, $cacheDir . '/.verrou');
    if ($status === 404) {
        fail(404, 'Introuvable sur MC4DB.');
    }
    if ($status !== 200 || !is_valid_body($body, $kind)) {
        error_log("[gamebox-mc4db] $url : statut $status" . (is_string($body) ? ', ' . strlen($body) . ' octets' : ', pas de réponse'));
        // MC4DB en panne ou qui demande de ralentir : la dernière réponse gardée vaut mieux que rien
        if ($cachedAt !== null) {
            relay((string) file_get_contents($cacheFile), $kind, 'STALE', 60);
        }
        if ($status === 429) {
            fail(503, 'MC4DB demande de ralentir : réessayez dans un moment.', ['Retry-After: 30']);
        }
        fail(502, 'MC4DB ne répond pas. Réessayez plus tard.');
    }

    cache_store($cacheFile, $body);
    if (random_int(1, 100) === 1) {
        purge_cache($cacheDir, time());
    }
    relay($body, $kind, 'MISS', $ttl);
} catch (Throwable $e) {
    error_log('[gamebox-mc4db] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fail(500, 'Le service est momentanément indisponible. Réessayez plus tard.');
}
