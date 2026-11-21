// Déplacer et changer les cartes : moveCard (la seule fonction qui change la zone d'une carte, à quelques
// exceptions près signalées), l'entrée en jeu (jetons, Tenace), jouer une carte, la prendre dans une pile,
// la retourner, l'incliner, lui donner une carte d'état, changer la forme de l'identité, poser un pion.

import { STATUS_CARDS, PAWN_KIND_BY_ID } from '../data.js'
import { MAIN_SCHEME_NOTES, VILLAIN_STAGE_RULES } from '../rules.js'
import {
  definitionOf, cardName, cardLabel, cardsInZone, cardById, isEncounterCard, isCharacter, isAlterEgo, plural,
  logMessage, uniqueId, moveToTop, moveToBottom, DECK_ZONES, DISCARD_ZONES, deckZoneOf, discardZoneOf, zoneLabel,
  scenarioRulesOf, startingThreatOf, revealHint
} from './state.js'
import { SPOTS, DEFAULT_LAYOUT, nextEncounterSpot, nextHeroSpot, keepCardOnTable } from './layout.js'
import { refillInvocationDeck } from './piles.js'
import {
  crewVillainLeftTable, revealVillainStage, defeatVillain, villainHitPointsChanged, villainHitPointsBonus, villainHitPointsBonusNote
} from './villains.js'

/* ---------------------------------------------------------------------------------------------------- */
/* Déplacer une carte                                                                                    */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Déplace une carte vers une zone.
 *   targetZone  la zone d'arrivée ; 'deck' ou n'importe quelle pioche désigne la pioche propre à la carte,
 *               'discard' ou n'importe quelle défausse sa défausse propre (joueur, Rencontre, Invocation…)
 *   options     {x, y} position sur la table ; faceDown : posée face cachée ; bottom : sous la pioche ;
 *               layout : la disposition de la table, pour garder la carte entière sur la table
 *               (keepCardOnTable) et placer ce qu'amène la défaite du méchant
 *   quiet       ne rien écrire au journal (l'appelant écrit son propre message)
 * Un pion qui quitte la table disparaît. Ce que fait la carte en arrivant :
 *   - en quittant la table, elle est remise à zéro (jetons, dégâts, menace, cartes d'état, inclinaison,
 *     face A ; l'identité revient en alter ego) ;
 *   - dans une pioche elle est face cachée (le deck Invocation, lui, est face visible) ; dans la main ou
 *     une défausse, face visible ; ailleurs elle garde sa face, sauf si elle arrive d'une autre zone ;
 *   - en entrant en jeu face visible : ses jetons d'entrée et sa carte Tenace (enterPlay), et un
 *     environnement défausse les autres si le scénario le veut (discardOtherEnvironments) ;
 *   - une étape du méchant ou une manigance principale qui arrive de « De côté » met à jour son compteur ;
 *   - une manigance qui donne des PV au méchant (Klaw « l'Immortel ») les lui donne en entrant en jeu, et
 *     les lui reprend en sortant (villainHitPointsChanged) ;
 *   - un des Démolisseurs qui quitte la table emmène sa manigance (crewVillainLeftTable) ;
 *   - le deck Invocation vidé se remélange (refillInvocationDeck), sans pénalité ; le paquet du joueur et le
 *     paquet Rencontre vidés, eux, ne se reconstituent qu'à la main (shuffleDiscardIntoDeck) ;
 *   - une carte qui arrive sur la table ou dans une défausse met fin au mulligan (mulliganTaken).
 * Rend ce qu'a donné la défaite du méchant (defeatVillain), tombé à 0 PV quand une telle manigance est
 * sortie du jeu, pour que l'écran le présente ; sinon undefined.
 */
export function moveCard(game, card, targetZone, options = {}, quiet = false) {
  if (card.isPawn) {
    movePawn(game, card, targetZone, options, quiet)
    return undefined
  }
  let zone = targetZone
  if (zone === 'deck' || DECK_ZONES.includes(zone)) zone = deckZoneOf(game, card)
  if (zone === 'discard' || DISCARD_ZONES.includes(zone)) zone = discardZoneOf(card)
  const fromZone = card.zone
  // le mulligan se fait avant tout le reste : une carte mise en jeu ou défaussée y met fin (la mise en place,
  // qui pose ses propres cartes, le laisse ouvert : newGame)
  if (fromZone !== zone && (zone === 'table' || DISCARD_ZONES.includes(zone))) game.mulliganTaken = true
  // en jeu : face visible sur la table, pas un boost (on ne fait que le regarder)
  const wasInPlay = fromZone === 'table' && card.faceUp && !card.isBoost
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
    // posée à la main (glissée) : toujours entière sur la table, remontée si elle dépasse du bas
    if (options.layout) keepCardOnTable(card, options.layout)
  }

  const entersPlayFaceUp = zone === 'table' && fromZone !== 'table' && card.faceUp
  const entryTokensText = entersPlayFaceUp ? enterPlay(card) : ''
  if (entersPlayFaceUp) discardOtherEnvironments(game, card)
  if (zone === 'table' && fromZone === 'setAside') updateCountersForNewStage(game, card)
  const isInPlay = zone === 'table' && card.faceUp && !card.isBoost
  const hitPointsChange = wasInPlay !== isInPlay ? villainHitPointsChanged(game, card, isInPlay) : null

  if (!quiet && fromZone !== zone) {
    const name = card.faceUp || fromZone === 'hand' ? `« ${cardName(card)} »` : 'Une carte face cachée'
    const destination = DECK_ZONES.includes(zone)
      ? `${options.bottom ? 'sous le' : 'sur le'} ${zoneLabel(game, zone)}`
      : `→ ${zoneLabel(game, zone)}`
    const hitPointsText = hitPointsChange ? ` ${hitPointsChange.text}.` : ''
    logMessage(game, `${name} : ${zoneLabel(game, fromZone)} ${destination}${entryTokensText && `, avec ${entryTokensText}`}.${hitPointsText}`, !!hitPointsChange)
  } else if (hitPointsChange && !isInPlay) {
    // entrée sans bruit : l'appelant l'écrit (applyStartingThreat) ; une sortie l'est toujours
    logMessage(game, `« ${cardName(card)} » quitte le jeu : ${hitPointsChange.text}.`, true)
  }
  if (game.crew && fromZone === 'table' && zone !== 'table' && definitionOf(card).type === 'villain') crewVillainLeftTable(game, card)
  if (fromZone === 'invocationDeck' && zone !== 'invocationDeck' && !cardsInZone(game, 'invocationDeck').length) refillInvocationDeck(game)
  return hitPointsChange?.villainDefeated ? defeatVillain(game, hitPointsChange.villain, options.layout ?? DEFAULT_LAYOUT) : undefined
}

/** Un pion se déplace sur la table (toujours entier dessus), ou disparaît s'il en sort. */
function movePawn(game, pawn, targetZone, options, quiet) {
  if (targetZone !== 'table') {
    game.cards.splice(game.cards.indexOf(pawn), 1)
    if (!quiet) logMessage(game, `Retiré de la table : ${cardName(pawn)}.`)
    return
  }
  pawn.x = options.x ?? pawn.x
  pawn.y = options.y ?? pawn.y
  pawn.zIndex = ++game.topZIndex
  if (options.layout) keepCardOnTable(pawn, options.layout)
}

/**
 * Remise à zéro d'une carte qui quitte la table : ni jetons, ni dégâts, ni menace, ni carte d'état, plus
 * inclinée, face A (l'identité revient en alter ego), plus sous une manigance, plus reçue ni boost.
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
    // avec les PV que lui donne une manigance en jeu (Klaw « l'Immortel »)
    const hitPoints = definition.hitPoints + villainHitPointsBonus(game)
    Object.assign(game.counters[1], { value: hitPoints, label: `${definition.name} ${definition.stage}` })
    logMessage(game, `Nouvelle étape du méchant : ${definition.name} ${definition.stage}, ${hitPoints} PV${villainHitPointsBonusNote(game)}.`, true)
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
  else if (type === 'villain') spot = SPOTS.villain(layout)
  else if (type === 'main_scheme') spot = SPOTS.mainScheme(layout)
  else spot = nextEncounterSpot(game, layout)
  moveCard(game, card, 'table', spot)
  if (type === 'side_scheme') card.threat = startingThreatOf(card)
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

/**
 * Pose un pion libre sur la table (une sorte de PAWN_KINDS) : à l'endroit où on l'a lâché (`spot`, {x, y},
 * son coin haut gauche), sinon au milieu de la table, les suivants en ligne de part et d'autre. Toujours
 * entier sur la table. Rend le pion posé (rien pour une sorte inconnue).
 */
export function addPawn(game, layout, pawnId, spot = null) {
  const kind = PAWN_KIND_BY_ID[pawnId]
  if (!kind) return undefined
  const [width, height] = kind.size.map(size => size * layout.cardWidth)
  const pawnCount = game.cards.filter(card => card.isPawn).length
  const pawn = {
    id: uniqueId(), isPawn: true, pawn: kind.id, zone: 'table', faceUp: true,
    x: spot?.x ?? layout.width / 2 - width / 2 + ((pawnCount % 5) - 2) * layout.cardWidth * 0.6,
    y: spot?.y ?? layout.height / 2 - height / 2,
    zIndex: ++game.topZIndex, damage: 0, threat: 0, tokens: 0
  }
  game.cards.push(pawn)
  keepCardOnTable(pawn, layout)
  logMessage(game, `Sur la table : ${kind.label}.`)
  return pawn
}

/* ---------------------------------------------------------------------------------------------------- */
/* État d'une carte sur la table                                                                         */
/* ---------------------------------------------------------------------------------------------------- */

/** Incline ou redresse une carte de la table. */
export function toggleExhausted(game, card) {
  if (card.zone !== 'table' || card.isPawn) return
  card.exhausted = !card.exhausted
  logMessage(game, `${card.exhausted ? 'Inclinée' : 'Redressée'} : ${cardLabel(card)}.`)
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
 *     porte déjà quelque chose (un double retournement par erreur ne recharge pas ses jetons). Une
 *     manigance qui donne des PV au méchant les lui donne, retournée face visible, et les reprend, face
 *     cachée : le méchant peut en être vaincu.
 * Rend ce qu'a donné la défaite du méchant, pour que l'écran le présente ; sinon undefined.
 */
export function flipCard(game, card, layout = DEFAULT_LAYOUT) {
  if (card.isPawn) return undefined
  const definition = definitionOf(card)
  if (card.isIdentity && definition.backName) {
    setIdentityForm(game, card, isAlterEgo(card) ? 0 : 1)
    return undefined
  }
  if (card.faceUp && definition.backName) {
    turnToOtherSide(game, card)
    return undefined
  }
  return turnFaceUpOrDown(game, card, layout)
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

/** Une carte passe de face cachée à face visible ou inversement (voir flipCard). Rend la défaite du méchant, ou undefined. */
function turnFaceUpOrDown(game, card, layout) {
  const definition = definitionOf(card)
  const onTable = card.zone === 'table'
  card.faceUp = !card.faceUp
  // Klaw « l'Immortel » retournée : elle entre en jeu ou en sort, et Klaw gagne ou perd ses PV (un boost,
  // qu'on ne fait que regarder, n'entre pas en jeu)
  const hitPointsChange = onTable && !card.isBoost ? villainHitPointsChanged(game, card, card.faceUp) : null
  const hitPointsText = hitPointsChange ? ` ${hitPointsChange.text}.` : ''
  if (!card.faceUp) {
    logMessage(game, `Carte retournée face cachée.${hitPointsText}`, !!hitPointsChange)
    return hitPointsChange?.villainDefeated ? defeatVillain(game, hitPointsChange.villain, layout) : undefined
  }
  const entersPlay = onTable && !card.isBoost && !card.tokens && !card.damage && !card.threat
  const details = []
  if (entersPlay) {
    details.push(enterPlay(card))
    if (definition.type === 'side_scheme') card.threat = startingThreatOf(card)
    if (card.threat) details.push(plural(card.threat, 'menace'))
    delete card.dealtToPlayer
  }
  const detailsText = details.filter(Boolean).join(', ')
  const hint = entersPlay ? revealHint(card) : ''
  logMessage(game, `Retournée : « ${cardName(card)} »${detailsText && ` (${detailsText})`}.${hitPointsText}${hint}`, !!hitPointsChange)
  // un environnement retourné face visible entre en jeu, même en boost (Personne ne Passe)
  if (onTable) discardOtherEnvironments(game, card)
  return undefined
}
