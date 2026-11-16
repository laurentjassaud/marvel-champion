// Le déroulement d'un round : la taille de main, la fin de la phase du héros (main complétée, cartes
// redressées), le passage à la phase du méchant puis au round suivant. La phase du méchant elle-même
// (menace, activations, cartes Rencontre) se joue à la main : le journal en rappelle les étapes.

import { heroRules, MAIN_SCHEME_NOTES } from '../rules.js'
import {
  definitionOf, cardName, cardsInZone, identityCard, isAlterEgo, isEncounterCard, traitsOf, plural, logMessage
} from './state.js'
import { DEFAULT_LAYOUT } from './layout.js'
import { moveCard } from './moves.js'
import { drawCard } from './piles.js'
import { resolvePendingStageChange, masterOfTimeScheme } from './villains.js'

/* ---------------------------------------------------------------------------------------------------- */
/* Taille de main                                                                                        */
/* ---------------------------------------------------------------------------------------------------- */

/** Taille de main de l'identité, selon sa forme en jeu, plus le bonus de ses améliorations (Iron Man). */
export function handSize(game) {
  const maximum = heroRules(game.setup?.hero).handSizeBonus?.max ?? Infinity
  return Math.min(printedHandSize(game) + handSizeBonus(game), maximum)
}

/** Taille de main imprimée sur la face de l'identité en jeu (6 par défaut). */
export function printedHandSize(game) {
  const identity = identityCard(game)
  if (!identity) return 6
  const definition = definitionOf(identity)
  if (identity.side === 2) return definition.thirdHandSize ?? 6
  if (identity.side === 1) return definition.backHandSize ?? 6
  return definition.handSize ?? 6
}

/**
 * Sous forme de héros, +1 à la taille de main pour chaque amélioration que vous contrôlez (face visible,
 * pas sous une manigance) avec le trait que nomment les règles du héros (rules.js handSizeBonus :
 * améliorations Tech d'Iron Man) ; 0 sinon.
 */
export function handSizeBonus(game) {
  const bonusRule = heroRules(game.setup?.hero).handSizeBonus
  const identity = identityCard(game)
  if (!bonusRule || !identity || isAlterEgo(identity)) return 0
  return cardsInZone(game, 'table').filter(card => !isEncounterCard(card) && card.faceUp && !card.underSchemeId
    && definitionOf(card).type === 'upgrade' && traitsOf(card).includes(bonusRule.trait)).length
}

/* ---------------------------------------------------------------------------------------------------- */
/* Phases                                                                                                */
/* ---------------------------------------------------------------------------------------------------- */

/** Fin du tour du joueur : « Enragé » de Hulk, sous forme de héros la main est défaussée. */
function discardHandIfEnraged(game) {
  const identity = identityCard(game)
  if (!identity || isAlterEgo(identity) || !heroRules(game.setup.hero).discardsHandAtTurnEnd) return
  const hand = cardsInZone(game, 'hand')
  if (!hand.length) return
  for (const card of hand) moveCard(game, card, 'discard', {}, true)
  logMessage(game, `Fin de votre tour (Enragé) : ${cardName(identity)} défausse sa main (${plural(hand.length, 'carte')}).`, true)
}

/**
 * Fin de la phase du héros : la main est complétée jusqu'à la taille de main de la forme en jeu (héros
 * ou alter ego), puis toutes les cartes du joueur sont redressées. Le journal détaille un bonus de taille
 * de main ("main de 4 en Iron Man : 1 + 3 améliorations Tech") et les cartes qui manquent si le paquet
 * s'est vidé (l'écran propose alors de remélanger la défausse, puis de les piocher).
 */
function endHeroPhase(game, layout) {
  discardHandIfEnraged(game)
  const targetHandSize = handSize(game)
  let drawnCount = 0
  while (cardsInZone(game, 'hand').length < targetHandSize && drawCard(game, layout, true)) drawnCount++
  for (const card of cardsInZone(game, 'table')) if (!isEncounterCard(card)) card.exhausted = false

  const bonus = handSizeBonus(game)
  const printed = printedHandSize(game)
  const [singular, pluralLabel] = heroRules(game.setup.hero).handSizeBonus?.label ?? []
  const capped = printed + bonus > targetHandSize ? `, ${targetHandSize} au plus` : ''
  const bonusDetail = bonus ? ` : ${printed} + ${bonus} ${bonus > 1 ? pluralLabel : singular}${capped}` : ''
  const identityName = cardName(identityCard(game))
  // le paquet vide ne se reconstitue pas tout seul : les cartes qui manquent se piochent après le remélange
  const missing = targetHandSize - cardsInZone(game, 'hand').length
  const missingNote = missing > 0 ? ` Votre paquet est vide : il manque ${plural(missing, 'carte')}, à piocher une fois la défausse remélangée.` : ''
  logMessage(game, `Fin de la phase du héros : +${plural(drawnCount, 'carte')} (main de ${targetHandSize} en ${identityName}${bonusDetail}), vos cartes sont redressées.${missingNote}`, true)
}

/**
 * Bouton « Phase du méchant » (touche V), depuis la phase du héros seulement : termine la phase du héros
 * (endHeroPhase), résout un changement de stade qui attendait la fin de la phase (Kang), puis rappelle au
 * journal ce qui se joue à la main : la menace (avec les pions Accélération), les activations, les cartes
 * Rencontre, et la réponse forcée de la manigance principale en jeu (rules.js).
 * Rend false (pas possible), true, ou ce qu'a donné un changement de stade (à montrer dans la fenêtre du méchant).
 */
export function startVillainPhase(game, layout = DEFAULT_LAYOUT) {
  if (game.phase === 'villain') return false
  game.phase = 'villain'
  endHeroPhase(game, layout)
  const stageChange = resolvePendingStageChange(game, layout)

  const masterOfTime = masterOfTimeScheme(game)
  const tokens = game.accelerationTokens
  let accelerationNote = ''
  if (tokens && masterOfTime) {
    const waiting = tokens > 1 ? `les ${tokens} pions Accélération restent` : 'le pion Accélération reste'
    accelerationNote = ` (${waiting} sur « ${cardName(masterOfTime)} »)`
  } else if (tokens) {
    accelerationNote = ` (+${tokens} d'accélération)`
  }
  const phaseName = game.crew ? 'Phase des méchants' : 'Phase du méchant'
  logMessage(game, `${phaseName} : à jouer à la main (menace sur la manigance principale${accelerationNote}, activations, cartes Rencontre).`, true)

  // réponse forcée de la manigance principale en jeu (face B), après l'étape 1
  const mainScheme = cardsInZone(game, 'table').find(card => definitionOf(card).type === 'main_scheme' && card.side && card !== masterOfTime)
  const note = mainScheme && MAIN_SCHEME_NOTES[definitionOf(mainScheme).id]?.eachVillainPhase
  if (note) logMessage(game, `« ${cardName(mainScheme)} », après la menace : ${note}.`, true)
  return stageChange ?? true
}

/**
 * Bouton « Phase du héros » (touche N), depuis la phase du méchant seulement : résout un changement de
 * stade qui attendait la fin de la phase (Kang) et commence le round suivant. Comme startVillainPhase,
 * rend false, true, ou ce qu'a donné un changement de stade.
 */
export function startHeroPhase(game, layout = DEFAULT_LAYOUT) {
  if (game.phase !== 'villain') return false
  const stageChange = resolvePendingStageChange(game, layout)
  game.phase = 'hero'
  game.turn += 1
  logMessage(game, `Tour ${game.turn} : phase du héros.`, true)
  return stageChange ?? true
}
