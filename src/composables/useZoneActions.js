import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const PILES = ['deck', 'edeck', 'discard', 'ediscard', 'aside']

/** What a plain click does on a pile or a card. */
export function useZoneActions() {
  const game = useGameStore()
  const ui = useUiStore()

  function activateZone(zone) {
    if (zone === 'deck') game.draw()
    else if (zone === 'edeck') game.reveal()
    else if (PILES.includes(zone)) ui.openModal('pile', { zone })
  }

  function activateCard(c) {
    if (PILES.includes(c.zone)) return activateZone(c.zone)
    ui.select(c.id)
    ui.showPreview(c.id)
  }

  return { activateZone, activateCard }
}
