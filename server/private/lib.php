<?php
/**
 * Inscriptions Gamebox Hero : configuration, base SQLite, validation, anti-spam.
 * Utilisé par public/api/signup.php (web) et bin/signups.php (ligne de commande).
 */
declare(strict_types=1);

namespace GameboxHero\Signup;

use PDO;
use RuntimeException;

const NAME_MAX = 80;
const EMAIL_MAX = 254;
const BODY_MAX = 4096; // octets : un envoi légitime fait moins de 300 octets

function config(): array
{
    static $config = null;
    if ($config === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) {
            throw new RuntimeException('config.php introuvable dans ' . __DIR__ . ' (copier config.sample.php)');
        }
        $config = require $file;
        if (($config['ip_salt'] ?? '') === '' || $config['ip_salt'] === 'A-REMPLACER') {
            throw new RuntimeException('ip_salt doit être renseigné dans config.php');
        }
    }
    return $config;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $path = config()['db_path'];
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) {
            throw new RuntimeException("Impossible de créer le dossier $dir");
        }
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        // Plusieurs inscriptions à la fois : chaque écriture attend son tour (jusqu'à 5 s) au lieu d'échouer.
        // Ce délai réglé en premier vaut aussi pour la ligne suivante. Attention : une lecture dont le résultat
        // n'est pas lu en entier (fetch() d'une seule ligne) garde la base ouverte en lecture, et l'écriture qui
        // suit échoue tout de suite si quelqu'un a écrit entre-temps. Fermer ces lectures (closeCursor()).
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec('PRAGMA journal_mode = WAL');
        migrate($pdo);
    }
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS signups (
            id         INTEGER PRIMARY KEY,
            email      TEXT NOT NULL UNIQUE,
            name       TEXT NOT NULL,
            source     TEXT NOT NULL,
            consent_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rate_hits (
            ip_hash TEXT    NOT NULL,
            hit_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS rate_hits_ip ON rate_hits (ip_hash, hit_at);

        CREATE TABLE IF NOT EXISTS mailings (
            id          INTEGER PRIMARY KEY,
            campaign    TEXT NOT NULL UNIQUE,
            subject     TEXT NOT NULL,
            template    TEXT NOT NULL,
            content_sha TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            finished_at TEXT
        );
        CREATE TABLE IF NOT EXISTS mailing_sends (
            mailing_id INTEGER NOT NULL REFERENCES mailings (id),
            email      TEXT NOT NULL,
            status     TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
            error      TEXT,
            sent_at    TEXT NOT NULL,
            PRIMARY KEY (mailing_id, email)
        );
        SQL);
}

/** Supprime un inscrit et l'historique de ses envois (désinscription, droit à l'effacement). */
function delete_subscriber(PDO $pdo, string $email): bool
{
    $email = mb_strtolower(trim($email));
    $pdo->beginTransaction();
    $st = $pdo->prepare('DELETE FROM signups WHERE email = ?');
    $st->execute([$email]);
    $pdo->prepare('DELETE FROM mailing_sends WHERE email = ?')->execute([$email]);
    $pdo->commit();
    return $st->rowCount() > 0;
}

function unsubscribe_secret(): string
{
    $secret = config()['unsubscribe_secret'] ?? '';
    if ($secret === '' || $secret === 'A-REMPLACER') {
        throw new RuntimeException('unsubscribe_secret doit être renseigné dans config.php');
    }
    return $secret;
}

/** Jeton signé : seul le destinataire du message peut se désinscrire avec ce lien. */
function unsubscribe_token(int $id, string $email): string
{
    return substr(hash_hmac('sha256', $id . ':' . mb_strtolower($email), unsubscribe_secret()), 0, 32);
}

function unsubscribe_url(int $id, string $email): string
{
    $site = rtrim((string) (config()['site_url'] ?? ''), '/');
    if ($site === '') {
        throw new RuntimeException('site_url doit être renseigné dans config.php');
    }
    return $site . '/api/unsubscribe.php?' . http_build_query(['u' => $id, 't' => unsubscribe_token($id, $email)]);
}

/** Supprime les caractères de contrôle et les espaces multiples. Renvoie '' si l'entrée n'est pas une chaîne UTF-8. */
function clean_text(mixed $value): string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        return '';
    }
    $value = preg_replace('/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/u', ' ', $value) ?? '';
    $value = preg_replace('/\s+/u', ' ', $value) ?? '';
    return trim($value);
}

function domain_accepts_mail(string $domain): bool
{
    if (function_exists('idn_to_ascii')) {
        $domain = idn_to_ascii($domain, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46) ?: $domain;
    }
    $fqdn = rtrim($domain, '.') . '.';
    return checkdnsrr($fqdn, 'MX') || checkdnsrr($fqdn, 'A') || checkdnsrr($fqdn, 'AAAA');
}

/**
 * Valide les données reçues.
 * @return array{0: array{name: string, email: string, source: string}, 1: array<string, string>}
 *         [données nettoyées, erreurs par champ]
 */
function validate(array $in, array $config): array
{
    $errors = [];

    $name = clean_text($in['name'] ?? null);
    if ($name === '') {
        $errors['name'] = 'Indiquez votre nom.';
    } elseif (mb_strlen($name) > NAME_MAX) {
        $errors['name'] = 'Le nom ne doit pas dépasser ' . NAME_MAX . ' caractères.';
    } elseif (preg_match('~(://|www\.|[<>{}\[\]])~i', $name)) {
        // Les robots glissent des liens dans le champ nom.
        $errors['name'] = 'Le nom contient des caractères non autorisés.';
    }

    $email = mb_strtolower(clean_text($in['email'] ?? null));
    if ($email === '') {
        $errors['email'] = 'Indiquez votre adresse e-mail.';
    } elseif (strlen($email) > EMAIL_MAX || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors['email'] = "Cette adresse e-mail n'est pas valide.";
    } elseif (!empty($config['check_mx']) && !domain_accepts_mail(substr($email, strrpos($email, '@') + 1))) {
        $errors['email'] = "Le domaine de cette adresse ne reçoit pas d'e-mails. Vérifiez l'orthographe.";
    }

    if (($in['consent'] ?? false) !== true) {
        $errors['consent'] = 'Votre accord est nécessaire pour enregistrer votre adresse.';
    }

    $source = $in['source'] ?? null;
    if (!is_string($source) || !in_array($source, $config['allowed_sources'], true)) {
        $source = $config['default_source'];
    }

    return [['name' => $name, 'email' => $email, 'source' => $source], $errors];
}

function ip_hash(string $ip, string $salt): string
{
    return hash_hmac('sha256', $ip, $salt);
}

/**
 * Compte une tentative pour cette IP.
 * @return int 0 si la tentative est acceptée, sinon le nombre de secondes à attendre.
 */
function check_rate(PDO $pdo, string $ipHash, int $max, int $window, int $now): int
{
    $pdo->prepare('DELETE FROM rate_hits WHERE hit_at <= ?')->execute([$now - $window]);

    $st = $pdo->prepare('SELECT COUNT(*) AS n, MIN(hit_at) AS first FROM rate_hits WHERE ip_hash = ?');
    $st->execute([$ipHash]);
    $row = $st->fetch();
    $st->closeCursor(); // voir db() : une lecture laissée ouverte ferait échouer l'écriture qui suit
    if ((int) $row['n'] >= $max) {
        return max(1, (int) $row['first'] + $window - $now);
    }

    $pdo->prepare('INSERT INTO rate_hits (ip_hash, hit_at) VALUES (?, ?)')->execute([$ipHash, $now]);
    return 0;
}

/**
 * Enregistre l'inscription. Si l'e-mail existe déjà, met à jour le nom et la date de consentement.
 * @return bool true pour une nouvelle adresse (elle reçoit le mail de confirmation), false pour une adresse déjà connue
 */
function save(PDO $pdo, array $data, string $now): bool
{
    // L'insertion seule dit si l'adresse est nouvelle : une seule requête, donc un seul gagnant même si deux
    // envois de la même adresse arrivent en même temps (deux onglets, double envoi). Un SELECT préalable
    // laisserait les deux se croire nouveaux, et le mail de confirmation partirait deux fois.
    $insert = $pdo->prepare(<<<'SQL'
        INSERT INTO signups (email, name, source, consent_at, created_at, updated_at)
        VALUES (:email, :name, :source, :now, :now, :now)
        ON CONFLICT (email) DO NOTHING
        SQL);
    $insert->execute([
        'email' => $data['email'],
        'name' => $data['name'],
        'source' => $data['source'],
        'now' => $now,
    ]);
    if ($insert->rowCount() === 1) {
        return true;
    }
    $pdo->prepare('UPDATE signups SET name = ?, consent_at = ?, updated_at = ? WHERE email = ?')
        ->execute([$data['name'], $now, $now, $data['email']]);
    return false;
}

/**
 * Le template du mail de confirmation envoyé à chaque nouvelle inscription, ou null s'il ne faut pas en
 * envoyer. Réglage « confirmation » de config.php : le chemin d'un template, ou false pour ne rien envoyer ;
 * absent, templates/confirmation.html. Rien non plus tant que le bloc « mail » n'est pas rempli (adresse
 * d'expéditeur, serveur SMTP autre que celui de l'exemple) ni unsubscribe_secret (le lien de désinscription).
 */
function confirmation_template(array $config): ?string
{
    $template = $config['confirmation'] ?? __DIR__ . '/templates/confirmation.html';
    if (!is_string($template) || !is_file($template)) {
        return null;
    }
    $mc = $config['mail'] ?? [];
    $smtp = ($mc['transport'] ?? 'smtp') === 'smtp';
    if (empty($mc['from_email']) || ($smtp && (empty($mc['host']) || $mc['host'] === 'smtp.exemple.fr'))) {
        return null;
    }
    if (($config['unsubscribe_secret'] ?? '') === '' || $config['unsubscribe_secret'] === 'A-REMPLACER' || empty($config['site_url'])) {
        return null;
    }
    return $template;
}
