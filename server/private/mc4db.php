<?php
/**
 * Relais vers MC4DB (mc4db.merlindumesnil.net), utilisé par public/api/mc4db.php : l'appli ne peut pas lire son
 * API depuis gameboxheroes.fr (MC4DB n'envoie pas d'en-tête Access-Control-Allow-Origin), un serveur, lui, le
 * peut. Cinq demandes seulement, aux paramètres vérifiés (route) :
 *   decklist  une decklist publiée                → /api/public/decklist/<n>.json
 *   card      une carte, en français              → /api/public/card/<code>.json?locale=fr
 *   pack      les cartes d'une boîte, en français → /api/public/cards/<boîte>.json?locale=fr (obligation, Némésis)
 *   author    les decks publics d'un joueur       → /api/public/decks?author=<pseudo>
 *   image     l'image (anglaise) d'une carte      → /bundles/cards/EN/<boîte>/<code>.webp
 * Jamais une adresse libre (le serveur servirait à d'autres pour attaquer des sites), jamais les pages de comptes
 * de MC4DB (elles renvoient l'e-mail des inscrits).
 *
 * Ménager MC4DB, qui refuse les rafales (« 429 Too Many Requests ») : les réponses sont gardées en cache dans le
 * dossier de la base (data/mc4db-cache), une carte un jour, une image un mois, pour tous les joueurs à la fois ;
 * les demandes à MC4DB passent une à une, espacées d'au moins MIN_GAP (fetch_politely, un verrou partagé par
 * toutes les demandes du serveur) ; un refus « 429 » est retenté une fois, après une courte attente. Si MC4DB ne
 * répond pas, la dernière réponse gardée sert encore.
 *
 * Réglages de config.php (bloc « mc4db », facultatif) :
 *   'rate_limit'  au plus `max` demandes envoyées à MC4DB par connexion sur `window` secondes (le cache ne compte
 *                 pas ; 300 par heure par défaut ; garder la même fenêtre que celle de l'inscription)
 *   'site'        l'adresse de MC4DB (par défaut la vraie ; les tests en donnent une fausse)
 */
declare(strict_types=1);

namespace GameboxHero\Mc4db;

use RuntimeException;

require_once __DIR__ . '/lib.php';

const DEFAULT_SITE = 'https://mc4db.merlindumesnil.net';
const DEFAULT_RATE = ['max' => 300, 'window' => 3600];
/** Taille maximale d'une réponse : la liste des cartes de la boîte de base fait 390 Ko, une image 100 à 200 Ko. */
const MAX_BYTES = 4_000_000;
/** Un fichier du cache plus vieux que ça est effacé, de temps en temps (purge_cache). */
const CACHE_KEEP = 45 * 86400;
/** Écart minimal entre deux demandes à MC4DB, en secondes, toutes demandes du serveur confondues. */
const MIN_GAP = 0.25;
/** Attente avant de retenter une demande refusée par « 429 », en secondes (le Retry-After de MC4DB s'il est plus court). */
const RETRY_WAIT = 2;
const USER_AGENT = 'MarvelChampionsTable (gameboxheroes.fr)';

/**
 * Les demandes acceptées : paramètre → [motif de sa valeur, chemin sur MC4DB, durée du cache en secondes, genre].
 * Codes de cartes : officiels (« 26002 », « 01001a ») ou de fans (« 206201a », « 70302 ») ; boîtes : leur code
 * (« mystique_by_merlin »).
 */
function routes(): array
{
    return [
        'decklist' => ['/^\d{1,9}$/', fn (string $v) => "/api/public/decklist/$v.json", 300, 'json'],
        'card' => ['/^\d{5,8}[a-z]?$/', fn (string $v) => "/api/public/card/$v.json?locale=fr", 86400, 'json'],
        'pack' => ['/^[a-z0-9_]{1,60}$/', fn (string $v) => "/api/public/cards/$v.json?locale=fr", 86400, 'json'],
        'author' => ['/^[\p{L}\p{N}_.\- ]{1,40}$/u', fn (string $v) => '/api/public/decks?' . http_build_query(['page' => 1, 'limit' => 100, 'author' => $v]), 600, 'json'],
        'image' => ['/^[a-z0-9_]{1,60}\/\d{5,8}[a-z]?$/', fn (string $v) => "/bundles/cards/EN/$v.webp", 30 * 86400, 'image'],
    ];
}

/**
 * La demande, d'après les paramètres de l'adresse : ['path' => chemin sur MC4DB, 'ttl' => durée du cache,
 * 'kind' => 'json' ou 'image'], ou null si elle n'est pas l'une des cinq, ou si sa valeur n'a pas la forme attendue.
 * @param array<string, mixed> $query
 */
function route(array $query): ?array
{
    foreach (routes() as $name => [$pattern, $path, $ttl, $kind]) {
        $value = $query[$name] ?? null;
        if ($value === null) {
            continue;
        }
        return is_string($value) && preg_match($pattern, $value) ? ['path' => $path($value), 'ttl' => $ttl, 'kind' => $kind] : null;
    }
    return null;
}

/** L'adresse de MC4DB (« site » de config.php, sinon la vraie), sans barre finale. */
function site_url(array $config): string
{
    return rtrim((string) ($config['mc4db']['site'] ?? DEFAULT_SITE), '/');
}

/** La limite d'envoi : « mc4db.rate_limit », sinon 300 demandes par heure. @return array{max: int, window: int} */
function rate_limit(array $config): array
{
    $limit = $config['mc4db']['rate_limit'] ?? DEFAULT_RATE;
    return ['max' => (int) ($limit['max'] ?? DEFAULT_RATE['max']), 'window' => (int) ($limit['window'] ?? DEFAULT_RATE['window'])];
}

/** Le dossier du cache, à côté de la base (le dossier data/, où le serveur écrit déjà) ; créé s'il manque. */
function cache_dir(array $config): string
{
    $dir = dirname((string) $config['db_path']) . '/mc4db-cache';
    if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) {
        throw new RuntimeException("Impossible de créer le dossier $dir");
    }
    return $dir;
}

function cache_file(string $dir, string $url): string
{
    return $dir . '/' . sha1($url) . '.cache';
}

/** Garde une réponse, d'un coup (un fichier à moitié écrit ne doit jamais être lu). */
function cache_store(string $file, string $body): void
{
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, $body) !== false) {
        rename($tmp, $file);
    }
}

/** Efface les réponses gardées depuis plus de CACHE_KEEP ; appelée de temps en temps, pas à chaque demande. */
function purge_cache(string $dir, int $now): void
{
    foreach (glob($dir . '/*.cache') ?: [] as $file) {
        if ($now - (int) @filemtime($file) > CACHE_KEEP) {
            @unlink($file);
        }
    }
}

/**
 * Demande une adresse à MC4DB : délais courts, pas de redirection suivie, réponse limitée à MAX_BYTES.
 * @return array{0: int, 1: ?string, 2: int} [statut HTTP (0 : pas de réponse), corps, Retry-After en secondes (0 : aucun)]
 */
function fetch(string $url): array
{
    $retryAfter = 0;
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXFILESIZE => MAX_BYTES,
            CURLOPT_USERAGENT => USER_AGENT,
            CURLOPT_HEADERFUNCTION => function ($curl, string $line) use (&$retryAfter): int {
                if (preg_match('/^Retry-After:\s*(\d+)/i', $line, $m)) {
                    $retryAfter = (int) $m[1];
                }
                return strlen($line);
            },
        ]);
        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        return [$status, is_string($body) ? $body : null, $retryAfter];
    }
    // sans l'extension curl : les flux de PHP (allow_url_fopen)
    $context = stream_context_create(['http' => [
        'method' => 'GET', 'timeout' => 10, 'follow_location' => 0, 'ignore_errors' => true, 'header' => 'User-Agent: ' . USER_AGENT,
    ]]);
    $body = @file_get_contents($url, false, $context, 0, MAX_BYTES + 1);
    $headers = $http_response_header ?? [];
    foreach ($headers as $line) {
        if (preg_match('/^Retry-After:\s*(\d+)/i', $line, $m)) {
            $retryAfter = (int) $m[1];
        }
    }
    $status = isset($headers[0]) ? (int) (explode(' ', $headers[0])[1] ?? 0) : 0;
    return [$status, is_string($body) ? $body : null, $retryAfter];
}

/**
 * Demande une adresse à MC4DB en le ménageant : une demande à la fois pour tout le serveur (verrou sur `$lockFile`),
 * au moins MIN_GAP après la précédente, et un refus « 429 » retenté une fois après une courte attente.
 * @return array{0: int, 1: ?string, 2: int} comme fetch
 */
function fetch_politely(string $url, string $lockFile): array
{
    $lock = fopen($lockFile, 'c+');
    if ($lock === false) {
        return fetch($url);
    }
    try {
        flock($lock, LOCK_EX);
        $last = (float) stream_get_contents($lock);
        $wait = $last + MIN_GAP - microtime(true);
        if ($wait > 0) {
            usleep((int) ($wait * 1_000_000));
        }
        $result = fetch($url);
        if ($result[0] === 429) {
            usleep((int) (min($result[2] > 0 ? $result[2] : RETRY_WAIT, RETRY_WAIT) * 1_000_000));
            $result = fetch($url);
        }
        ftruncate($lock, 0);
        rewind($lock);
        fwrite($lock, (string) microtime(true));
        return $result;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/** Le type d'une image d'après ses premiers octets (WebP, PNG, JPEG), ou null si ce n'en est pas une. */
function image_type(string $body): ?string
{
    if (str_starts_with($body, 'RIFF') && substr($body, 8, 4) === 'WEBP') {
        return 'image/webp';
    }
    if (str_starts_with($body, "\x89PNG")) {
        return 'image/png';
    }
    return str_starts_with($body, "\xFF\xD8\xFF") ? 'image/jpeg' : null;
}

/** Une réponse utilisable : pas trop grosse, et un objet ou une liste JSON, ou une image, selon la demande. */
function is_valid_body(?string $body, string $kind): bool
{
    if (!is_string($body) || $body === '' || strlen($body) > MAX_BYTES) {
        return false;
    }
    return $kind === 'image' ? image_type($body) !== null : is_array(json_decode($body, true));
}
