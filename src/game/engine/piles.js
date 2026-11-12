// Les piles : piocher dans le paquet du joueur (et le remélanger quand il est vide), révéler et
// distribuer les cartes Rencontre (et remélanger le paquet Rencontre, avec un pion Accélération), révéler
// le deck du scénario, lancer les cartes du deck Invocation de Docteur Strange.

import { TYPE_LABELS } from '../data.js'
import {
  definitionOf, cardName, cardsInZone, identityCard, plural, logMessage, randomIndex, moveToTop, shuffleZone,
  encounterPile, activeVillainName, scenarioDeckOf
} from './state.js'
import { nextEncounterSpot, nextDealtSpot } from './layout.js'
import { moveCard, entryTokensNote } from './moves.js'
import { masterOfTimeScheme } from './villains.js'

/* ---------------------------------------------------------------------------------------------------- */
/* Paquet du joueur                                                                                      */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Pioche une carte. Si le paquet est vide (règle de Marvel Champions) : la défausse est remélangée et
 * devient le paquet, vous recevez une carte Rencontre face cachée devant votre identité, puis la pioche
 * continue. Rend false si le paquet et la défausse sont vides tous les deux.
 *   quiet  ne rien écrire pour la pioche elle-même (l'appelant compte les cartes et écrit le total)
 */
export function drawCard(game, layout, quiet = false) {
  if (!cardsInZone(game, 'playerDeck').length && !reshuffleDiscardIntoDeck(game, layout)) {
    if (!quiet) logMessage(game, 'Paquet et défausse vides.')
    return false
  }
  const card = cardsInZone(game, 'playerDeck').at(-1)
  Object.assign(card, { zone: 'hand', faceUp: true, exhausted: false })
  moveToTop(game, card)
  if (!quiet) logMessage(game, 'Vous piochez une carte.')
  return true
}

/**
 * Paquet vide : la défausse est remélangée et devient le paquet (la défausse est alors vide), et vous
 * recevez une carte Rencontre face cachée devant votre identité. Rend false s'il n'y a rien à remélanger.
 */
function reshuffleDiscardIntoDeck(game, layout) {
  const discardPile = cardsInZone(game, 'playerDiscard')
  if (!discardPile.length) return false
  // changement de zone direct : les cartes d'une défausse sont déjà remises à zéro
  for (const card of discardPile) Object.assign(card, { zone: 'playerDeck', faceUp: false })
  shuffleZone(game, 'playerDeck')
  const dealtCard = dealEncounterCardToPlayer(game, layout)
  const identity = identityCard(game)
  const where = identity ? `, posée devant ${cardName(identity)}` : ''
  const penalty = dealtCard ? `Vous recevez une carte Rencontre face cachée${where}.` : 'Plus aucune carte Rencontre à recevoir.'
  logMessage(game, `Paquet vide : votre défausse est remélangée et devient votre paquet. ${penalty}`, true)
  return true
}

/** Pioche plusieurs cartes et écrit le total au journal ; rend le nombre de cartes piochées. */
export function drawCards(game, layout, count) {
  let drawnCount = 0
  for (let i = 0; i < count; i++) if (drawCard(game, layout, true)) drawnCount++
  logMessage(game, `Vous piochez ${plural(drawnCount, 'carte')}.`)
  return drawnCount
}

/** Défausse la carte du dessus du paquet du joueur. */
export function discardTopOfDeck(game) {
  const topCard = cardsInZone(game, 'playerDeck').at(-1)
  if (topCard) moveCard(game, topCard, 'discard')
}

/** Une carte de la main au hasard (pour les effets qui le demandent) : écrite au journal, rendue pour que l'écran la marque. */
export function pickRandomHandCard(game) {
  const hand = cardsInZone(game, 'hand')
  if (!hand.length) return null
  const card = hand[randomIndex(hand.length)]
  logMessage(game, `Carte de la main au hasard : « ${cardName(card)} ».`)
  return card
}

/* ---------------------------------------------------------------------------------------------------- */
/* Paquet Rencontre                                                                                      */
/* ---------------------------------------------------------------------------------------------------- */
// Avec plusieurs méchants (Les Démolisseurs), seuls le paquet et la défausse du méchant actif servent
// (encounterPile).

/**
 * Paquet Rencontre épuisé : sa défausse est mélangée et devient le nouveau paquet Rencontre, et un pion
 * Accélération s'ajoute (+1 menace par phase du méchant). Kang : tant que Le Maître du Temps attend, les
 * pions se posent sur lui et n'ajoutent pas de menace au stade 3. Rend false si la défausse est vide aussi.
 */
function refillEncounterDeck(game) {
  const discardPile = encounterPile(game, 'encounterDiscard')
  if (!discardPile.length) return false
  // changement de zone direct : les cartes d'une défausse sont déjà remises à zéro
  for (const card of discardPile) Object.assign(card, { zone: 'encounterDeck', faceUp: false })
  shuffleZone(game, 'encounterDeck')
  game.accelerationTokens += 1
  const whose = game.activeVillainSet ? ` de « ${activeVillainName(game)} »` : ''
  const masterOfTime = masterOfTimeScheme(game)
  if (masterOfTime) masterOfTime.tokens = game.accelerationTokens
  const effect = masterOfTime
    ? `posé sur « ${cardName(masterOfTime)} », il n'ajoute pas de menace au stade 3`
    : '+1 menace par phase du méchant'
  logMessage(game, `Paquet Rencontre${whose} épuisé : sa défausse (${plural(discardPile.length, 'carte')}) est mélangée et devient le nouveau paquet Rencontre. Pion Accélération : ${game.accelerationTokens} (${effect}).`, true)
  return true
}

/**
 * Règle du paquet Rencontre : dès que sa dernière carte en sort (révélée, distribuée, défaussée,
 * déplacée…), sa défausse est mélangée et devient le nouveau paquet (refillEncounterDeck). Si la défausse
 * est vide à ce moment-là, le paquet reste vide : il sera remélangé à la prochaine carte demandée
 * (topEncounterCard). Appelé par moveCard.
 */
export function refillEncounterDeckIfEmpty(game) {
  if (!encounterPile(game, 'encounterDeck').length) refillEncounterDeck(game)
}

/** La carte du dessus du paquet Rencontre en service (remélangé s'il est vide), ou null s'il ne reste rien. */
function topEncounterCard(game) {
  if (!encounterPile(game, 'encounterDeck').length && !refillEncounterDeck(game)) return null
  return encounterPile(game, 'encounterDeck').at(-1)
}

/** Révèle la carte du dessus du paquet Rencontre dans la rangée Rencontre (touche E, clic sur le paquet). */
export function revealEncounterCard(game, layout) {
  const card = topEncounterCard(game)
  if (!card) {
    logMessage(game, 'Plus aucune carte Rencontre.')
    return null
  }
  moveCard(game, card, 'table', nextEncounterSpot(game, layout), true) // face visible, avec ses jetons
  const details = applyStartingThreat(game, card, layout) + entryTokensNote(card)
  logMessage(game, `Carte Rencontre révélée : « ${cardName(card)} » (${typeLabelOf(card)}${details}).`)
  return card
}

/** Libellé français du type d'une carte ("Manigance annexe"). */
const typeLabelOf = card => TYPE_LABELS[definitionOf(card).type] ?? definitionOf(card).type

/**
 * Révèle la carte du dessus du deck du scénario (Armes Expérimentales, Manigance Annexe) dans la rangée
 * Rencontre : une manigance annexe avec sa menace de départ. Un deck vide reste vide.
 */
export function revealScenarioDeckCard(game, layout) {
  const scenarioDeck = scenarioDeckOf(game)
  if (!scenarioDeck) return null
  const card = cardsInZone(game, 'scenarioDeck').at(-1)
  if (!card) {
    logMessage(game, `Deck ${scenarioDeck.name} vide.`)
    return null
  }
  moveCard(game, card, 'table', nextEncounterSpot(game, layout), true)
  const details = applyStartingThreat(game, card, layout) + entryTokensNote(card)
  logMessage(game, `Deck ${scenarioDeck.name} : « ${cardName(card)} » révélée (${typeLabelOf(card)}${details}).`)
  return card
}

/**
 * Une manigance annexe révélée entre en jeu avec sa menace de départ (imprimée pour un joueur) ; Capturé
 * par Hydra prend en plus un allié Captif. Rend ce que le journal ajoute après le type de la carte
 * (", 2 menaces…"), ou '' pour une autre carte.
 */
export function applyStartingThreat(game, card, layout) {
  const definition = definitionOf(card)
  if (definition.type !== 'side_scheme') return ''
  card.threat = definition.startingThreat ?? 0
  const captiveNote = definition.capturesAlly ? captureAlly(game, card, layout) : ''
  return `, ${plural(card.threat, 'menace')}${captiveNote}`
}

/**
 * Glisse une carte face cachée sous une manigance de la table (un allié Captif, l'allié retenu dans la
 * Prison d'Hydra) : elle dépasse sous la manigance couchée, qui reste dessus, et ne prend pas de place
 * dans la rangée du héros.
 */
function tuckUnder(game, card, scheme, layout) {
  moveCard(game, card, 'table', { x: scheme.x + layout.cardWidth * 0.2, y: scheme.y, faceDown: true }, true)
  card.underSchemeId = scheme.id
  scheme.zIndex = ++game.topZIndex
}

/** Capturé par Hydra : un allié Captif mis de côté, tiré au hasard, passe face cachée sous la manigance. */
function captureAlly(game, scheme, layout) {
  const captives = cardsInZone(game, 'setAside').filter(card => definitionOf(card).captive)
  if (!captives.length) return ', aucun allié Captif de côté'
  tuckUnder(game, captives[randomIndex(captives.length)], scheme, layout)
  return ', un allié Captif tiré au hasard dessous, face cachée : déjouez-la pour le prendre en main'
}

/**
 * Prison d'Hydra (Zola), révélée à la mise en place : l'allié propre au héros, cherché dans le paquet, la
 * défausse ou la main, passe face cachée dessous ; la manigance prend autant de menace que le coût de
 * l'allié. Rend l'allié, ou null si le deck n'en a pas.
 */
export function putOwnAllyUnder(game, scheme, layout) {
  const isOwnAlly = card => definitionOf(card).type === 'ally' && definitionOf(card).faction === 'hero' && definitionOf(card).set === game.setup.hero
  const ally = [...cardsInZone(game, 'playerDeck'), ...cardsInZone(game, 'playerDiscard'), ...cardsInZone(game, 'hand')].find(isOwnAlly)
  if (!ally) return null
  tuckUnder(game, ally, scheme, layout)
  scheme.threat += definitionOf(ally).cost ?? 0
  return ally
}

/** Pose la carte du dessus du paquet Rencontre face cachée dans la rangée Rencontre, comme boost (retournée, elle n'entre pas en jeu). */
export function dealBoostCard(game, layout) {
  const card = topEncounterCard(game)
  if (!card) return null
  moveCard(game, card, 'table', { ...nextEncounterSpot(game, layout), faceDown: true }, true)
  card.isBoost = true
  return card
}

/**
 * Vous attribue la carte du dessus du paquet Rencontre : face cachée, devant votre identité (paquet du
 * joueur vide, stade 3 de Kang, « attribuez-vous une carte Rencontre »). Elle se révèle en la retournant.
 */
export function dealEncounterCardToPlayer(game, layout) {
  const card = topEncounterCard(game)
  if (!card) return null
  moveCard(game, card, 'table', { ...nextDealtSpot(game, layout), faceDown: true }, true)
  card.dealtToPlayer = true
  return card
}

/** Vous attribue `count` cartes Rencontre ; rend la phrase du journal ("vous recevez 2 cartes Rencontre…"). */
export function dealEncounterCardsToPlayer(game, layout, count) {
  let dealtCount = 0
  for (let i = 0; i < count; i++) if (dealEncounterCardToPlayer(game, layout)) dealtCount++
  if (!dealtCount) return 'plus aucune carte Rencontre à recevoir'
  const cards = dealtCount > 1 ? `${dealtCount} cartes Rencontre` : 'une carte Rencontre'
  return `vous recevez ${cards} face cachée, posée${dealtCount > 1 ? 's' : ''} devant votre identité`
}

/* ---------------------------------------------------------------------------------------------------- */
/* Deck Invocation (Docteur Strange)                                                                     */
/* ---------------------------------------------------------------------------------------------------- */
// Face visible, sa carte du dessus toujours visible ; les cartes lancées vont dans sa propre défausse, qui
// est remélangée sans pénalité dès que le deck est vide (moveCard appelle refillInvocationDeck).

/** Deck Invocation vide : sa défausse est remélangée et devient le deck, sans pénalité. */
export function refillInvocationDeck(game) {
  const discardPile = cardsInZone(game, 'invocationDiscard')
  if (!discardPile.length) return
  for (const card of discardPile) Object.assign(card, { zone: 'invocationDeck', faceUp: true })
  shuffleZone(game, 'invocationDeck')
  logMessage(game, 'Deck Invocation vide : sa défausse est remélangée (sans pénalité).', true)
}

/**
 * La carte du dessus du deck Invocation va dans sa défausse : lancée (Maîtrise des Sorts, cast = true) ou
 * seulement défaussée (Talent Naturel, Wong). Son coût et sa capacité « Spécial » se résolvent à la main.
 */
export function castInvocation(game, cast = true) {
  const card = cardsInZone(game, 'invocationDeck').at(-1)
  if (!card) {
    logMessage(game, 'Deck Invocation vide.')
    return null
  }
  logMessage(game, cast
    ? `Invocation lancée : « ${cardName(card)} ». Payez son coût et résolvez sa capacité Spécial.`
    : `« ${cardName(card)} » défaussée du deck Invocation.`)
  moveCard(game, card, 'invocationDiscard', {}, true)
  return card
}

/** Maître des Arts Mystiques : la carte du dessus est lancée et reste sur le deck. */
export function castInvocationAndKeep(game) {
  const card = cardsInZone(game, 'invocationDeck').at(-1)
  if (card) logMessage(game, `Invocation lancée : « ${cardName(card)} », qui reste sur le deck Invocation. Payez son coût et résolvez sa capacité Spécial.`)
}
