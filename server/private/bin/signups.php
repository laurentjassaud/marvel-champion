#!/usr/bin/env php
<?php
/**
 * Gestion des inscriptions en ligne de commande (sur le VPS, en SSH).
 *
 *   php bin/signups.php liste [--source=marvel-champions]
 *   php bin/signups.php compte
 *   php bin/signups.php export [fichier.csv]      CSV pour Excel ou LibreOffice (séparateur ;)
 *   php bin/signups.php supprimer adresse@exemple.fr   droit à l'effacement (RGPD)
 *   php bin/signups.php campagnes                     suivi des envois de la mailing list
 *   php bin/signups.php echecs nom-de-campagne        adresses en échec et raison
 *
 * À lancer avec l'utilisateur qui possède la base, par exemple :
 *   sudo -u www-data php bin/signups.php liste
 */
declare(strict_types=1);

use function GameboxHero\Signup\{db, delete_subscriber};

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/lib.php';

function out(string $line = ''): void
{
    fwrite(STDOUT, $line . PHP_EOL);
}

function fail(string $message, int $code = 1): never
{
    fwrite(STDERR, $message . PHP_EOL);
    exit($code);
}

/** Évite qu'Excel interprète une cellule comme une formule (injection CSV). */
function csv_safe(string $value): string
{
    return preg_match('/^[=+\-@\t\r]/', $value) ? "'" . $value : $value;
}

$args = array_slice($argv, 1);
$command = array_shift($args) ?? 'aide';
$options = [];
$params = [];
foreach ($args as $arg) {
    if (preg_match('/^--([a-z-]+)=(.*)$/', $arg, $m)) {
        $options[$m[1]] = $m[2];
    } else {
        $params[] = $arg;
    }
}

try {
    $pdo = db();

    switch ($command) {
        case 'liste':
            $sql = 'SELECT created_at, name, email, source FROM signups';
            $bind = [];
            if (isset($options['source'])) {
                $sql .= ' WHERE source = ?';
                $bind[] = $options['source'];
            }
            $st = $pdo->prepare($sql . ' ORDER BY created_at DESC, id DESC');
            $st->execute($bind);
            $rows = $st->fetchAll();
            foreach ($rows as $r) {
                out(sprintf('%s  %-30s  %-40s  %s', substr($r['created_at'], 0, 10), mb_strimwidth($r['name'], 0, 30, '…'), $r['email'], $r['source']));
            }
            out(count($rows) . ' inscription(s)');
            break;

        case 'compte':
            $total = 0;
            foreach ($pdo->query('SELECT source, COUNT(*) AS n FROM signups GROUP BY source ORDER BY n DESC') as $r) {
                out(sprintf('%-20s %d', $r['source'], $r['n']));
                $total += (int) $r['n'];
            }
            out(sprintf('%-20s %d', 'total', $total));
            break;

        case 'export':
            $file = $params[0] ?? 'php://stdout';
            $fh = fopen($file, 'wb') ?: fail("Impossible d'écrire dans $file");
            fwrite($fh, "\xEF\xBB\xBF"); // BOM : Excel lit alors les accents correctement
            fputcsv($fh, ['nom', 'email', 'source', 'consentement', 'inscription', 'mise_a_jour'], ';', '"', '');
            $n = 0;
            foreach ($pdo->query('SELECT name, email, source, consent_at, created_at, updated_at FROM signups ORDER BY created_at') as $r) {
                fputcsv($fh, array_map(csv_safe(...), array_values($r)), ';', '"', '');
                $n++;
            }
            fclose($fh);
            if ($file !== 'php://stdout') {
                out("$n inscription(s) exportée(s) dans $file");
            }
            break;

        case 'supprimer':
            $email = mb_strtolower(trim($params[0] ?? ''));
            if ($email === '') {
                fail('Usage : php bin/signups.php supprimer adresse@exemple.fr');
            }
            out(delete_subscriber($pdo, $email) ? "$email supprimée." : "$email n'est pas inscrite.");
            break;

        case 'campagnes':
            $rows = $pdo->query(<<<'SQL'
                SELECT m.campaign, m.subject, m.created_at, m.finished_at,
                       SUM(s.status = 'sent') AS sent, SUM(s.status = 'failed') AS failed
                FROM mailings m LEFT JOIN mailing_sends s ON s.mailing_id = m.id
                GROUP BY m.id ORDER BY m.created_at DESC
                SQL)->fetchAll();
            foreach ($rows as $r) {
                out(sprintf('%s  %-24s  envoyés %4d  échecs %3d  %s  « %s »', substr($r['created_at'], 0, 10), $r['campaign'],
                    $r['sent'], $r['failed'], $r['finished_at'] ? 'terminée' : 'en cours', $r['subject']));
            }
            out(count($rows) . ' campagne(s)');
            break;

        case 'echecs':
            $campaign = $params[0] ?? fail('Usage : php bin/signups.php echecs <campagne>');
            $st = $pdo->prepare(<<<'SQL'
                SELECT s.email, s.error FROM mailing_sends s JOIN mailings m ON m.id = s.mailing_id
                WHERE m.campaign = ? AND s.status = 'failed' ORDER BY s.email
                SQL);
            $st->execute([$campaign]);
            $rows = $st->fetchAll();
            foreach ($rows as $r) {
                out("{$r['email']}  {$r['error']}");
            }
            out(count($rows) . ' échec(s)');
            break;

        case 'aide':
        case 'help':
        case '--help':
            out('Commandes : liste [--source=…] | compte | export [fichier.csv] | supprimer <email> | campagnes | echecs <campagne>');
            break;

        default:
            fail("Commande inconnue : $command (essayer « aide »)");
    }
} catch (Throwable $e) {
    fail('Erreur : ' . $e->getMessage());
}
