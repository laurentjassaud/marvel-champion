# Table Marvel Champions

Table solo pour **Marvel Champions** (boîte de base, paquets de scénarios *Le Bouffon Vert* et *Les Démolisseurs*, paquets héros *Black Widow*, *Docteur Strange*, *Captain America*, *Hulk*, *Miss Marvel* et *Thor*, version française), en Vue 3.
Mise en place automatique, decks préconstruits officiels, import de decks OCTGN `.o8d` ou texte MarvelCDB `.txt`, installable en PWA.

## Démarrer

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests du moteur de règles (Vitest)
npm run build        # build PWA dans dist/
npm run preview      # sert dist/ pour tester le build et le service worker
```

Node 20.19+ ou 22.12+ (exigence de Vite 8).

Pour déployer sous un sous-chemin (par exemple dans Gamebox Hero) :

```bash
BASE_PATH=/modules/marvel-champions/ npm run build
```

`npm run build:artifact` produit `dist-artifact/page.html`, une page unique (JS et CSS inlinés, sans service worker) pour l'hébergement en artefact Claude ; les images restent à côté dans `cards/` (un dossier par boîte), `backs/` et `status/`.

## Structure

```
src/
  game/
    data.js            listes héros / méchants / modules, libellés, index des cartes
    engine.js          moteur de règles : fonctions pures sur un objet d'état (aucune dépendance à Vue)
    engine.test.js     tests Vitest du moteur
  stores/
    game.js            store Pinia : état de partie, persistance localStorage, actions → engine
    ui.js              taille des cartes, sélection, survol, aperçu, menu contextuel, modale ouverte
  composables/
    usePointer.js      glisser-déposer, clic, double-clic, survol, clic droit / appui long (délégués sur document)
    useKeyboard.js     raccourcis clavier
    useCardMenu.js     contenu des menus contextuels
    useZoneActions.js  action d'un clic sur une pile ou une carte
    useAssets.js       URL des images (respecte BASE_URL)
  components/
    GameTable, GameCard, CardPile, HandStrip, TopBar, CounterBox, CardPreview, GameLog, ContextMenu
    modals/            BaseModal, ChoiceOption, SetupModal, PileModal, MulliganModal, RestartModal, HelpModal
  data/
    cards.json         boîte de base, 198 cartes (GUID OCTGN, nom FR, type, set, quantité, PV, menace, taille de main…)
    bouffon-vert.json  paquet Le Bouffon Vert, 49 cartes saisies depuis les cartes imprimées (id gob-<numéro>)
    demolisseurs.json  paquet Les Démolisseurs, 59 cartes saisies depuis les cartes imprimées (id dem-<numéro>)
    black-widow.json   paquet héros Black Widow, 26 cartes (id bw-<numéro>) ; son précon est dans data.js
    docteur-strange.json  paquet héros Docteur Strange, 33 cartes (id drs-<numéro>) ; son précon est dans data.js
    captain-america.json  paquet héros Captain America, 27 cartes (id cap-<numéro>) ; son précon est dans data.js
    hulk.json          paquet héros Hulk, 26 cartes (id hlk-<numéro>) ; son précon est dans data.js
    miss-marvel.json   paquet héros Miss Marvel, 27 cartes (id msm-<numéro>) ; son précon est dans data.js
    thor.json          paquet héros Thor, 28 cartes (id thor-<numéro>) ; son précon est dans data.js
    precons.json       les 5 decks préconstruits de la boîte de base (40 cartes)
public/
  cards/base/          209 images de la boîte de base (GUID.jpg, GUID.b.jpg pour les versos)
  cards/bouffon vert/  57 images du paquet Le Bouffon Vert (gob-NN.jpg, gob-NN.b.jpg pour les versos)
  cards/demolisseurs/  60 images du paquet Les Démolisseurs (dem-NN.jpg, dem-01.b.jpg pour Évasion 1B)
  cards/black widow/   27 images du paquet Black Widow (bw-NN.jpg, bw-01.b.jpg pour Natasha Romanoff)
  cards/docteur strange/  34 images du paquet Docteur Strange (drs-NN.jpg, drs-01.b.jpg pour Stephen Strange)
  cards/captain america/  28 images du paquet Captain America (cap-NN.jpg, cap-01.b.jpg pour Steve Rogers)
  cards/hulk/          27 images du paquet Hulk (hlk-NN.jpg, hlk-01.b.jpg pour Bruce Banner)
  cards/miss marvel/   28 images du paquet Miss Marvel (msm-NN.jpg, msm-01.b.jpg pour Kamala Khan)
  cards/thor/          29 images du paquet Thor (thor-NN.jpg, thor-01.b.jpg pour Odinson)
  backs/               dos bleu (cartes du héros), violet (cartes de type Méchant) et jaune orangé (autres cartes Rencontre)
  status/              cartes de statut posées sur les personnages (sonné, désorienté, tenace)
  icons/               icône d'onglet (favicon-32), icône iPad (apple-touch-icon) et icônes PWA, tirées du visuel Marvel Champions
scripts/
  build-data.py        régénère cards.json / precons.json (voir l'en-tête du script)
  inline-artifact.mjs  post-traitement du build artefact
```

Le principe : `engine.js` porte toutes les règles (mise en place, pioche, paquet Rencontre, phase du méchant, mulligan, dégâts/menace) et ne connaît que des objets JS. Le store Pinia lui passe son état réactif ; les composants ne font qu'afficher et appeler le store. Les cartes portent `data-id` et les zones `data-zone`, ce qui permet de gérer tout le pointeur à un seul endroit (`usePointer`).

### État d'une carte

```js
{ id, g /* GUID OCTGN */, o /* 'p' joueur | 'e' rencontre */, zone, side /* 0 face A | 1 face B */,
  faceUp, tapped, x, y, z, dmg, thr, tok, hero?, kind? /* 'token' */, stunned?, confused?, tough? }
```

L'ordre du tableau `cards` est l'ordre des piles : le dessus d'une pile est sa dernière carte.

## Règles automatisées

- Nouvelle partie en deux écrans. 1 · Héros : une tuile de même largeur par héros (son préconstruit), plus une tuile « Deck personnalisé » qui importe un .o8d ou un .txt MarvelCDB et affiche ensuite la miniature du héros et le nom du deck ; un seul choix est allumé à la fois. 2 · Scénario : méchant, set modulaire et difficulté ; le set modulaire et la difficulté ont un choix « Au hasard », tiré à la mise en place et annoncé dans le journal. Les dos ne se choisissent plus : bleu pour les cartes du héros, violet pour les cartes de type Méchant, jaune orangé pour toutes les autres cartes Rencontre.
- Mise en place : identité en alter ego, deck précon ou importé, méchant (I+II standard, II+III expert) et manigance face A sur la table, paquet Rencontre = set du méchant + module + Standard (+ Expert) + obligation du héros, set Némésis mis de côté.
- Paquet joueur vide : la défausse est remélangée et une carte Rencontre arrive face cachée.
- Paquet Rencontre vide : la défausse est remélangée et un jeton d'accélération est ajouté.
- Tours et phases : la partie commence au tour 1, en phase du héros. Le compteur de tour et les deux boutons « Phase du héros » / « Phase du méchant » (« des méchants » contre Les Démolisseurs) remplacent « Nouveau tour », « Phase du méchant » et « Révéler rencontre » ; le bouton allumé est la phase en cours.
  - Passer à la phase du méchant (`V`) termine votre phase : la main est complétée à la taille de la forme en jeu (héros ou alter ego), vos cartes sont redressées. La phase du méchant elle-même se joue à la main (menace, activations, cartes Rencontre) : le journal en rappelle les étapes et le nombre de jetons d'accélération.
  - Repasser à la phase du héros (`N`) commence le tour suivant.
  - On ne peut passer qu'à l'autre phase : un second clic sur la phase en cours ne fait rien. Une carte Rencontre se révèle aussi à la main (clic sur le paquet Rencontre ou `E`).
- Mulligan officiel : bouton à côté de « Main », actif seulement au tour 1 en phase du héros et une fois par partie (garder sa main compte aussi) ; défausser des cartes de la main de départ puis repiocher.
- Carte au hasard (à côté du mulligan) : une carte de la main tirée au hasard est entourée de rouge et annoncée au journal ; elle perd sa bordure dès qu'on la touche, la clique ou la déplace, ou qu'elle quitte la main.
- Recommencer la partie (barre du haut) : après confirmation, même héros, même deck (précon ou importé), même scénario, module et difficulté compris même s'ils avaient été tirés au hasard ; la partie repart du tour 1, paquets remélangés.
- Dégâts / menace / jetons : les dégâts ne vont que sur les personnages (compteurs PV du héros et du méchant, jeton sur les alliés et sbires), la menace que sur les manigances (compteur avec seuil pour la principale, jeton sur les annexes), et les autres cartes (ou une carte face cachée) reçoivent des jetons génériques.
- Statuts : clic droit sur un personnage (identité, allié, méchant, sbire) pour le rendre Sonné, Désorienté ou Tenace ; ils se cumulent, s'affichent sur la carte, restent quand l'identité change de forme et disparaissent quand la carte quitte la table.
- Une nouvelle étape du méchant ou de la manigance posée depuis « De côté » met les compteurs à jour.
- Méchant vaincu (PV à 0, par dégât ou par le « − » du compteur) : l'étape suivante, mise de côté, le remplace automatiquement, au même endroit et dans la même forme, avec ses cartes d'état (les attachements restent, les dégâts non) ; une fenêtre la présente avec sa carte. L'étape vaincue passe hors jeu. S'il n'y a plus d'étape : fenêtre de victoire, avec le méchant marqué « Vaincu », le nombre de tours et un texte propre à la manigance principale en jeu (ce que vous avez empêché, `VICTORY` dans `data.js`), et les boutons Nouvelle partie / Recommencer.
- Ténacité (Géant de Glace) : le personnage entre en jeu avec une carte d'état Tenace.
- Le Bouffon Vert, deux scénarios et quatre sets modulaires (Gadgets du Bouffon, Un Immense Gâchis, Absorption Électrique, Ingérence en Cours) :
  - *Entreprise à Risques* : l'environnement Entreprise Criminelle est mis en jeu avec 2 jetons Infamie. Retourner Norman Osborn (F) le change en Le Bouffon Vert et renomme le compteur de PV ; Entreprise Criminelle se retourne en Accès de Folie.
  - *Formule Mutagène* : un Esclave Bouffon est mis en jeu engagé avec vous. Nuage Mutagène posé depuis « De côté » met le compteur de menace à 4 /11 ; son accélération +X se compte à la main.
- Les Démolisseurs (quatre méchants à la fois, sans set modulaire, Standard, obligation ni Némésis) :
  - Mise en place : les quatre méchants (versions A, ou B en expert) et leurs manigances annexes avec leur menace de départ, un paquet Rencontre de 15 cartes par méchant, jeton Actif sur Le Démolisseur.
  - Les piles Rencontre affichées (paquet, défausse, révélation, boost, recherche) sont celles du méchant actif, signalé par un badge « Actif » ; clic droit sur un autre méchant → Rendre actif.
  - Phase des méchants (Évasion) : à jouer à la main, menace sur les manigances annexes et jeton Actif compris (clic droit sur un méchant → Rendre actif).
  - Chaque méchant garde ses dégâts sur sa carte, le compteur de PV suit le méchant actif. Un méchant à 0 PV quitte la partie automatiquement (une fenêtre présente le nouveau méchant actif) ; défaussé à la main, de même : il emporte sa manigance annexe (hors jeu) et passe le jeton Actif ; victoire quand les quatre sont tombés.
  - Paquet du méchant actif vide : seule sa défausse est remélangée, +1 jeton d'accélération.
- Captain America : la mise en place de Steve Rogers ajoute le Bouclier de Captain America à la main de départ (cherché dans le paquet, qui est mélangé). Comme la règle résout les mises en place après le mulligan, le Bouclier ne compte pas dans la main à compléter, et il est repris dans la défausse s'il a été défaussé au mulligan.
- Hulk (Enragé) : sous forme de héros, sa main est défaussée à la fin de son tour, c'est-à-dire quand on passe à la phase du méchant, juste avant de la compléter à 4 cartes.
- Docteur Strange : son deck Invocation (5 cartes) est mélangé à part, face visible, avec sa propre défausse, à droite de la défausse joueur. Clic (ou `I`) : lancer l'invocation du dessus (Maîtrise des Sorts), qui part dans la défausse Invocation ; clic droit ou appui long : la lancer en la gardant (Maître des Arts Mystiques), la défausser sans la lancer (Talent Naturel, Wong), mélanger, chercher. Deck vide : sa défausse est remélangée sans pénalité. Une carte Invocation renvoyée « sur le paquet » retourne sur le deck Invocation ; glissée sur la table, elle arrive face cachée (Ouvrir la Dimension Noire).

Les effets des cartes eux-mêmes restent à appliquer à la main.

## Raccourcis

`D` piocher · `V` phase du méchant · `N` phase du héros (tour suivant) · `E` révéler · `I` invocation (Docteur Strange) · `G`/`⇧G` dégât ± · `M`/`⇧M` menace ± · `J`/`⇧J` jeton ± · `T` épuiser · `F` retourner · `H` en main · `X` de côté · `Suppr` défausser · `Entrée` jouer · `?` aide.
Les raccourcis de carte visent la carte sous la souris, sinon la carte sélectionnée.

## Tablette

Toucher une carte l'agrandit, la glisser la déplace, un double tap l'épuise (ou la joue depuis la main), un appui long ouvre ses options avec la carte en grand. Sur un paquet ou une défausse, le clic droit ou l'appui long ouvre le menu de la pile : chercher dedans (paquet joueur, paquet Rencontre, deck Invocation et leurs défausses), piocher ou révéler, mélanger, reprendre la carte du dessus d'une défausse. Une main trop longue défile en glissant horizontalement, une carte glissée vers le haut part sur la table.

Côté code (`usePointer`) : l'appui long envoie lui-même un `contextmenu` (iOS n'en émet pas) et ignore celui d'Android ou Windows s'il arrive en plus ; le clic qui suit un geste déjà traité est absorbé (pioche en double, option du menu sous le doigt, pile découverte par une fenêtre qui se ferme) ; le double tap est détecté à la main pour le toucher et le stylet. Le navigateur ne reçoit jamais de glissement horizontal (`touch-action`), sinon il peut le transformer en « page précédente ». Les cartes jouables annulent leur `touchstart` (`GameCard`) : tout se joue en événements de pointeur, et aucun geste du navigateur ne reste en suspens quand la carte touchée quitte la page (piochée, jouée, glissée hors de la main), ce qui faisait perdre le tap suivant.

## Données et droits

- Statistiques et traductions : [MarvelCDB](https://github.com/zzorba/marvelsdb-json-data).
- Decks préconstruits : module [OCTGN Marvel Champions](https://github.com/twistedsistem/OCTGN-Marvel-Champions).
- Images des cartes et des dos : © Fantasy Flight Games / Marvel. À garder pour un usage privé, ne pas redistribuer publiquement.

## Pistes

- Multijoueur : l'état est un objet sérialisable, il suffit de synchroniser les actions du store (WebSocket) ; le moteur reste côté client ou passe côté serveur.
- Extensions : comme pour Le Bouffon Vert, un fichier `src/data/<boîte>.json` et un dossier d'images `public/cards/<boîte>/` déclarés dans `PACKS` (`data.js`), puis compléter `HEROES` / `VILLAINS` / `MODULARS`. Un scénario peut décrire dans `setup` les cartes que sa manigance 1A met en jeu. Un paquet héros ajoute son précon à `PRECONS` (`data.js`), en reprenant les cartes de la boîte de base qu'il réimprime.
- Import `.o8d` : il reconnaît les cartes par leur GUID OCTGN, donc seulement les héros de la boîte de base ; les cartes des autres paquets ont des id maison (`bw-…`, `gob-…`, `dem-…`).
- Import texte MarvelCDB (`.txt`, export « Text file » d'un deck) : les cartes y sont nommées en anglais avec leur paquet entre parenthèses (« 2x Widow's Bite (Black Widow) »). Chaque carte joueur porte donc son nom anglais (`en`, repris de MarvelCDB) et chaque boîte son nom MarvelCDB (`cdb` dans `PACKS`). Les cartes d'un paquet absent sont ignorées et listées à l'import.
