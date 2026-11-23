<?php
/**
 * Configuration du formulaire d'inscription (nom + e-mail).
 *
 * Copier ce fichier en config.php dans le même dossier, puis adapter.
 * Ce dossier doit rester HORS de la racine web d'Apache.
 */
return [
    // Fichier SQLite. Le dossier data/ doit être accessible en écriture par Apache (www-data) :
    // SQLite y crée ses fichiers de journal à côté de la base.
    'db_path' => __DIR__ . '/data/signups.sqlite',

    // Origines autorisées à envoyer le formulaire (schéma + domaine, sans slash final).
    'allowed_origins' => [
        'https://gameboxheroes.fr',
        'https://www.gameboxheroes.fr',
        // 'http://localhost:5173', // à décommenter sur un poste de dev (serveur Vite)
    ],

    // Sources acceptées : le même script peut servir à d'autres modules Gamebox Hero.
    'allowed_sources' => ['marvel-champions', 'gamebox-hero'],
    'default_source' => 'marvel-champions',

    // Sel secret pour hacher les adresses IP de l'anti-spam (l'IP en clair n'est jamais stockée).
    // Générer avec : php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    'ip_salt' => 'A-REMPLACER',

    // Au plus `max` envois par IP sur `window` secondes.
    'rate_limit' => ['max' => 5, 'window' => 3600],

    // Délai minimal (ms) entre l'affichage du formulaire et l'envoi. En dessous, c'est un robot.
    'min_elapsed_ms' => 1500,

    // Refuse les e-mails dont le domaine ne reçoit pas de courrier (faute de frappe type gmail.con).
    'check_mx' => true,

    // ── Mailing list (bin/mailing.php) ──────────────────────────────────────────

    // Adresse publique du site, pour construire les liens de désinscription.
    'site_url' => 'https://gameboxheroes.fr',

    // Secret qui signe les liens de désinscription. Ne plus le changer après le premier envoi,
    // sinon les liens des messages déjà envoyés ne fonctionnent plus.
    // Générer avec : php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    'unsubscribe_secret' => 'A-REMPLACER',

    // Mail de confirmation envoyé à chaque nouvelle inscription, avec le lien de désinscription : le chemin
    // du template, ou false pour n'en envoyer aucun. Il ne part que si le bloc « mail » ci-dessous est rempli
    // (et unsubscribe_secret). Suivi : php bin/signups.php echecs confirmation-inscription
    'confirmation' => __DIR__ . '/templates/confirmation.html',

    // Avis de nouvelle inscription : à chaque nouvelle adresse, un court mail (nom, adresse, source, heure, sort
    // du mail de confirmation) part à cette adresse, ou à chacune d'une liste : ['a@…', 'b@…']. '' : aucun avis.
    // « Répondre » à cet avis écrit directement à la personne inscrite. Demande aussi le bloc « mail » rempli.
    'notify' => 'contact@gameboxheroes.fr',

    // ── Rapports de bug (« Signaler un bug » de l'appli, public/api/bug-report.php) ─────────────────
    // Chaque rapport part par e-mail, la partie en pièce jointe ; rien n'est enregistré. Demande le bloc « mail ».
    'bug_report' => [
        // Qui reçoit les rapports : une adresse ou une liste. Absent : les adresses de « notify ».
        'to' => 'contact@gameboxheroes.fr',
        // Au plus `max` rapports par connexion sur `window` secondes (même fenêtre que rate_limit, plus haut).
        'rate_limit' => ['max' => 5, 'window' => 3600],
    ],

    'mail' => [
        // 'smtp' : passe par un serveur SMTP authentifié (hébergeur, Brevo, Mailjet, Google Workspace…).
        //          C'est le choix conseillé pour la délivrabilité.
        // 'sendmail' : passe par le Postfix ou Exim local du VPS. Il faut alors SPF + DKIM sur le domaine.
        'transport' => 'smtp',

        'host' => 'smtp.exemple.fr',
        'port' => 587,
        'encryption' => 'tls',   // 'tls' (STARTTLS, port 587), 'ssl' (port 465) ou '' (aucun)
        'username' => '',
        'password' => '',

        'from_email' => 'contact@gameboxheroes.fr',
        'from_name' => 'Gamebox Hero',
        'reply_to' => '',        // adresse de réponse, si différente de from_email

        // Cadence d'envoi. Reste sous le quota de ton fournisseur SMTP.
        'per_minute' => 30,

        // Signature DKIM faite par PHP. Seulement en 'sendmail' sans DKIM déjà configuré dans Postfix.
        // 'dkim' => ['domain' => 'gameboxheroes.fr', 'selector' => 'gbh', 'private_key' => __DIR__ . '/dkim.private'],
        'dkim' => null,
    ],
];
