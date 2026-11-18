// Données fixes du jeu Marvel Champions (version française) : les boîtes et leurs cartes, les decks
// préconstruits, la liste des héros, des scénarios et des sets modulaires, et quelques libellés.
//
// Boîtes présentes : la boîte de base, les paquets scénario Le Bouffon Vert, Les Démolisseurs et Kang le
// Conquérant, la grosse boîte L'Avènement de Crâne Rouge, et les paquets héros Black Widow, Docteur Strange,
// Captain America, Hulk, Miss Marvel, Thor, Ant-Man, La Guêpe, Vif-Argent et La Sorcière Rouge.
//
// Les cartes sont rangées dans src/data/*.json : cards.json et precons.json sont produits par le script
// scripts/build-data.py (boîte de base) ; les autres fichiers sont écrits à la main d'après les cartes
// imprimées (identifiants "<boîte>-<numéro de la carte>", par exemple "rrs-064").
//
// Ces fichiers JSON utilisent des clés courtes pour rester compacts (n, t, s, hp…). Le code, lui, ne
// manipule que des noms lisibles : chaque fiche est traduite une seule fois, au chargement, par
// readDefinition() grâce à la table SHORT_KEYS ci-dessous.

import CORE_SET_CARDS from '../data/cards.json'
import GREEN_GOBLIN_CARDS from '../data/bouffon-vert.json'
import WRECKING_CREW_CARDS from '../data/demolisseurs.json'
import RED_SKULL_CARDS from '../data/crane-rouge.json'
import KANG_CARDS from '../data/kang.json'
import BLACK_WIDOW_CARDS from '../data/black-widow.json'
import DOCTOR_STRANGE_CARDS from '../data/docteur-strange.json'
import CAPTAIN_AMERICA_CARDS from '../data/captain-america.json'
import HULK_CARDS from '../data/hulk.json'
import MS_MARVEL_CARDS from '../data/miss-marvel.json'
import THOR_CARDS from '../data/thor.json'
import QUICKSILVER_CARDS from '../data/vif-argent.json'
import SCARLET_WITCH_CARDS from '../data/sorciere-rouge.json'
import ANT_MAN_CARDS from '../data/ant-man.json'
import WASP_CARDS from '../data/guepe.json'
import CORE_SET_PRECON_DECKS from '../data/precons.json'

/* ---------------------------------------------------------------------------------------------------- */
/* Fiches des cartes : des clés courtes des fichiers JSON aux noms lisibles du code                      */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Clé courte d'un fichier JSON → nom du champ dans le code. Une fiche de carte (« définition ») décrit la
 * carte imprimée ; les cartes posées pendant une partie y renvoient par leur `definitionId`.
 */
const SHORT_KEYS = {
  n: 'name', // nom français imprimé (face A)
  en: 'englishName', // nom anglais (cartes joueur) : sert à reconnaître les decks texte de MarvelCDB
  t: 'type', // type : hero, alter_ego, ally, event, support, upgrade, resource, villain, main_scheme,
  //            side_scheme, minion, treachery, attachment, obligation, environment
  f: 'faction', // affinité : hero (cartes propres au héros), basic, justice, aggression… ou encounter
  s: 'set', // set de la carte : le héros (spider_man), un scénario (rhino), un set modulaire…
  q: 'quantity', // nombre d'exemplaires dans la boîte
  l: 'landscape', // 1 si la carte est à l'horizontale (manigances)
  st: 'stage', // étape d'un méchant (I, II, III) ou stade d'une manigance principale (1A, 2A…)
  hp: 'hitPoints', // points de vie (identité, méchant, allié, sbire)
  hs: 'handSize', // taille de main de la face A (héros)
  th: 'threshold', // seuil de menace d'une manigance principale
  esc: 'acceleration', // menace d'accélération imprimée sur une manigance principale (nombre ou "X")
  bth: 'startingThreat', // menace de départ (pour un joueur)
  xth: 'extraThreatPerHero', // « Une fois révélée : placez N menace(s) supplémentaire(s) par héros » (Réseau de Défense)
  bn: 'backName', // nom de la face B (alter ego, Accès de Folie, Le Bouffon Vert…)
  bt: 'backType', // type de la face B
  bhs: 'backHandSize', // taille de main de la face B (alter ego)
  bst: 'backStage', // stade de la face B d'une manigance principale (1B…)
  tr: 'traits', // traits de la face A, en minuscules (méchants, sbires, améliorations joueur)
  btr: 'backTraits', // traits de la face B
  tk: 'entryTokens', // nombre de jetons avec lesquels la carte entre en jeu (Utilisations, « entre en jeu avec »)
  tkn: 'entryTokenName', // nom de ces jetons (« Toile », « Munition »…)
  btk: 'backEntryTokens', // la même chose pour la face B (Accès de Folie)
  btkn: 'backEntryTokenName',
  capture: 'capturesAlly', // Capturé par Hydra : prend un allié Captif, mis de côté, quand elle est révélée
  cn: 'thirdName', // nom de la face C, la deuxième face héros (Ant-Man et La Guêpe : Géant)
  chs: 'thirdHandSize', // taille de main de la face C
  orig: 'originalCode', // code MarvelCDB de la première impression d'une carte réimprimée gardée ici
  foe: 'bringsKang', // stades 3 de Kang : le nom du Kang (II) que ce stade met en jeu
  img: 'imageUrl', // carte lue sur MarvelCDB : l'image du site (face A)
  bimg: 'backImageUrl' // carte lue sur MarvelCDB : l'image de la face B
  // Les autres clés gardent le même nom : id, code, toughness (mot-clé Ténacité : entre en jeu avec une
  // carte d'état Tenace), cost (coût des alliés propres au héros), captive (allié Captif de Taskmaster),
  // forms (noms des formes héros des faces A et C : ["Minuscule", "Géant"]).
}

/**
 * Fiche lisible d'une carte, à partir de sa fiche JSON (clés courtes). Les clés déjà longues (une fiche
 * déjà traduite, ou lue sur MarvelCDB) passent telles quelles : la fonction peut être appliquée deux fois.
 */
export function readDefinition(rawDefinition) {
  const definition = {}
  for (const [key, value] of Object.entries(rawDefinition)) definition[SHORT_KEYS[key] ?? key] = value
  if ('landscape' in definition) definition.landscape = !!definition.landscape
  return definition
}

/* ---------------------------------------------------------------------------------------------------- */
/* Boîtes                                                                                                */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Les boîtes de la table :
 *   id             identifiant interne de la boîte
 *   name           nom français affiché
 *   marvelCdbName  nom que MarvelCDB écrit entre parenthèses après chaque carte d'un deck texte
 *   codePrefix     numéro de la boîte qui commence les codes MarvelCDB ("08" + carte 1 face A = "08001a")
 *   imageFolder    dossier des images sous public/cards/
 *   cards          fiches des cartes (clés courtes, telles que dans le JSON)
 */
export const PACKS = [
  { id: 'core', name: 'Boîte de base', marvelCdbName: 'Core Set', codePrefix: '01', imageFolder: 'base', cards: CORE_SET_CARDS },
  { id: 'green_goblin', name: 'Le Bouffon Vert', marvelCdbName: 'The Green Goblin', codePrefix: '02', imageFolder: 'bouffon vert', cards: GREEN_GOBLIN_CARDS },
  { id: 'wrecking_crew', name: 'Les Démolisseurs', marvelCdbName: 'The Wrecking Crew', codePrefix: '07', imageFolder: 'demolisseurs', cards: WRECKING_CREW_CARDS },
  { id: 'rise_of_red_skull', name: "L'Avènement de Crâne Rouge", marvelCdbName: 'The Rise of Red Skull', codePrefix: '04', imageFolder: 'crane rouge', cards: RED_SKULL_CARDS },
  { id: 'kang', name: 'Kang le Conquérant', marvelCdbName: 'The Once and Future Kang', codePrefix: '11', imageFolder: 'kang', cards: KANG_CARDS },
  { id: 'black_widow', name: 'Black Widow', marvelCdbName: 'Black Widow', codePrefix: '08', imageFolder: 'black widow', cards: BLACK_WIDOW_CARDS },
  { id: 'doctor_strange', name: 'Docteur Strange', marvelCdbName: 'Doctor Strange', codePrefix: '09', imageFolder: 'docteur strange', cards: DOCTOR_STRANGE_CARDS },
  { id: 'captain_america', name: 'Captain America', marvelCdbName: 'Captain America', codePrefix: '03', imageFolder: 'captain america', cards: CAPTAIN_AMERICA_CARDS },
  { id: 'hulk', name: 'Hulk', marvelCdbName: 'Hulk', codePrefix: '10', imageFolder: 'hulk', cards: HULK_CARDS },
  { id: 'ms_marvel', name: 'Miss Marvel', marvelCdbName: 'Ms. Marvel', codePrefix: '05', imageFolder: 'miss marvel', cards: MS_MARVEL_CARDS },
  { id: 'thor', name: 'Thor', marvelCdbName: 'Thor', codePrefix: '06', imageFolder: 'thor', cards: THOR_CARDS },
  { id: 'ant_man', name: 'Ant-Man', marvelCdbName: 'Ant-Man', codePrefix: '12', imageFolder: 'ant-man', cards: ANT_MAN_CARDS },
  { id: 'wasp', name: 'La Guêpe', marvelCdbName: 'Wasp', codePrefix: '13', imageFolder: 'guepe', cards: WASP_CARDS },
  { id: 'quicksilver', name: 'Vif-Argent', marvelCdbName: 'Quicksilver', codePrefix: '14', imageFolder: 'vif-argent', cards: QUICKSILVER_CARDS },
  { id: 'scarlet_witch', name: 'La Sorcière Rouge', marvelCdbName: 'Scarlet Witch', codePrefix: '15', imageFolder: 'sorciere rouge', cards: SCARLET_WITCH_CARDS }
]

/** Identifiant (GUID OCTGN) de la carte de la boîte de base qui porte ce code MarvelCDB ("01064"). */
const coreSetId = marvelCdbCode => CORE_SET_CARDS.find(rawDefinition => rawDefinition.code === marvelCdbCode).id

/* ---------------------------------------------------------------------------------------------------- */
/* Decks préconstruits                                                                                   */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Deck préconstruit de chaque héros : liste de [identifiant de carte, nombre d'exemplaires], identité
 * comprise ; l'obligation et le set Némésis sont gérés à part (mise en place). Les héros de la boîte de
 * base viennent de build-data.py ; ceux des paquets héros sont listés ici (listes du module OCTGN).
 * Plusieurs paquets réimpriment des cartes de la boîte de base : on reprend alors la carte de la boîte.
 */
export const PRECON_DECKS = {
  ...CORE_SET_PRECON_DECKS,
  // Justice : 15 cartes du héros, 17 Justice, 8 basiques
  black_widow: [
    ['bw-01', 1], ['bw-02', 1], ['bw-03', 2], ['bw-04', 2], ['bw-05', 1], ['bw-06', 2], ['bw-07', 2], ['bw-08', 2], ['bw-09', 1], ['bw-10', 2],
    ['bw-11', 1], ['bw-12', 1], ['bw-13', 3], ['bw-17', 3], ['bw-18', 3],
    [coreSetId('01062'), 2], [coreSetId('01063'), 2], [coreSetId('01064'), 2], // Le Pouvoir de la Justice, Salle d'Interrogatoire, Équipe de Surveillance
    ['bw-23', 1], ['bw-24', 3],
    [coreSetId('01084'), 1], [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1] // Nick Fury, Énergie, Génie, Force
  ],
  // Protection : 15 cartes du héros, 17 Protection, 8 basiques ; les 5 cartes Invocation forment un deck à part
  doctor_strange: [
    ['drs-01', 1], ['drs-02', 1], ['drs-03', 2], ['drs-04', 2], ['drs-05', 2], ['drs-06', 1], ['drs-07', 2], ['drs-08', 1], ['drs-09', 1], ['drs-10', 2], ['drs-11', 1],
    ['drs-12', 1], ['drs-13', 1], ['drs-14', 1], ['drs-15', 3], ['drs-16', 3], ['drs-19', 1], ['drs-20', 3],
    [coreSetId('01079'), 2], [coreSetId('01080'), 2], // Le Pouvoir de la Protection, Équipe Médicale
    ['drs-21', 3], ['drs-26', 1],
    [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1], [coreSetId('01091'), 1] // Énergie, Génie, Force, Manoir des Avengers
  ],
  // Commandement : 15 cartes du héros, 17 Commandement, 8 basiques
  captain_america: [
    ['cap-01', 1], ['cap-02', 1], ['cap-03', 2], ['cap-04', 3], ['cap-05', 2], ['cap-06', 2], ['cap-07', 1], ['cap-08', 1], ['cap-09', 1], ['cap-10', 2],
    ['cap-11', 1], ['cap-13', 1], ['cap-14', 1], ['cap-15', 3], ['cap-17', 3], ['cap-19', 3],
    [coreSetId('01066'), 1], [coreSetId('01071'), 2], [coreSetId('01072'), 2], // Hawkeye, Appel de Détresse, Le Pouvoir du Commandement
    ['cap-24', 1], ['cap-25', 3],
    [coreSetId('01083'), 1], [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1] // Mockingbird, Énergie, Génie, Force
  ],
  // Agressivité : 15 cartes du héros, 17 Agressivité, 8 basiques
  hulk: [
    ['hlk-01', 1], ['hlk-02', 2], ['hlk-03', 2], ['hlk-04', 2], ['hlk-05', 2], ['hlk-06', 2], ['hlk-07', 2], ['hlk-08', 1], ['hlk-09', 1], ['hlk-10', 1],
    ['hlk-11', 1], ['hlk-12', 1], ['hlk-13', 1], ['hlk-14', 3], ['hlk-15', 3], ['hlk-16', 3], ['hlk-18', 3],
    [coreSetId('01055'), 2], // Le Pouvoir de l'Agressivité
    ['hlk-19', 3],
    [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1], [coreSetId('01091'), 1], [coreSetId('01092'), 1] // Énergie, Génie, Force, Manoir des Avengers, Héliporteur
  ],
  // Protection : 15 cartes du héros, 14 Protection, 11 basiques
  ms_marvel: [
    ['msm-01', 1], ['msm-02', 1], ['msm-03', 3], ['msm-04', 3], ['msm-05', 2], ['msm-06', 1], ['msm-07', 1], ['msm-08', 1], ['msm-09', 1], ['msm-10', 1], ['msm-11', 1],
    ['msm-12', 1], ['msm-14', 3], ['msm-15', 3], ['msm-17', 3],
    [coreSetId('01078'), 2], [coreSetId('01079'), 2], // Restez derrière moi !, Le Pouvoir de la Protection
    ['msm-18', 1], ['msm-23', 3], ['msm-24', 3],
    [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1], [coreSetId('01091'), 1] // Énergie, Génie, Force, Manoir des Avengers
  ],
  // Agressivité : 15 cartes du héros, 17 Agressivité, 8 basiques
  thor: [
    ['thor-01', 1], ['thor-02', 1], ['thor-03', 3], ['thor-04', 1], ['thor-05', 3], ['thor-06', 2], ['thor-07', 1], ['thor-08', 2], ['thor-09', 1], ['thor-10', 1],
    ['thor-11', 1], ['thor-12', 1], ['thor-14', 3], ['thor-15', 3], ['thor-17', 1], ['thor-18', 3], ['thor-19', 1],
    [coreSetId('01052'), 2], [coreSetId('01055'), 2], // Poursuivons-les, Le Pouvoir de l'Agressivité
    ['thor-20', 1], ['thor-21', 3],
    [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1], [coreSetId('01091'), 1] // Énergie, Génie, Force, Manoir des Avengers
  ],
  // L'Avènement de Crâne Rouge. Commandement : 15 cartes du héros, 17 Commandement, 8 basiques ; la boîte
  // réimprime des cartes de la boîte de base et la Tour des Avengers du paquet Captain America
  hawkeye: [
    ['rrs-001', 1], ['rrs-002', 1], ['rrs-003', 1], ['rrs-004', 1], ['rrs-005', 2], ['rrs-006', 2], ['rrs-007', 2], ['rrs-008', 2], ['rrs-009', 2], ['rrs-010', 2],
    ['rrs-011', 1], ['rrs-012', 1], ['rrs-013', 1], ['rrs-014', 1], ['rrs-015', 3], ['rrs-016', 3], ['rrs-017', 3],
    [coreSetId('01070'), 2], [coreSetId('01072'), 2], // Commander en Première Ligne, Le Pouvoir du Commandement
    ['rrs-020', 1], ['cap-24', 1], ['rrs-022', 3], // War Machine, Tour des Avengers, Les Plus Grands Héros de la Terre
    [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1] // Énergie, Génie, Force
  ],
  // Agent Double : Agressivité et Justice. 15 cartes du héros, 11 Agressivité, 11 Justice, 3 basiques
  spider_woman: [
    ['rrs-031', 1], ['rrs-032', 1], ['rrs-033', 2], ['rrs-034', 1], ['rrs-035', 2], ['rrs-036', 2], ['rrs-037', 2], ['rrs-038', 2], ['rrs-039', 3],
    ['rrs-040', 1], [coreSetId('01057'), 2], [coreSetId('01056'), 2], ['rrs-043', 3], ['rrs-044', 3], // Spider-Girl, Entraînement au Combat, Équipe Tactique…
    ['rrs-045', 1], [coreSetId('01065'), 2], ['rrs-047', 3], [coreSetId('01063'), 2], ['rrs-049', 3], // Spider-Man, Instinct Héroïque, Enquêteur Chevronné, Salle d'Interrogatoire…
    [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1] // Énergie, Génie, Force
  ],
  // Protection : 15 cartes du héros, 15 Protection, 10 basiques
  quicksilver: [
    ['qsv-01', 1], ['qsv-02', 1], ['qsv-03', 4], ['qsv-04', 2], ['qsv-05', 2], ['qsv-06', 1], ['qsv-07', 1], ['qsv-08', 1], ['qsv-09', 1], ['qsv-10', 1], ['qsv-11', 1],
    ['qsv-12', 3], ['qsv-13', 1], ['qsv-14', 3], ['qsv-15', 3], [coreSetId('01081'), 2], ['qsv-17', 3], // … Veste Blindée, Nerfs d'Acier
    ['qsv-18', 1], [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1], ['qsv-22', 3], ['qsv-23', 3] // Ordre et Chaos, Énergie, Génie, Force…
  ],
  // Justice : 15 cartes du héros, 18 Justice, 7 basiques ; Ordre et Chaos est celle du paquet Vif-Argent
  scarlet_witch: [
    ['scw-01', 1], ['scw-02', 1], ['scw-03', 1], ['scw-04', 4], ['scw-05', 3], ['scw-06', 1], ['scw-07', 1], ['scw-08', 3], ['scw-09', 1],
    ['scw-10', 1], ['scw-11', 1], ['scw-12', 3], ['scw-13', 3], ['scw-14', 3], ['scw-15', 3],
    [coreSetId('01062'), 2], [coreSetId('01065'), 2], // Le Pouvoir de la Justice, Instinct Héroïque
    ['qsv-18', 1], ['scw-19', 3], [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1] // Ordre et Chaos, Méditation Spirituelle, Énergie, Génie, Force
  ],
  // Agressivité : 15 cartes du héros, 16 Agressivité, 9 basiques ; le Quinporteur est celui du paquet Black Widow
  wasp: [
    ['wsp-01', 1], ['wsp-02', 1], ['wsp-03', 2], ['wsp-04', 3], ['wsp-05', 2], ['wsp-06', 2], ['wsp-07', 2], ['wsp-08', 1], ['wsp-09', 1], ['wsp-10', 1],
    ['wsp-11', 1], ['wsp-12', 1], ['wsp-13', 3], ['wsp-14', 3], [coreSetId('01055'), 2], ['wsp-16', 3], ['wsp-17', 3], // … Le Pouvoir de l'Agressivité…
    ['wsp-18', 1], ['wsp-19', 1], ['wsp-20', 1], [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1], ['wsp-24', 2], ['bw-23', 1] // … Quinporteur
  ],
  // Commandement : 15 cartes du héros, 16 Commandement, 9 basiques ; la Tactique d'Essaim est celle du paquet La Guêpe
  ant_man: [
    ['ant-01', 1], ['ant-02', 1], ['ant-03', 2], ['ant-04', 1], ['ant-05', 2], ['ant-06', 2], ['ant-07', 3], ['ant-08', 1], ['ant-09', 2], ['ant-10', 1],
    ['ant-11', 1], ['ant-12', 1], ['ant-13', 1], ['ant-14', 1], ['ant-15', 3], ['ant-16', 3], ['ant-17', 3], ['ant-18', 3],
    [coreSetId('01086'), 2], ['wsp-20', 1], [coreSetId('01088'), 1], [coreSetId('01089'), 1], [coreSetId('01090'), 1], ['ant-24', 3] // Premiers Soins, Tactique d'Essaim, Énergie, Génie, Force…
  ]
}

/* ---------------------------------------------------------------------------------------------------- */
/* Index des fiches                                                                                      */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Toutes les fiches de cartes, lisibles, chacune complétée de `pack` (identifiant de sa boîte) et de
 * `imageFolder` (dossier de ses images). Les cartes lues sur MarvelCDB s'y ajoutent (addImportedDefinitions).
 */
export const CARD_DEFINITIONS = PACKS.flatMap(pack => pack.cards.map(rawDefinition =>
  ({ ...readDefinition(rawDefinition), pack: pack.id, imageFolder: pack.imageFolder })))

/** Identifiant de carte (GUID OCTGN pour la boîte de base, "rrs-064" pour les autres) → fiche. */
export const DEFINITION_BY_ID = Object.fromEntries(CARD_DEFINITIONS.map(definition => [definition.id, definition]))

/**
 * Code MarvelCDB d'une carte de nos boîtes. La boîte de base garde les codes de MarvelCDB ("01043a") ; les
 * autres boîtes donnent le numéro imprimé ("1A", "17") : on le complète du numéro de la boîte ("12001a").
 */
const marvelCdbCodeOf = (pack, rawDefinition) => (/^\d{5}/.test(rawDefinition.code)
  ? rawDefinition.code
  : pack.codePrefix + rawDefinition.code.replace(/\D/g, '').padStart(3, '0') + rawDefinition.code.replace(/\d/g, '').toLowerCase())

/**
 * Code MarvelCDB ("01043a", "08012") → fiche. Une réimpression gardée ici répond aussi au code de sa
 * première impression (Tactique d'Essaim : wsp-20 est aussi 12020, l'impression du paquet Ant-Man).
 */
export const DEFINITION_BY_CODE = Object.fromEntries(PACKS.flatMap(pack =>
  pack.cards.map(rawDefinition => [marvelCdbCodeOf(pack, rawDefinition), DEFINITION_BY_ID[rawDefinition.id]])))
for (const definition of CARD_DEFINITIONS) {
  if (definition.originalCode) DEFINITION_BY_CODE[definition.originalCode] ??= definition
}

/**
 * Ajoute les cartes lues sur MarvelCDB quand un deck est importé par lien (un héros, ou des cartes d'une
 * boîte absente de la table) : identifiants "cdb-<code>", noms français, `imageUrl` / `backImageUrl` les
 * images du site (scans anglais). Elles rejoignent CARD_DEFINITIONS, DEFINITION_BY_ID et DEFINITION_BY_CODE ;
 * la partie les garde (setup.importedDefinitions), si bien qu'un rechargement ou « Recommencer » les retrouve.
 * Une carte déjà connue n'est pas ajoutée deux fois ; une carte de nos boîtes (scan français) reste prioritaire
 * pour son code.
 */
export function addImportedDefinitions(importedDefinitions = []) {
  for (const imported of importedDefinitions) {
    if (DEFINITION_BY_ID[imported.id]) continue
    const definition = { ...readDefinition(imported), pack: 'marvelcdb', imageFolder: null }
    CARD_DEFINITIONS.push(definition)
    DEFINITION_BY_ID[definition.id] = definition
    DEFINITION_BY_CODE[definition.code] ??= definition
  }
}

/* ---------------------------------------------------------------------------------------------------- */
/* Héros, scénarios, sets modulaires                                                                     */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Héros de la table, dans l'ordre de l'écran Nouvelle partie : `id` est aussi le set de ses cartes,
 * `aspect` l'affinité de son précon, `feminine` pour accorder les phrases (« battue »). Leurs règles
 * spéciales sont dans rules.js.
 */
export const HEROES = [
  { id: 'spider_man', name: 'Spider-Man', aspect: 'Justice' },
  { id: 'captain_marvel', name: 'Captain Marvel', aspect: 'Commandement', feminine: true },
  { id: 'she_hulk', name: 'Miss Hulk', aspect: 'Agressivité', feminine: true },
  { id: 'iron_man', name: 'Iron Man', aspect: 'Agressivité' },
  { id: 'black_panther', name: 'Black Panther', aspect: 'Protection' },
  { id: 'black_widow', name: 'Black Widow', aspect: 'Justice', feminine: true },
  { id: 'doctor_strange', name: 'Docteur Strange', aspect: 'Protection' },
  { id: 'captain_america', name: 'Captain America', aspect: 'Commandement' },
  { id: 'hulk', name: 'Hulk', aspect: 'Agressivité' },
  { id: 'ms_marvel', name: 'Miss Marvel', aspect: 'Protection', feminine: true },
  { id: 'thor', name: 'Thor', aspect: 'Agressivité' },
  { id: 'hawkeye', name: 'Hawkeye', aspect: 'Commandement' },
  { id: 'spider_woman', name: 'Spider-Woman', aspect: 'Agressivité et Justice', feminine: true },
  { id: 'quicksilver', name: 'Vif-Argent', aspect: 'Protection' },
  { id: 'scarlet_witch', name: 'La Sorcière Rouge', aspect: 'Justice', feminine: true },
  { id: 'wasp', name: 'La Guêpe', aspect: 'Agressivité', feminine: true },
  { id: 'ant_man', name: 'Ant-Man', aspect: 'Commandement' }
]

/** Nom d'un héros : celui de la liste ci-dessus, ou celui de sa carte d'identité lue sur MarvelCDB. */
export const heroName = heroId => HEROES.find(hero => hero.id === heroId)?.name
  ?? CARD_DEFINITIONS.find(definition => definition.type === 'hero' && definition.set === heroId)?.name ?? ''

/** Le héros est une héroïne (accord des phrases) ; un héros lu sur MarvelCDB est pris au masculin. */
export const isFeminineHero = heroId => !!HEROES.find(hero => hero.id === heroId)?.feminine

/**
 * Scénarios, dans l'ordre de l'écran Nouvelle partie :
 *   id               identifiant du scénario, qui est aussi le set du méchant et des manigances principales
 *   villainName      nom du méchant affiché
 *   title            titre du scénario, quand il diffère du nom du méchant
 *   advisedModulars  sets modulaires conseillés (un, plusieurs, ou aucun pour Les Démolisseurs)
 *   level            difficulté indiquée sur l'écran de choix (boîte de base)
 * Leurs règles spéciales (mise en place, decks à part, rappels…) sont dans rules.js.
 */
export const SCENARIOS = [
  { id: 'rhino', villainName: 'Rhino', advisedModulars: ['bomb_scare'], level: 'Débutant' },
  { id: 'klaw', villainName: 'Klaw', advisedModulars: ['masters_of_evil'], level: 'Intermédiaire' },
  { id: 'ultron', villainName: 'Ultron', advisedModulars: ['under_attack'], level: 'Difficile' },
  { id: 'risky_business', villainName: 'Norman Osborn', title: 'Entreprise à Risques', advisedModulars: ['goblin_gimmicks'] },
  { id: 'mutagen_formula', villainName: 'Le Bouffon Vert', title: 'Formule Mutagène', advisedModulars: ['goblin_gimmicks'] },
  { id: 'wrecking_crew', villainName: 'Les Démolisseurs', title: 'Quatre méchants', advisedModulars: [] },
  // L'Avènement de Crâne Rouge
  { id: 'crossbones', villainName: 'Crossbones', title: 'Attaque sur le Mont Athéna', advisedModulars: ['hydra_assault', 'weapon_master', 'legions_of_hydra'] },
  { id: 'absorbing_man', villainName: "L'Homme Absorbant", title: 'Personne ne Passe', advisedModulars: ['hydra_patrol'] },
  { id: 'taskmaster', villainName: 'Taskmaster', title: 'Traquer les Héros', advisedModulars: ['weapon_master'] },
  { id: 'zola', villainName: 'Zola', title: "L'Île du Dr Zola", advisedModulars: ['under_attack'] },
  { id: 'red_skull', villainName: 'Crâne Rouge', title: "L'Avènement de Crâne Rouge", advisedModulars: ['hydra_assault', 'hydra_patrol'] },
  { id: 'kang', villainName: 'Kang', title: 'Kang le Conquérant', advisedModulars: ['temporal'] }
]

/** Sets modulaires de la table : identifiant (le `set` de leurs cartes) et nom français. */
export const MODULAR_SETS = [
  { id: 'bomb_scare', name: 'Alerte à la Bombe' },
  { id: 'masters_of_evil', name: 'Les Maîtres du Mal' },
  { id: 'under_attack', name: 'Civils Attaqués' },
  { id: 'legions_of_hydra', name: "Légions d'Hydra" },
  { id: 'the_doomsday_chair', name: "Le Siège de l'Apocalypse" },
  { id: 'goblin_gimmicks', name: 'Gadgets du Bouffon' },
  { id: 'a_mess_of_things', name: 'Un Immense Gâchis' },
  { id: 'power_drain', name: 'Absorption Électrique' },
  { id: 'running_interference', name: 'Ingérence en Cours' },
  { id: 'hydra_assault', name: "Offensive d'Hydra" },
  { id: 'weapon_master', name: 'Maîtrise des Armes' },
  { id: 'hydra_patrol', name: "Patrouille d'Hydra" },
  { id: 'temporal', name: 'Temporel' },
  { id: 'anachronauts', name: 'Les Anachronautes' },
  { id: 'master_of_time', name: 'Le Maître du Temps' }
]

/**
 * Boîtes proposées à la mise en place (écran Nouvelle partie, sets modulaires tirés au hasard) : pour
 * l'instant la boîte de base seule, soit 5 héros, 3 scénarios et 5 sets modulaires. Les cartes des autres
 * boîtes restent connues de la table (parties sauvegardées, decks importés).
 */
export const AVAILABLE_PACKS = ['core']
/** Le set (héros, scénario, set modulaire) a des cartes dans une des boîtes proposées. */
const isAvailableSet = setId => CARD_DEFINITIONS.some(definition => definition.set === setId && AVAILABLE_PACKS.includes(definition.pack))
export const AVAILABLE_HEROES = HEROES.filter(hero => isAvailableSet(hero.id))
export const AVAILABLE_SCENARIOS = SCENARIOS.filter(scenario => isAvailableSet(scenario.id))
export const AVAILABLE_MODULAR_SETS = MODULAR_SETS.filter(modular => isAvailableSet(modular.id))

/* ---------------------------------------------------------------------------------------------------- */
/* Libellés et constantes                                                                                */
/* ---------------------------------------------------------------------------------------------------- */

/** Type de carte → libellé français (journal, menus). */
export const TYPE_LABELS = {
  hero: 'Héros', alter_ego: 'Alter ego', ally: 'Allié', event: 'Événement', support: 'Soutien',
  upgrade: 'Amélioration', resource: 'Ressource', villain: 'Méchant', main_scheme: 'Manigance principale',
  side_scheme: 'Manigance annexe', minion: 'Sbire', treachery: 'Traîtrise', attachment: 'Attachement',
  obligation: 'Obligation', environment: 'Environnement'
}

/**
 * Texte de la fenêtre de victoire, selon la manigance principale en jeu quand le dernier méchant tombe :
 * ce que les héros ont empêché. Clé : identifiant de la carte de la manigance.
 */
export const VICTORY_TEXTS = {
  '1687b8a9-9630-4800-b297-03c5001e8ee9': 'L\'effraction a échoué : Rhino repart les mains vides, et menotté.', // L'Effraction !
  '77e9fb39-e38c-4b35-bf58-39072e9c6c10': 'Le réseau de Klaw est démantelé : aucune de ses armes soniques n\'arrivera dans les rues.', // Trafic Clandestin
  '76806fd2-3552-44be-98a5-17ab83880eca': 'Le rendez-vous secret n\'aura jamais lieu : Klaw ne livrera pas sa technologie aux pires criminels du monde.', // Rendez-Vous Secret
  '741ee538-008d-4f5b-8b54-be47c3b37160': 'Le masque du Crimson Cowl est tombé : les plans d\'Ultron sont exposés avant d\'avoir pu aboutir.', // Le Crimson Cowl
  '79ae1bd9-628f-40f7-8e00-049526f13041': 'Le NORAD tient bon : Ultron ne prendra pas le contrôle des défenses du continent.', // Assaut sur le NORAD
  'af49444f-d93e-4ef5-b2fb-2035cd386d41': 'Le compte à rebours est stoppé à temps : Ultron n\'anéantira pas l\'humanité.', // Compte à Rebours pour l'Enfer
  'gob-04': 'La prise de contrôle hostile échoue : Norman Osborn ne mettra pas la main sur la ville.', // Prise de Contrôle Hostile
  'gob-05': 'L\'acquisition est annulée : l\'empire d\'Osborn s\'effondre avant d\'avoir englouti ses rivaux.', // Acquisition d'Entreprise
  'gob-17': 'Le mutagène ne se répandra pas : aucun habitant ne deviendra l\'esclave du Bouffon.', // Répandre le Mutagène
  'gob-18': 'Le nuage mutagène se dissipe : la ville respire, et l\'armée de Bouffons ne verra jamais le jour.', // Nuage Mutagène
  'dem-01': 'L\'évasion a échoué : les Démolisseurs retournent derrière les barreaux.', // Évasion
  'rrs-061': 'Le Mont Athéna tient : l\'assaut de Crossbones sur le Projet P.E.G.A.S.U.S. est repoussé.', // Attaque sur le Mont Athéna
  'rrs-062': 'La Pierre d\'Infinité reste au S.H.I.E.L.D. : Hydra repart sans la Pierre de la Réalité.', // La Pierre d'Infinité
  'rrs-063': 'Le convoi est arrêté : Crossbones et ses hommes ne s\'enfuiront pas avec la Pierre.', // La Fuite
  'rrs-079': 'Le passage est libre : l\'Homme Absorbant ne retardera plus les héros.', // Personne ne Passe
  'rrs-096': 'La traque est finie : le chef de la police d\'Hydra ne mettra plus de héros sous les verrous.', // Traquer les Héros
  'rrs-112': 'L\'île du Dr Zola est libérée : ses cobayes ne deviendront pas des soldats d\'Hydra.', // L'Île du Dr Zola
  'rrs-113': 'Le savant fou est arrêté : son armée d\'altérés ne sera jamais lâchée sur le monde.', // Le Savant Fou
  'rrs-128': 'Crâne Rouge tombe avant d\'avoir conquis le monde : la Pierre de la Réalité lui échappe.', // L'Avènement de Crâne Rouge
  'rrs-129': 'Le nouvel ordre mondial d\'Hydra ne verra pas le jour : la réalité n\'obéira pas à Crâne Rouge.', // Nouvel Ordre Mondial d'Hydra
  'kng-07': 'Kang repart comme il est venu : les plus grands héros de la Terre ne se sont pas soumis.', // L'Arrivée de Kang
  'kng-08': 'Le Maître du Temps n\'a pas su vous disperser : vous vous êtes retrouvés au présent.', // Le Maître du Temps
  'kng-09': 'Chronopolis s\'éteint : Immortus ne régnera pas sur la fin des temps.', // Chronopolis
  'kng-10': 'Le destin n\'était pas inéluctable : Iron Lad ne deviendra pas Kang.', // Destin Inéluctable
  'kng-11': 'Le royaume de Rama-Tut retourne aux sables : l\'Égypte n\'aura pas de pharaon venu du futur.', // Le Royaume de Rama-Tut
  'kng-12': 'La guerre du présent et du futur est gagnée : le Centurion Écarlate est renvoyé dans son siècle.', // La Guerre Présent-Futur
  'kng-13': 'La colère de Kang retombe : la Terre ne sera pas une province de son empire.' // La Colère de Kang
}

/**
 * Zones où une carte peut se trouver (la valeur de `card.zone`) → libellé français pour le journal.
 * Les piles « Rencontre » sont partagées par les quatre Démolisseurs : seules celles du méchant actif
 * sont montrées (encounterPile dans le moteur).
 */
export const ZONE_LABELS = {
  playerDeck: 'paquet',
  hand: 'main',
  table: 'table',
  playerDiscard: 'défausse',
  encounterDeck: 'paquet Rencontre',
  encounterDiscard: 'défausse Rencontre',
  setAside: 'de côté', // cartes mises de côté, hors jeu (étapes suivantes du méchant, Némésis…)
  invocationDeck: 'deck Invocation', // Docteur Strange
  invocationDiscard: 'défausse Invocation',
  scenarioDeck: 'deck du scénario', // Armes Expérimentales, Manigance Annexe : le moteur précise son nom
  outOfGame: 'hors jeu' // étapes de méchant vaincues, manigances d'un Démolisseur vaincu : montrées nulle part
}

/** Couleurs des pions libres posés sur la table (bouton « + Pion »), utilisées tour à tour. */
export const PAWN_COLORS = ['#d9705c', '#4f7fc9', '#6fbf73', '#d1a356', '#a77ad9']

/**
 * Cartes d'état qu'un personnage peut porter : `id` est aussi le nom du champ booléen sur la carte en
 * jeu (card.stunned…) et le nom de l'image ; `label` le nom affiché.
 */
export const STATUS_CARDS = [
  { id: 'stunned', label: 'Sonné' },
  { id: 'confused', label: 'Désorienté' },
  { id: 'tough', label: 'Tenace' }
]

/** Types de cartes qui sont des personnages (l'identité est repérée par `isIdentity` sur la carte en jeu). */
export const CHARACTER_TYPES = ['ally', 'villain', 'minion']

/** Types de cartes qui reçoivent de la menace. */
export const SCHEME_TYPES = ['main_scheme', 'side_scheme']
