// Le camp du méchant : dégâts, menace et jetons posés sur les cartes, la défaite d'une étape du méchant
// (l'étape suivante la remplace et fait son « Une fois révélée »), le jeton Actif des Démolisseurs, et les
// stades de Kang le Conquérant.

import { DEFINITION_BY_ID, STATUS_CARDS, TYPE_LABELS } from '../data.js'
import { VILLAIN_STAGE_RULES } from '../rules.js'
import {
  definitionOf, cardName, cardLabel, cardsInZone, identityCard, isAlterEgo, counterKindOf, plural, logMessage,
  randomIndex, moveToTop, shuffleZone, encounterPile, activeVillainCard, activeVillainName, sideSchemeOfSet,
  scenarioRulesOf, scenarioDeckOf, mainSchemesInPlay
} from './state.js'
import { SPOTS, DEFAULT_LAYOUT, nextEncounterSpot } from './layout.js'
import { moveCard, entryTokensNote } from './moves.js'
import { applyStartingThreat, dealEncounterCardToPlayer, dealEncounterCardsToPlayer, revealScenarioDeckCard } from './piles.js'

/** Ordre des étapes : "I" < "II" < "III" (et "1A" < "2A"… pour les manigances). */
export const byStage = (first, second) => first.stage.length - second.stage.length || first.stage.localeCompare(second.stage)

/* ---------------------------------------------------------------------------------------------------- */
/* Dégâts, menace, jetons                                                                                */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Inflige des dégâts (amount > 0) ou soigne (amount < 0), aux personnages seulement. Le méchant et
 * l'identité utilisent les compteurs de PV du haut de l'écran ; alliés et sbires reçoivent un jeton de
 * dégâts. Sans carte (card = null) : le méchant. Avec les Démolisseurs, chaque méchant garde ses dégâts
 * sur sa carte et le compteur montre le méchant actif.
 * Rend ce qu'a donné la défaite d'un méchant (voir defeatVillain), pour que l'écran le présente.
 */
export function addDamage(game, card, amount, layout = DEFAULT_LAYOUT) {
  if (card && counterKindOf(card) !== 'damage') return undefined
  const isVillain = !card || definitionOf(card).type === 'villain'

  if (game.crew && isVillain) {
    const villain = card ?? activeVillainCard(game)
    if (!villain) return undefined
    const hitPoints = definitionOf(villain).hitPoints
    const hitPointsBefore = hitPoints - villain.damage
    villain.damage = Math.max(0, villain.damage + amount)
    const hitPointsLeft = Math.max(0, hitPoints - villain.damage)
    logMessage(game, `${amount > 0 ? 'Dégât' : 'Soin'} sur ${cardName(villain)} : ${hitPointsLeft} PV.`)
    syncVillainCounterWithActive(game)
    if (hitPointsBefore > 0 && hitPointsLeft === 0) return defeatVillain(game, villain, layout)
    return undefined
  }
  if (isVillain) {
    const villainCounter = game.counters[1]
    const hitPointsBefore = villainCounter.value
    villainCounter.value = Math.max(0, villainCounter.value - amount)
    logMessage(game, `${amount > 0 ? 'Dégât' : 'Soin'} sur ${villainCounter.label} : ${villainCounter.value} PV.`)
    const villain = card ?? cardsInZone(game, 'table').find(candidate => definitionOf(candidate).type === 'villain')
    if (hitPointsBefore > 0 && villainCounter.value === 0 && villain) return defeatVillain(game, villain, layout)
    return undefined
  }
  if (card.isIdentity) {
    const heroCounter = game.counters[0]
    heroCounter.value = Math.max(0, heroCounter.value - amount)
    logMessage(game, `${amount > 0 ? 'Dégât' : 'Soin'} sur ${cardName(card)} : ${heroCounter.value} PV.`)
    if (amount > 0 && heroCounter.value === 0) logMessage(game, 'Votre identité tombe à 0 PV : défaite.', true)
    return undefined
  }
  card.damage = Math.max(0, card.damage + amount)
  logMessage(game, `${cardLabel(card)} : ${plural(card.damage, 'dégât')}.`)
  return undefined
}

/**
 * Ajoute de la menace (amount > 0) ou en retire (contre, amount < 0), sur les manigances seulement. La
 * manigance principale utilise le compteur de menace ; une manigance annexe reçoit un jeton de menace.
 * Sans carte : la manigance principale. Quand la menace de la manigance principale atteint son seuil, elle
 * est achevée (mainSchemeCompleted) : rend ce que cela a donné, pour que l'écran le présente.
 */
export function addThreat(game, card, amount) {
  if (card && counterKindOf(card) !== 'threat') return undefined
  if (card && definitionOf(card).type !== 'main_scheme') {
    card.threat = Math.max(0, card.threat + amount)
    logMessage(game, `${cardLabel(card)} : ${plural(card.threat, 'menace')}.`)
    return undefined
  }
  const threatCounter = game.counters[2]
  threatCounter.value = Math.max(0, threatCounter.value + amount)
  logMessage(game, `Menace sur la manigance principale : ${threatCounter.value}.`)
  const threshold = threatThreshold(game)
  if (amount > 0 && threshold && threatCounter.value >= threshold) return mainSchemeCompleted(game)
  return undefined
}

/**
 * La manigance principale, face visible sur la table : sa menace est le compteur, mais la carte peut
 * aussi recevoir des jetons génériques (jetons Retard de L'Homme Absorbant, jetons Test de Zola).
 */
export const mainSchemeTakesTokens = card => card.zone === 'table' && card.faceUp && definitionOf(card).type === 'main_scheme'

/**
 * Ajoute (amount > 0) ou retire (amount < 0) des jetons génériques sur une carte qui n'est ni un
 * personnage ni une manigance (utilisations, compteurs…), ou sur la manigance principale. À ne pas
 * confondre avec addPawn, qui pose un pion libre sur la table.
 */
export function addTokens(game, card, amount) {
  if (!card || (counterKindOf(card) !== 'tokens' && !mainSchemeTakesTokens(card))) return
  card.tokens = Math.max(0, (card.tokens || 0) + amount)
  logMessage(game, `${cardLabel(card)} : ${plural(card.tokens, 'jeton')}.`)
}

/** Seuil de menace de la manigance principale, lu dans le libellé de son compteur ("Menace /7" → 7) ; null s'il est inconnu. */
export function threatThreshold(game) {
  return Number((game.counters[2].label.match(/\/(\d+)/) || [])[1]) || null
}

/* ---------------------------------------------------------------------------------------------------- */
/* Manigance principale achevée                                                                          */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * La menace de la manigance principale atteint son seuil : le stade est achevé.
 *   - Kang, stade 3 : une carte Empire de Kang passe sous le stade 4A, le stade 4 arrive à la fin de la
 *     phase (completeKangStage3, présenté dans la fenêtre du méchant) ;
 *   - un stade suivant attend de côté : il le remplace (advanceMainScheme) ;
 *   - sinon c'est le dernier stade (« Si ce stade est achevé, les joueurs perdent la partie ») : défaite.
 *     Les stades 2 à 4 de Kang ne se suivent pas dans l'ordre : ses stades 1 et 4 achevés sont des défaites.
 * Rend {kind: 'pending', …} (Kang), {kind: 'schemeAdvance', …} ou {kind: 'schemeDefeat', …}.
 */
function mainSchemeCompleted(game) {
  const kangStage3 = kangStage3Scheme(game)
  if (kangStage3) return completeKangStage3(game) ?? undefined
  const mainScheme = threatCounterScheme(game)
  if (!mainScheme) return undefined
  const nextStage = scenarioRulesOf(game).kang ? null : nextMainSchemeStage(game, mainScheme)
  const reachedThreat = game.counters[2].value
  const threshold = threatThreshold(game)
  if (nextStage) return advanceMainScheme(game, mainScheme, nextStage, { reachedThreat, threshold })
  logMessage(game, `« ${cardName(mainScheme)} » est achevée (${reachedThreat}/${threshold}) : les joueurs perdent la partie.`, true)
  return { kind: 'schemeDefeat', fromCardId: mainScheme.id, reachedThreat, threshold }
}

/** Le stade suivant de la manigance principale, mis de côté à la mise en place (le premier dans l'ordre des stades), ou undefined. */
const nextMainSchemeStage = (game, mainScheme) => cardsInZone(game, 'setAside')
  .filter(card => definitionOf(card).type === 'main_scheme' && definitionOf(card).set === definitionOf(mainScheme).set)
  .sort((first, second) => byStage(definitionOf(first), definitionOf(second)))[0]

/**
 * Le stade achevé quitte la partie ; le stade suivant prend sa place, face A, avec ses propres valeurs :
 * le compteur de menace repart de sa menace de départ, avec son seuil (moveCard depuis « De côté ») ; la
 * menace en trop ne passe pas au stade suivant. Le journal rappelle son « Une fois révélée ».
 * Rend {kind: 'schemeAdvance', fromCardId, toCardId, reachedThreat, threshold}.
 */
function advanceMainScheme(game, mainScheme, nextStage, { reachedThreat, threshold }) {
  const { x, y } = mainScheme // le stade suivant se pose à la même place
  logMessage(game, `« ${cardName(mainScheme)} » est achevée (${reachedThreat}/${threshold}) : le stade suivant la remplace.`, true)
  moveCard(game, mainScheme, 'outOfGame', {}, true)
  moveCard(game, nextStage, 'table', { x, y }, true) // depuis « De côté » : nouveau compteur, « Nouvelle manigance » au journal
  return { kind: 'schemeAdvance', fromCardId: mainScheme.id, toCardId: nextStage.id, reachedThreat, threshold }
}

/* ---------------------------------------------------------------------------------------------------- */
/* Défaite d'une étape du méchant                                                                        */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Un méchant tombe à 0 PV. Son étape suivante, mise de côté, prend sa place : même endroit, même forme,
 * cartes d'état gardées (les attachements sont des cartes à part et restent), dégâts non ; puis elle fait
 * son « Une fois révélée » (revealVillainStage). Avec les Démolisseurs, le méchant quitte la partie avec
 * sa manigance annexe et le jeton Actif passe à un autre. Plus aucun méchant : victoire. Les stades de
 * Kang ont leurs propres règles (plus bas) : ses changements de stade attendent la fin de la phase.
 * Rend, avec des identifiants de cartes :
 *   {kind: 'stage', fromCardId, toCardId, keptStatuses, note?, stageLeft?}
 *        étape suivante (keptStatuses : cartes d'état passées à la suivante ; Kang : note, ce que le
 *        changement de stade a amené, stageLeft : le stade 3 a été achevé et non le méchant vaincu)
 *   {kind: 'pending', fromCardId, note, title?}  Kang : changement de stade à la fin de la phase
 *   {kind: 'crew', fromCardId, activeVillainId, sideSchemeId}  Démolisseurs : méchant parti, nouveau méchant actif
 *   {kind: 'victory', villainId, mainSchemeId}  victoire (la manigance principale en jeu, pour le texte de victoire)
 */
export function defeatVillain(game, villain, layout = DEFAULT_LAYOUT) {
  const definition = definitionOf(villain)
  if (scenarioRulesOf(game).kang && ['I', 'II'].includes(definition.stage)) return kangVillainDefeated(game, villain)

  const mainScheme = mainSchemesInPlay(game).at(-1)
  const victory = () => {
    // avec les Démolisseurs, crewVillainLeftTable a déjà annoncé la victoire en retirant le dernier méchant
    if (!game.crew) logMessage(game, `Victoire : « ${cardName(villain)} » est vaincu en ${plural(game.turn, 'tour')} !`, true)
    return { kind: 'victory', villainId: villain.id, mainSchemeId: mainScheme?.id }
  }

  if (game.crew) {
    const sideScheme = sideSchemeOfSet(game, definition.set)
    moveCard(game, villain, 'outOfGame', {}, true) // crewVillainLeftTable : manigance retirée, jeton Actif déplacé
    if (!cardsInZone(game, 'table').some(card => definitionOf(card).type === 'villain')) return victory()
    return { kind: 'crew', fromCardId: villain.id, activeVillainId: activeVillainCard(game)?.id, sideSchemeId: sideScheme?.id }
  }

  const nextStage = cardsInZone(game, 'setAside')
    .filter(card => definitionOf(card).type === 'villain' && definitionOf(card).set === definition.set)
    .sort((first, second) => byStage(definitionOf(first), definitionOf(second)))[0]
  if (!nextStage) return victory()

  const keptStatuses = STATUS_CARDS.filter(status => villain[status.id]).map(status => status.id)
  const { x, y, side } = villain
  const statusNote = keptStatuses.length ? ', ses cartes d\'état passent à l\'étape suivante' : ''
  logMessage(game, `« ${cardName(villain)} » ${definition.stage} est vaincu${statusNote}.`, true)
  moveCard(game, villain, 'outOfGame', {}, true)
  nextStage.side = side
  moveCard(game, nextStage, 'table', { x, y }, true) // depuis « De côté » : nouveau compteur, « Nouvelle étape du méchant » au journal
  for (const statusId of keptStatuses) nextStage[statusId] = true
  game.counters[1].label = `${cardName(nextStage)} ${definitionOf(nextStage).stage}`
  revealVillainStage(game, nextStage, layout)
  return { kind: 'stage', fromCardId: villain.id, toCardId: nextStage.id, keptStatuses }
}

/**
 * Une étape du méchant vient d'entrer en jeu (elle remplace l'étape vaincue, ou elle est posée depuis
 * « De côté ») : la table fait son « Une fois révélée » quand elle le peut (rules.js villainStages :
 * revealCardId, dealEncounterCards, revealScenarioDeckTop, stunHero) et l'écrit au journal. Ce qui se joue
 * à la main (onRevealA) est rappelé par moveCard ; une étape qui arrive sur sa face B n'a que des rappels.
 */
export function revealVillainStage(game, villain, layout) {
  const stageRules = VILLAIN_STAGE_RULES[definitionOf(villain).id]
  if (!stageRules || villain.side) return
  const effects = []
  if (stageRules.revealCardId) effects.push(revealCardFromEncounter(game, stageRules, layout))
  if (stageRules.dealEncounterCards) effects.push(dealEncounterCardsToPlayer(game, layout, stageRules.dealEncounterCards))
  if (stageRules.stunHero) effects.push(stunIdentity(game))
  const scenarioDeck = stageRules.revealScenarioDeckTop && scenarioDeckOf(game)
  if (scenarioDeck) effects.push(`la carte du dessus du deck ${scenarioDeck.name} est révélée`)
  if (effects.length) logMessage(game, `« ${cardName(villain)} » ${definitionOf(villain).stage}, une fois révélé : ${effects.join(' ; ')}.`, true)
  if (scenarioDeck) revealScenarioDeckCard(game, layout) // écrit la carte révélée au journal
}

/**
 * La carte que nomme une étape (rules.js revealCardId), cherchée dans le paquet Rencontre puis sa défausse,
 * et révélée : une manigance annexe avec sa menace de départ, un attachement pour le méchant (avec ses
 * jetons) ; le paquet est ensuite mélangé. Si elle est déjà en jeu et que les règles le prévoient
 * (dealIfAlreadyInPlay), une carte Rencontre vous est attribuée à la place. Rend la phrase du journal.
 */
function revealCardFromEncounter(game, stageRules, layout) {
  const name = `« ${DEFINITION_BY_ID[stageRules.revealCardId].name} »`
  const alreadyInPlay = cardsInZone(game, 'table').some(card => card.definitionId === stageRules.revealCardId && card.faceUp)
  if (alreadyInPlay && stageRules.dealIfAlreadyInPlay) {
    return `${name} est déjà en jeu, ${dealEncounterCardsToPlayer(game, layout, 1)}`
  }
  const card = [...encounterPile(game, 'encounterDeck'), ...encounterPile(game, 'encounterDiscard')]
    .find(candidate => candidate.definitionId === stageRules.revealCardId)
  if (!card) return `${name} ${alreadyInPlay ? 'est déjà en jeu' : 'n\'est ni dans le paquet Rencontre ni dans sa défausse'}`
  moveCard(game, card, 'table', nextEncounterSpot(game, layout), true) // face visible, avec ses jetons (enterPlay)
  const details = applyStartingThreat(game, card, layout) + entryTokensNote(card)
  shuffleZone(game, 'encounterDeck')
  const how = definitionOf(card).type === 'attachment' ? 'attachée au méchant' : 'révélée'
  return `${name} ${how} (${TYPE_LABELS[definitionOf(card).type] ?? definitionOf(card).type}${details}), paquet Rencontre mélangé`
}

/** « Sonnez chaque héros » : votre identité, si elle est sous forme de héros. Rend la phrase du journal. */
function stunIdentity(game) {
  const identity = identityCard(game)
  if (!identity) return 'aucun héros à sonner'
  if (isAlterEgo(identity)) return `${cardName(identity)} est en alter ego : aucun héros à sonner`
  identity.stunned = true
  return `${cardName(identity)} reçoit une carte d'état Sonné`
}

/* ---------------------------------------------------------------------------------------------------- */
/* Plusieurs méchants : Les Démolisseurs                                                                 */
/* ---------------------------------------------------------------------------------------------------- */

const TIE_ADVICE = ' (égalité : le premier joueur choisit, clic droit sur un autre méchant → Rendre actif)'

/** Le compteur du méchant suit le méchant actif (ses dégâts restent sur sa carte). */
function syncVillainCounterWithActive(game) {
  const villain = activeVillainCard(game)
  if (!villain) return
  const definition = definitionOf(villain)
  Object.assign(game.counters[1], { label: `${definition.name} ${definition.stage}`, value: Math.max(0, definition.hitPoints - villain.damage) })
}

/**
 * Le méchant encore en jeu dont la manigance annexe a le plus de menaces : {set, tie}. En cas d'égalité,
 * le méchant actif garde le jeton s'il en fait partie ; `tie` signale l'égalité (le joueur choisit).
 */
function mostThreatenedVillainSet(game) {
  const villainsLeft = game.crew.filter(set => cardsInZone(game, 'table').some(card => definitionOf(card).type === 'villain' && definitionOf(card).set === set))
  const threatOf = set => sideSchemeOfSet(game, set)?.threat ?? 0
  const highestThreat = Math.max(...villainsLeft.map(threatOf))
  const leaders = villainsLeft.filter(set => threatOf(set) === highestThreat)
  return { set: leaders.includes(game.activeVillainSet) ? game.activeVillainSet : leaders[0], tie: leaders.length > 1 }
}

/** Donne le jeton Actif au méchant du set Rencontre `set` (menu « Rendre actif »). */
export function setActiveVillain(game, set) {
  if (!game.crew?.includes(set) || set === game.activeVillainSet) return
  game.activeVillainSet = set
  syncVillainCounterWithActive(game)
  logMessage(game, `Jeton Actif sur « ${activeVillainName(game)} » : les piles Rencontre affichées sont les siennes.`, true)
}

/**
 * Un des Démolisseurs a quitté la table (vaincu, ou déplacé à la main) : il emmène sa manigance annexe
 * hors de la partie ; s'il avait le jeton Actif, le jeton passe au méchant dont la manigance a le plus de
 * menaces. S'il n'en reste plus aucun : victoire (c'est le seul endroit qui l'annonce, défaite ou pas).
 */
export function crewVillainLeftTable(game, villain) {
  const set = definitionOf(villain).set
  const sideScheme = sideSchemeOfSet(game, set)
  if (sideScheme) moveCard(game, sideScheme, 'outOfGame', {}, true)
  const withScheme = sideScheme ? ` avec sa manigance « ${definitionOf(sideScheme).name} »` : ''
  logMessage(game, `« ${definitionOf(villain).name} » quitte la partie${withScheme}.`, true)
  const next = mostThreatenedVillainSet(game)
  if (!next.set) {
    logMessage(game, `Victoire : les quatre Démolisseurs sont vaincus en ${plural(game.turn, 'tour')}, vous gagnez la partie !`, true)
    return
  }
  if (game.activeVillainSet !== set) return
  game.activeVillainSet = next.set
  syncVillainCounterWithActive(game)
  logMessage(game, `Jeton Actif sur « ${activeVillainName(game)} », dont la manigance annexe a le plus de menaces${next.tie ? TIE_ADVICE : ''}.`, true)
}

/* ---------------------------------------------------------------------------------------------------- */
/* Kang le Conquérant                                                                                    */
/* ---------------------------------------------------------------------------------------------------- */
// En solo, les aires de jeu du scénario se ramènent à ses stades, dans l'ordre : Kang (I) et le stade 1 ;
// un stade 3 tiré au hasard avec son Kang (II), pendant que Le Maître du Temps (stade 2) attend à côté
// avec les pions Accélération ; puis le stade 4 avec Kang (III). Comme le disent les cartes, un changement
// de stade attend la fin de la phase : il est gardé dans game.pendingStageChange =
// {step: 3 | 4, fromVillainId, x, y, empires?, stageLeft?} et résolu par resolvePendingStageChange
// (startVillainPhase, startHeroPhase).

const STAGE_4_NEXT = 'À la fin de la phase, vous rejoignez Le Maître du Temps : la manigance principale avancera au stade 4A, avec Kang (III)'

/** La manigance principale de ce stade, sur la table, dans le scénario de Kang ; null sinon. */
const kangSchemeAtStage = (game, stage) =>
  (scenarioRulesOf(game).kang ? mainSchemesInPlay(game).find(card => definitionOf(card).stage === stage) : null) ?? null

/** Le Maître du Temps sur la table : le stade 2, qui attend pendant le stade 3 ; null sinon. */
export const masterOfTimeScheme = game => kangSchemeAtStage(game, '2A')

/**
 * La manigance principale dont la menace est le compteur de menace (game.counters[2]) : celle en jeu, hors
 * Le Maître du Temps de Kang (qui garde, lui, ses pions Accélération en jetons) ; null s'il n'y en a pas.
 */
export const threatCounterScheme = game => mainSchemesInPlay(game).find(card => card !== masterOfTimeScheme(game)) ?? null

/** Le stade 3 en jeu ; null sinon. */
export const kangStage3Scheme = game => kangSchemeAtStage(game, '3A')

/**
 * Kang (I) ou Kang (II) vaincu : il quitte la table tout de suite, le changement de stade attend la fin
 * de la phase. Kang (II) retire aussi son stade 3 de la partie aussitôt.
 */
function kangVillainDefeated(game, villain) {
  const stage = definitionOf(villain).stage
  const { x, y } = villain
  moveCard(game, villain, 'outOfGame', {}, true)
  if (stage === 'I') {
    game.pendingStageChange = { step: 3, fromVillainId: villain.id, x, y }
    const note = 'À la fin de la phase, la manigance principale avancera au stade 2, Le Maître du Temps, puis un stade 3 tiré au hasard entrera en jeu avec son Kang (II).'
    logMessage(game, `« ${cardName(villain)} » I est vaincu. ${note}`, true)
    return { kind: 'pending', fromCardId: villain.id, note }
  }
  const stage3 = kangStage3Scheme(game)
  if (stage3) moveCard(game, stage3, 'outOfGame', {}, true)
  // un stade 3 achevé plus tôt dans la phase a déjà glissé son Empire de Kang sous le stade 4A
  game.pendingStageChange = { step: 4, fromVillainId: villain.id, x, y, empires: game.pendingStageChange?.empires ?? 0 }
  const note = `${stage3 ? `« ${cardName(stage3)} » quitte la partie. ` : ''}${STAGE_4_NEXT}.`
  logMessage(game, `« ${cardName(villain)} » II est vaincu. ${note}`, true)
  return { kind: 'pending', fromCardId: villain.id, note }
}

/**
 * Fin d'une phase : le changement de stade en attente (Kang) est résolu. Rend ce qu'il a donné (une
 * nouvelle étape du méchant, pour que l'écran la présente), ou null s'il n'y en avait pas.
 */
export function resolvePendingStageChange(game, layout) {
  const pending = game.pendingStageChange
  if (!pending) return null
  delete game.pendingStageChange
  return pending.step === 3 ? advanceToKangStage3(game, layout, pending) : advanceToKangStage4(game, layout, pending)
}

/** Pose une carte sur la table sans jetons ni message (son effet est géré par l'appelant). */
function placeWithoutEffects(game, card, spot) {
  Object.assign(card, spot, { zone: 'table', faceUp: true, zIndex: ++game.topZIndex })
  moveToTop(game, card)
}

/**
 * Fin de la phase après la défaite de Kang (I) : stade 2, Le Maître du Temps. Un pion Accélération dessus
 * par manigance annexe en jeu, puis ces manigances sont défaussées ; un stade 3A tiré au hasard entre en
 * jeu avec son Kang (II), les autres stades 3 et Kang (II) quittent la partie ; vous recevez une carte
 * Rencontre. Le Maître du Temps reste à côté, sur sa face B : les pions Accélération vont sur lui au lieu
 * du stade 3.
 */
function advanceToKangStage3(game, layout, { fromVillainId, x, y }) {
  const setAside = cardsInZone(game, 'setAside')
  const isMainSchemeAtStage = (card, stage) => definitionOf(card).type === 'main_scheme' && definitionOf(card).stage === stage
  const masterOfTime = setAside.find(card => isMainSchemeAtStage(card, '2A'))
  const stage3Candidates = setAside.filter(card => isMainSchemeAtStage(card, '3A'))
  if (!masterOfTime || !stage3Candidates.length) return null

  logMessage(game, 'Fin de la phase : la manigance principale avance au stade 2, Le Maître du Temps.', true)
  for (const scheme of mainSchemesInPlay(game)) moveCard(game, scheme, 'outOfGame', {}, true)
  const sideSchemes = cardsInZone(game, 'table').filter(card => definitionOf(card).type === 'side_scheme')
  game.accelerationTokens += sideSchemes.length
  for (const sideScheme of sideSchemes) moveCard(game, sideScheme, 'discard', {}, true)
  placeWithoutEffects(game, masterOfTime, SPOTS.masterOfTime(layout))
  Object.assign(masterOfTime, { side: 1, tokens: game.accelerationTokens })

  const stage3 = stage3Candidates[randomIndex(stage3Candidates.length)]
  const isKang2 = card => definitionOf(card).type === 'villain' && definitionOf(card).stage === 'II'
  const kang2 = setAside.find(card => isKang2(card) && definitionOf(card).name === definitionOf(stage3).bringsKang)
  for (const other of stage3Candidates.filter(card => card !== stage3)) moveCard(game, other, 'outOfGame', {}, true)
  for (const other of setAside.filter(card => isKang2(card) && card !== kang2)) moveCard(game, other, 'outOfGame', {}, true)
  moveCard(game, stage3, 'table', SPOTS.mainScheme(layout), true) // compteur de menace, « Nouvelle manigance » au journal
  if (kang2) moveCard(game, kang2, 'table', { x, y }, true) // compteur de PV, « Nouvelle étape du méchant » au journal
  const dealtCard = dealEncounterCardToPlayer(game, layout)

  const tokens = game.accelerationTokens
  const fromSideSchemes = sideSchemes.length ? ` (${sideSchemes.length} pour les manigances annexes défaussées)` : ''
  const tokensNote = tokens ? `avec ${plural(tokens, 'pion')} Accélération${fromSideSchemes}` : 'sans pion Accélération'
  const dealtNote = dealtCard ? ' Vous recevez une carte Rencontre face cachée, posée devant votre identité.' : ''
  const note = `Stade 3 tiré au hasard : « ${cardName(stage3)} ». Le Maître du Temps (2B) attend à côté ${tokensNote}.${dealtNote}`
  logMessage(game, note, true)
  return { kind: 'stage', fromCardId: fromVillainId, toCardId: (kang2 ?? masterOfTime).id, keptStatuses: [], note }
}

/**
 * Fin de la phase après la fin du stade 3 (Kang (II) vaincu, ou stade achevé : `empires` cartes Empire de
 * Kang sont passées sous le stade 4A, Kang (II) et le stade quittent la partie maintenant) : vous rejoignez
 * Le Maître du Temps, la seule autre aire de jeu, et la manigance principale avance au stade 4A : Kang (III)
 * entre en jeu, les cartes Empire de Kang sous le stade sont révélées.
 */
function advanceToKangStage4(game, layout, { fromVillainId, x, y, empires = 0, stageLeft = false }) {
  const setAside = cardsInZone(game, 'setAside')
  const stage4 = setAside.find(card => definitionOf(card).type === 'main_scheme' && definitionOf(card).stage === '4A')
  const kang3 = setAside.find(card => definitionOf(card).type === 'villain' && definitionOf(card).stage === 'III')
  if (!stage4 || !kang3) return null
  // Kang (II) si le stade a été achevé, le stade 3 s'il est encore là, Le Maître du Temps
  for (const villain of cardsInZone(game, 'table').filter(card => definitionOf(card).type === 'villain')) moveCard(game, villain, 'outOfGame', {}, true)
  for (const scheme of mainSchemesInPlay(game)) moveCard(game, scheme, 'outOfGame', {}, true)
  moveCard(game, stage4, 'table', SPOTS.mainScheme(layout), true)
  moveCard(game, kang3, 'table', { x, y }, true)
  const empireCards = setAside.filter(card => card.definitionId === scenarioRulesOf(game).kang.empireCardId).slice(0, empires)
  for (const empire of empireCards) {
    moveCard(game, empire, 'table', nextEncounterSpot(game, layout), true)
    empire.threat = definitionOf(empire).startingThreat ?? 0
  }
  const empiresNote = empireCards.length
    ? `, ${plural(empireCards.length, 'carte')} Empire de Kang ${empireCards.length > 1 ? 'sont révélées' : 'est révélée'}`
    : ''
  const note = `Fin de la phase : vous rejoignez Le Maître du Temps, la manigance avance au stade 4A et Kang (III) entre en jeu${empiresNote}. Retournez la manigance (F).`
  logMessage(game, note, true)
  return { kind: 'stage', fromCardId: fromVillainId, toCardId: kang3.id, keptStatuses: [], note, stageLeft }
}

/**
 * Le stade 3 de Kang est achevé (sa menace a atteint le seuil ; menu de la manigance) : une carte Empire
 * de Kang passe sous le stade 4A tout de suite ; à la fin de la phase, Kang (II) et le stade quittent la
 * partie et le stade 4 arrive (advanceToKangStage4).
 */
export function completeKangStage3(game) {
  const stage3 = kangStage3Scheme(game)
  const kang2 = cardsInZone(game, 'table').find(card => definitionOf(card).type === 'villain' && definitionOf(card).stage === 'II')
  if (!stage3 || !kang2 || game.pendingStageChange) return null
  game.pendingStageChange = { step: 4, fromVillainId: kang2.id, x: kang2.x, y: kang2.y, empires: 1, stageLeft: true }
  const note = `Une carte Empire de Kang passe sous le stade 4A. À la fin de la phase, « ${cardName(kang2)} » et « ${cardName(stage3)} » quitteront la partie et vous rejoindrez Le Maître du Temps : la manigance principale avancera au stade 4A, avec Kang (III).`
  logMessage(game, `« ${cardName(stage3)} » est achevé. ${note}`, true)
  return { kind: 'pending', fromCardId: stage3.id, title: `« ${cardName(stage3)} » est achevé`, note }
}
