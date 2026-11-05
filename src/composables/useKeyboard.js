import { onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

/**
 * Keyboard shortcuts. Card shortcuts target the card under the pointer,
 * otherwise the selected card. G / M with no target hit the villain / main scheme;
 * G, M and J only act on a card that takes that counter (see counterOf).
 */
export function useKeyboard() {
  const game = useGameStore()
  const ui = useUiStore()

  const target = () => {
    const h = game.card(ui.hover)
    if (h && (h.zone === 'table' || h.zone === 'hand')) return h
    return game.card(ui.sel)
  }

  function onKey(e) {
    if (e.key === 'Escape') { ui.closeMenu(); ui.closeModal(); return }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.target.closest?.('input, textarea, select') || ui.modal || !game.ready) return
    const c = target()
    const id = c?.id ?? null
    const k = e.key.toLowerCase()
    const sh = e.shiftKey

    if (e.key === '?') ui.openModal('help')
    else if (k === 'd') game.draw()
    else if (k === 'n') game.toHeroPhase()
    else if (k === 'v') game.toVillainPhase()
    else if (k === 'e') game.reveal()
    else if (k === 'i' && game.hasInvocation) game.invoke()
    else if (k === 'g') game.damage(id, sh ? -1 : 1)
    else if (k === 'm') game.threat(id, sh ? -1 : 1)
    else if (e.key === '+' || e.key === '=') game.damage(id, 1)
    else if (e.key === '-') game.damage(id, -1)
    else if (!c) return
    else if (k === 't') game.tap(id)
    else if (k === 'f') game.flip(id)
    else if (k === 'j') game.tokens(id, sh ? -1 : 1)
    else if (k === 'h' && !c.hero) game.move(id, 'hand')
    else if (k === 'x' && !c.hero) game.move(id, 'aside')
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !c.hero) { e.preventDefault(); game.move(id, 'discard'); ui.select(null) }
    else if (e.key === 'Enter' && c.zone === 'hand') game.playToTable(id)
  }

  onMounted(() => document.addEventListener('keydown', onKey))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
}
