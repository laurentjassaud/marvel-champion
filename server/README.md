# Inscription des visiteurs et mailing list

Rubrique « Restez informé » pour l'appli Marvel Champions de Gamebox Hero.
Le visiteur laisse son nom et son e-mail, un script PHP les enregistre dans une base SQLite sur le VPS.
Un second script envoie ensuite la mailing list à partir d'un template HTML (voir la partie 4).

Version courte, pour l'usage courant (réglages, newsletter, commandes, dépannage) : [MEMO.md](MEMO.md).

```
server/
  public/api/
    signup.php               → à copier dans la racine web (DocumentRoot)/api/
    unsubscribe.php          → idem : page de désinscription
  private/                   → à copier HORS de la racine web
    lib.php                  validation, anti-spam, base, liens de désinscription
    mail.php                 envoi des e-mails (mailing list et mail de confirmation)
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
sudo cp server/public/api/signup.php server/public/api/unsubscribe.php /home/prod/WWW/base/api/
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

- **Politique de confidentialité** : y indiquer ce qui est collecté (nom, e-mail), pourquoi (envoyer les nouvelles de Gamebox Hero), combien de temps on le garde, et comment demander l'accès ou la suppression. Passe son URL au composant avec `privacy-url`.
- **Désinscription** : gérée par `bin/mailing.php` et `api/unsubscribe.php` (partie 4). Si tu envoies un jour depuis un autre outil, il faudra y mettre un lien de désinscription.
- **Durée de conservation** : pour ce type de liste, la CNIL recommande en général 3 ans après le dernier contact. Pour supprimer une adresse : `bin/signups.php supprimer`.

## Tests

```bash
php server/tests/api-test.php            # inscription
php server/tests/mailing-test.php        # mailing list et désinscription
php server/tests/confirmation-test.php   # mail de confirmation et avis de nouvelle inscription
```

Sans PHP sur le poste : `docker run --rm -v "$PWD/server:/srv:ro" -w /srv php:8.3-cli php tests/confirmation-test.php` (idem pour les deux autres).

Les tests lancent des serveurs locaux sur une copie temporaire, dont un faux serveur SMTP qui garde les messages pour les inspecter. Ils ne touchent ni à ta vraie base ni à ton SMTP.

- **Inscription** : cas valides et invalides, anti-spam, doublons, codes HTTP, outil en ligne de commande.
- **Mailing list** : personnalisation, échappement, en-têtes, version texte, images jointes, reprise, échecs, cadence, verrou, panne SMTP et page de désinscription.
