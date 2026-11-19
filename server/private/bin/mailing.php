#!/usr/bin/env php
<?php
/**
 * Envoie la mailing list aux inscrits, à partir d'un template HTML.
 *
 *   php bin/mailing.php chemin/vers/template.html [options]
 *
 * Options :
 *   --test=adresse@exemple.fr   un seul exemplaire, à cette adresse (rien n'est enregistré)
 *   --simulation                n'envoie rien : vérifie le SMTP, compte les destinataires, écrit un aperçu
 *   --sujet="…"                 sujet (sinon : la balise <title> du template)
 *   --texte=fichier.txt         version texte (sinon : le .txt du même nom, sinon générée depuis le HTML)
 *   --source=marvel-champions   seulement les inscrits venus de cette source
 *   --campagne=nom              nom de la campagne (par défaut : nom du fichier template)
 *   --limite=N                  au plus N messages pour ce lancement
 *   --par-minute=N              cadence (sinon : mail.per_minute de config.php)
 *   --oui                       pas de confirmation (cron, nohup)
 *
 * Variables du template : {{nom}} {{prenom}} {{email}} {{desinscription}}
 * Les images en chemin relatif (<img src="images/logo.png">) sont jointes au message.
 *
 * Relancer la même campagne reprend où elle s'est arrêtée : les destinataires déjà servis
 * sont sautés, les échecs sont retentés.
 */
declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as MailerException;

use function GameboxHero\Signup\{add_unsubscribe_footer, config, db, html_to_text, make_mailer, placeholders, record_send, render, send_one, unsubscribe_url, vars_for};
use const GameboxHero\Signup\VARIABLES;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$privateDir = dirname(__DIR__);
if (!is_file($privateDir . '/vendor/autoload.php')) {
    fwrite(STDERR, "PHPMailer est absent : lancer « composer install --no-dev » dans $privateDir" . PHP_EOL);
    exit(1);
}
// templates, version texte, SMTP et en-têtes de désinscription : partagés avec le mail de confirmation (signup.php)
require $privateDir . '/mail.php';

const OPTIONS = ['test', 'simulation', 'sujet', 'texte', 'source', 'campagne', 'limite', 'par-minute', 'oui'];
const MAX_CONSECUTIVE_FAILURES = 5;

// ── Outils ───────────────────────────────────────────────────────────────────

function out(string $line = ''): void
{
    fwrite(STDOUT, $line . PHP_EOL);
}

function warn(string $line): void
{
    fwrite(STDERR, 'Attention : ' . $line . PHP_EOL);
}

function fail(string $message): never
{
    fwrite(STDERR, $message . PHP_EOL);
    exit(1);
}

function now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

// ── Arguments ────────────────────────────────────────────────────────────────

$options = [];
$params = [];
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--([a-z-]+)(?:=(.*))?$/s', $arg, $m)) {
        if (!in_array($m[1], OPTIONS, true)) {
            fail("Option inconnue : --{$m[1]}. Options possibles : --" . implode(', --', OPTIONS));
        }
        $options[$m[1]] = $m[2] ?? true;
    } else {
        $params[] = $arg;
    }
}
if (count($params) !== 1) {
    fail('Usage : php bin/mailing.php chemin/vers/template.html [--test=adresse | --simulation] [--oui] …');
}

foreach (['limite', 'par-minute'] as $opt) {
    if (isset($options[$opt]) && filter_var($options[$opt], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
        fail("--$opt attend un nombre entier positif.");
    }
}
foreach (['test', 'sujet', 'texte', 'source', 'campagne'] as $opt) {
    if (($options[$opt] ?? null) === true || ($options[$opt] ?? null) === '') {
        fail("--$opt attend une valeur : --$opt=…");
    }
}

try {
    $config = config();
    $mc = $config['mail'] ?? fail('Bloc « mail » absent de config.php (voir config.sample.php).');
    foreach (['from_email'] + (($mc['transport'] ?? 'smtp') === 'smtp' ? [1 => 'host', 2 => 'port'] : []) as $key) {
        if (empty($mc[$key])) {
            fail("mail.$key doit être renseigné dans config.php");
        }
    }
    unsubscribe_url(1, 'controle@exemple.fr'); // vérifie site_url et unsubscribe_secret avant tout envoi

    // ── Template ─────────────────────────────────────────────────────────────

    $templatePath = realpath($params[0]) ?: fail("Template introuvable : {$params[0]}");
    $html = (string) file_get_contents($templatePath);
    if (!mb_check_encoding($html, 'UTF-8')) {
        fail('Le template doit être enregistré en UTF-8.');
    }
    $baseDir = dirname($templatePath);
    $campaign = $options['campagne'] ?? pathinfo($templatePath, PATHINFO_FILENAME);

    $subject = $options['sujet'] ?? (preg_match('~<title\b[^>]*>(.*?)</title>~is', $html, $m)
        ? html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8') : '');
    $subject = trim(preg_replace('/\s+/u', ' ', $subject));
    if ($subject === '') {
        fail('Sujet manquant : ajoutez <title>…</title> au template, ou passez --sujet="…".');
    }

    $textPath = $options['texte'] ?? preg_replace('/\.html?$/i', '.txt', $templatePath);
    $text = null;
    if ($textPath !== $templatePath && is_file($textPath)) {
        $text = (string) file_get_contents($textPath);
    } elseif (isset($options['texte'])) {
        fail("Version texte introuvable : $textPath");
    }

    $unknown = array_diff(array_merge(placeholders($html), placeholders($subject), $text === null ? [] : placeholders($text)), VARIABLES);
    if ($unknown) {
        fail('Variable inconnue : {{' . implode('}}, {{', $unknown) . '}}. Variables possibles : {{' . implode('}}, {{', VARIABLES) . '}}');
    }
    if (in_array('desinscription', placeholders($subject), true)) {
        fail('{{desinscription}} ne peut pas figurer dans le sujet.');
    }
    if (!in_array('desinscription', placeholders($html), true)) {
        $html = add_unsubscribe_footer($html);
        warn('le template ne contient pas {{desinscription}} : un pied de page avec le lien a été ajouté.');
    }
    $text ??= html_to_text($html);
    if (!in_array('desinscription', placeholders($text), true)) {
        $text = rtrim($text) . "\n\n--\nSe désinscrire : {{desinscription}}\n";
    }

    $pdo = db();

    // ── Envoi de test ────────────────────────────────────────────────────────

    if (isset($options['test'])) {
        $to = mb_strtolower(trim((string) $options['test']));
        if (filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
            fail("Adresse de test invalide : $to");
        }
        $st = $pdo->prepare('SELECT id, email, name FROM signups WHERE email = ?');
        $st->execute([$to]);
        $r = $st->fetch() ?: ['id' => 0, 'email' => $to, 'name' => 'Visiteur Test'];
        $mail = make_mailer($mc);
        send_one($mail, vars_for($r), '[Test] ' . $subject, $html, $text, $baseDir);
        $mail->smtpClose();
        out("Message de test envoyé à $to.");
        if ((int) $r['id'] === 0) {
            out("Cette adresse n'est pas inscrite : {{nom}} vaut « Visiteur Test » et le lien de désinscription ne mène à rien.");
        }
        exit(0);
    }

    // ── Destinataires ────────────────────────────────────────────────────────

    $contentSha = hash('sha256', $subject . "\0" . $html . "\0" . $text);
    $st = $pdo->prepare('SELECT * FROM mailings WHERE campaign = ?');
    $st->execute([$campaign]);
    $mailing = $st->fetch() ?: null;
    $mailingId = $mailing ? (int) $mailing['id'] : 0;

    $sql = <<<'SQL'
        SELECT s.id, s.email, s.name FROM signups s
        WHERE NOT EXISTS (
            SELECT 1 FROM mailing_sends m WHERE m.mailing_id = :mid AND m.email = s.email AND m.status = 'sent'
        )
        SQL;
    $bind = ['mid' => $mailingId];
    if (isset($options['source'])) {
        $sql .= ' AND s.source = :source';
        $bind['source'] = $options['source'];
    }
    $st = $pdo->prepare($sql . ' ORDER BY s.id');
    $st->execute($bind);
    $recipients = $st->fetchAll();
    $alreadySent = $mailingId
        ? (int) $pdo->query("SELECT COUNT(*) FROM mailing_sends WHERE mailing_id = $mailingId AND status = 'sent'")->fetchColumn()
        : 0;
    $remaining = count($recipients);
    if (isset($options['limite'])) {
        $recipients = array_slice($recipients, 0, (int) $options['limite']);
    }
    $perMinute = (int) ($options['par-minute'] ?? $mc['per_minute'] ?? 30);

    out("Campagne    : $campaign" . ($mailing ? ' (reprise)' : ''));
    out("Sujet       : $subject");
    out('Expéditeur  : ' . trim(($mc['from_name'] ?? '') . " <{$mc['from_email']}>"));
    out('Envoi par   : ' . (($mc['transport'] ?? 'smtp') === 'sendmail' ? 'sendmail local' : "SMTP {$mc['host']}:{$mc['port']}"));
    out('Source      : ' . ($options['source'] ?? 'toutes'));
    out("Déjà servis : $alreadySent");
    out("À envoyer   : $remaining" . (count($recipients) < $remaining ? ' (' . count($recipients) . ' pour ce lancement, --limite)' : ''));
    out(sprintf('Cadence     : %d/min, environ %d min', $perMinute, (int) ceil(count($recipients) / max(1, $perMinute))));
    if ($mailing && $mailing['content_sha'] !== $contentSha && $alreadySent > 0) {
        warn("le contenu a changé depuis le premier lancement de « $campaign ». Les $alreadySent destinataires déjà servis "
            . 'ne recevront pas cette nouvelle version (utilisez --campagne=autre-nom pour tout renvoyer).');
    }

    // ── Simulation ───────────────────────────────────────────────────────────

    if (isset($options['simulation'])) {
        $sample = $recipients[0] ?? ['id' => 0, 'email' => 'exemple@exemple.fr', 'name' => 'Peter Parker'];
        $vars = vars_for($sample);
        $previewBase = $baseDir . '/' . $campaign . '.apercu';
        file_put_contents("$previewBase.html", render($html, $vars, true));
        file_put_contents("$previewBase.txt", 'Sujet : ' . render($subject, $vars, false) . "\n\n" . render($text, $vars, false));
        out("Aperçu      : $previewBase.html et .txt (pour {$sample['email']})");
        if (($mc['transport'] ?? 'smtp') === 'smtp') {
            $mail = make_mailer($mc);
            $mail->smtpConnect();
            $mail->smtpClose();
            out('Connexion SMTP : ok');
        }
        out('Simulation : aucun message envoyé.');
        exit(0);
    }

    if (!$recipients) {
        if ($mailing && $mailing['finished_at'] === null) {
            $pdo->prepare('UPDATE mailings SET finished_at = ? WHERE id = ?')->execute([now(), $mailingId]);
        }
        out('Personne à qui envoyer : tous les inscrits concernés ont déjà reçu cette campagne.');
        exit(0);
    }

    // ── Confirmation et verrou ───────────────────────────────────────────────

    if (!isset($options['oui'])) {
        if (!stream_isatty(STDIN)) {
            fail('Pas de terminal pour confirmer : ajoutez --oui.');
        }
        fwrite(STDOUT, sprintf('Envoyer « %s » à %d destinataire(s) ? [o/N] ', $subject, count($recipients)));
        if (!in_array(mb_strtolower(trim((string) fgets(STDIN))), ['o', 'oui'], true)) {
            out('Annulé.');
            exit(0);
        }
    }

    $lock = fopen(dirname($config['db_path']) . '/mailing.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        fail('Un envoi est déjà en cours sur ce serveur. Attendez sa fin.');
    }

    if ($mailing) {
        $pdo->prepare('UPDATE mailings SET subject = ?, template = ?, content_sha = ?, finished_at = NULL WHERE id = ?')
            ->execute([$subject, $templatePath, $contentSha, $mailingId]);
    } else {
        $pdo->prepare('INSERT INTO mailings (campaign, subject, template, content_sha, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$campaign, $subject, $templatePath, $contentSha, now()]);
        $mailingId = (int) $pdo->lastInsertId();
    }

    // Ctrl+C ou kill : on termine le message en cours, on enregistre, puis on s'arrête proprement.
    $stop = false;
    if (function_exists('pcntl_async_signals')) {
        pcntl_async_signals(true);
        pcntl_signal(SIGINT, function () use (&$stop) { $stop = true; });
        pcntl_signal(SIGTERM, function () use (&$stop) { $stop = true; });
    }

    // ── Envoi ────────────────────────────────────────────────────────────────

    $mail = make_mailer($mc);
    $delayUs = (int) round(60_000_000 / max(1, $perMinute));
    $total = count($recipients);
    $sent = $failed = $consecutive = 0;
    $aborted = false;

    foreach ($recipients as $i => $r) {
        if ($stop) {
            out('Interruption demandée.');
            $aborted = true;
            break;
        }
        $start = microtime(true);
        $label = sprintf('[%' . strlen((string) $total) . 'd/%d]', $i + 1, $total);
        try {
            send_one($mail, vars_for($r), $subject, $html, $text, $baseDir);
            record_send($pdo, $mailingId, $r['email'], 'sent', null);
            $sent++;
            $consecutive = 0;
            out("$label ok     {$r['email']}");
        } catch (MailerException $e) {
            $error = trim(preg_replace('/\s+/u', ' ', $mail->ErrorInfo ?: $e->getMessage()));
            record_send($pdo, $mailingId, $r['email'], 'failed', $error);
            $failed++;
            $consecutive++;
            out("$label ÉCHEC  {$r['email']} — $error");
            $mail->smtpClose(); // repart sur une connexion propre
            if ($consecutive >= MAX_CONSECUTIVE_FAILURES) {
                out("Arrêt : $consecutive échecs de suite. Vérifiez la configuration SMTP ou le quota du fournisseur.");
                $aborted = true;
                break;
            }
        }
        if ($i < $total - 1) {
            $wait = $delayUs - (int) ((microtime(true) - $start) * 1_000_000);
            if ($wait > 0) {
                usleep($wait);
            }
        }
    }
    $mail->smtpClose();

    $bind['mid'] = $mailingId;
    $st = $pdo->prepare($sql);
    $st->execute($bind);
    $left = count($st->fetchAll());
    if ($left === 0) {
        $pdo->prepare('UPDATE mailings SET finished_at = ? WHERE id = ?')->execute([now(), $mailingId]);
    }

    out();
    out("Envoyés : $sent, échecs : $failed, restants : $left.");
    if ($left > 0) {
        out('Relancez la même commande pour reprendre : les destinataires déjà servis seront sautés.');
    }
    exit($failed || $aborted ? 2 : 0);
} catch (MailerException $e) {
    fail('Erreur d’envoi : ' . $e->getMessage());
} catch (Throwable $e) {
    fail('Erreur : ' . $e->getMessage());
}
