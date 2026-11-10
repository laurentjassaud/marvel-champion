// Déplacer et changer les cartes : moveCard (la seule fonction qui change la zone d'une carte, à quelques
// exceptions près signalées), l'entrée en jeu (jetons, Tenace), jouer une carte, la prendre dans une pile,
// la retourner, l'épuiser, lui donner une carte d'état, changer la forme de l'identité, poser un pion.

import { STATUS_CARDS, PAWN_COLORS } from '../data.js'
import { MAIN_SCHEME_NOTES, VILLAIN_STAGE_RULES } from '../rules.js'
import {
  definitionOf, cardName, cardLabel, cardsInZone, cardById, isEncounterCard, isCharacter, isAlterEgo, plural,
  logMessage, uniqueId, moveToTop, moveToBottom, DECK_ZONES, DISCARD_ZONES, deckZoneOf, discardZoneOf, zoneLabel,
  scenarioRulesOf
} from './state.js'
import { SPOTS, nextEncounterSpot, nextHeroSpot } from './layout.js'
import { refillInvocationDeck } from './piles.js'
import { crewVillainLeftTable, revealVillainStage } from './villains.js'

/* ---------------------------------------------------------------------------------------------------- */
/* Déplacer une carte                                                                                    */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Déplace une carte vers une zone.
 *   targetZone  la zone d'arrivée ; 'deck' ou n'importe quelle pioche désigne la pioche propre à la carte,
 *               'discard' ou n'importe quelle défausse sa défausse propre (joueur, Rencontre, Invocation…)
 *   options     {x, y} position sur la table ; faceDown : posée face cachée ; bottom : sous la pioche
 *   quiet       ne rien écrire au journal (l'appelant écrit son propre message)
 * Un pion qui quitte la table disparaît. Ce que fait la carte en arrivant :
 *   - en quittant la table, elle est remise à zéro (jetons, dégâts, menace, cartes d'état, épuisement,
 *     face A ; l'identité revient en alter ego) ;
 *   - dans une pioche elle est face cachée (le deck Invocation, lui, est face visible) ; dans la main ou
 *     une défausse, face visible ; ailleurs elle garde sa face, sauf si elle arrive d'une autre zone ;
 *   - en entrant en jeu face visible : ses jetons d'entrée et sa carte Tenace (enterPlay), et un
 *     environnement défausse les autres si le scénario le veut (discardOtherEnvironments) ;
 *   - une étape du méchant ou une manigance principale qui arrive de « De côté » met à jour son compteur ;
 *   - un des Démolisseurs qui quitte la table emmène sa manigance (crewVillainLeftTable) ;
 *   - le deck Invocation vidé se remélange (refillInvocationDeck).
 */
export function moveCard(game, card, targetZone, options = {}, quiet = false) {
  if (card.isPawn) {
    movePawn(game, card, targetZone, options, quiet)
    return
  }
  let zone = targetZone
  if (zone === 'deck' || DECK_ZONES.includes(zone)) zone = deckZoneOf(game, card)
  if (zone === 'discard' || DISCARD_ZONES.includes(zone)) zone = discardZoneOf(card)
  const fromZone = card.zone
  card.zone = zone

  if (zone !== 'table') resetCard(card)
  if (DECK_ZONES.includes(zone)) {
    card.faceUp = zone === 'invocationDeck'
    if (options.bottom) moveToBottom(game, card)
    else moveToTop(game, card)
  } else {
    if (fromZone !== 'table' || zone === 'hand' || DISCARD_ZONES.includes(zone)) card.faceUp = !options.faceDown
    moveToTop(game, card)
  }
  if (zone === 'table') {
    card.x = options.x ?? card.x
    card.y = options.y ?? card.y
    card.zIndex = ++game.topZIndex
  }

  const entersPlayFaceUp = zone === 'table' && fromZone !== 'table' && card.faceUp
  const entryTokensText = entersPlayFaceUp ? enterPlay(card) : ''
  if (entersPlayFaceUp) discardOtherEnvironments(game, card)
  if (zone === 'table' && fromZone === 'setAside') updateCountersForNewStage(game, card)

  if (!quiet && fromZone !== zone) {
    const name = card.faceUp || fromZone === 'hand' ? `« ${cardName(card)} »` : 'Une carte face cachée'
    const destination = DECK_ZONES.includes(zone)
      ? `${options.bottom ? 'sous le' : 'sur le'} ${zoneLabel(game, zone)}`
      : `→ ${zoneLabel(game, zone)}`
    logMessage(game, `${name} : ${zoneLabel(game, fromZone)} ${destination}${entryTokensText && `, avec ${entryTokensText}`}.`)
  }
  if (game.crew && fromZone === 'table' && zone !== 'table' && definitionOf(card).type === 'villain') crewVillainLeftTable(game, card)
  if (fromZone === 'invocationDeck' && zone !== 'invocationDeck' && !cardsInZone(game, 'invocationDeck').length) refillInvocationDeck(game)
}

/** Un pion se déplace sur la table, ou disparaît s'il en sort. */
function movePawn(game, pawn, targetZone, options, quiet) {
  if (targetZone !== 'table') {
    game.cards.splice(game.cards.indexOf(pawn), 1)
    if (!quiet) logMessage(game, 'Pion retiré.')
    return
  }
  pawn.x = options.x ?? pawn.x
  pawn.y = options.y ?? pawn.y
  pawn.zIndex = ++game.topZIndex
}

/**
 * Remise à zéro d'une carte qui quitte la table : ni jetons, ni dégâts, ni menace, ni carte d'état, plus
 * épuisée, face A (l'identité revient en alter ego), plus sous une manigance, plus reçue ni boost.
 */
function resetCard(card) {
  Object.assign(card, { exhausted: false, damage: 0, threat: 0, tokens: 0, side: card.isIdentity ? 1 : 0 })
  delete card.underSchemeId
  delete card.dealtToPlayer
  delete card.isBoost
  for (const status of STATUS_CARDS) delete card[status.id]
}

/**
 * Une nouvelle étape du méchant ou une nouvelle manigance principale arrive de « De côté » : son compteur
 * prend ses valeurs, et le journal rappelle son « Une fois révélée » quand il se joue à la main (rules.js).
 * Avec les Démolisseurs, le compteur du méchant suit le méchant actif : il n'est pas touché ici.
 */
function updateCountersForNewStage(game, card) {
  const definition = definitionOf(card)
  if (definition.type === 'villain' && !game.crew) {
    Object.assign(game.counters[1], { value: definition.hitPoints, label: `${definition.name} ${definition.stage}` })
    logMessage(game, `Nouvelle étape du méchant : ${definition.name} ${definition.stage}, ${definition.hitPoints} PV.`, true)
    // son « Une fois révélée » à jouer à la main, sur la face par laquelle elle arrive
    const note = VILLAIN_STAGE_RULES[definition.id]?.[card.side ? 'onRevealB' : 'onRevealA']
    if (note) logMessage(game, `« ${cardName(card)} » ${definition.stage}, une fois révélé : ${note}.`, true)
  }
  if (definition.type === 'main_scheme') {
    Object.assign(game.counters[2], { value: definition.startingThreat ?? 0, label: `Menace /${definition.threshold ?? '?'}` })
    const note = MAIN_SCHEME_NOTES[definition.id]?.onRevealA
    const advice = note ? `Une fois révélée : ${note}. Puis retournez-la.` : 'Lisez la face A puis retournez-la.'
    logMessage(game, `Nouvelle manigance : « ${definition.name} » (${definition.stage}). ${advice}`, true)
  }
}

/* ---------------------------------------------------------------------------------------------------- */
/* Entrer en jeu                                                                                         */
/* ---------------------------------------------------------------------------------------------------- */

/** "3 jetons Toile" : les jetons d'entrée en jeu de la face en jeu ; '' si elle n'en a pas. */
export function entryTokensText(card) {
  const definition = definitionOf(card)
  const [count, tokenName] = card.side
    ? [definition.backEntryTokens, definition.backEntryTokenName]
    : [definition.entryTokens, definition.entryTokenName]
  return count ? `${plural(count, 'jeton')}${tokenName ? ` ${tokenName}` : ''}` : ''
}

/** ", 2 jetons Munition" à ajouter au message d'une carte révélée, si elle est entrée en jeu avec des jetons. */
export const entryTokensNote = card => (entryTokensText(card) && card.tokens ? `, ${entryTokensText(card)}` : '')

/**
 * Une carte entre en jeu face visible : elle reçoit ses jetons d'entrée en jeu (Utilisations, « entre en
 * jeu avec » : Lance-toile, Hawkeye, Mitrailleuse de Crossbones…) et, avec le mot-clé Ténacité, une carte
 * d'état Tenace. Rend les jetons pour le journal ("3 jetons Toile"), ou ''.
 */
export function enterPlay(card) {
  const definition = definitionOf(card)
  if (definition.toughness) card.tough = true
  card.tokens = (card.side ? definition.backEntryTokens : definition.entryTokens) ?? card.tokens
  return entryTokensText(card)
}

/**
 * Personne ne Passe (L'Homme Absorbant) : quand un environnement entre en jeu, chaque autre environnement
 * en jeu est défaussé. Appelé quand une carte arrive face visible sur la table, ou y est retournée.
 */
export function discardOtherEnvironments(game, card) {
  if (definitionOf(card).type !== 'environment' || !scenarioRulesOf(game).oneEnvironment) return
  const others = cardsInZone(game, 'table').filter(other => other !== card && other.faceUp && definitionOf(other).type === 'environment')
  for (const other of others) {
    moveCard(game, other, 'discard', {}, true)
    logMessage(game, `« ${cardName(other)} » défaussée : « ${cardName(card)} » la remplace (un seul environnement en jeu).`)
  }
}

/* ---------------------------------------------------------------------------------------------------- */
/* Jouer, prendre, ranger                                                                                */
/* ---------------------------------------------------------------------------------------------------- */

/** Joue une carte sur la table, à la prochaine place libre de sa rangée (Rencontre ou héros), face visible ou cachée. */
export function playToTable(game, layout, card, faceDown = false) {
  const spot = isEncounterCard(card) ? nextEncounterSpot(game, layout) : nextHeroSpot(game, layout)
  moveCard(game, card, 'table', { ...spot, faceDown })
}

/**
 * Clic sur une carte dans la fenêtre d'une pile : depuis le paquet ou la défausse du joueur, elle va dans
 * la main ; depuis une autre pile, elle est mise en jeu à sa place (étape du méchant, manigance principale,
 * rangée Rencontre ou rangée du héros). Une manigance annexe prend sa menace de départ ; une étape du
 * méchant posée depuis « De côté » fait son « Une fois révélée » (revealVillainStage).
 */
export function takeFromPile(game, layout, card, zone) {
  if (zone === 'playerDeck' || zone === 'playerDiscard') {
    moveCard(game, card, 'hand')
    return
  }
  const type = definitionOf(card).type
  let spot
  if (!isEncounterCard(card)) spot = nextHeroSpot(game, layout)
  else if (type === 'villain') spot = SPOTS.villain()
  else if (type === 'main_scheme') spot = SPOTS.mainScheme(layout)
  else spot = nextEncounterSpot(game, layout)
  moveCard(game, card, 'table', spot)
  if (type === 'side_scheme') card.threat = definitionOf(card).startingThreat ?? 0
  if (type === 'villain' && zone === 'setAside') revealVillainStage(game, card, layout)
}

/** Range une carte dans la main juste avant la carte `beforeCardId` (ou en dernier). */
export function reorderHand(game, cardId, beforeCardId) {
  const card = cardById(game, cardId)
  if (!card) return
  game.cards.splice(game.cards.indexOf(card), 1)
  const before = beforeCardId && cardById(game, beforeCardId)
  game.cards.splice(before ? game.cards.indexOf(before) : game.cards.length, 0, card)
}

/** Pose un pion libre sur la table, de la couleur suivante ; ils se rangent en ligne au milieu à gauche. */
export function addPawn(game, layout) {
  const pawnCount = game.cards.filter(card => card.isPawn).length
  game.cards.push({
    id: uniqueId(), isPawn: true, color: PAWN_COLORS[pawnCount % PAWN_COLORS.length], zone: 'table', faceUp: true,
    x: 40 + (pawnCount % 6) * 40, y: layout.height / 2 - 20, zIndex: ++game.topZIndex, damage: 0, threat: 0, tokens: 0
  })
  logMessage(game, 'Pion ajouté.')
}

/* ---------------------------------------------------------------------------------------------------- */
/* État d'une carte sur la table                                                                         */
/* ---------------------------------------------------------------------------------------------------- */

/** Épuise ou redresse une carte de la table. */
export function toggleExhausted(game, card) {
  if (card.zone !== 'table' || card.isPawn) return
  card.exhausted = !card.exhausted
  logMessage(game, `${card.exhausted ? 'Épuisée' : 'Redressée'} : ${cardLabel(card)}.`)
}

/** Pose ou retire une carte d'état (stunned, confused, tough) sur un personnage de la table ; elles se cumulent. */
export function toggleStatus(game, card, statusId) {
  const status = STATUS_CARDS.find(candidate => candidate.id === statusId)
  if (!status || card.zone !== 'table' || !card.faceUp || !isCharacter(card)) return
  card[statusId] = !card[statusId]
  logMessage(game, `${cardLabel(card)} : statut ${status.label}${card[statusId] ? '' : ' retiré'}.`)
}

/** Nom d'une forme de l'identité pour le journal : "Nadia Van Dyne (alter ego)", "La Guêpe (héros Géant)". */
export function identityFormName(card, side = card.side) {
  const definition = definitionOf(card)
  if (side === 1) return `${definition.backName} (alter ego)`
  const formName = definition.forms?.[side === 2 ? 1 : 0]
  return `${side === 2 ? definition.thirdName : definition.name} (héros${formName ? ` ${formName}` : ''})`
}

/**
 * L'identité change de forme : 0 héros (face A), 1 alter ego (face B), 2 l'autre face héros (face C, La
 * Guêpe Géant) si l'identité en a une. Ses cartes d'état restent.
 */
export function setIdentityForm(game, card, side) {
  if (!card?.isIdentity || card.side === side || (side === 2 && !definitionOf(card).thirdName)) return
  card.side = side
  logMessage(game, `Changement de forme : ${identityFormName(card)}.`, true)
}

/**
 * Retourne une carte (touche F) :
 *   - l'identité passe d'alter ego à héros (face A) et inversement ;
 *   - une carte face visible qui a un verso passe d'une face à l'autre : sur la table, la nouvelle face
 *     reçoit ses propres jetons d'entrée (Entreprise Criminelle ⇄ Accès de Folie), le compteur suit un
 *     méchant à deux faces (Norman Osborn / Le Bouffon Vert), et le journal rappelle le « Une fois
 *     révélée » de la face qui apparaît (rules.js) ;
 *   - sinon la carte passe de face cachée à face visible et inversement. Révélée sur la table, elle entre
 *     en jeu (jetons, Tenace, menace de départ) : une carte jouée face cachée, une carte Rencontre reçue
 *     ou glissée face cachée depuis le paquet ; pas un boost, qu'on ne fait que regarder, ni une carte qui
 *     porte déjà quelque chose (un double retournement par erreur ne recharge pas ses jetons).
 */
export function flipCard(game, card) {
  if (card.isPawn) return
  const definition = definitionOf(card)
  if (card.isIdentity && definition.backName) {
    setIdentityForm(game, card, isAlterEgo(card) ? 0 : 1)
    return
  }
  if (card.faceUp && definition.backName) turnToOtherSide(game, card)
  else turnFaceUpOrDown(game, card)
}

/** Une carte face visible passe sur son autre face (voir flipCard). */
function turnToOtherSide(game, card) {
  const definition = definitionOf(card)
  card.side = card.side ? 0 : 1
  const onTable = card.zone === 'table'
  const newSideTokens = onTable && (card.side ? definition.backEntryTokens : definition.entryTokens)
  if (newSideTokens) card.tokens = newSideTokens
  logMessage(game, `« ${definition.name} » retournée sur la face ${card.side ? 'B' : 'A'}${newSideTokens ? `, avec ${entryTokensText(card)}` : ''}.`)
  if (!onTable) return
  if (definition.type === 'villain') game.counters[1].label = `${cardName(card)} ${definition.stage}`
  const noteKey = card.side ? 'onRevealB' : 'onRevealA'
  if (definition.type === 'main_scheme') {
    const note = MAIN_SCHEME_NOTES[definition.id]?.[noteKey]
    if (note) logMessage(game, `« ${cardName(card)} » (${card.side ? definition.backStage : definition.stage}), une fois révélée : ${note}.`, true)
  }
  if (definition.type === 'villain') {
    const note = VILLAIN_STAGE_RULES[definition.id]?.[noteKey]
    if (note) logMessage(game, `« ${cardName(card)} » ${definition.stage}, une fois révélé : ${note}.`, true)
  }
}

/** Une carte passe de face cachée à face visible ou inversement (voir flipCard). */
function turnFaceUpOrDown(game, card) {
  const definition = definitionOf(card)
  card.faceUp = !card.faceUp
  if (!card.faceUp) {
    logMessage(game, 'Carte retournée face cachée.')
    return
  }
  const onTable = card.zone === 'table'
  const entersPlay = onTable && !card.isBoost && !card.tokens && !card.damage && !card.threat
  const details = []
  if (entersPlay) {
    details.push(enterPlay(card))
    if (definition.type === 'side_scheme') card.threat = definition.startingThreat ?? 0
    if (card.threat) details.push(plural(card.threat, 'menace'))
    delete card.dealtToPlayer
  }
  const detailsText = details.filter(Boolean).join(', ')
  logMessage(game, `Retournée : « ${cardName(card)} »${detailsText && ` (${detailsText})`}.`)
  // un environnement retourné face visible entre en jeu, même en boost (Personne ne Passe)
  if (onTable) discardOtherEnvironments(game, card)
}
