# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Table solo Marvel Champions (VF) en Vue 3 + Pinia, construite avec Vite, installable en PWA.
`README.md` est la référence détaillée (maquette Figma, règles automatisées, raccourcis, données) : s'y reporter plutôt que de dupliquer ses explications ici.

## Commandes

Node 20.19+ ou 22.12+ (exigence de Vite 8).

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # Vitest, 146 tests (moteur, import MarvelCDB, decks sauvegardés, scans cgbuilder, rapport de bug)
npm run test:watch
npm run build          # PWA dans dist/
npm run preview        # sert dist/ : seul moyen de tester le service worker et le préchargement
npm run build:artifact # dist-artifact/page.html, page unique sans service worker
```

Un seul fichier ou un seul test (la configuration Vitest est dans `vite.config.js` : `environment: 'node'`, `include: src/**/*.test.js`) :

```bash
npx vitest run src/game/engine.test.js
npx vitest run -t "Klaw"        # filtre sur le nom du describe / it
```

Préfixe absolu pour le build : `BASE_PATH=/mc/ npm run build` (en PowerShell : `$env:BASE_PATH='/mc/'; npm run build`).

Adresse publique pour le référencement (adresse canonique, image de partage, `sitemap.xml`) : `SITE_URL`, par défaut `https://www.gameboxheroes.fr/marvel-champions-table/` ; `index.html` contient des marqueurs (`__SITE_URL__`, `__DESCRIPTION__`…) que le plugin `seo` de `vite.config.js` remplit.

Script serveur PHP (`server/`), lancé à part — le proxy `/api` de `vite.config.js` pointe sur le port 8000 :

```bash
GAMEBOX_PRIVATE_DIR=$PWD/server/private php -S 127.0.0.1:8000 -t server/public
php server/tests/api-test.php          # 39 vérifications attendues
php server/tests/mailing-test.php      # 77
php server/tests/confirmation-test.php # 42
php server/tests/bug-report-test.php   # 40
```

Sans PHP sur le poste : `docker run --rm -v "$PWD/server:/srv:ro" -w /srv php:8.3-cli php tests/api-test.php`. Les tests travaillent sur une copie temporaire avec un faux SMTP : ils ne touchent ni la base ni le SMTP réels.

`python scripts/build-data.py` régénère `src/data/cards.json` et `precons.json` (boîte de base seulement) et demande des dépôts externes clonés à côté : voir l'en-tête du script.

`python scripts/cgbuilder-images.py` régénère `src/data/cgbuilder.json` : les scans français de cgbuilder que prennent les cartes lues sur MarvelCDB (`cgbuilderImageUrl`, `useAssets.js`). Ne jamais deviner une adresse cgbuilder sans cette liste : ses dossiers ne suivent pas toujours les préfixes MarvelCDB, et une image absente y redirige vers une autre carte au lieu de répondre 404.

## Architecture

Trois couches, à garder étanches :

1. **Moteur de règles** (`src/game/engine.js`, qui réexporte `src/game/engine/*.js`) : des fonctions pures sur un objet d'état JavaScript ordinaire, **sans aucune dépendance à Vue**. L'état complet d'une partie et d'une carte est documenté en tête de `engine/state.js` — le lire avant de toucher au moteur. L'ordre du tableau `cards` est l'ordre des piles (le dessus d'une pile est sa dernière carte).
2. **Stores Pinia** : `stores/game.js` passe son état réactif au moteur (chaque action est une mince enveloppe autour d'une fonction du moteur, plus la persistance `localStorage`) ; `stores/ui.js` porte l'état d'interface (taille des cartes, sélection, aperçu, fenêtre ouverte, colonne de droite) et jamais l'état de jeu.
3. **Composants** : ils affichent et appellent le store. Pas de règle de jeu dans un composant.

Autres points qui demandent de lire plusieurs fichiers :

- **Fiches des cartes** : les JSON de `src/data/` utilisent des clés courtes (`n`, `t`, `s`, `hp`…) pour rester compacts ; `data.js` les traduit **une seule fois** au chargement (`readDefinition`, table `SHORT_KEYS`) et tout le reste du code n'utilise que les noms lisibles (`name`, `type`, `hitPoints`…). Les index `DEFINITION_BY_ID` et `DEFINITION_BY_CODE` (code MarvelCDB) sont la porte d'entrée.
- **`AVAILABLE_PACKS` vs `PACKS`** (`data.js`) : seuls la boîte de base, le paquet de scénarios Le Bouffon Vert et les paquets héros Captain America, Hulk et Thor sont proposés en « Nouvelle partie » ; les autres boîtes restent connues de la table pour les parties sauvegardées et les decks importés.
- **`src/game/rules.js`** : tout ce qu'un héros ou un scénario demande en plus des règles de base, une entrée par héros (`HERO_RULES`) et par scénario (`SCENARIO_RULES`), avec les listes en clair `automated` / `byHand` et les réglages que le moteur lit. Un test vérifie qu'aucune entrée ne manque et que chaque identifiant cité existe avec le bon type.
- **Partie enregistrée** : `savedGame.js` porte un numéro de version et convertit les parties des formats précédents à l'ouverture. Toute modification de la forme de l'état passe par là. Clés du navigateur : `mc-table-vue-v1` (partie), `mc-table-card-size`, `mc-table-side-tab`, `mc-table-side-width`, `mc-table-deck-tab` (dernier sous-onglet du choix du héros), `mc-table-decks` (decks sauvegardés, `stores/decks.js`), `gbh-signup`.
- **Pointeur** : souris, doigt et stylet sont gérés en un seul endroit (`composables/usePointer.js`, écouteurs délégués sur `document`) grâce aux attributs `data-id` (cartes) et `data-zone` (zones). Ne pas ajouter de gestionnaires de glisser / appui long dans un composant : les contournements iOS / Android y sont déjà réunis.
- **Hors ligne** : les `globPatterns` du service worker (`vite.config.js`) téléchargent les images des boîtes proposées (boîte de base, Le Bouffon Vert, Captain America, Hulk, Thor) dès l'installation. Une boîte ajoutée à `AVAILABLE_PACKS` doit l'être aussi aux `globPatterns`. Le build `--mode artifact` n'a ni service worker ni inscription.
- **Signaler un bug** : `components/modals/BugReportModal.vue` → `src/api/bugReport.js` → `server/public/api/bug-report.php` (+ `server/private/bug-report.php`), qui envoie le rapport par e-mail, la partie en pièce jointe ; rien n'est enregistré. Version artefact ou serveur injoignable : le même rapport par la messagerie du joueur (`buildMailUrl`). Le commit construit vient de `vite.config.js` (`__APP_COMMIT__`). Les mentions légales (`LegalNotice.vue`) décrivent ce traitement : à tenir à jour avec le script.
- **Inscription aux nouvelles** : `components/SignupForm.vue` → `src/api/signup.js` → `server/public/api/signup.php`. `server/private/config.php` (secrets, jamais versionné — modèle dans `config.sample.php`) doit lister l'origine de l'appli dans `allowed_origins`. Voir `server/README.md` et `server/MEMO NEWSLETTER.md`.

## Ajouter une boîte, un héros ou un scénario

`src/data/<boîte>.json` (identifiants `<préfixe>-<numéro>`) + `public/cards/<boîte>/` (images `<id>.jpg`, `.b.jpg` pour le verso, `.c.jpg` pour une troisième face) → déclarer la boîte dans `PACKS` (`data.js`, avec `cdb` et `codePrefix` pour les imports MarvelCDB) → compléter `HEROES` / `SCENARIOS` / `MODULAR_SETS` → ajouter l'entrée dans `rules.js` → si la boîte est jouable, l'ajouter à `AVAILABLE_PACKS` **et** aux `globPatterns`. Un test vérifie que chaque carte a son image.

## Conventions

- Tout est en français : commentaires, JSDoc, messages du journal, textes d'interface. Les identifiants de code restent en anglais (`cardsInZone`, `heroName`) ; les identifiants de données suivent les noms français des boîtes (`bouffon-vert`, `sorciere-rouge`).
- Chaque fichier s'ouvre sur un commentaire d'intention qui dit son rôle et ses conventions : le tenir à jour en même temps que le code.
- Messages de commit : une phrase descriptive en français, sans préfixe de type.
- Un seul thème sombre, assumé. La mise en page suit la maquette Figma via deux unités d'échelle : `--u` (un pixel de la maquette 1920 × 1080) dans `main.css`, `--su` dans les fenêtres ; `ui.js` expose la même échelle en JS. Réutiliser les classes existantes (`.slant`, `.modal-btn`, `.btn`) plutôt que d'en redéfinir.
- Images des cartes et des dos : © Fantasy Flight Games / Marvel, usage privé, ne pas redistribuer publiquement.
