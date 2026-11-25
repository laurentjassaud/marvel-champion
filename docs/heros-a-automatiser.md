# Héros aux règles particulières : à prendre en compte pour les decks importés

Les héros dont une règle touche la table elle-même : une mise en place, un deck à part, plusieurs identités,
ou un calcul que la table fait (taille de main, défaite). Leurs autres capacités se jouent à la main, comme
aujourd'hui. Ces héros arrivent presque tous par un deck chargé depuis un site (MarvelCDB, MC4DB) : leurs
règles iront dans `IMPORTED_HERO_RULES` (`src/game/rules.js`), sous le **set de leur identité sur MarvelCDB**
(`card_set_code`, colonne « Set ») et avec les **codes MarvelCDB** de leurs cartes, comme Vision, Star-Lord et
Colossus.

Relevé le 25/11/2026 sur le texte anglais des cartes de MarvelCDB (`/api/public/cards/`), jusqu'à Iron Fist.
Les noms de cartes sont ceux de MarvelCDB, en anglais quand le nom français n'est pas connu ici.

## Refusés pour l'instant

Elektra et Iron Fist ne se chargent pas : « héros non disponible sur cette plateforme » (`UNAVAILABLE_HEROES` dans
`src/game/rules.js`, vérifié avant toute lecture du deck, MarvelCDB comme MC4DB) ; un deck déjà gardé dans « Mes
decks » n'y est plus proposé. Les retirer de cette liste une fois leurs règles faites (points 4 et 6).

## Déjà pris en compte

| Héros | Ce que fait la table | Où |
|---|---|---|
| Vision | Intangible (`26002`) commence en jeu, face A | `startsInPlay` |
| Wolverine, X-23, Wonder Man, Jessica Jones | leur carte commence en jeu : Griffes de Wolverine (`35002`), Griffes de X-23 (`43002`), Ionic Physiology (`58002`), Alias Investigations (`61002`) | `startsInPlay` |
| Shadowcat, Nick Fury | leur amélioration à deux faces commence en jeu, face A : Corporelle (`32031a`), Assault (`50035a`) | `startsInPlay` |
| Psylocke | ses 2 Psi-Couteau (`41002a`) commencent en jeu, face A | `startsInPlay` (tous les exemplaires) |
| Phénix | Force Phénix (`34002a`) en jeu, face Contenue, avec 4 jetons Pouvoir | `startsInPlay` (`tokens`, `tokenName`) |
| Spectrum | Gamma, Photon, Pulsar (`21002`–`21004`) en jeu, face cachée ; leur face visible dans l'aperçu, au survol ou au toucher | `startsInPlay` (`faceDown`, `previewFace`) |
| Captain America, T'Challa, Star-Lord, Colossus | carte de mise en place en main après le mulligan (au choix pour T'Challa) | `setupCard` |
| Cable | après le mulligan, une manigance annexe de joueur au choix (paquet ou défausse) entre en jeu avec sa menace de départ | `setupCard` (`intoPlay`, `fromDiscard`) |
| Tornade | son deck Climat (Ciel Dégagé, Ouragan, Orage, Blizzard : `36002`–`36005`, hors de la liste du deck, lus dans la boîte) est la pile « Climat » du bandeau ; après le mulligan, la fenêtre propose le soutien Climat à mettre en jeu ; Contrôle Climatique à la main (glisser un soutien de la pile, X range l'ancien) | `heroPiles`, `setupCard` (`zones`, `intoPlay`) |
| Hercule | ses decks Travaux (`59002`–`59004`) et Dons (`59005`–`59007`), hors de la liste du deck (lus dans la boîte), mélangés et face cachée : les piles « Travaux » et « Dons » du bandeau ; un clic sur l'une met en jeu sa carte du dessus | `heroPiles` (`faceDown`, `shuffled`, `playsTop` ; zones `heroSetAside`, `heroSetAside2`) |
| Daredevil | son deck Sens (`60002`–`60006`, hors de la liste du deck), mélangé et face visible : la pile « Sens » ; un clic met en jeu la carte du dessus, le clic droit « Voir le deck Sens » ; une amélioration Sens qui quitte le jeu retourne sous le deck | `heroPiles` (`shuffled`, `playsTop`, `returnsUnder`) |
| Valkyrie, Malicia, Iceberg | Aura de la Mort (`25002`), Touché (`38002`), 6 Pris Dans la Glace (`46002`, créés : hors de la liste du deck, l'import les lit dans la boîte) dans la pile « De côté » du bandeau du joueur, entre le paquet et la défausse ; « Mettre de côté » (X) les y range | `heroPiles` (zone `heroSetAside`) |
| Docteur Strange | deck Invocation | set `<héros>_invocation` |
| Ant-Man, la Guêpe | 3 faces d'identité | `thirdName`, `thirdHandSize`, `forms` |
| Iron Man | taille de main + améliorations Tech | `handSizeBonus` |
| Hulk | Enragé : main défaussée en fin de tour | `discardsHandAtTurnEnd` |
| Deadpool | sous forme de héros, tombé à 0 PV, il n'est pas battu : 1 PV, alter ego, 1 pion Accélération ; la fenêtre « Pas mort ! » l'explique (« Annuler » ou « Continuer ») ; en alter ego, il est battu normalement | `regeneratesAtZero` |
| Magik, Faucon | sous forme de héros, la carte du dessus de leur pioche est face visible (Magik : son paquet, et glissée sur la table elle y arrive face visible ; Faucon : le paquet Rencontre, pendant la phase du joueur) ; seul l'affichage change, l'aperçu la montre aussi | `showsTopCard` |

## 1. Une carte commence en jeu

Fait : `startsInPlay` pose tous les exemplaires d'une carte, face A ou face cachée, avec des jetons de départ ;
`setupCard` (`intoPlay`) met en jeu une carte au choix après le mulligan (Cable).

## 2. Une carte rejoint la main

Fait : `setupCard` (Captain America, T'Challa, Star-Lord, Colossus). Venom reste manuel (voir plus bas).

## 3. Des cartes mises de côté au départ

Fait : `heroPiles` (Valkyrie, Malicia, Iceberg). Reste à la main : Malicia remet Touché de côté au début de
chaque phase du joueur (X sur la carte).

Vérifié sur de vrais decks : les Pris Dans la Glace d'Iceberg (set `iceman_frostbite`) ne sont pas dans la liste
du deck sur MarvelCDB ; l'import les lit dans la boîte du héros, comme le set Némésis. Les decks du point 4 sont
sans doute dans le même cas : à vérifier.

## 4. Un deck à part, comme l'Invocation de Docteur Strange

Fait : `heroPiles` (Tornade, Hercule, Daredevil). Reste Elektra (refusée pour l'instant), dont le deck se mélange
dans le paquet Rencontre.

| Héros | Set | Deck (set MarvelCDB) | Règle |
|---|---|---|---|
| Elektra | `elektra` | `elektra_ninja_deck` (3 cartes, `63002`–`63004`) | quand elle passe en héros, la carte du dessus est mélangée dans le paquet Rencontre |

Le set de l'Invocation s'appelle `doctor_strange_invocation_deck` sur MarvelCDB et `doctor_strange_invocation`
sur la table : à harmoniser si ces decks passent par l'import.

## 5. Plusieurs cartes ou faces d'identité

Fait (rules.js `identity`, `levelUp` ; l'import assemble l'identité avec des cartes de la boîte, `assembleIdentity`) :

| Héros | Set | Ce que fait la table | Cartes |
|---|---|---|---|
| Angel / Archangel | `angel` | 3 faces, comme Ant-Man : le menu de l'identité passe en Angel ou en Archangel. Pas de scan français d'Archangel sur cgbuilder : image anglaise de MarvelCDB | `42001a`, `42001b`, `42001c` (`identity.thirdFace`) |
| Ironheart | `ironheart` | version 1 au départ ; versions 2 et 3 dans la pile « Versions » du bandeau ; « Level Up! (version N) » au menu de l'identité en héros : la version suivante la remplace, à sa place, face héros, redressée, avec ses jetons et ses cartes d'état ; la taille de main suit (4, 5, 6). Les compteurs de progrès se jouent avec les jetons | `29001a/b`, `29002a/b`, `29003a/b` (`heroPiles`, `levelUp`) |
| SP//dr | `spdr` | l'identité : SP//dr Suit (héros, main de 3) et Peni Parker (alter ego, main de 4) ; la combinaison (Armure SP//dr) en jeu dès la mise en place, face Inactive, se retourne avec l'identité (face « SP//dr » de Peni en héros) | `31001a/b`, `31002a/b` (`identity.alterEgo`, `identity.companion`) |

## 6. Ce que la table calcule ou affiche

| Héros | Set | Règle | Où dans la table |
|---|---|---|---|
| Iron Fist (refusé pour l'instant) | `iron_fist` | fin de la phase du joueur : retirer les compteurs chi au-delà de 4, soigner 1 dégât par compteur retiré | fin de phase (`turns.js`) |

## Rien à faire sur la table

- Laissé manuel, par choix : Venom (`vnm`). Sa mise en place (défausser le dessus du paquet jusqu'à une
  amélioration Arme, qui rejoint la main) se joue à la main, après le mulligan : pas d'automatisation.
- Laissé manuel, par choix : Vision (`vision`), au-delà de sa forme de masse en jeu au départ.
  - Sa taille de main : le texte de sa face alter ego (en alter ego seulement : +1 taille de main en forme
    Intangible, +2 REC en forme Dense) n'est pas compté par la table ; la main se complète à 5 en alter ego, le
    joueur pioche la carte en plus s'il est en forme Intangible.
  - La pioche de la face Dense (`26002` : « Réponse : après être passé sous cette forme de masse, piochez 1
    carte ») : le joueur pioche lui-même (D) quand il retourne la forme de masse sur Dense.
- Règles de construction du deck seulement (la table ne vérifie pas les decks) : Spider-Woman (déjà notée),
  Adam Warlock, Gamora, Cyclope, Maria Hill, Cable et Wonder Man (en plus de leur mise en place).
- Compteurs ou cartes glissées dessous, qui se jouent avec les jetons de la table : Groot, Drax, War Machine,
  Spider-Ham, Gambit, Silk, Echo, Jessica Jones (compteurs de preuve).
- Les autres capacités (Action, Réponse, Interruption) se jouent à la main, comme pour tous les héros.

## Ordre proposé

1. Iron Fist et Elektra (refusés pour l'instant).

Aperçu des cartes face cachée : pour Spectrum seulement (option `previewFace` de `startsInPlay`), la souris sur
une forme d'énergie face cachée, ou le toucher qui la sélectionne, montre sa face dans l'aperçu, puisque le joueur choisit laquelle
retourner. À étendre au besoin à d'autres cartes posées face cachée par une mise en place.
