<?php
/**
 * Faux serveur SMTP pour les tests : accepte tout, sauf les destinataires contenant « refuse »,
 * et enregistre chaque message dans un dossier (0001.eml, 0002.eml…).
 *
 *   php smtp-sink.php PORT DOSSIER
 */
declare(strict_types=1);

[$port, $dir] = [(int) $argv[1], $argv[2]];
$server = stream_socket_server("tcp://127.0.0.1:$port", $errno, $errstr);
if (!$server) {
    fwrite(STDERR, "$errstr\n");
    exit(1);
}
$count = 0;

while ($conn = @stream_socket_accept($server, -1)) {
    $send = function (string $line) use ($conn) {
        fwrite($conn, $line . "\r\n");
    };
    $send('220 sink ESMTP');
    $auth = '';
    $rcpt = [];
    $awaitingAuth = false;

    while (($line = fgets($conn)) !== false) {
        $cmd = rtrim($line, "\r\n");
        $upper = strtoupper($cmd);
        if ($awaitingAuth) {
            $auth = (string) base64_decode($cmd);
            $awaitingAuth = false;
            $send('235 2.7.0 Authentification réussie');
            continue;
        }
        if (str_starts_with($upper, 'EHLO')) {
            $send('250-sink');
            $send('250-AUTH PLAIN');
            $send('250 8BITMIME');
        } elseif (str_starts_with($upper, 'HELO')) {
            $send('250 sink');
        } elseif (str_starts_with($upper, 'AUTH PLAIN')) {
            $arg = trim(substr($cmd, 10));
            if ($arg === '') {
                $awaitingAuth = true;
                $send('334 ');
            } else {
                $auth = (string) base64_decode($arg);
                $send('235 2.7.0 Authentification réussie');
            }
        } elseif (str_starts_with($upper, 'MAIL FROM:')) {
            $rcpt = [];
            $send('250 2.1.0 ok');
        } elseif (str_starts_with($upper, 'RCPT TO:')) {
            if (str_contains(strtolower($cmd), 'refuse')) {
                $send('550 5.1.1 Adresse inconnue');
            } else {
                $rcpt[] = trim(substr($cmd, 8), ' <>');
                $send('250 2.1.5 ok');
            }
        } elseif ($upper === 'DATA') {
            $send('354 Terminer par <CRLF>.<CRLF>');
            $data = '';
            while (($l = fgets($conn)) !== false && rtrim($l, "\r\n") !== '.') {
                $data .= str_starts_with($l, '..') ? substr($l, 1) : $l;
            }
            $count++;
            file_put_contents(
                sprintf('%s/%04d.eml', $dir, $count),
                'X-Sink-Auth: ' . str_replace("\0", '|', $auth) . "\r\nX-Sink-Rcpt: " . implode(',', $rcpt) . "\r\n" . $data,
            );
            $send('250 2.0.0 ok queued');
        } elseif ($upper === 'RSET' || $upper === 'NOOP') {
            $rcpt = [];
            $send('250 2.0.0 ok');
        } elseif ($upper === 'QUIT') {
            $send('221 2.0.0 bye');
            break;
        } else {
            $send('502 5.5.2 Commande inconnue');
        }
    }
    fclose($conn);
}
