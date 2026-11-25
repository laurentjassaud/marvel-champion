# Mémo : inscriptions et newsletter Gamebox Hero

L'essentiel pour faire tourner « Rester informé » sur gameboxheroes.fr. Le détail complet est dans [README.md](README.md).

## Comment ça marche

1. Un visiteur remplit « Rester informé » dans l'appli. `api/signup.php` enregistre son nom et son e-mail dans la base SQLite du VPS.
2. S'il s'agit d'une **nouvelle** adresse, deux mails partent juste après la réponse au visiteur, qui n'attend donc pas :
   - à l'inscrit : le **mail de confirmation**, avec son lien personnel de désinscription ;
   - à `contact@gameboxheroes.fr` : l'**avis de nouvelle inscription** (nom, adresse, source, heure, résultat du mail de confirmation). Si tu cliques sur « Répondre », ta réponse part à l'inscrit.
3. Une adresse déjà inscrite qui se réinscrit ne déclenche aucun mail.
4. La **newsletter** s'envoie à la main depuis le VPS avec `bin/mailing.php` (voir plus bas).
5. La **désinscription** se fait par le lien présent dans chaque mail, ou par le bouton « Se désabonner » de Gmail, Outlook ou Apple Mail. Le nom, l'adresse et l'historique d'envoi sont alors effacés.
6. **« Signaler un bug »** (onglet de l'appli pendant la partie) : `api/bug-report.php` t'envoie le rapport par mail (sujet `[Bug] …`), la partie jointe. Rien n'est enregistré dans la base. Si le joueur a laissé son adresse, « Répondre » lui écrit.
7. **Relais MC4DB** : `api/mc4db.php` lit pour l'appli les decks, cartes, decks d'un auteur et images de MC4DB (que l'appli ne peut pas lire elle-même, « Charger un deck » avec un lien MC4DB), avec un cache dans `data/mc4db-cache` et des demandes espacées pour ménager MC4DB. Détail : README, partie 7.

Les mails partent par le serveur d'envoi d'OVH (`ssl0.ovh.net`), avec le compte `contact@gameboxheroes.fr`.

## Où sont les fichiers

| Dans le dépôt (`server/`) | Sur le VPS | Rôle |
| --- | --- | --- |
| `public/api/signup.php` | `/home/prod/WWW/base/api/` | reçoit les inscriptions |
| `public/api/unsubscribe.php` | `/home/prod/WWW/base/api/` | page de désinscription |
| `public/api/bug-report.php` | `/home/prod/WWW/base/api/` | reçoit les rapports de bug |
| `public/api/mc4db.php` | `/home/prod/WWW/base/api/` | relais vers l'API de MC4DB |
| `private/lib.php`, `private/mail.php` | `/home/prod/gamebox-private/` | le code commun |
| `private/bug-report.php` | `/home/prod/gamebox-private/` | rapports de bug (vérification, mail) |
| `private/mc4db.php` | `/home/prod/gamebox-private/` | relais MC4DB (demandes acceptées, cache) |
| `private/bin/mailing.php` | `/home/prod/gamebox-private/bin/` | envoi de la newsletter |
| `private/bin/signups.php` | `/home/prod/gamebox-private/bin/` | consulter et gérer les inscrits |
| `private/templates/*.html` | `/home/prod/gamebox-private/templates/` | mail de confirmation et newsletters |
| `public/mail/*` | `/home/prod/WWW/base/mail/` | images du mail de confirmation (fond de l'en-tête, logo) et de la page de désinscription (le fond), servies sur `https://www.gameboxheroes.fr/mail/` |
| `private/vendor/` | `/home/prod/gamebox-private/vendor/` | PHPMailer |
| *(pas dans le dépôt)* `config.php` | `/home/prod/gamebox-private/` | réglages et secrets |
| *(pas dans le dépôt)* `data/` | `/home/prod/gamebox-private/data/` | la base des inscrits |

- L'appli est en ligne sur `https://www.gameboxheroes.fr/marvel-champions-table/`.
- Le dossier `server/` existe en deux exemplaires : dans le dépôt `marvel-champion` et dans le dépôt `home`. Toute modification doit être reportée dans les deux.
- **Pour mettre à jour le script**, dépose les fichiers modifiés avec WinSCP aux emplacements du tableau. Pas besoin de redémarrer quoi que ce soit.

## `config.php` (sur le VPS uniquement)

Il n'est jamais envoyé sur GitHub, car il contient les secrets et le mot de passe. Droits : `prod:www-data`, `640`.

| Réglage | Valeur | À savoir |
| --- | --- | --- |
| `ip_salt` | 64 caractères aléatoires | protège les IP de l'anti-spam ; peut être changé |
| `unsubscribe_secret` | 64 caractères aléatoires | **ne plus jamais le changer** : les liens de désinscription déjà envoyés ne marcheraient plus |
| `site_url` | `https://gameboxheroes.fr` | sert à construire les liens de désinscription |
| `notify` | `contact@gameboxheroes.fr` | avis de nouvelle inscription ; `''` pour ne plus en recevoir |
| `confirmation` | *(absent)* | `false` pour couper le mail de confirmation |
| `bug_report` → `to` | `contact@gameboxheroes.fr` | qui reçoit les rapports de bug ; absent : les adresses de `notify` |
| `bug_report` → `rate_limit` | `5` par `3600` s | rapports par connexion ; absent : 5 par heure |
| `mc4db` → `rate_limit` | `300` par `3600` s | demandes envoyées à MC4DB par connexion (le cache ne compte pas) ; absent : 300 par heure |
| `mail` → `host` / `port` / `encryption` | `ssl0.ovh.net` / `465` / `ssl` | serveur d'envoi OVH |
| `mail` → `username`, `from_email` | `contact@gameboxheroes.fr` | toujours la même adresse pour les deux |
| `mail` → `password` | mot de passe de `contact@` | à mettre à jour si tu le changes chez OVH |
| `mail` → `per_minute` | `3` | OVH limite à environ 200 mails par heure |

Pour générer un secret : `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`

Après chaque modification, vérifie le fichier :

```bash
sudo -u www-data php -l /home/prod/gamebox-private/config.php
grep -n "'host'\|'port'\|'notify'" /home/prod/gamebox-private/config.php
```

Le premier doit afficher `No syntax errors detected`. Le second vérifie que la modification est bien arrivée sur le serveur : il arrive que WinSCP n'enregistre pas.

## Envoyer une newsletter

**1. Écrire.** Copie `templates/exemple-nouveautes.html` sous un nouveau nom, par exemple `2026-12-nouveautes.html`. Ce nom sert de nom à la campagne : prends-en un nouveau à chaque newsletter, et ne le change plus une fois l'envoi lancé.

- `<title>` devient le sujet du mail.
- Le bloc caché après `<body>` est le texte d'aperçu, affiché à côté du sujet.
- Variables possibles : `{{prenom}}`, `{{nom}}`, `{{email}}`, et `{{desinscription}}`, le lien de désinscription, à garder dans le pied de page.
- Pour les images, mieux vaut des adresses en `https://www.gameboxheroes.fr/...` (le dossier `public/mail/`, déposé dans `WWW/base/mail/`, sert à ça). Une image en chemin relatif est jointe au mail.

Dépose le fichier dans `/home/prod/gamebox-private/templates/`.

**2. Tester.** Le mail part à ta seule adresse, avec « [Test] » devant le sujet, et rien n'est enregistré :

```bash
cd /home/prod/gamebox-private
sudo -u www-data php bin/mailing.php templates/2026-12-nouveautes.html --test=TON-ADRESSE@...
```

**3. Envoyer à tous.** Compte environ 20 minutes pour 60 inscrits. L'envoi continue même si tu fermes le terminal :

```bash
sudo -v
sudo -u www-data nohup php bin/mailing.php templates/2026-12-nouveautes.html --oui > envoi.log 2>&1 &
tail -f envoi.log
```

- `sudo -v` demande le mot de passe avant : une commande en arrière-plan ne peut pas le demander.
- Ctrl+C arrête l'affichage de `tail`, pas l'envoi.
- Pour une petite liste, tu peux lancer l'envoi sans `nohup` ni `--oui` : le script affiche alors un résumé et demande confirmation.

**Reprise.** Si l'envoi est coupé, relance la même commande. Ceux qui ont déjà reçu le mail sont sautés et les échecs sont retentés : personne ne le reçoit deux fois. Le script s'arrête de lui-même après 5 échecs de suite.

**Options utiles :**

| Option | Effet |
| --- | --- |
| `--source=marvel-champions` | seulement les inscrits venus de l'appli Marvel |
| `--limite=100` | au plus 100 envois pour ce lancement |
| `--sujet="…"` | un autre sujet que le `<title>` |
| `--campagne=autre-nom` | renvoyer le même fichier à tout le monde, comme une nouvelle campagne |
| `--simulation` | n'envoie rien : compte les destinataires et teste la connexion |

## Consulter et gérer les inscrits

Toutes ces commandes se lancent depuis `/home/prod/gamebox-private` :

```bash
sudo -u www-data php bin/signups.php compte                              # nombre d'inscrits, par source
sudo -u www-data php bin/signups.php liste                               # la liste
sudo -u www-data php bin/signups.php export > ~/inscrits.csv             # fichier pour Excel / LibreOffice
sudo -u www-data php bin/signups.php supprimer adresse@exemple.fr        # effacer quelqu'un (RGPD)
sudo -u www-data php bin/signups.php campagnes                           # envois et échecs par campagne
sudo -u www-data php bin/signups.php echecs confirmation-inscription     # confirmations en échec, avec la raison
sudo -u www-data php bin/signups.php echecs 2026-12-nouveautes           # idem pour une newsletter
```

Les mails de confirmation sont suivis comme une campagne nommée `confirmation-inscription`.

## Dépannage

**Aucun mail après une inscription :**
1. L'adresse était-elle déjà inscrite ? Une réinscription ne déclenche aucun mail. Pour refaire un essai : `bin/signups.php supprimer adresse`.
2. Regarde les échecs enregistrés : `bin/signups.php echecs confirmation-inscription`.
3. Regarde le journal du site : `sudo tail -n 20 /var/log/apache2/base-error.log` (lignes `[gamebox-signup]`).
4. Vérifie la connexion au serveur d'envoi avec le test ci-dessous.

**Tester la connexion au serveur d'envoi.** Ce test vérifie l'adresse du serveur et le mot de passe sans envoyer de mail, et le mot de passe reste masqué à l'écran. Colle tout le bloc, de `cd` jusqu'à la dernière ligne `PHP` :

```bash
cd /home/prod/gamebox-private
sudo -u www-data php <<'PHP'
<?php
require 'vendor/autoload.php';
$m = (require 'config.php')['mail'];
$mail = new PHPMailer\PHPMailer\PHPMailer(true);
$mail->isSMTP();
$mail->Host = $m['host']; $mail->Port = $m['port'];
$mail->SMTPSecure = $m['encryption'] === 'ssl' ? 'ssl' : 'tls';
$mail->SMTPAuth = true; $mail->Username = $m['username']; $mail->Password = $m['password'];
$mail->Timeout = 15;
$mail->SMTPDebug = 3; $mail->Debugoutput = 'echo';
try { $mail->smtpConnect(); echo "\n>>> CONNEXION ET MOT DE PASSE OK\n"; $mail->smtpClose(); }
catch (Throwable $e) { echo "\n>>> ÉCHEC : ", $e->getMessage(), "\n"; }
PHP
```

| Ce que tu vois | Cause | Solution |
| --- | --- | --- |
| `opening to smtp.exemple.fr` | `config.php` n'est pas à jour sur le serveur | réenregistrer dans WinSCP, puis vérifier avec `grep` |
| `Connection timed out` ou `refused` | le pare-feu du VPS bloque le port | demander à l'admin d'ouvrir les connexions sortantes vers `ssl0.ovh.net:465` |
| `535` ou `authentication failed` | mauvais mot de passe | le vérifier sur le webmail OVH, puis le corriger dans `config.php` |
| `certificate verify failed` | certificats manquants sur le VPS | `sudo apt install ca-certificates` |
| `>>> CONNEXION ET MOT DE PASSE OK` | la connexion fonctionne | chercher ailleurs : étapes 1 à 3 ci-dessus |

**Tester si un port est ouvert**, depuis le VPS et non depuis ton PC :

```bash
for p in 465 587; do timeout 5 bash -c "</dev/tcp/ssl0.ovh.net/$p" 2>/dev/null && echo "port $p : OUVERT" || echo "port $p : BLOQUÉ"; done
```

**Les mails arrivent en spam :** active DKIM et ajoute DMARC (voir ci-dessous).

## Reste à faire

- [ ] **Changer le mot de passe de `contact@`** chez OVH (il est apparu sur une capture), puis le reporter dans `config.php`.
- [ ] **DKIM** : espace client OVH → Web Cloud → E-mails → gameboxheroes.fr → activer DKIM.
- [ ] **DMARC** : Zone DNS de gameboxheroes.fr → ajouter une entrée TXT, sous-domaine `_dmarc`, valeur `v=DMARC1; p=none`.
- [x] **Politique de confidentialité** : rédigée dans l'appli Marvel (fenêtre « Mentions légales », `src/components/LegalNotice.vue`) et reliée au formulaire (« Vos données et vos droits »). À tenir à jour si les données collectées, les prestataires ou la durée de conservation changent.
- [ ] **Durée de conservation** : les mentions légales annoncent « jusqu'à la désinscription, ou 3 ans après le dernier contact ». Le script ne purge rien de lui-même : une fois par an, supprimer avec `bin/signups.php supprimer` les inscrits dont l'inscription date de plus de 3 ans.
- [ ] **Rapports de bug** : déposer `public/api/bug-report.php` et `private/bug-report.php` sur le VPS (tableau plus haut), ajouter le bloc `bug_report` à `config.php` si besoin, puis vérifier avec `curl -s -X POST https://gameboxheroes.fr/api/bug-report.php -H 'Origin: https://gameboxheroes.fr' -H 'Content-Type: application/json' -d '{}'` (réponse attendue : `Envoi trop rapide`). Supprimer les mails de rapports une fois le bug réglé (les mentions légales annoncent qu'ils sont gardés « le temps de traiter le problème »).
- [ ] **Relais MC4DB** : vérifier `php -m | grep curl` sur le VPS (sinon `sudo apt install php-curl`), déposer `public/api/mc4db.php` et `private/mc4db.php`, puis `curl -s "https://gameboxheroes.fr/api/mc4db.php?decklist=58"` (réponse attendue : le JSON du deck Mystique). Prévenir Merlin (MC4DB) que le site interroge son API, et de la fuite des e-mails sur `/api/public/user/<n>`.
- [ ] **Un seul exemplaire de `server/`** : choisir entre le dépôt `marvel-champion` et le dépôt `home`.

## Tester le script sur ton PC

Avec Docker, depuis la racine du dépôt. Ces tests ne touchent ni à la vraie base ni au vrai serveur d'envoi :

```bash
docker run --rm -v "$PWD/server:/srv:ro" -w /srv php:8.3-cli php tests/confirmation-test.php
docker run --rm -v "$PWD/server:/srv:ro" -w /srv php:8.3-cli php tests/api-test.php
docker run --rm -v "$PWD/server:/srv:ro" -w /srv php:8.3-cli php tests/mailing-test.php
docker run --rm -v "$PWD/server:/srv:ro" -w /srv php:8.3-cli php tests/bug-report-test.php
docker run --rm -v "$PWD/server:/srv:ro" -w /srv php:8.3-cli php tests/mc4db-test.php
```

Résultats attendus : 42, 39, 77, 40 et 45 vérifications réussies.
