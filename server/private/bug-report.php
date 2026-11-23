<?php
/**
 * Rapports de bug de Marvel Champions Table (« Signaler un bug ») : validation du rapport reçu, puis envoi par
 * e-mail à l'auteur de l'appli, la partie en cours en pièce jointe. Rien n'est enregistré sur le serveur, sauf
 * l'empreinte de l'adresse IP, une heure, pour l'anti-spam (comme l'inscription : table rate_hits, sous une clé
 * à part). Utilisé par public/api/bug-report.php. Demande PHPMailer (mail.php) pour l'envoi seulement.
 *
 * Réglages de config.php (bloc « bug_report », facultatif) :
 *   'to'         l'adresse, ou la liste d'adresses, qui reçoit les rapports (sinon celles de « notify »)
 *   'rate_limit' au plus `max` rapports par connexion sur `window` secondes (5 par heure par défaut ; garder la
 *                même fenêtre que celle de l'inscription, la table rate_hits étant purgée avec elle)
 */
declare(strict_types=1);

namespace GameboxHero\BugReport;

use DateTimeImmutable;
use DateTimeZone;
use function GameboxHero\Signup\{clean_text, mail_configured, make_mailer};

require_once __DIR__ . '/lib.php';

const BODY_MAX = 1_048_576;   // octets : une partie enregistrée fait de 20 à 100 Ko
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const EMAIL_MAX = 254;
const LINE_MAX = 400;         // une ligne du contexte ou du journal
const CONTEXT_MAX = 20;       // lignes du contexte
const JOURNAL_MAX = 100;      // derniers messages du journal recopiés dans le mail
const GAME_MAX = 900_000;     // la partie jointe, en octets
const DEFAULT_RATE = ['max' => 5, 'window' => 3600];

/**
 * Les adresses qui reçoivent les rapports : « bug_report.to », sinon « notify ». Vide si aucune n'est valide ou
 * si le bloc « mail » n'est pas rempli : le service est alors fermé (503).
 * @return string[]
 */
function recipients(array $config): array
{
    $list = $config['bug_report']['to'] ?? $config['notify'] ?? [];
    $list = is_string($list) ? [$list] : (is_array($list) ? $list : []);
    $valid = array_values(array_filter(
        array_map(fn ($address) => trim((string) $address), $list),
        fn ($address) => filter_var($address, FILTER_VALIDATE_EMAIL) !== false
    ));
    return $valid && mail_configured($config) ? $valid : [];
}

/** La limite d'envoi : « bug_report.rate_limit », sinon 5 rapports par heure. @return array{max: int, window: int} */
function rate_limit(array $config): array
{
    $limit = $config['bug_report']['rate_limit'] ?? DEFAULT_RATE;
    return ['max' => (int) ($limit['max'] ?? DEFAULT_RATE['max']), 'window' => (int) ($limit['window'] ?? DEFAULT_RATE['window'])];
}

/** Coupe un texte à `max` caractères, avec « … » s'il a fallu couper. */
function cut(string $text, int $max): string
{
    return mb_strlen($text) > $max ? rtrim(mb_substr($text, 0, $max - 1)) . '…' : $text;
}

/**
 * Un texte sur plusieurs lignes (la description) : retours à la ligne gardés, autres caractères de contrôle
 * retirés, espaces de fin de ligne et lignes vides en trop supprimés, coupé à `max` caractères. '' si l'entrée
 * n'est pas une chaîne UTF-8.
 */
function clean_multiline(mixed $value, int $max): string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        return '';
    }
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[^\P{Cc}\n]|[\p{Cf}\p{Zl}\p{Zp}]/u', ' ', $value) ?? '';
    $value = preg_replace('/[ \t]+\n/u', "\n", $value) ?? '';
    $value = preg_replace("/\n{3,}/", "\n\n", $value) ?? '';
    return cut(trim($value), $max);
}

/** Une liste de lignes (le journal) : des chaînes nettoyées, les `count` dernières, chacune coupée. @return string[] */
function clean_lines(mixed $value, int $count): array
{
    $lines = is_array($value) ? array_values(array_filter($value, 'is_string')) : [];
    $lines = array_map(fn ($line) => cut(clean_text($line), LINE_MAX), array_slice($lines, -$count));
    return array_values(array_filter($lines, fn ($line) => $line !== ''));
}

/**
 * Valide le rapport reçu.
 * @return array{0: array{title: string, description: string, email: string, context: list<array{0: string, 1: string}>,
 *   journal: string[], version: string, game: ?string, gameNote: string}, 1: array<string, string>}
 *   [données nettoyées, erreurs par champ]
 */
function validate(array $in): array
{
    $errors = [];

    $title = clean_text($in['title'] ?? null);
    if ($title === '') {
        $errors['title'] = 'Donnez un titre au rapport.';
    }
    $title = cut($title, TITLE_MAX);

    $email = mb_strtolower(clean_text($in['email'] ?? null));
    if ($email !== '' && (strlen($email) > EMAIL_MAX || filter_var($email, FILTER_VALIDATE_EMAIL) === false)) {
        $errors['email'] = "Cette adresse e-mail n'est pas valide (ou laissez le champ vide).";
    }

    $context = [];
    foreach (is_array($in['context'] ?? null) ? array_slice($in['context'], 0, CONTEXT_MAX) : [] as $pair) {
        if (is_array($pair) && count($pair) === 2) {
            [$label, $value] = [cut(clean_text($pair[0] ?? null), 60), cut(clean_text($pair[1] ?? null), LINE_MAX)];
            if ($label !== '' && $value !== '') {
                $context[] = [$label, $value];
            }
        }
    }

    // la partie jointe : un objet JSON, sinon le rapport part sans elle, en le disant
    $game = $in['game'] ?? null;
    $gameNote = '';
    if (!is_string($game) || $game === '') {
        [$game, $gameNote] = [null, 'aucune partie en cours'];
    } elseif (strlen($game) > GAME_MAX) {
        [$game, $gameNote] = [null, 'partie trop volumineuse, non jointe'];
    } elseif (!mb_check_encoding($game, 'UTF-8') || !is_array(json_decode($game, true, 64))) {
        [$game, $gameNote] = [null, 'partie illisible, non jointe'];
    }

    return [[
        'title' => $title,
        'description' => clean_multiline($in['description'] ?? null, DESCRIPTION_MAX),
        'email' => $email,
        'context' => $context,
        'journal' => clean_lines($in['journal'] ?? null, JOURNAL_MAX),
        'version' => cut(clean_text($in['version'] ?? null), 80),
        'game' => $game,
        'gameNote' => $gameNote,
    ], $errors];
}

/** Le nom de la partie jointe : "bug-report_mc-table_2026-11-23_08-15.json" (heure de Paris). */
function attachment_name(DateTimeImmutable $now): string
{
    return 'bug-report_mc-table_' . $now->setTimezone(new DateTimeZone('Europe/Paris'))->format('Y-m-d_H-i') . '.json';
}

/**
 * Le texte du mail : le rapport en clair, puis comment rouvrir la partie jointe et en faire un ticket GitHub.
 * @param array{title: string, description: string, email: string, context: list<array{0: string, 1: string}>,
 *   journal: string[], version: string, game: ?string, gameNote: string} $report
 */
function mail_body(array $report, string $userAgent, DateTimeImmutable $now): string
{
    $when = $now->setTimezone(new DateTimeZone('Europe/Paris'))->format('d/m/Y à H:i');
    $lines = [
        'Nouveau rapport de bug de Marvel Champions Table.',
        '',
        "Titre    : {$report['title']}",
        'E-mail   : ' . ($report['email'] !== '' ? "{$report['email']} (« Répondre » lui écrit)" : 'non donné'),
        "Date     : $when (heure de Paris)",
        '',
        'Description :',
        $report['description'] !== '' ? $report['description'] : '(pas de description)',
        '',
        'Contexte :',
    ];
    foreach ($report['context'] as [$label, $value]) {
        $lines[] = "- $label : $value";
    }
    $lines[] = '- Version : ' . ($report['version'] !== '' ? $report['version'] : 'inconnue');
    $lines[] = '- Navigateur : ' . ($userAgent !== '' ? $userAgent : 'inconnu');
    if ($report['journal']) {
        $lines[] = '';
        $lines[] = 'Journal (' . count($report['journal']) . ' derniers messages, ★ : message de règle) :';
        array_push($lines, ...$report['journal']);
    }
    $lines[] = '';
    if ($report['game'] !== null) {
        $lines[] = 'La partie complète est jointe (' . attachment_name($now) . '). Pour la rouvrir : dans la console du';
        $lines[] = "navigateur, sur l'appli, localStorage.setItem('mc-table-vue-v1', <contenu du fichier>), puis recharger la page.";
    } else {
        $lines[] = "Pas de partie jointe : {$report['gameNote']}.";
    }
    $lines[] = 'Pour en faire un ticket : https://github.com/laurentjassaud/marvel-champion/issues/new';
    return implode("\n", $lines) . "\n";
}

/**
 * Envoie le rapport aux adresses `$to` : sujet « [Bug] titre », le rapport en texte, la partie jointe ;
 * « Répondre » écrit au joueur s'il a laissé son adresse. Lève une exception si l'envoi échoue.
 * @param string[] $to
 */
function send(array $report, array $to, array $mailConfig, string $userAgent, DateTimeImmutable $now): void
{
    require_once __DIR__ . '/mail.php';
    $mail = make_mailer($mailConfig, false, 15);
    if ($report['email'] !== '') {
        $mail->clearReplyTos();
        $mail->addReplyTo($report['email']);
    }
    foreach ($to as $address) {
        $mail->addAddress($address);
    }
    $mail->addCustomHeader('Auto-Submitted', 'auto-generated'); // pas de réponse automatique (absence, etc.)
    $mail->isHTML(false);
    $mail->Subject = "[Bug] {$report['title']}";
    $mail->Body = mail_body($report, $userAgent, $now);
    if ($report['game'] !== null) {
        $mail->addStringAttachment($report['game'], attachment_name($now), 'base64', 'application/json');
    }
    $mail->send();
}
