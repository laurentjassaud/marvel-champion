# Inscription des visiteurs et mailing list

Rubrique « Restez informé » pour l'appli Marvel Champions de Gamebox Hero.
Le visiteur laisse son nom et son e-mail, un script PHP les enregistre dans une base SQLite sur le VPS.
Un second script envoie ensuite la mailing list à partir d'un template HTML (voir la partie 4).
Le même dossier reçoit aussi les rapports de bug de l'appli, envoyés par e-mail (« Signaler un bug », partie 6), et relaie l'API de MC4DB pour l'appli (partie 7).

Version courte, pour l'usage courant (réglages, newsletter, commandes, dépannage) : [MEMO NEWSLETTER.md](<MEMO NEWSLETTER.md>).

```
server/
  public/api/
    signup.php               → à copier dans la racine web (DocumentRoot)/api/
    unsubscribe.php          → idem : page de désinscription
    bug-report.php           → idem : rapports de bug (« Signaler un bug », partie 6)
    mc4db.php                → idem : relais vers MC4DB, données et images (partie 7)
  private/                   → à copier HORS de la racine web
    lib.php                  validation, anti-spam, base, liens de désinscription
    mail.php                 envoi des e-mails (mailing list et mail de confirmation)
    bug-report.php           rapports de bug : validation, envoi par e-mail avec la partie jointe
    mc4db.php                relais MC4DB : demandes acceptées, cache, appel à l'API
    config.sample.php        à copier en config.php
    bin/signups.php          outil d'admin (liste, export, suppression, suivi des campagnes)
    bin/mailing.php          envoi de la mailing list
    templates/               confirmation.html (mail de confirmation), template d'exemple
    vendor/                  PHPMailer 7.2 (déjà installé)
    composer.json / .lock
    .htaccess                filet de sécurité (Require all denied)
  tests/
    api-test.php             test de l'inscription (39 vérifications)
    mailing-test.php         test de la mailing list (77 vérifications)
    confirmation-test.php    test du mail de confirmation et de l’avis (42 vérifications)
    bug-report-test.php      test des rapports de bug (40 vérifications)
    mc4db-test.php           test du relais MC4DB (45 vérifications), avec un faux MC4DB (mc4db-fake.php)
    smtp-sink.php            faux serveur SMTP utilisé par le test
```

Le formulaire (côté appli) est déjà intégré : `src/components/SignupForm.vue`, `src/api/signup.js`, fenêtre `SignupModal`.

**Sur le VPS actuel** : dossier privé `/home/prod/gamebox-private` (c'est le chemin par défaut des deux pages publiques), pages publiques dans `/home/prod/WWW/base/api/` (`DocumentRoot` de gameboxheroes.fr). Apache tourne sous `www-data` : `data/` en 770 et `config.php` en 640, groupe `www-data`. PHP a besoin de `php-sqlite3` et `php-mbstring`.

## 1. Installer le script sur le VPS

Prérequis : PHP 8.1 ou plus, avec `pdo_sqlite` et `mbstring`. L'extension `intl` est utile pour les domaines accentués, mais pas obligatoire.

```bash
sudo apt install php-sqlite3 php-mbstring        # si besoin, puis redémarrer Apache ou PHP-FPM

# Dossier privé, hors de la racine web
sudo cp -r server/private /home/prod/gamebox-private
cd /home/prod/gamebox-private
sudo cp config.sample.php config.php
php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"   # à lancer deux fois : ip_salt et unsubscribe_secret
sudo nano config.php                                # ip_salt, allowed_origins, puis le bloc mailing (partie 4)
sudo chown prod:www-data config.php && sudo chmod 640 config.php   # il contiendra le mot de passe SMTP

# Dossier de la base : Apache doit pouvoir y écrire
sudo mkdir data && sudo chown www-data:www-data data && sudo chmod 770 data

# Points d'entrée publics
sudo mkdir -p /home/prod/WWW/base/api
sudo cp server/public/api/signup.php server/public/api/unsubscribe.php server/public/api/bug-report.php server/public/api/mc4db.php /home/prod/WWW/base/api/
```

Adapte `/home/prod/WWW/base` à ton DocumentRoot. Si le dossier privé n'est pas `/home/prod/gamebox-private`, indique-le dans le vhost :

```apache
SetEnv GAMEBOX_PRIVATE_DIR /chemin/vers/gamebox-private
```

Vérification rapide (doit répondre `Envoi trop rapide`, preuve que la chaîne complète fonctionne) :

```bash
curl -s -X POST https://gameboxheroes.fr/api/signup.php \
  -H 'Origin: https://gameboxheroes.fr' -H 'Content-Type: application/json' -d '{}'
```

En cas de réponse 500, le détail est dans le journal d'erreurs Apache, préfixé `[gamebox-signup]`.

## 2. Ajouter la rubrique dans l'appli Marvel Champions

Copie `vue/src/components/SignupForm.vue` dans `src/components/` et `vue/src/api/signup.js` dans `src/api/`.
Puis place le composant là où tu veux la rubrique, par exemple dans une fenêtre ouverte depuis la barre d'outils :

```vue
<script setup>
import SignupForm from './SignupForm.vue'
</script>

<template>
  <SignupForm source="marvel-champions" privacy-url="/confidentialite" />
</template>
```

Props : `source` (enregistrée avec l'adresse, utile si d'autres modules réutilisent le script), `title`, `intro`, `privacy-url`.
Slot `privacy` : un autre lien à la place de celui de `privacy-url` (l'appli Marvel y met « Vos données et vos droits », qui affiche les mentions légales dans la fenêtre même).
Événement : `@success="({ name, email }) => …"`.

Le composant reprend la police et la couleur de texte de l'appli. Pour l'accorder au thème, surcharge ses variables :

```css
.signup { --signup-accent: #c8102e; --signup-error: #ff8a80; --signup-focus: #ffd54f; }
```

Après une inscription, le navigateur garde le nom du visiteur (clé `gbh-signup` du localStorage) et la rubrique affiche « Merci …, votre adresse est bien enregistrée » aux visites suivantes, avec un bouton pour en inscrire une autre.

### En développement

Lance le script PHP en local et laisse Vite lui transmettre `/api` :

```bash
GAMEBOX_PRIVATE_DIR=$PWD/server/private php -S 127.0.0.1:8000 -t server/public
```

```js
// vite.config.js
export default defineConfig({
  // …
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
```

Dans le `config.php` de dev, ajoute `http://localhost:5173` à `allowed_origins` et passe `check_mx` à `false` si tu es hors ligne.

Si l'API est ailleurs que `/api/signup.php` à la racine du site, règle `VITE_SIGNUP_URL` dans `.env`.

## 3. Consulter et gérer les inscriptions

En SSH, depuis `/home/prod/gamebox-private` :

```bash
sudo -u www-data php bin/signups.php liste                       # les plus récentes d'abord
sudo -u www-data php bin/signups.php liste --source=marvel-champions
sudo -u www-data php bin/signups.php compte                      # total par source
sudo -u www-data php bin/signups.php export inscriptions.csv     # CSV pour Excel / LibreOffice
sudo -u www-data php bin/signups.php supprimer adresse@exemple.fr   # efface aussi son historique d'envoi
sudo -u www-data php bin/signups.php campagnes                   # suivi des envois de la mailing list
sudo -u www-data php bin/signups.php echecs exemple-nouveautes   # adresses en échec et raison
```

L'export est en UTF-8 avec BOM et séparateur `;`, pour qu'Excel l'ouvre directement avec les accents. Les cellules qui commencent par `=`, `+`, `-` ou `@` sont neutralisées pour éviter l'injection de formules.

Pour sauvegarder, il suffit de copier `data/signups.sqlite`.

## 4. Envoyer la mailing list

### Configurer l'envoi

Dans `config.php`, renseigne `site_url`, `unsubscribe_secret` et le bloc `mail` (voir `config.sample.php`).

Le plus simple et le plus fiable : passer par le SMTP d'un service d'envoi ou de ton hébergeur de mails (`transport => 'smtp'`, port 587, `encryption => 'tls'`). L'adresse `from_email` doit appartenir à `gameboxheroes.fr`, et le domaine doit déclarer ce service dans ses enregistrements DNS **SPF**, **DKIM** et **DMARC**. Sans eux, Gmail et Outlook classent les messages en spam, voire les refusent. Ton fournisseur SMTP indique les enregistrements à ajouter.

`transport => 'sendmail'` passe par le Postfix du VPS. Ça marche, mais il faut alors configurer SPF et DKIM pour le VPS toi-même (clé `dkim` de la config si Postfix ne signe pas déjà).

PHPMailer 7.2 est déjà dans `vendor/`. Pour le mettre à jour plus tard : `composer update` dans le dossier privé.

### Préparer le template

Un fichier HTML en UTF-8, comme `templates/exemple-nouveautes.html` :

- `<title>` devient le **sujet** du message (ou passe `--sujet="…"`, qui accepte aussi les variables) ;
- variables disponibles : `{{nom}}`, `{{prenom}}` (premier mot du nom), `{{email}}`, `{{desinscription}}` (lien personnel). Une variable mal orthographiée bloque l'envoi avant le premier message ;
- s'il manque `{{desinscription}}`, le script ajoute un pied de page avec le lien et le signale ;
- les images en chemin relatif (`<img src="images/logo.png">`, à côté du template) sont **jointes** au message. Les images en `https://…` restent hébergées, ce qui donne des messages plus légers ;
- la version texte est générée à partir du HTML (liens conservés). Pour l'écrire toi-même, crée un `.txt` du même nom à côté du template, ou passe `--texte=fichier.txt`.

Pour un e-mail, garde une mise en page en tableaux, des styles en ligne et 600 px de large : c'est ce que fait l'exemple.

### Envoyer

```bash
cd /home/prod/gamebox-private

# 1. Simulation : vérifie le SMTP, compte les destinataires, écrit un aperçu à côté du template
sudo -u www-data php bin/mailing.php templates/ma-campagne.html --simulation

# 2. Un exemplaire pour toi, sujet préfixé [Test], rien n'est enregistré
sudo -u www-data php bin/mailing.php templates/ma-campagne.html --test=laurent@exemple.fr

# 3. L'envoi : affiche le résumé et demande confirmation
sudo -u www-data php bin/mailing.php templates/ma-campagne.html
```

Options utiles : `--source=marvel-champions` (seulement les inscrits de l'appli Marvel), `--limite=200` (pour un quota journalier), `--par-minute=20`, `--oui` (sans confirmation).

Pour une longue liste, lance l'envoi détaché de la session SSH :

```bash
sudo -v                                   # le mot de passe d'abord : une commande en arrière-plan ne peut pas le demander
sudo -u www-data nohup php bin/mailing.php templates/ma-campagne.html --oui > envoi.log 2>&1 &
tail -f envoi.log                         # Ctrl+C arrête l'affichage, pas l'envoi
```

**Reprise** : chaque envoi est enregistré dès qu'il part. Si l'envoi est coupé (Ctrl+C, SSH perdu, quota atteint), relance la même commande : le script saute les destinataires déjà servis et retente les échecs. La campagne est identifiée par le nom du fichier template. Pour renvoyer le même template à tout le monde, donne-lui un autre nom avec `--campagne=autre-nom`.

**Sécurités** :
- un seul envoi à la fois sur le serveur ;
- arrêt automatique après 5 échecs de suite (SMTP en panne, mot de passe faux, quota dépassé) ;
- code de sortie 0 si tout est parti, 2 s'il reste des échecs, 1 si rien n'a été envoyé à cause d'une erreur.

### Désinscription

Chaque message porte un lien personnel et signé vers `api/unsubscribe.php`. Ce lien ouvre une page de confirmation avec un bouton : le simple clic dans le mail ne suffit pas, pour que les antivirus de messagerie, qui ouvrent les liens, ne désinscrivent personne par erreur. Le bouton « Se désabonner » de Gmail, Outlook ou Apple Mail fonctionne aussi, grâce aux en-têtes `List-Unsubscribe` (RFC 8058).

À la désinscription, le nom, l'adresse et l'historique d'envoi sont effacés.

Ne change plus `unsubscribe_secret` après le premier envoi : les liens des messages déjà partis ne fonctionneraient plus.

## 5. Mail de confirmation

À chaque **nouvelle** inscription, `api/signup.php` envoie un mail de confirmation, avec le lien personnel de désinscription et les en-têtes `List-Unsubscribe` (désabonnement en un clic dans les messageries), comme la mailing list.

- **Template** : `templates/confirmation.html` (mêmes règles que pour la mailing list : `<title>` = sujet, variables `{{nom}}`, `{{prenom}}`, `{{email}}`, `{{desinscription}}`). Un autre fichier, ou `false` pour ne rien envoyer : réglage `confirmation` de `config.php`.
- **Quand** : seulement pour une adresse nouvelle. Une adresse déjà inscrite qui se réinscrit ne reçoit rien : le formulaire ne peut pas servir à inonder la boîte de quelqu'un. Une adresse désinscrite puis réinscrite reçoit un nouveau mail.
- **Sans faire attendre** : le script répond au visiteur, ferme la connexion, puis envoie (délai SMTP de 10 s au plus).
- **Jamais bloquant** : si l'envoi échoue, l'inscription reste enregistrée et l'échec est noté. Rien n'est envoyé tant que le bloc `mail` n'est pas rempli (un serveur SMTP autre que `smtp.exemple.fr`) et que `unsubscribe_secret` n'est pas renseigné.
- **Suivi** : les confirmations sont suivies comme une campagne nommée `confirmation-inscription` :

```bash
sudo -u www-data php bin/signups.php campagnes                         # compte des envois et des échecs
sudo -u www-data php bin/signups.php echecs confirmation-inscription   # adresses en échec et raison
```

  Les autres erreurs (template illisible, PHPMailer absent) vont dans le journal d'erreurs du site (`/var/log/apache2/base-error.log`), préfixées `[gamebox-signup]`.

### Avis de nouvelle inscription

À chaque **nouvelle** inscription, un court mail part aussi vers l'adresse du réglage `notify` de `config.php` (par exemple `'notify' => 'contact@gameboxheroes.fr'`, ou une liste `['a@…', 'b@…']`, ou `''` pour ne rien recevoir). Il contient le nom, l'adresse, la source, l'heure (heure de Paris), le sort du mail de confirmation (envoyé, pas envoyé, ou échec avec la raison) et le nombre d'inscrits. « Répondre » écrit directement à la personne inscrite.

Comme la confirmation : rien pour une réinscription, envoi après la réponse au visiteur, et un échec ne touche pas à l'inscription (il est noté dans le journal d'erreurs, préfixé `[gamebox-signup]`). Chaque nouvelle inscription compte alors pour deux mails dans le quota horaire du fournisseur SMTP.

## 6. Rapports de bug

L'onglet « Signaler un bug » de l'appli (`src/components/modals/BugReportModal.vue`, `src/api/bugReport.js`) envoie le rapport à `api/bug-report.php`, qui le transmet **par e-mail**, la partie en cours en pièce jointe. Le joueur n'a besoin d'aucun compte, et **rien n'est enregistré** sur le serveur (sauf l'empreinte de l'IP, une heure, pour l'anti-spam).

Le mail, en texte : sujet `[Bug] <titre du joueur>`, puis le titre, l'e-mail du joueur s'il l'a laissé (« Répondre » lui écrit alors directement), la date, la description, le contexte (partie, situation, table, écran, page, version de l'appli, navigateur), les 50 derniers messages du journal, et en pièce jointe `bug-report_mc-table_<date>_<heure>.json`, la partie telle qu'elle était enregistrée dans le navigateur. Pour la rouvrir : dans la console du navigateur, sur l'appli, `localStorage.setItem('mc-table-vue-v1', <contenu du fichier>)`, puis recharger la page. Pour en faire un ticket GitHub, le mail rappelle l'adresse du dépôt.

Réglages de `config.php` (bloc facultatif, voir `config.sample.php`) :

```php
'bug_report' => [
    'to' => 'contact@gameboxheroes.fr',               // qui reçoit les rapports (absent : les adresses de « notify »)
    'rate_limit' => ['max' => 5, 'window' => 3600],   // par connexion ; même fenêtre que rate_limit
],
```

Il faut aussi le bloc `mail` rempli (partie 4). Sinon, ou sans adresse de réception, le service est fermé : l'appli le dit au joueur (503) et lui propose d'envoyer le rapport depuis sa messagerie. Chaque rapport compte pour un mail dans le quota du fournisseur SMTP.

**Sur une installation existante**, il suffit de copier les deux fichiers et, si besoin, d'ajouter le bloc `bug_report` :

```bash
sudo cp server/private/bug-report.php /home/prod/gamebox-private/
sudo cp server/public/api/bug-report.php /home/prod/WWW/base/api/
```

Vérification rapide (doit répondre `Envoi trop rapide`) :

```bash
curl -s -X POST https://gameboxheroes.fr/api/bug-report.php   -H 'Origin: https://gameboxheroes.fr' -H 'Content-Type: application/json' -d '{}'
```

`L'envoi des rapports n'est pas disponible` signale un bloc `mail` incomplet ou une adresse de réception manquante. Les erreurs (dont un mail qui n'a pas pu partir) sont dans le journal d'erreurs Apache, préfixées `[gamebox-bug-report]`.

Le script vérifie l'origine et le format comme l'inscription, refuse un rapport sans titre ou avec une adresse invalide, limite les envois par connexion (compteur à part de celui de l'inscription), ignore les robots (champ piège, délai minimal) et coupe les textes trop longs. Une partie illisible ou trop volumineuse (plus de 900 Ko) n'empêche pas l'envoi : le mail part sans pièce jointe, en le disant. Il envoie le mail avant de répondre : le joueur sait si son rapport est bien parti.

## 7. Relais MC4DB

[MC4DB](https://mc4db.merlindumesnil.net) (dérivé de MarvelCDB, avec des héros créés par des fans) a la même API publique que MarvelCDB, mais n'autorise pas un autre site à la lire depuis le navigateur (pas d'en-tête `Access-Control-Allow-Origin`). `api/mc4db.php` la lit à la place de l'appli, côté serveur, et lui renvoie le JSON (ou l'image) tel quel. L'appli s'en sert pour « Charger un deck » avec un lien MC4DB (`src/game/mc4db.js`). Il n'accepte que cinq demandes, aux paramètres vérifiés :

| Demande | Ce qu'il demande à MC4DB | Gardée en cache |
| --- | --- | --- |
| `?decklist=58` | `/api/public/decklist/58.json` | 5 min |
| `?card=70302` | `/api/public/card/70302.json?locale=fr` | 1 jour |
| `?pack=mystique_by_merlin` | `/api/public/cards/mystique_by_merlin.json?locale=fr` (obligation et Némésis d'un héros) | 1 jour |
| `?author=pseudo` | `/api/public/decks?page=1&limit=100&author=pseudo` (les decks publics d'un joueur) | 10 min |
| `?image=mystique_by_merlin/70302` | `/bundles/cards/EN/mystique_by_merlin/70302.webp` (l'image anglaise d'une carte de fans) | 30 jours |

- **Jamais une adresse libre** (le serveur servirait à d'autres pour attaquer des sites), **jamais les pages de comptes de MC4DB** : `/api/public/user/<n>` y renvoie l'e-mail des inscrits sans connexion.
- **Ménager MC4DB**, qui refuse les rafales (« 429 Too Many Requests », constaté avec un deck de fans dont les images étaient demandées d'un coup) :
  - **cache** dans `data/mc4db-cache` (à côté de la base), pour tous les joueurs : une carte n'est demandée à MC4DB qu'une fois par jour, une image une fois par mois ; si MC4DB ne répond pas, la dernière réponse gardée sert encore (en-tête `X-Cache: STALE`). Les fichiers de plus de 45 jours sont effacés de temps en temps ;
  - **une demande à la fois** pour tout le serveur, au moins 0,25 s après la précédente (verrou `data/mc4db-cache/.verrou`) ;
  - un **refus « 429 » est retenté une fois**, après 2 s au plus (son `Retry-After`) ; s'il revient, le relais répond 503 avec `Retry-After`, sans insister.
- **Limite par connexion** : 300 demandes envoyées à MC4DB par heure (réglage `mc4db.rate_limit`), sur la table `rate_hits` sous une clé à part ; les réponses en cache ne comptent pas. Un deck de fans de 46 cartes en demande une quarantaine la première fois (cartes, puis images).
- **Nom d'appli** dans chaque demande (`MarvelChampionsTable (gameboxheroes.fr)`) : MC4DB voit d'où viennent les appels.
- **Pas d'en-tête `Access-Control-Allow-Origin`** : seules les pages de gameboxheroes.fr peuvent lire le relais.
- Réponses : 200 (le JSON ou l'image de MC4DB), 400 (demande inconnue), 404 (inconnu de MC4DB), 405, 429, 500, 502 (MC4DB injoignable, réponse illisible ou de plus de 4 Mo), 503 (MC4DB demande de ralentir).

**Prérequis** : l'extension PHP `curl` (`php -m | grep curl` ; sinon `sudo apt install php-curl` puis redémarrer PHP), à défaut `allow_url_fopen`. **Installation** : copier les deux fichiers ; le bloc `mc4db` de `config.php` est facultatif :

```bash
sudo cp server/private/mc4db.php /home/prod/gamebox-private/
sudo cp server/public/api/mc4db.php /home/prod/WWW/base/api/
curl -s "https://gameboxheroes.fr/api/mc4db.php?decklist=58" | head -c 200   # le deck « Mystique »
```

Les erreurs sont dans le journal d'erreurs Apache, préfixées `[gamebox-mc4db]`. La version artefact de l'appli, sans serveur, ne peut pas lire MC4DB.

## Ce que fait le script d'inscription

- **Validation** : nom de 1 à 80 caractères, sans lien ni balise ; e-mail valide, mis en minuscules ; domaine qui reçoit du courrier (`check_mx`) ; case de consentement cochée.
- **Doublons** : une adresse déjà connue met à jour le nom et la date de consentement, sans nouvelle ligne. La réponse est la même dans les deux cas, pour ne pas révéler qui est inscrit.
- **Anti-spam, sans captcha** :
  - champ piège invisible : un robot qui le remplit reçoit un faux succès, et rien n'est enregistré ;
  - envoi refusé s'il arrive moins de 1,5 s après l'affichage du formulaire ;
  - au plus 5 envois par heure et par IP (l'IP est hachée avec le sel, jamais stockée en clair) ;
  - seules les requêtes JSON venant de `allowed_origins` sont acceptées.
- **Erreurs** : réponses JSON propres (400, 403, 405, 413, 415, 422, 429, 500). Le visiteur ne voit jamais de message PHP.

Si le site passe derrière Cloudflare ou un reverse proxy, active `mod_remoteip`. Sinon tous les visiteurs partagent l'IP du proxy et la limite par IP les bloque ensemble.

## RGPD : ce qui reste à ta charge

- **Politique de confidentialité** : rédigée dans l'appli Marvel (`src/components/LegalNotice.vue`), montrée par « Mentions légales » en bas de l'accueil, par « Vos données et vos droits » sous le formulaire et par « Ce que devient votre rapport » dans « Signaler un bug ». La tenir à jour si ce qui est collecté, les prestataires ou la durée de conservation changent.
- **Rapports de bug** : les mentions légales annoncent que l'éditeur garde un rapport « le temps de traiter le problème » : supprime les mails de rapports (et leur pièce jointe) une fois le bug réglé.
- **Désinscription** : gérée par `bin/mailing.php` et `api/unsubscribe.php` (partie 4). Si tu envoies un jour depuis un autre outil, il faudra y mettre un lien de désinscription.
- **Durée de conservation** : les mentions légales annoncent « jusqu'à la désinscription, ou 3 ans après le dernier contact », ce que recommande la CNIL pour ce type de liste. Le script ne purge rien de lui-même : supprime à la main les inscrits de plus de 3 ans avec `bin/signups.php supprimer`.

## Tests

```bash
php server/tests/api-test.php            # inscription
php server/tests/mailing-test.php        # mailing list et désinscription
php server/tests/confirmation-test.php   # mail de confirmation et avis de nouvelle inscription
php server/tests/bug-report-test.php     # rapports de bug
php server/tests/mc4db-test.php          # relais MC4DB
```

Sans PHP sur le poste : `docker run --rm -v "$PWD/server:/srv:ro" -w /srv php:8.3-cli php tests/confirmation-test.php` (idem pour les autres).

Les tests lancent des serveurs locaux sur une copie temporaire, dont un faux serveur SMTP qui garde les messages pour les inspecter. Ils ne touchent ni à ta vraie base ni à ton SMTP.

- **Inscription** : cas valides et invalides, anti-spam, doublons, codes HTTP, outil en ligne de commande.
- **Mailing list** : personnalisation, échappement, en-têtes, version texte, images jointes, reprise, échecs, cadence, verrou, panne SMTP et page de désinscription.
- **Rapports de bug** : mail reçu (destinataires, sujet, « Répondre », texte, partie jointe), champs invalides, anti-spam, codes HTTP, service fermé, panne SMTP, limite par connexion à part de celle de l'inscription.
- **Relais MC4DB** : les cinq demandes et les adresses demandées, images, cache (puis ancienne réponse quand MC4DB tombe), demandes espacées et « 429 » retenté une fois, valeurs piégées refusées sans rien demander à MC4DB, erreurs de MC4DB, limite par connexion. Un faux MC4DB local : le vrai n'est jamais contacté.
