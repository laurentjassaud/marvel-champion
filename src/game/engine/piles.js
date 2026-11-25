// Les piles : piocher dans le paquet du joueur, révéler et distribuer les cartes Rencontre, remélanger une
// défausse dans son paquet (à la main : un paquet vide ne se reconstitue jamais tout seul, et c'est alors
// le remélange qui applique la pénalité), révéler le deck du scénario ou vous en attribuer une carte, lancer
// les cartes du deck Invocation de Docteur Strange.

import { TYPE_LABELS } from '../data.js'
import {
  definitionOf, cardName, cardsInZone, identityCard, plural, logMessage, randomIndex, moveToTop, shuffleZone,
  encounterPile, activeVillainName, scenarioDeckOf, startingThreatOf, revealHint, heroPileOfZone
} from './state.js'
import { DEFAULT_LAYOUT, nextEncounterSpot, nextDealtSpot } from './layout.js'
import { moveCard, takeFromPile, entryTokensNote } from './moves.js'
import { masterOfTimeScheme, villainHitPointsGainNote } from './villains.js'

/* ---------------------------------------------------------------------------------------------------- */
/* Paquet du joueur                                                                                      */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Pioche une carte. Un paquet vide ne se reconstitue pas tout seul : rend false, et l'écran propose de
 * remélanger la défausse (shuffleDiscardIntoDeck, avec la pénalité du paquet vide).
 *   quiet  ne rien écrire pour la pioche elle-même (l'appelant compte les cartes et écrit le total)
 */
export function drawCard(game, layout, quiet = false) {
  const card = cardsInZone(game, 'playerDeck').at(-1)
  if (!card) {
    if (!quiet) logMessage(game, cardsInZone(game, 'playerDiscard').length ? 'Votre paquet est vide : remélangez votre défausse pour le reconstituer.' : 'Paquet et défausse vides.')
    return false
  }
  Object.assign(card, { zone: 'hand', faceUp: true, exhausted: false })
  moveToTop(game, card)
  if (!quiet) logMessage(game, 'Vous piochez une carte.')
  return true
}

/** La pioche où se remélange chaque défausse (« Remélanger dans le paquet »). */
export const DECK_OF_DISCARD = { playerDiscard: 'playerDeck', encounterDiscard: 'encounterDeck' }

/**
 * « Remélanger dans le paquet » (menu d'une défausse, ou pioche dans un paquet vide, après confirmation) :
 * les cartes de la défausse du joueur ou de la défausse Rencontre rejoignent leur paquet, qui est mélangé.
 * Un paquet vide ne se reconstitue que de cette façon ; s'il était vide, la règle du paquet épuisé
 * s'applique : vous recevez une carte Rencontre face cachée devant votre identité (paquet du joueur), ou
 * un pion Accélération s'ajoute (paquet Rencontre). Un paquet qui avait encore des cartes est remélangé
 * sans pénalité. Avec les Démolisseurs, la défausse et le paquet du méchant actif.
 * Rend le nombre de cartes remélangées.
 */
export function shuffleDiscardIntoDeck(game, discardZone, layout = DEFAULT_LAYOUT) {
  const deckZone = DECK_OF_DISCARD[discardZone]
  if (!deckZone) return 0
  const isPlayer = discardZone === 'playerDiscard'
  // les piles Rencontre du méchant actif (Démolisseurs) ; celles du joueur entières
  const pileOf = zone => (isPlayer ? cardsInZone(game, zone) : encounterPile(game, zone))
  const discardPile = pileOf(discardZone)
  if (!discardPile.length) return 0
  const deckWasEmpty = !pileOf(deckZone).length
  // changement de zone direct : les cartes d'une défausse sont déjà remises à zéro
  for (const card of discardPile) Object.assign(card, { zone: deckZone, faceUp: false })
  shuffleZone(game, deckZone)
  const deckSize = pileOf(deckZone).length
  const what = isPlayer ? 'Votre défausse' : `La défausse Rencontre${game.activeVillainSet ? ` de « ${activeVillainName(game)} »` : ''}`
  const where = isPlayer ? 'votre paquet' : 'le paquet Rencontre'
  let penalty = ''
  if (deckWasEmpty) penalty = ` ${isPlayer ? emptyPlayerDeckPenalty(game, layout) : emptyEncounterDeckPenalty(game)}`
  logMessage(game, `${what} (${plural(discardPile.length, 'carte')}) est remélangée dans ${where}, qui compte maintenant ${plural(deckSize, 'carte')}.${penalty}`, true)
  return discardPile.length
}

/** Paquet du joueur vide, reconstitué : une carte Rencontre face cachée devant votre identité. Rend la phrase du journal. */
function emptyPlayerDeckPenalty(game, layout) {
  const dealtCard = dealEncounterCardToPlayer(game, layout)
  if (!dealtCard) return 'Paquet vide : le paquet Rencontre l\'est aussi, remélangez-le puis attribuez-vous une carte Rencontre (clic droit sur le paquet Rencontre → Carte face cachée pour vous).'
  const identity = identityCard(game)
  return `Paquet vide : vous recevez une carte Rencontre face cachée${identity ? `, posée devant ${cardName(identity)}` : ''}.`
}

/**
 * Paquet Rencontre épuisé, reconstitué : un pion Accélération (+1 menace par phase du méchant). Kang : tant
 * que Le Maître du Temps attend, les pions se posent sur lui et n'ajoutent pas de menace au stade 3. Rend
 * la phrase du journal.
 */
function emptyEncounterDeckPenalty(game) {
  game.accelerationTokens += 1
  const masterOfTime = masterOfTimeScheme(game)
  if (masterOfTime) masterOfTime.tokens = game.accelerationTokens
  const effect = masterOfTime
    ? `posé sur « ${cardName(masterOfTime)} », il n'ajoute pas de menace au stade 3`
    : '+1 menace par phase du méchant'
  return `Paquet épuisé : pion Accélération ${game.accelerationTokens} (${effect}).`
}

/** Pioche plusieurs cartes et écrit le total au journal ; rend le nombre de cartes piochées (moins si le paquet se vide). */
export function drawCards(game, layout, count) {
  let drawnCount = 0
  for (let i = 0; i < count; i++) if (drawCard(game, layout, true)) drawnCount++
  const emptyNote = drawnCount < count ? ' Votre paquet est vide.' : ''
  logMessage(game, `Vous piochez ${plural(drawnCount, 'carte')}.${emptyNote}`)
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

/** La carte du dessus du paquet Rencontre en service, ou null s'il est vide (il ne se reconstitue pas tout seul). */
const topEncounterCard = game => encounterPile(game, 'encounterDeck').at(-1) ?? null

/**
 * Révèle la carte du dessus du paquet Rencontre dans la zone Rencontre (touche E, clic sur le paquet).
 * Paquet vide : rend null, et l'écran propose de remélanger la défausse Rencontre.
 */
export function revealEncounterCard(game, layout) {
  const card = topEncounterCard(game)
  if (!card) {
    logMessage(game, encounterPile(game, 'encounterDiscard').length ? 'Paquet Rencontre vide : remélangez sa défausse pour le reconstituer.' : 'Plus aucune carte Rencontre.')
    return null
  }
  moveCard(game, card, 'table', nextEncounterSpot(game, layout), true) // face visible, avec ses jetons
  const details = applyStartingThreat(game, card, layout) + entryTokensNote(card)
  logMessage(game, `Carte Rencontre révélée : « ${cardName(card)} » (${typeLabelOf(card)}${details}).${revealHint(card)}`)
  return card
}

/**
 * Le sbire Némésis d'un set Némésis : son sbire en un seul exemplaire, le premier dans l'ordre des cartes
 * (Thomas Edison avant son Robot Géant) ; les sbires en plusieurs exemplaires (Mercenaire d'Hydra) n'en
 * sont pas. Un set sans sbire en un exemplaire : son premier sbire.
 */
const nemesisMinionOf = cards => cards.find(card => definitionOf(card).type === 'minion' && definitionOf(card).quantity === 1)
  ?? cards.find(card => definitionOf(card).type === 'minion') ?? null

/**
 * L'Ombre du Passé (son menu : « Mettre en jeu la Némésis ») : le sbire Némésis du héros, mis de côté, entre
 * en jeu engagé avec vous (dans la zone Rencontre) et sa manigance annexe Némésis avec sa menace de départ
 * (et celle de son « Une fois révélée ») ; le reste du set Némésis est mélangé dans le paquet Rencontre.
 * Si aucun sbire n'entre en jeu ainsi, la carte gagne Renfort : le journal demande de révéler une autre carte
 * Rencontre. La traîtrise, résolue, est défaussée (sourceCard, si elle est sur la table).
 * Rend {minion, sideScheme} : ce qui est entré en jeu, ou null.
 */
export function putNemesisIntoPlay(game, layout, sourceCard = null) {
  const nemesisSet = `${game.setup.hero}_nemesis`
  const setAside = cardsInZone(game, 'setAside').filter(card => definitionOf(card).set === nemesisSet)
  const source = sourceCard ? `« ${cardName(sourceCard)} »` : 'La carte'
  const discardedSource = sourceCard?.zone === 'table'
  if (discardedSource) moveCard(game, sourceCard, 'discard', {}, true) // sa place libérée pour la Némésis

  const minion = nemesisMinionOf(setAside)
  const sideScheme = setAside.find(card => definitionOf(card).type === 'side_scheme') ?? null
  const done = []
  if (minion) {
    moveCard(game, minion, 'table', nextEncounterSpot(game, layout), true) // face visible, Tenace, avec ses jetons
    done.push(`« ${cardName(minion)} » entre en jeu, engagé avec vous${entryTokensNote(minion)}`)
  }
  if (sideScheme) {
    moveCard(game, sideScheme, 'table', nextEncounterSpot(game, layout), true)
    done.push(`« ${cardName(sideScheme)} » en jeu (manigance annexe${applyStartingThreat(game, sideScheme, layout)})`)
  }
  const rest = setAside.filter(card => card !== minion && card !== sideScheme)
  for (const card of rest) moveCard(game, card, 'encounterDeck', {}, true)
  if (rest.length) {
    shuffleZone(game, 'encounterDeck')
    done.push(rest.length > 1
      ? `les ${rest.length} autres cartes du set Némésis sont mélangées dans le paquet Rencontre`
      : 'l\'autre carte du set Némésis est mélangée dans le paquet Rencontre')
  }
  if (!minion) done.push('aucun sbire Némésis de côté, elle gagne Renfort (révélez une autre carte Rencontre, E)')
  if (discardedSource) done.push('elle est défaussée')
  logMessage(game, `${source} : ${done.join(' ; ')}.`, true)
  return { minion, sideScheme }
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
 * Vous attribue la carte du dessus du deck du scénario, face cachée devant votre identité, comme une carte
 * Rencontre attribuée (Kraven : « attribuez-vous une carte PIÈGE du deck PIÈGE ») : elle se révèle en la
 * retournant. Rend la carte, ou null si le deck est vide (il ne se reconstitue pas).
 */
/**
 * Clic sur une pile de l'identité qui joue sa carte du dessus (rules.js heroPiles, playsTop) : la carte entre en
 * jeu, face visible, à côté de l'identité (Travaux et Dons d'Hercule, Sens de Daredevil). Rend la carte, ou null
 * (pile vide, ou pile qui ne joue pas sa carte du dessus).
 */
export function playTopOfHeroPile(game, layout, zone) {
  const card = heroPileOfZone(game, zone)?.playsTop ? cardsInZone(game, zone).at(-1) : null
  if (!card) return null
  takeFromPile(game, layout, card, zone)
  return card
}

export function dealScenarioDeckCardToPlayer(game, layout) {
  const card = scenarioDeckOf(game) && cardsInZone(game, 'scenarioDeck').at(-1)
  if (!card) return null
  moveCard(game, card, 'table', { ...nextDealtSpot(game, layout), faceDown: true }, true)
  card.dealtToPlayer = true
  return card
}

/** Vous attribue `count` cartes du deck du scénario ; rend la phrase du journal ("vous recevez une carte Piège…"). */
export function dealScenarioDeckCardsToPlayer(game, layout, count) {
  const scenarioDeck = scenarioDeckOf(game)
  let dealtCount = 0
  for (let i = 0; i < count; i++) if (dealScenarioDeckCardToPlayer(game, layout)) dealtCount++
  if (!dealtCount) return `le deck ${scenarioDeck?.name ?? 'du scénario'} est vide`
  const cards = dealtCount > 1 ? `${dealtCount} cartes ${scenarioDeck.name}` : `une carte ${scenarioDeck.name}`
  return `vous recevez ${cards} face cachée, posée${dealtCount > 1 ? 's' : ''} devant votre identité`
}

/**
 * Une manigance annexe révélée entre en jeu avec sa menace de départ (imprimée pour un joueur, plus celle
 * que son « Une fois révélée » ajoute par héros : startingThreatOf) ; Capturé par Hydra prend en plus un
 * allié Captif. Rend ce que le journal ajoute après le type de la carte (", 2 menaces…", et les PV
 * qu'elle a donnés au méchant en entrant en jeu : Klaw « l'Immortel »), ou '' pour une autre carte.
 */
export function applyStartingThreat(game, card, layout) {
  const definition = definitionOf(card)
  if (definition.type !== 'side_scheme') return ''
  card.threat = startingThreatOf(card)
  const captiveNote = definition.capturesAlly ? captureAlly(game, card, layout) : ''
  return `, ${plural(card.threat, 'menace')}${captiveNote}${villainHitPointsGainNote(game, card)}`
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

/** Pose la carte du dessus du paquet Rencontre face cachée dans la zone Rencontre, comme boost (retournée, elle n'entre pas en jeu). */
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
