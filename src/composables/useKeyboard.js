// Raccourcis clavier (liste complète dans la fenêtre d'aide, touche ?).

import { onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

/**
 * Installe les raccourcis clavier. Les raccourcis de carte visent la carte sous la souris (sur la table ou
 * dans la main), sinon la carte sélectionnée. G (dégâts) et M (menace) sans carte visent le méchant et la
 * manigance principale ; G, M et J n'agissent que sur une carte qui prend ce compteur (counterKindOf ; J
 * aussi sur la manigance principale et sur un personnage qui porte des jetons : takesTokens).
 * Un groupe sélectionné au lasso : T, H, X et Suppr agissent sur toutes ses cartes, sauf si la souris est sur
 * une carte qui n'en fait pas partie ; Échap le désélectionne.
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
  /** Le groupe sélectionné au lasso, s'il est visé : la souris n'est pas sur une carte qui n'en fait pas partie. */
  const targetGroup = () => {
    const group = gameStore.selectedGroup()
    const hovered = gameStore.cardById(ui.hoveredCardId)
    return group.length && (!hovered || group.includes(hovered)) ? group : null
  }

  function onKeyDown(event) {
    // pendant le changement de scène de « Lancer la partie », la fenêtre s'en va d'elle-même : rien à faire
    if (ui.scene) return
    // Échap ferme le menu ouvert (par-dessus une fenêtre de défausse, la fenêtre reste), sinon la liste des
    // pions, sinon la fenêtre, sauf celle qui attend une réponse (le mulligan du début de partie) ; sans rien
    // d'ouvert, il retire la sélection (une carte ou un groupe)
    if (event.key === 'Escape') {
      if (ui.contextMenu) ui.closeContextMenu()
      else if (ui.pawnTrayOpen) {
        // la liste des pions se ferme, le focus revient à son onglet
        ui.closePawnTray()
        document.querySelector('[data-pawn-anchor]')?.focus()
      } else if (ui.modal) {
        if (!ui.modal.required) ui.closeModal()
      } else ui.selectCard(null)
      return
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.target.closest?.('input, textarea, select') || ui.modal || ui.introOpen || !gameStore.isReady) return
    const card = targetCard()
    const cardId = card?.id ?? null
    const key = event.key.toLowerCase()
    const sign = event.shiftKey ? -1 : 1 // Maj : retirer au lieu d'ajouter

    // le groupe sélectionné au lasso : incliner, prendre en main, mettre de côté, défausser, toutes ses cartes
    const isDelete = event.key === 'Delete' || event.key === 'Backspace'
    if (['t', 'h', 'x'].includes(key) || isDelete) {
      if (targetGroup()) {
        if (isDelete) event.preventDefault() // Retour arrière ne doit pas revenir à la page précédente
        if (key === 't') gameStore.toggleGroupExhausted()
        else gameStore.moveGroup({ h: 'hand', x: 'setAside' }[key] ?? 'discard')
        return
      }
    }

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
