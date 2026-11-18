// Mise en place d'une partie : le héros et son deck, le scénario (méchant, manigances, paquet Rencontre,
// mise en place de la manigance 1A), la main de départ, puis le mulligan.

import { CARD_DEFINITIONS, DEFINITION_BY_ID, addImportedDefinitions, SCENARIOS, MODULAR_SETS, AVAILABLE_MODULAR_SETS } from '../data.js'
import { heroRules, scenarioRules } from '../rules.js'
import { SAVED_GAME_VERSION } from '../savedGame.js'
import {
  definitionOf, cardName, cardsInZone, isInScenarioDeck, plural, listInFrench, logMessage, random, randomIndex,
  uniqueId, shuffleZone, activeVillainCard, startingThreatOf
} from './state.js'
import { SPOTS, nextEncounterSpot } from './layout.js'
import { moveCard, entryTokensText } from './moves.js'
import { drawCard, putOwnAllyUnder } from './piles.js'
import { handSize } from './turns.js'
import { byStage, revealVillainStage } from './villains.js'

/* ---------------------------------------------------------------------------------------------------- */
/* Résumé et tirages                                                                                     */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * ", module Alerte à la Bombe, standard" : la fin du résumé d'une mise en place (journal, barre du haut,
 * fenêtre « Recommencer »). Un set modulaire ou une difficulté tirés au hasard restent une surprise : ils
 * ne sont jamais nommés.
 */
export function setupSummary(setup) {
  const randomChoices = setup.randomChoices ?? []
  const modularNames = (setup.modulars ?? []).map(id => MODULAR_SETS.find(modular => modular.id === id)?.name).filter(Boolean)
  const several = modularNames.length > 1
  let modularText = ''
  if (modularNames.length && randomChoices.includes('modular')) modularText = `, module${several ? 's tirés' : ' tiré'} au hasard`
  else if (modularNames.length) modularText = `, module${several ? 's' : ''} ${listInFrench(modularNames)}`
  let difficulty = setup.expert ? 'expert' : 'standard'
  if (randomChoices.includes('expert')) difficulty = 'difficulté tirée au hasard'
  return `${modularText}, ${difficulty}`
}

/**
 * Sets modulaires tirés au hasard, parmi ceux des boîtes proposées (AVAILABLE_PACKS) : autant que le scénario
 * en prend (un, ou plusieurs pour Crossbones et Crâne Rouge), tous différents, jamais un set que le scénario
 * utilise déjà (Patrouille d'Hydra de Taskmaster).
 */
function drawRandomModulars(scenario) {
  const wanted = Math.max(1, scenario.advisedModulars.length)
  const alreadyUsed = scenarioRules(scenario.id).extraSets ?? []
  const pool = AVAILABLE_MODULAR_SETS.filter(modular => !alreadyUsed.includes(modular.id))
  const picked = []
  while (picked.length < wanted && pool.length) picked.push(pool.splice(randomIndex(pool.length), 1)[0].id)
  return picked
}

/* ---------------------------------------------------------------------------------------------------- */
/* Nouvelle partie                                                                                       */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Crée une nouvelle partie.
 * @param {object} options
 *   hero                 identifiant du héros (son set : 'spider_man')
 *   deckList             le deck : [identifiant de carte, exemplaires][] (identité comprise)
 *   scenario             identifiant du scénario ('rhino')
 *   modulars             identifiants des sets modulaires, ou 'random' (tirés ici)
 *   expert               difficulté expert, ou 'random' (tirée ici)
 *   deckLabel            nom du deck pour le journal ("précon Justice")
 *   randomChoices?       ce qui a déjà été tiré au hasard (« Recommencer » rejoue le même tirage)
 *   importedDefinitions? fiches lues sur MarvelCDB avec un deck importé
 * @param {{width, height, cardWidth}} layout  disposition de la table
 * Ce qui a été tiré au hasard est gardé secret (setupSummary). Rend l'état de la nouvelle partie.
 */
export function newGame(options, layout) {
  addImportedDefinitions(options.importedDefinitions)
  const heroDefinition = CARD_DEFINITIONS.find(definition => definition.type === 'hero' && definition.set === options.hero)
  const scenario = SCENARIOS.find(candidate => candidate.id === options.scenario)
  if (!heroDefinition) throw new Error(`Héros inconnu : ${options.hero}`)
  if (!scenario) throw new Error(`Scénario inconnu : ${options.scenario}`)
  const rules = scenarioRules(scenario.id)

  // tirages au hasard : les sets modulaires (sauf Les Démolisseurs, qui n'en ont pas) et la difficulté
  const newRandomChoices = []
  let modulars = options.modulars ?? []
  if (rules.crew) modulars = []
  else if (modulars === 'random') { modulars = drawRandomModulars(scenario); newRandomChoices.push('modular') }
  let expert = options.expert
  if (expert === 'random') { expert = random() < 0.5; newRandomChoices.push('expert') }

  const game = {
    version: SAVED_GAME_VERSION, // format de la partie enregistrée (savedGame.js)
    cards: [], log: [], counters: [], turn: 1, phase: 'hero', accelerationTokens: 0, mulliganTaken: false, topZIndex: 10,
    setup: {
      hero: options.hero, deckList: options.deckList, scenario: scenario.id, modulars, expert: !!expert,
      deckLabel: options.deckLabel, randomChoices: [...(options.randomChoices ?? []), ...newRandomChoices]
    }
  }
  /** Crée une carte de la partie : face cachée dans une pioche, face visible ailleurs, sans rien dessus. */
  const addCard = (definitionId, owner, zone, extra = {}) => game.cards.push({
    id: uniqueId(), definitionId, owner, zone, side: 0, faceUp: !['playerDeck', 'encounterDeck', 'scenarioDeck'].includes(zone),
    exhausted: false, x: 0, y: 0, zIndex: 0, damage: 0, threat: 0, tokens: 0, ...extra
  })

  // l'identité commence sous forme d'alter ego (face B)
  addCard(heroDefinition.id, 'player', 'table', { side: 1, isIdentity: true, zIndex: 1, ...SPOTS.identity(layout) })

  // le paquet du joueur (l'identité, l'obligation et les cartes Invocation sont mises en place à part)
  for (const [definitionId, copies] of options.deckList) {
    const definition = DEFINITION_BY_ID[definitionId]
    if (!definition || ['hero', 'obligation'].includes(definition.type) || definition.set?.endsWith('_invocation')) continue
    for (let copy = 0; copy < copies; copy++) addCard(definitionId, 'player', 'playerDeck')
  }

  const mainSchemeStages = CARD_DEFINITIONS.filter(definition => definition.type === 'main_scheme' && definition.set === scenario.id)
    .sort((first, second) => first.stage.localeCompare(second.stage))
  // ce que la mise en place a mis en jeu ou de côté, pour le message de début de partie
  const setupReport = []
  let firstVillain
  if (rules.crew) {
    firstVillain = setUpCrew(game, layout, rules, expert, addCard)
    addCard(mainSchemeStages[0].id, 'encounter', 'table', { zIndex: 3, ...SPOTS.crewMainScheme(layout) })
  } else {
    firstVillain = setUpVillainStages(game, layout, rules, expert, addCard)
    // la manigance principale : son premier stade sur la table (face A), les autres de côté
    addCard(mainSchemeStages[0].id, 'encounter', 'table', { zIndex: 3, ...SPOTS.mainScheme(layout) })
    for (const stage of mainSchemeStages.slice(1)) addCard(stage.id, 'encounter', 'setAside')
    buildEncounterDeck(game, rules, addCard, setupReport)
    applyScenarioSetup(game, layout, rules, addCard, setupReport)
    // le set Némésis du héros, mis de côté
    for (const definition of CARD_DEFINITIONS) {
      if (definition.set !== `${options.hero}_nemesis`) continue
      for (let copy = 0; copy < definition.quantity; copy++) addCard(definition.id, 'encounter', 'setAside')
    }
  }

  game.counters = [
    { label: heroDefinition.name.toUpperCase(), value: heroDefinition.hitPoints, color: 'var(--hero)' },
    { label: `${firstVillain.name} ${firstVillain.stage}`, value: firstVillain.hitPoints, color: 'var(--enc)' },
    { label: `Menace /${mainSchemeStages[0].threshold ?? '?'}`, value: mainSchemeStages[0].startingThreat ?? 0, color: 'var(--threat)' }
  ]

  // Docteur Strange : le deck Invocation à part, face visible (sa carte du dessus est toujours visible)
  for (const definition of CARD_DEFINITIONS) {
    if (definition.set !== `${options.hero}_invocation`) continue
    for (let copy = 0; copy < definition.quantity; copy++) addCard(definition.id, 'player', 'invocationDeck', { faceUp: true })
  }

  for (const zone of ['playerDeck', 'encounterDeck', 'invocationDeck', 'scenarioDeck']) shuffleZone(game, zone)
  // l'« Une fois révélé » de la première étape du méchant, une fois le paquet Rencontre prêt : en expert,
  // Rhino (II) commence la partie et révèle Casser et Emporter (rules.js villainStages)
  const firstVillainCard = !rules.crew && cardsInZone(game, 'table').find(card => definitionOf(card).type === 'villain')
  const villainRevealNote = firstVillainCard ? revealVillainStage(game, firstVillainCard, layout, { quiet: true }) : ''
  // les cartes lues sur MarvelCDB restent avec la partie : un rechargement ou « Recommencer » les rajoute
  const importedDefinitions = [...new Set(game.cards.map(card => card.definitionId))]
    .map(definitionId => DEFINITION_BY_ID[definitionId]).filter(definition => definition?.pack === 'marvelcdb')
  if (importedDefinitions.length) game.setup.importedDefinitions = importedDefinitions.map(({ pack, imageFolder, ...definition }) => definition)

  // main de départ : la taille de main de l'alter ego ; puis la mise en place de l'identité (Bouclier)
  const startingHandSize = heroDefinition.backHandSize ?? 6
  for (let i = 0; i < startingHandSize; i++) drawCard(game, layout, true)
  const setupCard = applyIdentitySetup(game)
  // la mise en place a posé ses cartes sur la table (moveCard ferme alors le mulligan) : il reste à faire
  game.mulliganTaken = false

  logStartOfGame(game, { heroDefinition, scenario, firstVillain, startingHandSize, setupCard, setupReport, villainRevealNote, deckLabel: options.deckLabel })
  return game
}

/**
 * Les Démolisseurs : les quatre méchants en même temps (version A, B en expert), chacun avec sa manigance
 * annexe en jeu et son propre paquet Rencontre ; le premier a le jeton Actif. Ni obligation, ni Némésis.
 * Rend la fiche du méchant actif (celui dont le compteur montre les PV).
 */
function setUpCrew(game, layout, rules, expert, addCard) {
  game.crew = rules.crew
  game.activeVillainSet = rules.crew[0]
  rules.crew.forEach((set, column) => {
    const [versionA, versionB] = CARD_DEFINITIONS.filter(definition => definition.type === 'villain' && definition.set === set).sort(byStage)
    addCard((expert ? versionB : versionA).id, 'encounter', 'table', { zIndex: 2, ...SPOTS.crewVillain(layout, column) })
    const sideScheme = CARD_DEFINITIONS.find(definition => definition.type === 'side_scheme' && definition.set === set)
    addCard(sideScheme.id, 'encounter', 'table', { zIndex: 2, threat: sideScheme.startingThreat ?? 0, ...SPOTS.crewSideScheme(layout, column) })
    for (const definition of CARD_DEFINITIONS) {
      if (definition.set !== set || ['villain', 'side_scheme'].includes(definition.type)) continue
      for (let copy = 0; copy < definition.quantity; copy++) addCard(definition.id, 'encounter', 'encounterDeck')
    }
  })
  return definitionOf(activeVillainCard(game))
}

/**
 * Un seul méchant : ses étapes I et II en standard, II et III en expert (un scénario dont les cartes
 * expert forment un set à part, Kang Expert, joue toutes les étapes de ce set) — la première sur la
 * table, les autres de côté. Rend la fiche de la première étape du méchant.
 */
function setUpVillainStages(game, layout, rules, expert, addCard) {
  const villainSet = expert && rules.expertSet ? rules.expertSet : game.setup.scenario
  const allStages = CARD_DEFINITIONS.filter(definition => definition.type === 'villain' && definition.set === villainSet).sort(byStage)
  let usedStages = allStages.slice(0, 2)
  if (rules.expertSet) usedStages = allStages
  else if (expert) usedStages = allStages.slice(1, 3)
  const firstVillain = usedStages[0]
  // mot-clé Ténacité (Kang) : le méchant commence avec une carte d'état Tenace
  addCard(firstVillain.id, 'encounter', 'table', { zIndex: 2, ...SPOTS.villain(layout), ...(firstVillain.toughness ? { tough: true } : {}) })
  for (const stage of usedStages.slice(1)) addCard(stage.id, 'encounter', 'setAside')
  return firstVillain
}

/** Les sets Rencontre d'une partie à un seul méchant : le scénario, ses autres sets, les modulaires, Standard (et Expert). */
const encounterSetsOf = (setup, rules) =>
  [setup.scenario, ...(rules.extraSets ?? []), ...setup.modulars, 'standard', ...(setup.expert ? ['expert'] : [])]

/**
 * Le paquet Rencontre d'un seul méchant : set du méchant, autres sets du scénario, set(s) modulaire(s),
 * Standard (et Expert), puis l'obligation du héros ; les alliés Captifs (Taskmaster) sont mis de côté.
 */
function buildEncounterDeck(game, rules, addCard, setupReport) {
  const encounterSets = encounterSetsOf(game.setup, rules)
  const hero = game.setup.hero
  for (const definition of CARD_DEFINITIONS) {
    if (definition.faction !== 'encounter' || !encounterSets.includes(definition.set) || ['villain', 'main_scheme'].includes(definition.type)) continue
    for (let copy = 0; copy < definition.quantity; copy++) {
      if (definition.captive) addCard(definition.id, 'player', 'setAside') // allié Captif : une carte du joueur une fois libéré
      else addCard(definition.id, 'encounter', 'encounterDeck')
    }
  }
  // l'obligation du héros, sauf si le scénario la retire de la partie (Kang)
  const obligation = CARD_DEFINITIONS.find(definition => definition.type === 'obligation' && definition.set === hero)
  if (obligation && rules.removesObligation) setupReport.push(`« ${obligation.name} » retirée de la partie`)
  else if (obligation) addCard(obligation.id, 'encounter', 'encounterDeck')
}

/**
 * La mise en place imprimée sur la face 1A de la manigance principale (rules.js) : les cartes qu'elle met
 * en jeu (une carte nommée, ou la première d'un type depuis le dessus du paquet mélangé, les cartes
 * au-dessus retournant dans le paquet : l'environnement de L'Homme Absorbant), les cartes mises de côté
 * (Le Dormeur, les Empire de Kang), et le deck propre au scénario (Armes Expérimentales, Manigance Annexe).
 * Chaque étape est ajoutée à `setupReport` pour le message de début de partie.
 */
function applyScenarioSetup(game, layout, rules, addCard, setupReport) {
  if (rules.setupSteps?.some(step => step.type)) shuffleZone(game, 'encounterDeck')
  for (const step of rules.setupSteps ?? []) {
    const encounterDeck = cardsInZone(game, 'encounterDeck')
    const card = step.cardId
      ? encounterDeck.find(candidate => candidate.definitionId === step.cardId)
      : encounterDeck.findLast(candidate => definitionOf(candidate).type === step.type)
    if (!card) continue
    moveCard(game, card, 'table', nextEncounterSpot(game, layout), true) // avec ses jetons (enterPlay)
    if (definitionOf(card).type === 'side_scheme') card.threat = startingThreatOf(card)
    const ally = step.allyUnder ? putOwnAllyUnder(game, card, layout) : null
    const counts = [card.tokens ? entryTokensText(card) || plural(card.tokens, 'jeton') : '', card.threat ? plural(card.threat, 'menace') : ''].filter(Boolean)
    const withCounts = counts.length ? ` avec ${counts.join(' et ')}` : ''
    const allyNote = ally ? ` (« ${cardName(ally)} » dessous, face cachée)` : ''
    const engaged = definitionOf(card).type === 'minion' ? ', engagé avec vous' : ''
    setupReport.push(`« ${cardName(card)} »${withCounts}${allyNote} en jeu${engaged}`)
  }
  // chaque exemplaire mis de côté (Le Dormeur, les 4 Empire de Kang)
  for (const definitionId of rules.setAside ?? []) {
    const copies = cardsInZone(game, 'encounterDeck').filter(card => card.definitionId === definitionId)
    for (const card of copies) moveCard(game, card, 'setAside', {}, true)
    if (copies.length) setupReport.push(`${copies.length > 1 ? `${copies.length} ` : ''}« ${DEFINITION_BY_ID[definitionId].name} » de côté`)
  }
  // Kang : les étapes II et III attendent de côté
  if (rules.kang) {
    const kangStagesAside = cardsInZone(game, 'setAside').filter(card => definitionOf(card).type === 'villain').length
    setupReport.push(`${plural(kangStagesAside, 'Kang')} (II et III) de côté`)
  }
  const captiveCount = cardsInZone(game, 'setAside').filter(card => definitionOf(card).captive).length
  if (captiveCount) setupReport.push(`${captiveCount} alliés Captifs de côté`)

  // le deck du scénario : son set (Armes Expérimentales) ou certaines cartes du set du méchant (les
  // manigances annexes de Crâne Rouge, une fois La Maison Rouge en jeu)
  const scenarioDeck = rules.scenarioDeck
  if (!scenarioDeck) return
  for (const card of cardsInZone(game, 'encounterDeck')) {
    if (isInScenarioDeck(scenarioDeck, definitionOf(card))) card.zone = 'scenarioDeck' // changement de zone direct : cartes neuves
  }
  if (!encounterSetsOf(game.setup, rules).includes(scenarioDeck.set)) {
    for (const definition of CARD_DEFINITIONS) {
      if (!isInScenarioDeck(scenarioDeck, definition)) continue
      for (let copy = 0; copy < definition.quantity; copy++) addCard(definition.id, 'encounter', 'scenarioDeck')
    }
  }
  setupReport.push(`deck ${scenarioDeck.name} de ${plural(cardsInZone(game, 'scenarioDeck').length, 'carte')} à côté du paquet Rencontre`)
}

/** Les messages du début de partie : le résumé, les paquets, l'« Une fois révélé » du méchant, la main de départ, ce qui reste à faire. */
function logStartOfGame(game, { heroDefinition, scenario, firstVillain, startingHandSize, setupCard, setupReport, villainRevealNote, deckLabel }) {
  const title = scenario.title ? ` (${scenario.title})` : ''
  logMessage(game, `Partie : ${heroDefinition.name} (${deckLabel}) contre ${scenario.villainName}${title}${setupSummary(game.setup)}.`, true)
  const invocationCount = cardsInZone(game, 'invocationDeck').length
  if (invocationCount) logMessage(game, `Deck Invocation : ${invocationCount} cartes mélangées, celle du dessus est visible. Clic sur le deck (ou I) : la lancer.`)

  const deckSize = cardsInZone(game, 'playerDeck').length + cardsInZone(game, 'hand').length
  const setupCardNote = setupCard ? `, plus « ${cardName(setupCard)} » (mise en place de ${heroDefinition.backName})` : ''
  const start = `Vous commencez en alter ego (${heroDefinition.backName}) avec ${startingHandSize} cartes${setupCardNote}.`
  if (game.crew) {
    logMessage(game, `Paquet : ${deckSize} cartes · un paquet Rencontre de 15 cartes par méchant, ni obligation ni Némésis.`)
    logMessage(game, `${start} Les quatre méchants et leurs manigances annexes sont en jeu, jeton Actif sur « ${firstVillain.name} » : les piles Rencontre affichées sont les siennes. Retournez la manigance (F) pour passer au stade 1B.`, true)
  } else {
    logMessage(game, `Paquet : ${deckSize} cartes · Rencontre : ${cardsInZone(game, 'encounterDeck').length} cartes · Némésis mis de côté.`)
    if (villainRevealNote) logMessage(game, villainRevealNote, true)
    if (setupReport.length) logMessage(game, `${start} Mise en place de la manigance faite (${setupReport.join(', ')}) : retournez-la (F) pour passer au stade 1B.`, true)
    else logMessage(game, `${start} Lisez la face A de la manigance, appliquez sa mise en place puis retournez-la (F).`, true)
  }
  // la mise en place de l'identité quand elle se joue à la main (rules.js : T'Challa), rappelée en dernier
  const heroSetupNote = heroRules(game.setup.hero).setupNote
  if (heroSetupNote) logMessage(game, heroSetupNote, true)
}

/* ---------------------------------------------------------------------------------------------------- */
/* Mise en place de l'identité, mulligan                                                                 */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * « Mise en place » de l'identité qui ajoute une carte à la main (rules.js setupCardId : le Bouclier de
 * Captain America) : cherchée dans le paquet ou la défausse, puis le paquet est mélangé. Rien si elle est
 * déjà en main. Rend la carte prise, ou null.
 *   announce  écrire au journal (après un mulligan ; au début de partie, le message de départ la nomme)
 */
function applyIdentitySetup(game, announce = false) {
  const setupCardId = heroRules(game.setup.hero).setupCardId
  if (!setupCardId || cardsInZone(game, 'hand').some(card => card.definitionId === setupCardId)) return null
  const card = [...cardsInZone(game, 'playerDeck'), ...cardsInZone(game, 'playerDiscard')].find(candidate => candidate.definitionId === setupCardId)
  if (!card) return null
  moveCard(game, card, 'hand', {}, true)
  shuffleZone(game, 'playerDeck')
  game.setupCardId = card.id
  if (announce) logMessage(game, `Mise en place de l'identité : « ${cardName(card)} » revient dans votre main.`, true)
  return card
}

/**
 * Mulligan officiel : défausse les cartes choisies, puis complète la main jusqu'à la taille de main. Les
 * mises en place d'identité viennent après le mulligan : la carte qu'elles ont mise en main ne compte pas
 * dans la main de départ, et elle est reprise si elle a été défaussée. Garder sa main est aussi un choix
 * de mulligan : il ne se fait qu'une fois. Rend le nombre de cartes défaussées.
 */
export function mulligan(game, layout, cardIds) {
  const discarded = cardsInZone(game, 'hand').filter(card => cardIds.includes(card.id))
  if (!discarded.length) {
    logMessage(game, 'Main de départ conservée.')
    game.mulliganTaken = true
    return 0
  }
  for (const card of discarded) moveCard(game, card, 'discard', {}, true)
  const setupCardStillInHand = cardsInZone(game, 'hand').some(card => card.id === game.setupCardId)
  const targetHandSize = handSize(game) + (setupCardStillInHand ? 1 : 0)
  let drawnCount = 0
  while (cardsInZone(game, 'hand').length < targetHandSize && drawCard(game, layout, true)) drawnCount++
  const plural1 = discarded.length > 1 ? 's' : ''
  const plural2 = drawnCount > 1 ? 's' : ''
  logMessage(game, `Mulligan : ${plural(discarded.length, 'carte')} défaussée${plural1}, ${drawnCount} piochée${plural2}.`, true)
  applyIdentitySetup(game, true)
  game.mulliganTaken = true
  return discarded.length
}
