<?php
/**
 * Faux MC4DB pour tests/mc4db-test.php (routeur du serveur intégré de PHP) : répond d'après $FAKE_DIR/routes.json,
 *   { "<chemin et requête>": { "status": 200, "body": "…" | "base64": "…", "type": "image/webp", "retry_after": 1 } }
 * ou { "sequence": [ {…}, {…} ] } : la n-ième demande de cette adresse reçoit la n-ième réponse (la dernière
 * ensuite) ; 404 pour le reste. Chaque demande reçue est notée dans $FAKE_DIR/requests.log : adresse, User-Agent
 * et heure (microtime), séparés par des tabulations.
 *
 *   FAKE_DIR=… php -S 127.0.0.1:PORT tests/mc4db-fake.php
 */
declare(strict_types=1);

$dir = (string) getenv('FAKE_DIR');
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
file_put_contents("$dir/requests.log", $uri . "\t" . ($_SERVER['HTTP_USER_AGENT'] ?? '') . "\t" . microtime(true) . "\n", FILE_APPEND | LOCK_EX);
$routes = json_decode((string) @file_get_contents("$dir/routes.json"), true) ?: [];
$route = $routes[$uri] ?? ['status' => 404, 'body' => '{"error":"Not found"}'];
if (isset($route['sequence'])) {
    $counter = "$dir/count-" . sha1($uri);
    $n = (int) @file_get_contents($counter);
    file_put_contents($counter, (string) ($n + 1));
    $route = $route['sequence'][min($n, count($route['sequence']) - 1)];
}
http_response_code((int) ($route['status'] ?? 200));
header('Content-Type: ' . ($route['type'] ?? 'application/json; charset=utf-8'));
if (isset($route['retry_after'])) {
    header('Retry-After: ' . (int) $route['retry_after']);
}
echo isset($route['base64']) ? base64_decode((string) $route['base64']) : (string) ($route['body'] ?? '');
