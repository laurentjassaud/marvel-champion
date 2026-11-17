// Raccourcis clavier (liste complète dans la fenêtre d'aide, touche ?).

import { onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

/**
 * Installe les raccourcis clavier. Les raccourcis de carte visent la carte sous la souris (sur la table ou
 * dans la main), sinon la carte sélectionnée. G (dégâts) et M (menace) sans carte visent le méchant et la
 * manigance principale ; G, M et J n'agissent que sur une carte qui prend ce compteur (counterKindOf ; J
 * aussi sur la manigance principale et sur un personnage qui porte des jetons : takesTokens).
 * Rien pendant la saisie dans un champ, quand une fenêtre est ouverte, ou avant la première partie.
 */
export function useKeyboard() {
  const gameStore = useGameStore()
  const ui = useUiStore()

  /** La carte visée : celle sous la souris si elle est sur la table ou dans la main, sinon la carte sélectionnée. */
  const targetCard = () => {
    const hovered = gameStore.cardById(ui.hoveredCardId)
    if (hovered && (hovered.zone === 'table' || hovered.zone === 'hand')) return hovered
    return gameStore.cardById(ui.selectedCardId)
  }

  function onKeyDown(event) {
    // Échap ferme le menu ouvert (par-dessus une fenêtre de défausse, la fenêtre reste), sinon la fenêtre
    if (event.key === 'Escape') {
      if (ui.contextMenu) ui.closeContextMenu()
      else ui.closeModal()
      return
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.target.closest?.('input, textarea, select') || ui.modal || ui.introOpen || !gameStore.isReady) return
    const card = targetCard()
    const cardId = card?.id ?? null
    const key = event.key.toLowerCase()
    const sign = event.shiftKey ? -1 : 1 // Maj : retirer au lieu d'ajouter

    // raccourcis de partie
    if (event.key === '?') ui.openModal('help')
    else if (key === 'd') gameStore.drawCard()
    else if (key === 'n') gameStore.startHeroPhase()
    else if (key === 'v') gameStore.startVillainPhase()
    else if (key === 'e') gameStore.revealEncounterCard()
    else if (key === 'i' && gameStore.hasInvocationDeck) gameStore.castInvocation()
    else if (key === 'g') gameStore.addDamage(cardId, sign)
    else if (key === 'm') gameStore.addThreat(cardId, sign)
    else if (event.key === '+' || event.key === '=') gameStore.addDamage(cardId, 1)
    else if (event.key === '-') gameStore.addDamage(cardId, -1)
    // raccourcis de carte : il faut une carte visée
    else if (!card) return
    else if (key === 't') gameStore.toggleExhausted(cardId)
    else if (key === 'f') gameStore.flipCard(cardId)
    else if (key === 'j') gameStore.addTokens(cardId, sign)
    else if (key === 'h' && !card.isIdentity) gameStore.moveCard(cardId, 'hand')
    else if (key === 'x' && !card.isIdentity) gameStore.moveCard(cardId, 'setAside')
    else if ((event.key === 'Delete' || event.key === 'Backspace') && !card.isIdentity) {
      event.preventDefault() // Retour arrière ne doit pas revenir à la page précédente
      gameStore.moveCard(cardId, 'discard')
      ui.selectCard(null)
    } else if (event.key === 'Enter' && card.zone === 'hand') gameStore.playToTable(cardId)
  }

  onMounted(() => document.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown))
}
