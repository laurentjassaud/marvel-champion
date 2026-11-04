import { onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'
import { useZoneActions } from './useZoneActions.js'
import { useCardMenu } from './useCardMenu.js'

const LONG_PRESS = 500
const DOUBLE_TAP = 350
// a finger wobbles more than a mouse: below this distance a press is still a tap
const SLOP = { mouse: 5, pen: 8, touch: 10 }

// A press handled here must not also reach the click handlers underneath: the pile under
// a card that was just drawn, the menu item now under the finger after a long press,
// the zone revealed by a menu or a modal that a tap just closed.
let swallowClick = false
/** Drop the click that ends the current press. */
export const swallowNextClick = () => { swallowClick = true }

/**
 * Pointer input, delegated at document level, the same for mouse, touch and pen:
 * drag & drop between zones, tap, double-click / double tap, hover preview,
 * right-click / long-press menu. Cards expose `data-id`, drop zones expose `data-zone`.
 */
export function usePointer() {
  const game = useGameStore()
  const ui = useUiStore()
  const { activateCard } = useZoneActions()
  const { openCardMenu, openPileMenu } = useCardMenu()

  let press = null // primary pointer down, not yet a drag
  let drag = null
  let lastTap = null // {id, t, x, y}: double tap on touch and pen
  let pointerType = 'mouse'
  let longPressed = false // the current press already opened a menu

  const inert = el => el.closest('.modal, .preview, .menu')
  const cardFrom = target => {
    const el = target.closest?.('.card[data-id]')
    if (!el || inert(el)) return null
    const c = game.card(el.dataset.id)
    return c ? { el, c } : null
  }
  // long press works like a right click on any card (also in a pile viewer) and on the draw piles;
  // the hand strip itself is pressable so that a finger can scroll it from the gaps too
  const pressable = target => target.closest?.('.card, .hand-row, [data-zone="deck"], [data-zone="edeck"]')
  // Touch and pen: an overflowing hand scrolls sideways under the finger. We scroll it ourselves:
  // a native pan that reaches the end of the row can turn into the browser's "back" swipe.
  const handScroller = target => {
    if (pointerType === 'mouse') return null
    const row = target.closest?.('.hand-row')
    return row && row.scrollWidth > row.clientWidth + 1 ? row : null
  }
  const zoneAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-zone]') ?? null
  const clearOver = () => document.querySelectorAll('.over').forEach(n => n.classList.remove('over'))

  // runs before every other pointerdown listener, including the ones that stop propagation
  function onDownFirst(e) {
    swallowClick = false
    longPressed = false
    pointerType = e.pointerType
  }

  function onDown(e) {
    if (!e.isPrimary || e.button !== 0) return
    const target = pressable(e.target)
    if (!target || target.closest('.menu')) return
    const hit = cardFrom(e.target)
    const r = hit?.el.getBoundingClientRect()
    press = {
      hit, row: handScroller(e.target), scrolling: false, left: 0, id: e.pointerId, sx: e.clientX, sy: e.clientY,
      ox: hit ? e.clientX - r.left : 0, oy: hit ? e.clientY - r.top : 0,
      timer: setTimeout(longPress, LONG_PRESS)
    }
  }

  // iOS never fires contextmenu on a long press (Android and Windows do): send one ourselves
  function longPress() {
    const p = press
    if (!p) return
    press = null
    longPressed = true
    swallowClick = true
    const el = document.elementFromPoint(p.sx, p.sy)
    el?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, clientX: p.sx, clientY: p.sy }))
  }

  function startDrag() {
    clearTimeout(press.timer)
    const { el, c } = press.hit
    const ghost = el.cloneNode(true)
    ghost.classList.add('ghost')
    ghost.classList.remove('sel', 'tapped')
    ghost.removeAttribute('data-id')
    ghost.style.width = `${el.offsetWidth}px`
    ghost.style.height = `${el.offsetHeight}px`
    ghost.style.zIndex = ''
    ghost.style.left = '0'
    ghost.style.top = '0'
    if (c.zone === 'table' && c.tapped) { press.ox = el.offsetWidth / 2; press.oy = el.offsetHeight / 2 }
    document.body.appendChild(ghost)
    el.style.opacity = '.25'
    drag = { ...press, el, c, ghost }
    press = null
  }

  function onMove(e) {
    if (press && e.pointerId === press.id) {
      const dx = e.clientX - press.sx
      const dy = e.clientY - press.sy
      if (press.scrolling) { press.row.scrollLeft = press.left - dx; return }
      if (Math.hypot(dx, dy) < (SLOP[pointerType] ?? 5)) return
      // sideways on an overflowing hand: scroll it; upwards: drag the card as usual
      if (press.row && Math.abs(dx) > Math.abs(dy)) {
        clearTimeout(press.timer)
        Object.assign(press, { scrolling: true, left: press.row.scrollLeft + dx })
        press.row.scrollLeft = press.left - dx
        return
      }
      // a pile, a card in a pile viewer or the hand strip does not drag: moving only cancels the long press
      if (!press.hit) { clearTimeout(press.timer); press = null; return }
      startDrag()
    }
    if (!drag || e.pointerId !== drag.id) return
    drag.ghost.style.transform = `translate(${e.clientX - drag.ox}px, ${e.clientY - drag.oy}px)`
    clearOver()
    zoneAt(e.clientX, e.clientY)?.classList.add('over')
  }

  function onUp(e) {
    if (press && e.pointerId === press.id) {
      clearTimeout(press.timer)
      const { hit, scrolling } = press
      press = null
      if (scrolling) { swallowClick = true; return }
      if (!hit) return // pile or pile viewer: their own click handler does the job
      swallowClick = true
      if (pointerType !== 'mouse' && isDoubleTap(hit.c, e)) doubleActivate(hit.c)
      else activateCard(hit.c)
      return
    }
    if (!drag || e.pointerId !== drag.id) return
    swallowClick = true
    const d = drag
    drag = null
    d.ghost.remove()
    d.el.style.opacity = ''
    clearOver()
    const zoneEl = zoneAt(e.clientX, e.clientY)
    if (!zoneEl) return
    const zone = zoneEl.dataset.zone
    if (zone === 'table') {
      const tr = zoneEl.getBoundingClientRect()
      const w = d.el.offsetWidth
      const h = d.el.offsetHeight
      const x = Math.max(0, Math.min(tr.width - w, e.clientX - tr.left - d.ox))
      const y = Math.max(0, Math.min(tr.height - h, e.clientY - tr.top - d.oy))
      // a card dragged off a draw pile lands face down
      game.move(d.c.id, 'table', { x, y, faceDown: d.c.zone === 'deck' || d.c.zone === 'edeck' })
    } else if (zone === 'hand' && d.c.zone === 'hand') {
      const others = [...zoneEl.querySelectorAll('.card[data-id]')].filter(n => n.dataset.id !== d.c.id)
      const before = others.find(n => { const r = n.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 })
      game.reorderHand(d.c.id, before?.dataset.id)
    } else if (zone !== d.c.zone) {
      game.move(d.c.id, zone)
    }
    ui.select(d.c.id)
  }

  function onCancel() {
    if (press) clearTimeout(press.timer)
    press = null
    if (drag) { drag.ghost.remove(); drag.el.style.opacity = ''; drag = null; clearOver() }
  }

  // touch and pen get our own double tap; the mouse keeps the native dblclick (OS speed setting)
  function isDoubleTap(c, e) {
    const prev = lastTap
    lastTap = { id: c.id, t: e.timeStamp, x: e.clientX, y: e.clientY }
    if (!prev || prev.id !== c.id || e.timeStamp - prev.t > DOUBLE_TAP || Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 30) return false
    lastTap = null
    return true
  }
  function doubleActivate(c) {
    if (c.zone === 'table') game.tap(c.id)
    else if (c.zone === 'hand') game.playToTable(c.id)
  }
  function onDblClick(e) {
    if (pointerType !== 'mouse') return
    const hit = cardFrom(e.target)
    if (hit) doubleActivate(hit.c)
  }

  function onClickFirst(e) {
    if (!swallowClick || e.detail === 0) return // detail 0: keyboard activation, never dropped
    swallowClick = false
    e.preventDefault()
    e.stopPropagation()
  }

  // native contextmenu: right click, or long press on Android and Windows touch screens
  function onContextFirst(e) {
    if (!e.isTrusted) return
    if (longPressed || drag) { e.preventDefault(); e.stopPropagation(); return }
    if (press) { clearTimeout(press.timer); press = null; longPressed = true; swallowClick = true }
  }

  function onOver(e) {
    const hit = cardFrom(e.target)
    ui.hover = hit ? hit.c.id : null
    if (hit && hit.c.kind !== 'token') ui.showPreview(hit.c.id)
  }

  function onContext(e) {
    const hit = cardFrom(e.target)
    if (hit) { e.preventDefault(); openCardMenu(hit.c, e.clientX, e.clientY); return }
    const pile = e.target.closest?.('[data-zone="deck"], [data-zone="edeck"]')
    if (pile && !inert(pile)) { e.preventDefault(); openPileMenu(pile.dataset.zone, e.clientX, e.clientY) }
  }

  // window capture runs before anything on the page; iOS only applies :active with a touch listener
  const first = [['pointerdown', onDownFirst], ['click', onClickFirst], ['contextmenu', onContextFirst]]
  const listeners = [
    ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onCancel],
    ['dblclick', onDblClick], ['mouseover', onOver], ['contextmenu', onContext]
  ]
  const noop = () => {}
  onMounted(() => {
    first.forEach(([t, fn]) => window.addEventListener(t, fn, true))
    listeners.forEach(([t, fn]) => document.addEventListener(t, fn))
    document.addEventListener('touchstart', noop, { passive: true })
  })
  onBeforeUnmount(() => {
    first.forEach(([t, fn]) => window.removeEventListener(t, fn, true))
    listeners.forEach(([t, fn]) => document.removeEventListener(t, fn))
    document.removeEventListener('touchstart', noop)
  })
}
