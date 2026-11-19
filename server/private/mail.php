<?php
/**
 * Envoi d'e-mails Gamebox Hero : templates à variables, version texte, connexion SMTP, en-têtes de
 * désinscription. Partagé par bin/mailing.php (la mailing list) et public/api/signup.php (le mail de
 * confirmation envoyé à chaque nouvelle inscription, et l'avis au propriétaire du site). Demande PHPMailer (vendor/).
 */
declare(strict_types=1);

namespace GameboxHero\Signup;

use PDO;
use PHPMailer\PHPMailer\Exception as MailerException;
use PHPMailer\PHPMailer\PHPMailer;
use RuntimeException;

require_once __DIR__ . '/lib.php';
if (!is_file(__DIR__ . '/vendor/autoload.php')) {
    throw new RuntimeException('PHPMailer est absent : lancer « composer install --no-dev » dans ' . __DIR__);
}
require_once __DIR__ . '/vendor/autoload.php';

const VARIABLES = ['nom', 'prenom', 'email', 'desinscription'];
const PLACEHOLDER = '/\{\{\s*([^{}]*?)\s*\}\}/u';
/** Nom sous lequel les mails de confirmation sont suivis (bin/signups.php campagnes, echecs). */
const CONFIRMATION_CAMPAIGN = 'confirmation-inscription';

/** @return string[] noms des variables utilisées, en minuscules */
function placeholders(string $s): array
{
    preg_match_all(PLACEHOLDER, $s, $m);
    return array_values(array_unique(array_map('mb_strtolower', $m[1])));
}

function render(string $template, array $vars, bool $html): string
{
    return preg_replace_callback(PLACEHOLDER, function (array $m) use ($vars, $html) {
        $value = $vars[mb_strtolower($m[1])];
        return $html ? htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8') : $value;
    }, $template);
}

/** Version texte lisible d'un e-mail HTML : liens conservés, paragraphes, listes. */
function html_to_text(string $html): string
{
    $t = preg_replace('~<(head|style|script|title)\b[^>]*>.*?</\1>~is', '', $html);
    $t = preg_replace('~<(div|span|p)\b[^>]*display\s*:\s*none[^>]*>.*?</\1>~is', '', $t); // texte d'aperçu caché
    $t = preg_replace('/\s+/u', ' ', $t); // en HTML, les retours à la ligne du code source ne comptent pas
    $t = preg_replace_callback('~<a\b[^>]*?href\s*=\s*(["\'])(.*?)\1[^>]*>(.*?)</a>~is', function (array $m) {
        $url = html_entity_decode($m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $label = trim(preg_replace('/\s+/u', ' ', strip_tags($m[3])));
        if ($label === '' || $label === $url || str_starts_with($url, 'mailto:') || str_starts_with($url, '#')) {
            return $label !== '' ? $label : $url;
        }
        return "$label ($url)";
    }, $t);
    $t = preg_replace('~<br\s*/?>~i', "\n", $t);
    $t = preg_replace('~<li\b[^>]*>~i', "\n- ", $t);
    $t = preg_replace('~<(h[1-6]|p|div|tr|table|ul|ol|blockquote)\b[^>]*>~i', "\n", $t);
    $t = preg_replace('~</(h[1-6]|p|div|tr|table|ul|ol|blockquote)>~i', "\n\n", $t);
    $t = strip_tags($t);
    $t = html_entity_decode($t, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $t = str_replace(["\u{00A0}", "\u{200C}", "\u{034F}"], [' ', '', ''], $t);
    $t = preg_replace('/[ \t]+/u', ' ', $t);
    $t = preg_replace('/ *\n */u', "\n", $t);
    $t = preg_replace("/\n{3,}/", "\n\n", $t);
    return trim($t) . "\n";
}

function add_unsubscribe_footer(string $html): string
{
    $host = parse_url((string) config()['site_url'], PHP_URL_HOST) ?: 'notre site';
    $footer = '<p style="margin:24px 0 0;padding:0 16px;font:12px/1.5 Arial,sans-serif;color:#8a8f98;text-align:center">'
        . 'Vous recevez ce message car vous vous êtes inscrit sur ' . htmlspecialchars($host) . '. '
        . '<a href="{{desinscription}}" style="color:#8a8f98">Se désinscrire</a></p>';
    return stripos($html, '</body>') !== false
        ? preg_replace('~</body>~i', $footer . "\n</body>", $html, 1)
        : $html . $footer;
}

/** @param array{id: int|string, email: string, name: string} $r */
function vars_for(array $r): array
{
    return [
        'nom' => $r['name'],
        'prenom' => explode(' ', trim($r['name']))[0],
        'email' => $r['email'],
        'desinscription' => unsubscribe_url((int) $r['id'], $r['email']),
    ];
}

/**
 * Un expéditeur réglé d'après le bloc « mail » de config.php.
 *   $keepAlive  une seule connexion SMTP pour plusieurs messages (une campagne)
 *   $timeout    délai d'attente du serveur SMTP, en secondes
 */
function make_mailer(array $mc, bool $keepAlive = true, int $timeout = 20): PHPMailer
{
    $mail = new PHPMailer(true);
    PHPMailer::setLanguage('fr', __DIR__ . '/vendor/phpmailer/phpmailer/language/');
    $mail->CharSet = PHPMailer::CHARSET_UTF8;
    $mail->Encoding = PHPMailer::ENCODING_QUOTED_PRINTABLE;
    $mail->XMailer = ' '; // pas d'en-tête X-Mailer

    if (($mc['transport'] ?? 'smtp') === 'sendmail') {
        $mail->isSendmail();
        if (!empty($mc['sendmail_path'])) {
            $mail->Sendmail = $mc['sendmail_path'];
        }
    } else {
        $mail->isSMTP();
        $mail->Host = (string) $mc['host'];
        $mail->Port = (int) $mc['port'];
        $mail->Timeout = $timeout;
        $mail->SMTPKeepAlive = $keepAlive;
        $encryption = $mc['encryption'] ?? 'tls';
        $mail->SMTPSecure = match ($encryption) {
            'tls' => PHPMailer::ENCRYPTION_STARTTLS,
            'ssl' => PHPMailer::ENCRYPTION_SMTPS,
            '' => '',
            default => throw new RuntimeException("mail.encryption doit valoir 'tls', 'ssl' ou ''"),
        };
        $mail->SMTPAutoTLS = $encryption !== '';
        if (($mc['username'] ?? '') !== '') {
            $mail->SMTPAuth = true;
            $mail->Username = (string) $mc['username'];
            $mail->Password = (string) $mc['password'];
        }
    }

    $mail->setFrom((string) $mc['from_email'], (string) ($mc['from_name'] ?? ''));
    if (!empty($mc['reply_to'])) {
        $mail->addReplyTo((string) $mc['reply_to']);
    }
    if (!empty($mc['dkim'])) {
        $mail->DKIM_domain = $mc['dkim']['domain'];
        $mail->DKIM_selector = $mc['dkim']['selector'];
        $mail->DKIM_private = $mc['dkim']['private_key'];
        $mail->DKIM_identity = $mail->From;
    }
    return $mail;
}

function send_one(PHPMailer $mail, array $vars, string $subject, string $html, string $text, string $baseDir): void
{
    $mail->clearAllRecipients();
    $mail->clearAttachments();
    $mail->clearCustomHeaders();
    $mail->addAddress($vars['email'], $vars['nom']);
    $mail->Subject = render($subject, $vars, false);
    $mail->msgHTML(render($html, $vars, true), $baseDir); // joint les images relatives
    $mail->AltBody = render($text, $vars, false);
    // Désabonnement en un clic dans Gmail, Outlook, Apple Mail… (RFC 2369 et 8058)
    $mail->addCustomHeader('List-Unsubscribe', '<' . $vars['desinscription'] . '>');
    $mail->addCustomHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
    $mail->send();
}

/** Note l'envoi (ou l'échec) d'un message d'une campagne : bin/signups.php campagnes et echecs le montrent. */
function record_send(PDO $pdo, int $mailingId, string $email, string $status, ?string $error): void
{
    $pdo->prepare(<<<'SQL'
        INSERT INTO mailing_sends (mailing_id, email, status, error, sent_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (mailing_id, email) DO UPDATE SET status = excluded.status, error = excluded.error, sent_at = excluded.sent_at
        SQL)->execute([$mailingId, $email, $status, $error, gmdate('Y-m-d\TH:i:s\Z')]);
}

/**
 * Lit un template : sujet (balise <title>), HTML (avec un pied de page de désinscription s'il n'a pas
 * {{desinscription}}), texte (le .txt du même nom, sinon tiré du HTML, avec le lien de désinscription).
 * @return array{subject: string, html: string, text: string, baseDir: string}
 */
function load_template(string $path): array
{
    $html = (string) file_get_contents($path);
    if (!mb_check_encoding($html, 'UTF-8')) {
        throw new RuntimeException("Le template $path doit être enregistré en UTF-8.");
    }
    $subject = preg_match('~<title\b[^>]*>(.*?)</title>~is', $html, $m)
        ? trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8')))
        : '';
    if ($subject === '') {
        throw new RuntimeException("Sujet manquant : ajoutez <title>…</title> au template $path.");
    }
    $textPath = preg_replace('/\.html?$/i', '.txt', $path);
    $text = $textPath !== $path && is_file($textPath) ? (string) file_get_contents($textPath) : null;
    $unknown = array_diff(array_merge(placeholders($html), placeholders($subject), $text === null ? [] : placeholders($text)), VARIABLES);
    if ($unknown) {
        throw new RuntimeException('Variable inconnue dans ' . basename($path) . ' : {{' . implode('}}, {{', $unknown) . '}}');
    }
    if (!in_array('desinscription', placeholders($html), true)) {
        $html = add_unsubscribe_footer($html);
    }
    $text ??= html_to_text($html);
    if (!in_array('desinscription', placeholders($text), true)) {
        $text = rtrim($text) . "\n\n--\nSe désinscrire : {{desinscription}}\n";
    }
    return ['subject' => $subject, 'html' => $html, 'text' => $text, 'baseDir' => dirname($path)];
}

/**
 * Le mail de confirmation d'une nouvelle inscription, avec son lien personnel de désinscription. Suivi
 * comme une campagne (CONFIRMATION_CAMPAIGN) : envoyé ou en échec, avec la raison. Lève une exception
 * si l'envoi échoue (après l'avoir noté).
 */
function send_confirmation(PDO $pdo, string $email, string $templatePath): void
{
    $st = $pdo->prepare('SELECT id, email, name FROM signups WHERE email = ?');
    $st->execute([$email]);
    $subscriber = $st->fetch() ?: throw new RuntimeException("Inscrit introuvable : $email");
    $st->closeCursor(); // voir db() dans lib.php
    $template = load_template($templatePath);

    $pdo->prepare(<<<'SQL'
        INSERT INTO mailings (campaign, subject, template, content_sha, created_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (campaign) DO UPDATE SET subject = excluded.subject, template = excluded.template, content_sha = excluded.content_sha
        SQL)->execute([
        CONFIRMATION_CAMPAIGN, $template['subject'], $templatePath,
        hash('sha256', $template['subject'] . "\0" . $template['html'] . "\0" . $template['text']), gmdate('Y-m-d\TH:i:s\Z'),
    ]);
    $st = $pdo->prepare('SELECT id FROM mailings WHERE campaign = ?');
    $st->execute([CONFIRMATION_CAMPAIGN]);
    $mailingId = (int) $st->fetchColumn();
    $st->closeCursor();

    $mail = make_mailer(config()['mail'], false, 10);
    try {
        send_one($mail, vars_for($subscriber), $template['subject'], $template['html'], $template['text'], $template['baseDir']);
    } catch (MailerException $e) {
        $error = trim(preg_replace('/\s+/u', ' ', $mail->ErrorInfo ?: $e->getMessage()));
        record_send($pdo, $mailingId, $subscriber['email'], 'failed', $error);
        throw new RuntimeException("confirmation non envoyée à {$subscriber['email']} : $error", 0, $e);
    }
    record_send($pdo, $mailingId, $subscriber['email'], 'sent', null);
}

/**
 * Prévient le propriétaire du site d'une nouvelle inscription (réglage « notify » de config.php) : un court
 * message texte avec le nom, l'adresse, la source, l'heure, le sort du mail de confirmation et le nombre
 * d'inscrits. « Répondre » écrit directement à la personne inscrite.
 * @param string[] $to
 */
function send_notification(PDO $pdo, string $email, array $to, string $confirmation): void
{
    $st = $pdo->prepare('SELECT email, name, source, created_at FROM signups WHERE email = ?');
    $st->execute([$email]);
    $s = $st->fetch() ?: throw new RuntimeException("Inscrit introuvable : $email");
    $st->closeCursor();
    $total = (int) $pdo->query('SELECT COUNT(*) FROM signups')->fetchColumn();
    $when = (new \DateTimeImmutable($s['created_at']))->setTimezone(new \DateTimeZone('Europe/Paris'))->format('d/m/Y à H:i');

    $mail = make_mailer(config()['mail'], false, 10);
    $mail->clearReplyTos();
    $mail->addReplyTo($s['email'], $s['name']);
    foreach ($to as $address) {
        $mail->addAddress($address);
    }
    $mail->addCustomHeader('Auto-Submitted', 'auto-generated'); // pas de réponse automatique (absence, etc.)
    $mail->isHTML(false);
    $mail->Subject = "Nouvelle inscription : {$s['name']} ({$s['email']})";
    $mail->Body = implode("\n", [
        'Nouvelle inscription aux nouvelles de Gamebox Hero.',
        '',
        "Nom     : {$s['name']}",
        "E-mail  : {$s['email']}",
        "Source  : {$s['source']}",
        "Date    : $when (heure de Paris)",
        '',
        "Mail de confirmation : $confirmation",
        "Inscrits en tout : $total",
        '',
        'Répondre à ce message écrit directement à la personne inscrite.',
        "Pour la retirer de la liste : php bin/signups.php supprimer {$s['email']}",
    ]);
    $mail->send();
}
