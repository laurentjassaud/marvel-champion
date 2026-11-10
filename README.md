# Table Marvel Champions

Table solo pour **Marvel Champions** (boîte de base, paquets de scénarios *Le Bouffon Vert*, *Les Démolisseurs* et *Kang le Conquérant*, boîte de campagne *L'Avènement de Crâne Rouge*, paquets héros *Black Widow*, *Docteur Strange*, *Captain America*, *Hulk*, *Miss Marvel*, *Thor*, *Ant-Man*, *La Guêpe*, *Vif-Argent* et *La Sorcière Rouge*, version française), en Vue 3.
Mise en place automatique, decks préconstruits officiels, import de decks OCTGN `.o8d`, texte MarvelCDB `.txt` ou directement par lien MarvelCDB, installable en PWA.

## Démarrer

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests du moteur de règles (Vitest)
npm run build        # build PWA dans dist/
npm run preview      # sert dist/ pour tester le build et le service worker
```

Node 20.19+ ou 22.12+ (exigence de Vite 8).

Le build utilise des chemins relatifs (`./`) : le contenu de `dist/` fonctionne tel quel à la racine d'un domaine comme dans n'importe quel sous-dossier. L'URL de la page doit finir par `/` (`https://exemple.fr/mc/`, pas `https://exemple.fr/mc`). Pour forcer un préfixe absolu :

```bash
BASE_PATH=/modules/marvel-champions/ npm run build
```

`npm run build:artifact` produit `dist-artifact/page.html`, une page unique (JS et CSS inlinés, sans service worker) pour l'hébergement en artefact Claude ; les images restent à côté dans `cards/` (un dossier par boîte), `backs/` et `status/`.

## Structure

```
src/
  game/
    data.js            boîtes, fiches des cartes (clés courtes des JSON traduites en noms lisibles), précons,
                       héros, scénarios, sets modulaires, libellés
    rules.js           règles spéciales de chaque héros et de chaque scénario (ce que la table fait seule,
                       ce qui se joue à la main, réglages lus par le moteur, rappels du journal)
    engine.js          point d'entrée du moteur de règles : réexporte les modules de engine/
    engine/            le moteur, par thème — fonctions pures sur un objet d'état (aucune dépendance à Vue) :
      state.js         hasard, journal, lecture des cartes, zones et piles (décrit l'état d'une partie et d'une carte)
      layout.js        places des cartes sur la table
      moves.js         déplacer, jouer, retourner une carte ; entrée en jeu, cartes d'état, formes de l'identité
      piles.js         pioche, paquet Rencontre, deck du scénario, deck Invocation
      turns.js         taille de main, phases du héros et du méchant
      villains.js      dégâts, menace, jetons ; défaite et étapes du méchant ; Démolisseurs ; Kang
      setup.js         nouvelle partie, mise en place, mulligan
      deckImport.js    lecture des decks importés (OCTGN, texte et API MarvelCDB)
    savedGame.js       version de la partie enregistrée, et mise à jour d'une partie de l'ancien format
    marvelcdb.js       import de decks par lien MarvelCDB (API publique)
    engine.test.js     tests Vitest du moteur ; marvelcdb.test.js ceux de l'import MarvelCDB
  stores/
    game.js            store Pinia : état de partie, persistance localStorage, actions → engine
    ui.js              taille des cartes, sélection, survol, aperçu, menu contextuel, modale ouverte,
                       onglet et largeur de la colonne de droite (gardés dans le navigateur)
  composables/
    usePointer.js      glisser-déposer, clic, double-clic, survol, clic droit / appui long (délégués sur document)
    useKeyboard.js     raccourcis clavier
    useCardMenu.js     contenu des menus contextuels
    useZoneActions.js  action d'un clic sur une pile ou une carte
    useAssets.js       URL des images (respecte BASE_URL)
    usePreload.js      préchargement en tâche de fond des images de la partie (cache du service worker)
  components/
    GameTable, GameCard, CardPile, HandStrip, TopBar, CounterBox, CardPreview, GameLog, ContextMenu,
    SideTabs (onglets Carte / Journal de la colonne de droite), SideResizer (son bord gauche, à glisser)
    modals/            BaseModal, ChoiceOption, SetupModal, PileModal, MulliganModal, RestartModal, HelpModal
  data/
    cards.json         boîte de base, 198 cartes (GUID OCTGN, nom FR, type, set, quantité, PV, menace, taille de main…)
    bouffon-vert.json  paquet Le Bouffon Vert, 49 cartes saisies depuis les cartes imprimées (id gob-<numéro>)
    demolisseurs.json  paquet Les Démolisseurs, 59 cartes saisies depuis les cartes imprimées (id dem-<numéro>)
    kang.json          paquet Kang le Conquérant, 51 cartes (id kng-<numéro>) : Kang, Kang Expert, trois sets modulaires
    crane-rouge.json   boîte L'Avènement de Crâne Rouge, 153 cartes (id rrs-<numéro sur 3 chiffres>) : Hawkeye, Spider-Woman,
                       cinq scénarios, trois sets modulaires, cartes de campagne ; noms imprimés, quantités et statistiques
                       de MarvelCDB ; les réimpressions (Énergie, Commander en Première Ligne…) ne sont pas recopiées
    black-widow.json   paquet héros Black Widow, 26 cartes (id bw-<numéro>) ; son précon est dans data.js
    docteur-strange.json  paquet héros Docteur Strange, 33 cartes (id drs-<numéro>) ; son précon est dans data.js
    captain-america.json  paquet héros Captain America, 27 cartes (id cap-<numéro>) ; son précon est dans data.js
    hulk.json          paquet héros Hulk, 26 cartes (id hlk-<numéro>) ; son précon est dans data.js
    miss-marvel.json   paquet héros Miss Marvel, 27 cartes (id msm-<numéro>) ; son précon est dans data.js
    thor.json          paquet héros Thor, 28 cartes (id thor-<numéro>) ; son précon est dans data.js
    vif-argent.json    paquet héros Vif-Argent, 28 cartes (id qsv-<numéro>) ; son précon est dans data.js
    sorciere-rouge.json  paquet héros La Sorcière Rouge, 25 cartes (id scw-<numéro>) ; son précon (dans data.js)
                       reprend l'Ordre et Chaos du paquet Vif-Argent, réimprimé dans les deux
    guepe.json         paquet héros La Guêpe, 29 cartes (id wsp-<numéro>) : identité à trois faces (cn, chs, forms),
                       Tactique d'Essaim répond aussi au code de sa première impression (orig 12020, paquet Ant-Man)
    ant-man.json       paquet héros Ant-Man, 28 cartes (id ant-<numéro>) : identité à trois faces comme La Guêpe ;
                       son précon (dans data.js) reprend la Tactique d'Essaim du paquet La Guêpe, réimprimée dans les deux
    precons.json       les 5 decks préconstruits de la boîte de base (40 cartes)
public/
  cards/base/          209 images de la boîte de base (GUID.jpg, GUID.b.jpg pour les versos)
  cards/bouffon vert/  57 images du paquet Le Bouffon Vert (gob-NN.jpg, gob-NN.b.jpg pour les versos)
  cards/demolisseurs/  60 images du paquet Les Démolisseurs (dem-NN.jpg, dem-01.b.jpg pour Évasion 1B)
  cards/kang/          58 images du paquet Kang le Conquérant (kng-NN.jpg, .b.jpg pour les manigances principales B)
  cards/crane rouge/   168 images de L'Avènement de Crâne Rouge (rrs-NNN.jpg, .b.jpg pour les versos : alter ego,
                       manigances principales B, améliorations de campagne avancées)
  cards/black widow/   27 images du paquet Black Widow (bw-NN.jpg, bw-01.b.jpg pour Natasha Romanoff)
  cards/docteur strange/  34 images du paquet Docteur Strange (drs-NN.jpg, drs-01.b.jpg pour Stephen Strange)
  cards/captain america/  28 images du paquet Captain America (cap-NN.jpg, cap-01.b.jpg pour Steve Rogers)
  cards/hulk/          27 images du paquet Hulk (hlk-NN.jpg, hlk-01.b.jpg pour Bruce Banner)
  cards/miss marvel/   28 images du paquet Miss Marvel (msm-NN.jpg, msm-01.b.jpg pour Kamala Khan)
  cards/thor/          29 images du paquet Thor (thor-NN.jpg, thor-01.b.jpg pour Odinson)
  cards/vif-argent/    29 images du paquet Vif-Argent (qsv-NN.jpg, qsv-01.b.jpg pour Pietro Maximoff)
  cards/sorciere rouge/  26 images du paquet La Sorcière Rouge (scw-NN.jpg, scw-01.b.jpg pour Wanda Maximoff)
  cards/guepe/         31 images du paquet La Guêpe (wsp-NN.jpg, wsp-01.b.jpg Nadia Van Dyne, wsp-01.c.jpg La Guêpe Géant)
  cards/ant-man/       30 images du paquet Ant-Man (ant-NN.jpg, ant-01.b.jpg Scott Lang, ant-01.c.jpg Ant-Man Géant)
  backs/               dos bleu (cartes du héros), violet (cartes de type Méchant) et jaune orangé (autres cartes Rencontre)
  status/              cartes de statut posées sur les personnages (sonné, désorienté, tenace)
  icons/               icône d'onglet (favicon-32), icône iPad (apple-touch-icon) et icônes PWA, tirées du visuel Marvel Champions
scripts/
  build-data.py        régénère cards.json / precons.json (voir l'en-tête du script)
  inline-artifact.mjs  post-traitement du build artefact
```

Le principe : le moteur (`engine.js` et `engine/`) porte toutes les règles (mise en place, pioche, paquet Rencontre, phase du méchant, mulligan, dégâts/menace) et ne connaît que des objets JS. Le store Pinia lui passe son état réactif ; les composants ne font qu'afficher et appeler le store. Les cartes portent `data-id` et les zones `data-zone`, ce qui permet de gérer tout le pointeur à un seul endroit (`usePointer`).

### État d'une carte

```js
{ id, definitionId /* sa fiche (GUID OCTGN pour la boîte de base) */, owner /* 'player' | 'encounter' */, zone,
  side /* 0 face A | 1 face B | 2 face C (Ant-Man, La Guêpe Géant) */, faceUp, exhausted, x, y, zIndex,
  damage, threat, tokens, isIdentity?, isPawn? /* pion libre, avec sa couleur `color` */, stunned?, confused?, tough?,
  underSchemeId? /* id de la manigance sous laquelle elle est posée, face cachée */,
  dealtToPlayer? /* carte Rencontre reçue face cachée, posée devant l'identité */,
  isBoost? /* carte de boost face cachée : retournée, elle n'entre pas en jeu */ }
```

L'ordre du tableau `cards` est l'ordre des piles : le dessus d'une pile est sa dernière carte. Les zones : `playerDeck`, `hand`, `table`, `playerDiscard`, `encounterDeck`, `encounterDiscard`, `setAside` (de côté), `invocationDeck`, `invocationDiscard`, `scenarioDeck` (deck du scénario), `outOfGame` (hors jeu). L'état complet d'une partie est décrit en tête de `src/game/engine/state.js`.

Les fiches des cartes (`src/data/*.json`) gardent des clés courtes pour rester compactes (`n` nom, `t` type, `s` set, `hp`, `bth` menace de départ…) ; `data.js` les traduit une seule fois au chargement (`readDefinition`, table `SHORT_KEYS` commentée), et tout le code n'utilise que les noms lisibles (`name`, `type`, `set`, `hitPoints`, `startingThreat`…).

La partie en cours est enregistrée dans le navigateur avec un numéro de version (`savedGame.js`) : une partie enregistrée par une version précédente de la table (clés courtes) est convertie automatiquement à l'ouverture.

## Règles spéciales des héros et des scénarios (`rules.js`)

Tout ce que les cartes d'un héros ou d'un scénario demandent en plus des règles de base est réuni dans `src/game/rules.js` : une entrée par héros (`HERO_RULES`) et par scénario (`SCENARIO_RULES`), avec deux listes en clair, `automated` (ce que la table fait seule) et `byHand` (ce qui se joue à la main), et les réglages que le moteur lit :

- héros : `setupCardId` (carte que la mise en place de l'identité met en main : le Bouclier de Captain America), `setupNote` (mise en place à faire à la main, rappelée au journal au début : T'Challa), `discardsHandAtTurnEnd` (Hulk, Enragé), `handSizeBonus` (sous forme de héros, +1 taille de main par amélioration que vous contrôlez avec un trait donné, avec un maximum : Iron Man, Tech, 7 au plus ; la fin de phase le détaille, « main de 4 en Iron Man : 1 + 3 améliorations Tech ») ;
- scénarios : `setupSteps` (cartes que la manigance 1A met en jeu), `extraSets`, `setAside`, `scenarioDeck`, `oneEnvironment`, `expertSet`, `removesObligation`, `kang`, `crew`, `mainSchemes` (manigances principales : « Une fois révélée » des faces A et B, `onRevealA` / `onRevealB`, réponse forcée à chaque phase du méchant, `eachVillainPhase`, rappelés au journal) et `villainStages` (étapes du méchant : leur « Une fois révélée » quand l'étape remplace la précédente ou est posée depuis « De côté », fait par la table : `revealCardId` cherche une carte dans le paquet Rencontre et sa défausse et la révèle, manigance annexe avec sa menace de départ ou attachement avec ses jetons, puis mélange le paquet, `dealIfAlreadyInPlay` donne une carte Rencontre si elle est déjà en jeu ; `dealEncounterCards` donne des cartes Rencontre face cachée devant l'identité ; `revealScenarioDeckTop` révèle la carte du dessus du deck du scénario ; `stunHero` sonne votre héros ; sinon un texte `onRevealA`, ou `onRevealB` quand la carte est retournée, rappelé au journal).

En reprenant les cartes de chaque scénario : Klaw met maintenant en jeu la manigance annexe Réseau de Défense à la mise en place, Ultron l'environnement Drones d'Ultron ; les étapes II et III des méchants font leur « Une fois révélée » : Rhino II, Klaw II, Ultron III, Zola II et L'Homme Absorbant II révèlent leur manigance annexe (cherchée dans le paquet Rencontre et sa défausse), Crossbones II attache sa Mitrailleuse (2 jetons Munition) et Crossbones III révèle une Arme, Rhino III sonne votre héros, Taskmaster, Crâne Rouge et Le Bouffon Vert (Formule Mutagène) vous donnent leurs cartes Rencontre ; seuls Zola III (un sbire au choix) et Norman Osborn retourné (dégâts à répartir) restent rappelés au journal ; le stade 1B des Démolisseurs rappelle à chaque phase la menace sur les manigances annexes et le jeton Actif. Les capacités ordinaires des cartes (Action, Réponse, Interruption) restent à jouer à la main et ne sont pas reprises.

« Attribuez-vous une carte Rencontre » : clic droit sur le paquet Rencontre → Carte face cachée pour vous (posée devant votre identité, à révéler en la retournant) ; « Carte face cachée (boost) » la pose dans la rangée Rencontre.

## Règles automatisées

- Nouvelle partie en deux écrans. 1 · Héros : une tuile de même largeur par héros (son préconstruit), plus une tuile « Deck personnalisé » qui importe un .o8d ou un .txt MarvelCDB et affiche ensuite la miniature du héros et le nom du deck ; le champ « Depuis MarvelCDB » importe aussi un deck par son lien (decklist publiée ou deck partagé) ou le numéro d'une decklist, avec n'importe quel héros du site : ce qui manque à la table est lu sur MarvelCDB ; un seul choix est allumé à la fois. 2 · Scénario : méchant, set modulaire et difficulté ; le set modulaire et la difficulté ont un choix « Au hasard », tiré à la mise en place et gardé secret : ni le journal, ni la barre du haut, ni la fenêtre « Recommencer la partie » ne le nomment (« module tiré au hasard », « difficulté tirée au hasard »). Les dos ne se choisissent plus : bleu pour les cartes du héros, violet pour les cartes de type Méchant, jaune orangé pour toutes les autres cartes Rencontre.
- Mise en place : identité en alter ego, deck précon ou importé, méchant (I+II standard, II+III expert) et manigance face A sur la table, paquet Rencontre = set du méchant + module + Standard (+ Expert) + obligation du héros, set Némésis mis de côté.
- Paquet joueur vide au moment de piocher (bouton Piocher, clic sur le paquet, `D`, main complétée en fin de phase, mulligan) : la défausse est remélangée et devient le paquet (la défausse est vide), vous recevez une carte Rencontre face cachée, posée devant votre identité (au-dessus, là où elle se trouve ; les suivantes en éventail vers la droite), puis la pioche continue. Même place pour la carte reçue au stade 3 de Kang ; un boost reste dans la rangée Rencontre.
- Paquet Rencontre vide : la défausse est remélangée et un jeton d'accélération est ajouté.
- Tours et phases : la partie commence au tour 1, en phase du héros. Le compteur de tour et les deux boutons « Phase du héros » / « Phase du méchant » (« des méchants » contre Les Démolisseurs) remplacent « Nouveau tour », « Phase du méchant » et « Révéler rencontre » ; le bouton allumé est la phase en cours.
  - Passer à la phase du méchant (`V`) termine votre phase : la main est complétée à la taille de la forme en jeu (héros ou alter ego), vos cartes sont redressées. La phase du méchant elle-même se joue à la main (menace, activations, cartes Rencontre) : le journal en rappelle les étapes et le nombre de jetons d'accélération.
  - Repasser à la phase du héros (`N`) commence le tour suivant.
  - On ne peut passer qu'à l'autre phase : un second clic sur la phase en cours ne fait rien. Une carte Rencontre se révèle aussi à la main (clic sur le paquet Rencontre ou `E`).
- Mulligan officiel : bouton à côté de « Main », actif seulement au tour 1 en phase du héros et une fois par partie (garder sa main compte aussi) ; défausser des cartes de la main de départ puis repiocher.
- Carte au hasard (à côté du mulligan) : une carte de la main tirée au hasard est entourée de rouge et annoncée au journal ; elle perd sa bordure dès qu'on la touche, la clique ou la déplace, ou qu'elle quitte la main.
- Recommencer la partie (barre du haut) : après confirmation, même héros, même deck (précon ou importé), même scénario, module et difficulté compris même s'ils avaient été tirés au hasard (toujours sans les nommer) ; la partie repart du tour 1, paquets remélangés.
- Dégâts / menace / jetons : les dégâts ne vont que sur les personnages (compteurs PV du héros et du méchant, jeton sur les alliés et sbires), la menace que sur les manigances (compteur avec seuil pour la principale, jeton sur les annexes), et les autres cartes (ou une carte face cachée) reçoivent des jetons génériques. La manigance principale reçoit aussi des jetons génériques (`J`, menu) : jetons Retard de L'Homme Absorbant, jetons Test de Zola.
- Une manigance annexe révélée (paquet Rencontre, deck du scénario) ou mise en jeu depuis une pile arrive avec sa menace de départ (la valeur imprimée, pour un joueur). Ce qu'ajoute sa capacité « Une fois révélée » reste à faire à la main.
- Statuts : clic droit sur un personnage (identité, allié, méchant, sbire) pour le rendre Sonné, Désorienté ou Tenace ; ils se cumulent, s'affichent sur la carte, restent quand l'identité change de forme et disparaissent quand la carte quitte la table.
- Une nouvelle étape du méchant ou de la manigance posée depuis « De côté » met les compteurs à jour.
- Méchant vaincu (PV à 0, par dégât ou par le « − » du compteur) : l'étape suivante, mise de côté, le remplace automatiquement, au même endroit et dans la même forme, avec ses cartes d'état (les attachements restent, les dégâts non) ; une fenêtre la présente avec sa carte. L'étape vaincue passe hors jeu. S'il n'y a plus d'étape : fenêtre de victoire, avec le méchant marqué « Vaincu », le nombre de tours et un texte propre à la manigance principale en jeu (ce que vous avez empêché, `VICTORY_TEXTS` dans `data.js`), et les boutons Nouvelle partie / Recommencer.
- Traits : les améliorations joueur portent leurs traits (champ `traits`, clé `tr` dans les JSON, en français : « objet », « tech », « armure »...), lus sur MarvelCDB par `scripts/build-data.py` pour la boîte de base et par `marvelCdbDefinition` pour les cartes importées ; Iron Man compte ses améliorations Tech.
- Ténacité : le personnage entre en jeu avec une carte d'état Tenace (L'Homme-Sable, Garde Blindé, Rhino III, Klaw III, Luke Cage, War Machine, Géant de Glace, les sbires de Crâne Rouge et de Kang qui l'ont, les Kang), quand il est révélé, joué, posé depuis une pile ou retourné face visible sur la table ; elle disparaît dès qu'il quitte la table (défausse, paquet Rencontre, main...). Champ `toughness` des fiches ; `scripts/build-data.py` le tire du texte des cartes de la boîte de base, comme leurs jetons d'entrée en jeu.
- Jetons d'entrée en jeu (Utilisations, « entre en jeu avec ») : la carte arrive sur la table avec ses jetons, nommés dans le journal (« avec 3 jetons Toile ») : Lance-toile, Équipe Tactique, Équipe de Surveillance, Équipe Médicale, Hawkeye (4), Vigilance Accrue, Barrière Énergétique, Réflexes Améliorés, Constitution Améliorée, Iron Fist (2), L'Infirmière de Nuit, et côté Rencontre Entreprise Criminelle (2 Infamie, puis 2 Folie une fois retournée en Accès de Folie), Mitrailleuse de Crossbones (2) et Augmentation de Taille (3) ; en solo, « par joueur » compte une fois. Cela vaut pour une carte jouée, révélée, posée depuis une pile, ou retournée face visible sur la table (jouée face cachée, carte Rencontre reçue face cachée ou glissée face cachée depuis le paquet ; pas un boost posé par le menu, qu'on ne fait que regarder), sauf si elle porte déjà quelque chose. Champs `entryTokens` / `entryTokenName` (`backEntryTokens` / `backEntryTokenName` pour la face B) des fiches, clés `tk` / `tkn` dans les JSON ; les cartes lues sur MarvelCDB les tirent de leur texte.
- Une carte qui quitte la table (main, paquet, défausse, de côté...) est remise à zéro : jetons, dégâts, menace, cartes d'état, épuisement, face A ; dans la main et les défausses, elle est face visible.
- Le Bouffon Vert, deux scénarios et quatre sets modulaires (Gadgets du Bouffon, Un Immense Gâchis, Absorption Électrique, Ingérence en Cours) :
  - *Entreprise à Risques* : l'environnement Entreprise Criminelle est mis en jeu avec 2 jetons Infamie. Retourner Norman Osborn (F) le change en Le Bouffon Vert et renomme le compteur de PV ; Entreprise Criminelle se retourne en Accès de Folie.
  - *Formule Mutagène* : un Esclave Bouffon est mis en jeu engagé avec vous. Nuage Mutagène posé depuis « De côté » met le compteur de menace à 4 /11 ; son accélération +X se compte à la main.
- Les Démolisseurs (quatre méchants à la fois, sans set modulaire, Standard, obligation ni Némésis) :
  - Mise en place : les quatre méchants (versions A, ou B en expert) et leurs manigances annexes avec leur menace de départ, un paquet Rencontre de 15 cartes par méchant, jeton Actif sur Le Démolisseur.
  - Les piles Rencontre affichées (paquet, défausse, révélation, boost, recherche) sont celles du méchant actif, signalé par un badge « Actif » ; clic droit sur un autre méchant → Rendre actif.
  - Phase des méchants (Évasion) : à jouer à la main, menace sur les manigances annexes et jeton Actif compris (clic droit sur un méchant → Rendre actif).
  - Chaque méchant garde ses dégâts sur sa carte, le compteur de PV suit le méchant actif. Un méchant à 0 PV quitte la partie automatiquement (une fenêtre présente le nouveau méchant actif) ; défaussé à la main, de même : il emporte sa manigance annexe (hors jeu) et passe le jeton Actif ; victoire quand les quatre sont tombés.
  - Paquet du méchant actif vide : seule sa défausse est remélangée, +1 jeton d'accélération.
- L'Avènement de Crâne Rouge, cinq scénarios, trois nouveaux sets modulaires (Offensive d'Hydra, Maîtrise des Armes, Patrouille d'Hydra). Un scénario peut prendre plusieurs sets modulaires : l'écran Scénario passe alors en cases à cocher (« 3 à choisir »), un set de plus fait céder le plus ancien, et « Au hasard » en tire autant, tous différents. La face B de chaque manigance principale rappelle au journal sa capacité « Une fois révélée » quand on la retourne, et sa réponse forcée à chaque phase du méchant.
  - *Attaque sur le Mont Athéna* (Crossbones) : trois sets modulaires (Offensive d'Hydra, Maîtrise des Armes, Légions d'Hydra). Le deck Armes Expérimentales est une pile à part, « Armes », entre la défausse Rencontre et « De côté » : clic (ou appui long → Révéler) pour révéler l'arme du dessus, à attacher au méchant. Une arme renvoyée « sur le paquet » retourne sur ce deck, une arme défaussée va dans la défausse Rencontre ; le deck vide le reste.
  - *Personne ne Passe* (L'Homme Absorbant) : les cartes Rencontre sont défaussées jusqu'à un environnement, mis en jeu, la défausse remélangée (en pratique : le premier environnement du paquet mélangé). Un environnement qui entre en jeu (révélé, ou boost retourné face visible) défausse les autres.
  - *Traquer les Héros* (Taskmaster) : set Patrouille d'Hydra toujours inclus, sa manigance annexe en jeu ; les quatre alliés Captifs sont mis de côté comme cartes joueur. Capturé par Hydra révélé en prend un au hasard, posé face cachée sous elle (il dépasse en bas de la manigance) : déjouée, prenez-le en main (`H`).
  - *L'Île du Dr Zola* (Zola) : Prison d'Hydra en jeu, avec dessous, face cachée, l'allié propre au héros cherché dans son paquet, et sa menace de départ plus le coût de cet allié (champ `cost` des alliés de héros, lu aussi sur MarvelCDB) ; un Bio-Serviteur Ultime engagé avec vous.
  - *L'Avènement de Crâne Rouge* (Crâne Rouge) : deux sets modulaires (Offensive d'Hydra, Patrouille d'Hydra). La Maison Rouge en jeu, les cinq autres manigances annexes du set forment le deck Manigance Annexe, pile « Annexes » (même fonctionnement que « Armes », chaque manigance révélée avec sa menace de départ), Le Dormeur mis de côté.
  - Hawkeye (précon Commandement) et Spider-Woman (Agent Double : précon Agressivité et Justice), avec leur obligation et leur set Némésis. Les cartes de campagne (améliorations, obligations de la campagne experte) sont dans les données et les images, sans mode campagne.
- Kang le Conquérant, trois sets modulaires (Temporel, conseillé, Les Anachronautes, Le Maître du Temps). En solo, les aires de jeu du scénario se ramènent à ses stades, enchaînés automatiquement. Comme le disent les cartes, un changement de stade attend la fin de la phase : le Kang vaincu quitte la table tout de suite, une fenêtre annonce ce qui vient, et le changement se fait au clic sur l'autre phase (`V` ou `N`), qui le présente dans la fenêtre du méchant (`s.pending` en attendant) :
  - Mise en place : Kang (I), avec sa carte Tenace (Ténacité), et la manigance 1A en jeu ; les quatre Kang (II), Kang (III) et les quatre Empire de Kang mis de côté ; l'obligation du héros retirée de la partie. En expert, les cartes Kang Expert (I, II, III) remplacent les Kang, avec le set Expert.
  - Kang (I) vaincu, à la fin de la phase : la manigance avance au stade 2. Le Maître du Temps reçoit un pion Accélération par manigance annexe en jeu, qui sont défaussées, et reste face B sous la manigance principale. Un stade 3A est tiré au hasard et entre en jeu avec son Kang (II) (les trois autres stades 3 et Kang (II) quittent la partie), et vous recevez une carte Rencontre face cachée.
  - Stade 3 : les pions Accélération (gardés sur Le Maître du Temps, nombre sur la carte) n'ajoutent pas de menace à votre stade, le journal le rappelle. Kang (II) vaincu (son stade 3 quitte aussitôt la partie), ou stade achevé (au seuil, le journal le signale ; clic droit sur la manigance → « Stade achevé » : une carte Empire de Kang passe sous le stade 4A, Kang (II) et le stade restent jusqu'à la fin de la phase) : à la fin de la phase, la manigance avance au stade 4A, Kang (III) entre en jeu et les cartes Empire de Kang sous le stade sont révélées.
  - Kang (III) vaincu : victoire. Le retournement en 4B rappelle d'aller chercher votre sbire Némésis (De côté).
- Ant-Man et La Guêpe : deux formes de héros, Minuscule (face A) et Géant (face C), autour de l'alter ego (face B : Scott Lang, Nadia Van Dyne). `F` passe de l'alter ego à Minuscule et d'une forme de héros à l'alter ego ; le menu de l'identité (clic droit, appui long) propose l'autre forme : Géant depuis l'alter ego ou Minuscule, Minuscule depuis Géant (Changer de Taille, Croissance Rapide, Tactique d'Essaim). Chaque face a son image, son nom au journal (« Ant-Man (héros Géant) ») et sa taille de main ; les cartes d'état restent.
- Captain America : la mise en place de Steve Rogers ajoute le Bouclier de Captain America à la main de départ (cherché dans le paquet, qui est mélangé). Comme la règle résout les mises en place après le mulligan, le Bouclier ne compte pas dans la main à compléter, et il est repris dans la défausse s'il a été défaussé au mulligan.
- Hulk (Enragé) : sous forme de héros, sa main est défaussée à la fin de son tour, c'est-à-dire quand on passe à la phase du méchant, juste avant de la compléter à 4 cartes.
- Docteur Strange : son deck Invocation (5 cartes) est mélangé à part, face visible, avec sa propre défausse, à droite de la défausse joueur. Clic (ou `I`) : lancer l'invocation du dessus (Maîtrise des Sorts), qui part dans la défausse Invocation ; clic droit ou appui long : la lancer en la gardant (Maître des Arts Mystiques), la défausser sans la lancer (Talent Naturel, Wong), mélanger, chercher. Deck vide : sa défausse est remélangée sans pénalité. Une carte Invocation renvoyée « sur le paquet » retourne sur le deck Invocation ; glissée sur la table, elle arrive face cachée (Ouvrir la Dimension Noire).

Les effets des cartes eux-mêmes restent à appliquer à la main.

## Raccourcis

`D` piocher · `V` phase du méchant · `N` phase du héros (tour suivant) · `E` révéler · `I` invocation (Docteur Strange) · `G`/`⇧G` dégât ± · `M`/`⇧M` menace ± · `J`/`⇧J` jeton ± · `T` épuiser · `F` retourner · `H` en main · `X` de côté · `Suppr` défausser · `Entrée` jouer · `?` aide.
Les raccourcis de carte visent la carte sous la souris, sinon la carte sélectionnée.

Colonne de droite, jusqu'en bas de l'écran (le bandeau du bas, paquet, main et défausse, a la largeur de la table ; sur téléphone tout est sur une colonne) : sous les piles Rencontre, deux onglets, Carte (la carte survolée ou touchée, en grand) et Journal. Pendant que la carte est affichée, l'onglet Journal compte les entrées arrivées entre-temps. La carte prend toute la largeur de la colonne en gardant son format ; plus haute que la place, elle défile (molette, doigt). Le bord gauche de la colonne se glisse (souris ou doigt, ou flèches gauche/droite une fois sélectionné au clavier) pour l'élargir, et la carte avec ; la table garde au moins 420 px. Double-clic sur ce bord : largeur d'origine. L'onglet et la largeur sont gardés dans le navigateur.

## Tablette

Toucher une carte l'agrandit, la glisser la déplace, un double tap l'épuise (ou la joue depuis la main), un appui long ouvre ses options avec la carte en grand. Sur un paquet ou une défausse, le clic droit ou l'appui long ouvre le menu de la pile : chercher dedans (paquet joueur, paquet Rencontre, deck Invocation et leurs défausses), piocher ou révéler, mélanger, reprendre la carte du dessus d'une défausse. Une main trop longue défile en glissant horizontalement, une carte glissée vers le haut part sur la table.

Côté code (`usePointer`) : l'appui long envoie lui-même un `contextmenu` (iOS n'en émet pas) et ignore celui d'Android ou Windows s'il arrive en plus ; le clic qui suit un geste déjà traité est absorbé (pioche en double, option du menu sous le doigt, pile découverte par une fenêtre qui se ferme) ; le double tap est détecté à la main pour le toucher et le stylet. Le navigateur ne reçoit jamais de glissement horizontal (`touch-action`), sinon il peut le transformer en « page précédente ». Les cartes jouables annulent leur `touchstart` (`GameCard`) : tout se joue en événements de pointeur, et aucun geste du navigateur ne reste en suspens quand la carte touchée quitte la page (piochée, jouée, glissée hors de la main), ce qui faisait perdre le tap suivant.

## Données et droits

- Statistiques et traductions : [MarvelCDB](https://github.com/zzorba/marvelsdb-json-data).
- Decks préconstruits : module [OCTGN Marvel Champions](https://github.com/twistedsistem/OCTGN-Marvel-Champions).
- Images des cartes et des dos : © Fantasy Flight Games / Marvel. À garder pour un usage privé, ne pas redistribuer publiquement.

## Pistes

- Multijoueur : l'état est un objet sérialisable, il suffit de synchroniser les actions du store (WebSocket) ; le moteur reste côté client ou passe côté serveur.
- Extensions : comme pour Le Bouffon Vert, un fichier `src/data/<boîte>.json` et un dossier d'images `public/cards/<boîte>/` déclarés dans `PACKS` (`data.js`), puis compléter `HEROES` / `SCENARIOS` / `MODULAR_SETS`, et donner au héros ou au scénario son entrée dans `src/game/rules.js` (un test vérifie qu'il n'en manque aucune).
- Mode campagne de L'Avènement de Crâne Rouge (registre de campagne, améliorations, alliés Captifs gardés d'un scénario à l'autre) : les cartes sont là, la campagne n'est pas gérée. Un paquet héros ajoute son précon à `PRECON_DECKS` (`data.js`), en reprenant les cartes de la boîte de base qu'il réimprime.
- Import `.o8d` : il reconnaît les cartes par leur GUID OCTGN, donc seulement les héros de la boîte de base ; les cartes des autres paquets ont des id maison (`bw-…`, `gob-…`, `dem-…`).
- Import texte MarvelCDB (`.txt`, export « Text file » d'un deck) : les cartes y sont nommées en anglais avec leur paquet entre parenthèses (« 2x Widow's Bite (Black Widow) »). Chaque carte joueur porte donc son nom anglais (`en`, repris de MarvelCDB) et chaque boîte son nom MarvelCDB (`cdb` dans `PACKS`). Les cartes d'un paquet absent sont ignorées et listées à l'import.
- Import par lien MarvelCDB (`src/game/marvelcdb.js`) : l'API publique de [fr.marvelcdb.com](https://fr.marvelcdb.com/api/), sans compte, ouverte à toutes les origines (CORS). Un lien `…/decklist/view/N` lit une decklist publiée, `…/deck/view/N` un deck dont l'auteur partage ses decks (option de son profil), un numéro seul une decklist puis, à défaut, un deck. Les cartes sont reconnues par leur code MarvelCDB (`DEFINITION_BY_CODE` dans `data.js` : numéro de boîte `codePrefix` dans `PACKS`, puis numéro imprimé de la carte et sa face, « 08001a »). Pour un code inconnu, l'API dit si c'est une réimpression d'une carte présente (`duplicate_of_code`, par exemple Premiers Soins réimprimé dans Ant-Man). `parseMarvelCdbDeck` (moteur, sans réseau) fait la correspondance.
- Cartes lues sur MarvelCDB : un héros ou une carte absents des boîtes de la table sont lus dans l'API (`marvelCdbDefinition` : nom français, type, PV, tailles de main, menace de départ, Ténacité, jetons d'entrée en jeu, alter ego au dos de l'identité) avec l'image du site. MarvelCDB n'a qu'un scan par carte, en anglais : ces cartes s'affichent en anglais, leurs noms (journal, menus, recherche) restent en français. Pour un héros absent, sa boîte donne aussi son obligation et son set Némésis. Les cartes ont l'id `cdb-<code>`, rejoignent `CARD_DEFINITIONS` / `DEFINITION_BY_ID` / `DEFINITION_BY_CODE` (`addImportedDefinitions`) et la partie les garde (`setup.importedDefinitions`) : rechargement et « Recommencer la partie » les retrouvent. Le service worker garde leurs images pour jouer hors ligne. Les règles propres à ces héros (jetons, formes, decks à part) se gèrent à la main.
- Images en tâche de fond : à chaque nouvelle partie (et à l'ouverture d'une partie sauvegardée), `usePreload` demande toutes les images de ses cartes (recto, verso, troisième face), celles de la Rencontre d'abord, 4 à la fois quand le navigateur est inactif. Le service worker les range dans son cache (`mc-cards`, `mc-marvelcdb` pour les images MarvelCDB) : une carte révélée plus tard s'affiche aussitôt, même hors ligne. À la première visite, le préchargement attend que le service worker ait pris la main sur la page. Rien n'est préchargé quand le navigateur est en mode économie de données. À tester avec `npm run build` puis `npm run preview` : le serveur de dev n'a pas de service worker.
- Contrôle des données : comparées à l'API, les cartes saisies à la main concordent (noms, PV), sauf dix quantités du Bouffon Vert et des Démolisseurs où l'API se trompe : les positions imprimées sur les cartes (« Le Démolisseur (14/18) ») donnent raison aux fichiers du dépôt.
