// Ce que fait un simple clic sur une pile ou sur une carte.

import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

/** Les zones montrées comme des piles (un clic sur une défausse ou « De côté » l'ouvre en fenêtre). */
const PILE_ZONES = ['playerDeck', 'encounterDeck', 'playerDiscard', 'encounterDiscard', 'setAside', 'invocationDeck', 'invocationDiscard', 'scenarioDeck']

export function useZoneActions() {
  const gameStore = useGameStore()
  const ui = useUiStore()

  /**
   * Clic sur une pile : le paquet pioche, le paquet Rencontre révèle, le deck Invocation lance sa carte, le
   * deck du scénario révèle la sienne ; une autre pile s'ouvre dans une fenêtre.
   */
  function activateZone(zone) {
    if (zone === 'playerDeck') gameStore.drawCard()
    else if (zone === 'encounterDeck') gameStore.revealEncounterCard()
    else if (zone === 'invocationDeck') gameStore.castInvocation()
    else if (zone === 'scenarioDeck') gameStore.revealScenarioDeckCard()
    else if (PILE_ZONES.includes(zone)) ui.openModal('pile', { zone })
  }

  /** Clic sur une carte : celle du dessus d'une pile agit comme la pile ; une autre est sélectionnée et montrée en grand. */
  function activateCard(card) {
    if (PILE_ZONES.includes(card.zone)) {
      activateZone(card.zone)
      return
    }
    ui.selectCard(card.id)
    ui.showPreview(card.id)
  }

  return { activateZone, activateCard }
}
