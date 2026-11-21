// Souris, doigt et stylet, gérés de la même façon et en un seul endroit (écouteurs posés sur le document) :
// glisser-déposer entre les zones, toucher, double-clic / double toucher, aperçu au survol, menu au clic
// droit ou à l'appui long. Les cartes portent l'attribut data-id, les zones où l'on dépose data-zone, les
// pions de la liste « Pions » (PawnTray), qu'on glisse sur la table pour les y poser, data-pawn.

import { onMounted, onBeforeUnmount } from 'vue'
import { PAWN_KIND_BY_ID } from '../game/data.js'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'
import { useZoneActions } from './useZoneActions.js'
import { useCardMenu, DECK_PILES, PILES_WITH_MENU } from './useCardMenu.js'

/** Durée d'un appui long (ms) : il ouvre le menu, comme un clic droit. */
const LONG_PRESS_DELAY = 500
/** Délai maximal entre deux touchers pour un double toucher (ms). */
const DOUBLE_TAP_DELAY = 350
/** Distance (px) en deçà de laquelle un appui reste un toucher et non un glisser : un doigt tremble plus qu'une souris. */
const MOVE_TOLERANCE = { mouse: 5, pen: 8, touch: 10 }
/** Sélecteur des piles qui ont leur propre menu. */
const PILE_SELECTOR = PILES_WITH_MENU.map(zone => `[data-zone="${zone}"]`).join(', ')

// Un appui traité ici ne doit pas aussi atteindre les gestionnaires de clic en dessous : la pile sous une
// carte qu'on vient de piocher, la ligne de menu qui se retrouve sous le doigt après un appui long, la zone
// découverte par un menu ou une fenêtre qu'un toucher vient de fermer.
let ignoreNextClick = false
/** Ignore le clic qui termine l'appui en cours. */
export const swallowNextClick = () => { ignoreNextClick = true }

export function usePointer() {
  const gameStore = useGameStore()
  const ui = useUiStore()
  const { activateCard } = useZoneActions()
  const { openCardMenu, openPileMenu } = useCardMenu()

  /** Appui du pointeur principal, pas encore devenu un glisser. */
  let press = null
  /** Glisser en cours : {cardElement, card, ghost, offsetX, offsetY, pointerId…}, ou pour un nouveau pion {pawnId, ghost…}. */
  let drag = null
  /** Dernier toucher {cardId, time, x, y} : pour reconnaître un double toucher (doigt et stylet). */
  let lastTap = null
  let pointerType = 'mouse'
  /** L'appui en cours a déjà ouvert un menu (appui long). */
  let longPressDone = false

  /** Élément à l'intérieur d'une fenêtre, de l'aperçu ou d'un menu : ces cartes-là ne se glissent pas. */
  const isInsideOverlay = element => element.closest('.modal, .preview, .menu')
  /** La carte (élément et objet) sous la cible d'un événement, ou null. */
  const cardUnder = target => {
    const element = target.closest?.('.card[data-id]')
    if (!element || isInsideOverlay(element)) return null
    const card = gameStore.cardById(element.dataset.id)
    return card ? { element, card } : null
  }
  // l'appui long agit comme un clic droit sur toute carte (aussi dans une fenêtre de pile), sur les pioches
  // et les défausses ; la main elle-même s'appuie, pour qu'un doigt la fasse défiler depuis les espaces vides ;
  // un pion de la liste « Pions » s'appuie pour être glissé
  const pressableUnder = target => target.closest?.(`.card, .hand-row, [data-pawn], ${PILE_SELECTOR}`)
  // Doigt et stylet : une main qui déborde défile de côté sous le doigt. On la fait défiler nous-mêmes : un
  // défilement natif qui atteint le bout de la rangée peut devenir le geste « page précédente » du navigateur.
  const scrollableHandUnder = target => {
    if (pointerType === 'mouse') return null
    const row = target.closest?.('.hand-row')
    return row && row.scrollWidth > row.clientWidth + 1 ? row : null
  }
  /** La zone de dépôt sous le point (x, y). */
  // la première zone de la pile d'éléments à cet endroit : un élément posé par-dessus une zone sans en être une
  // (les boutons et le nom des PV du méchant, la poignée de la colonne de droite) ne l'empêche pas de recevoir
  // la carte ; la table la remonte ensuite au-dessus des PV du méchant (keepCardOnTable)
  const zoneElementAt = (x, y) => {
    for (const element of document.elementsFromPoint(x, y)) {
      const zone = element.closest('[data-zone]')
      if (zone) return zone
    }
    return null
  }
  /** Efface la surbrillance des zones survolées pendant un glisser. */
  const clearDropHighlight = () => document.querySelectorAll('.over').forEach(element => element.classList.remove('over'))

  // s'exécute avant tous les autres écouteurs pointerdown, y compris ceux qui arrêtent la propagation
  function onPointerDownFirst(event) {
    ignoreNextClick = false
    longPressDone = false
    pointerType = event.pointerType
  }

  function onPointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return
    const target = pressableUnder(event.target)
    if (!target || target.closest('.menu')) return
    // un pion de la liste « Pions » : un glisser le pose sur la table ; un simple toucher, son bouton s'en charge
    // (au milieu de la table). Pas d'appui long : on peut le tenir avant de le tirer
    const pawnSource = target.closest('[data-pawn]')
    if (pawnSource) {
      press = { pawnSource, hit: null, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, longPressTimer: null }
      return
    }
    const hit = cardUnder(event.target)
    // la carte appuyée est sélectionnée tout de suite (filet jaune), sans attendre que le bouton remonte
    if (hit) ui.selectCard(hit.card.id)
    const rect = hit?.element.getBoundingClientRect()
    press = {
      hit,
      scrollRow: scrollableHandUnder(event.target), isScrolling: false, scrollStart: 0,
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      // où l'on a saisi la carte, pour qu'elle suive le pointeur sans sauter
      offsetX: hit ? event.clientX - rect.left : 0, offsetY: hit ? event.clientY - rect.top : 0,
      longPressTimer: setTimeout(onLongPress, LONG_PRESS_DELAY)
    }
  }

  // iOS n'envoie jamais contextmenu sur un appui long (Android et Windows oui) : on en envoie un nous-mêmes
  function onLongPress() {
    const pressed = press
    if (!pressed) return
    press = null
    longPressDone = true
    ignoreNextClick = true
    const element = document.elementFromPoint(pressed.startX, pressed.startY)
    element?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, clientX: pressed.startX, clientY: pressed.startY }))
  }

  /** La carte tirée au hasard perd son contour rouge dès qu'on la touche ou la déplace. */
  const clearRandomMark = card => { if (ui.randomlyPickedCardId === card.id) ui.randomlyPickedCardId = null }

  /** L'appui devient un glisser : une copie de la carte (le « fantôme ») suit le pointeur, la carte s'estompe. */
  function startDrag() {
    clearTimeout(press.longPressTimer)
    const { element, card } = press.hit
    clearRandomMark(card)
    const ghost = element.cloneNode(true)
    ghost.classList.add('ghost')
    ghost.classList.remove('sel', 'tapped')
    ghost.removeAttribute('data-id')
    Object.assign(ghost.style, { width: `${element.offsetWidth}px`, height: `${element.offsetHeight}px`, zIndex: '', left: '0', top: '0' })
    // une carte inclinée est tournée : on la saisit par son centre
    if (card.zone === 'table' && card.exhausted) { press.offsetX = element.offsetWidth / 2; press.offsetY = element.offsetHeight / 2 }
    document.body.appendChild(ghost)
    element.style.opacity = '.25'
    drag = { ...press, cardElement: element, card, ghost }
    press = null
  }

  /** Un pion de la liste « Pions » quitte la liste : son image, à sa taille sur la table, suit le pointeur par son milieu. */
  function startPawnDrag() {
    const pawnId = press.pawnSource.dataset.pawn
    const [width, height] = (PAWN_KIND_BY_ID[pawnId]?.size ?? [0.4, 0.4]).map(size => size * ui.cardWidth)
    const ghost = document.createElement('div')
    ghost.className = 'ghost pawn-ghost'
    Object.assign(ghost.style, { width: `${width}px`, height: `${height}px` })
    ghost.append(press.pawnSource.querySelector('img').cloneNode())
    document.body.appendChild(ghost)
    drag = { ...press, pawnId, ghost, offsetX: width / 2, offsetY: height / 2 }
    press = null
  }

  function onPointerMove(event) {
    if (press && event.pointerId === press.pointerId) {
      const deltaX = event.clientX - press.startX
      const deltaY = event.clientY - press.startY
      if (press.isScrolling) { press.scrollRow.scrollLeft = press.scrollStart - deltaX; return }
      if (Math.hypot(deltaX, deltaY) < (MOVE_TOLERANCE[pointerType] ?? 5)) return
      // de côté sur une main qui déborde : on la fait défiler ; vers le haut : on glisse la carte comme d'habitude
      if (press.scrollRow && Math.abs(deltaX) > Math.abs(deltaY)) {
        clearTimeout(press.longPressTimer)
        Object.assign(press, { isScrolling: true, scrollStart: press.scrollRow.scrollLeft + deltaX })
        press.scrollRow.scrollLeft = press.scrollStart - deltaX
        return
      }
      if (press.pawnSource) startPawnDrag()
      // une pile, une carte dans une fenêtre de pile ou la main ne se glissent pas : bouger annule seulement l'appui long
      else if (!press.hit) { clearTimeout(press.longPressTimer); press = null; return }
      else startDrag()
    }
    if (!drag || event.pointerId !== drag.pointerId) return
    drag.ghost.style.transform = `translate(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px)`
    clearDropHighlight()
    // un pion ne se pose que sur la table : seule elle s'éclaire sous lui
    const zoneElement = zoneElementAt(event.clientX, event.clientY)
    if (zoneElement && (!drag.pawnId || zoneElement.dataset.zone === 'table')) zoneElement.classList.add('over')
  }

  function onPointerUp(event) {
    if (press && event.pointerId === press.pointerId) {
      finishPress(event)
      return
    }
    if (drag && event.pointerId === drag.pointerId) finishDrag(event)
  }

  /** Fin d'un appui sans glisser : un toucher (ou double toucher) sur une carte. */
  function finishPress(event) {
    clearTimeout(press.longPressTimer)
    const { hit, isScrolling } = press
    press = null
    if (isScrolling) { ignoreNextClick = true; return }
    if (!hit) return // une pile ou une fenêtre de pile : leur propre gestionnaire de clic s'en charge
    ignoreNextClick = true
    clearRandomMark(hit.card)
    if (pointerType !== 'mouse' && isDoubleTap(hit.card, event)) doubleActivate(hit.card)
    else activateCard(hit.card)
  }

  /**
   * Fin d'un glisser : la carte est déposée dans la zone sous le pointeur. Sur la table, à l'endroit lâché
   * (face cachée si elle vient d'une pioche) ; dans la main, rangée parmi les autres cartes ; ailleurs, dans
   * cette zone.
   */
  function finishDrag(event) {
    ignoreNextClick = true
    const finished = drag
    drag = null
    finished.ghost.remove()
    if (finished.cardElement) finished.cardElement.style.opacity = ''
    clearDropHighlight()
    if (finished.pawnId) {
      dropPawn(finished, event)
      return
    }
    const zoneElement = zoneElementAt(event.clientX, event.clientY)
    if (!zoneElement) return
    const zone = zoneElement.dataset.zone
    const { card } = finished
    if (zone === 'table') {
      // à l'endroit lâché ; le moteur la garde entière sur la table, à sa taille sur la table (une carte de
      // la main n'a pas la même) : décalée vers le haut si elle dépasse du bas ou passe sous les PV du méchant
      const tableRect = zoneElement.getBoundingClientRect()
      const x = event.clientX - tableRect.left - finished.offsetX
      const y = event.clientY - tableRect.top - finished.offsetY
      // une carte tirée d'une pioche arrive face cachée (une carte Invocation est alors glissée sous une manigance)
      gameStore.moveCard(card.id, 'table', { x, y, faceDown: DECK_PILES.includes(card.zone) })
    } else if (zone === 'hand' && card.zone === 'hand') {
      const otherCards = [...zoneElement.querySelectorAll('.card[data-id]')].filter(element => element.dataset.id !== card.id)
      const nextCard = otherCards.find(element => {
        const rect = element.getBoundingClientRect()
        return event.clientX < rect.left + rect.width / 2
      })
      gameStore.reorderHand(card.id, nextCard?.dataset.id)
    } else if (zone !== card.zone) {
      gameStore.moveCard(card.id, zone)
    }
    ui.selectCard(card.id)
  }

  /**
   * Un pion lâché sur la table s'y pose, à l'endroit lâché (le moteur le garde entier sur la table), et est
   * sélectionné ; lâché ailleurs, ou rendu à la liste, il n'est pas posé.
   */
  function dropPawn(finished, event) {
    if (document.elementFromPoint(event.clientX, event.clientY)?.closest('.pawn-tray')) return
    const tableElement = zoneElementAt(event.clientX, event.clientY)
    if (tableElement?.dataset.zone !== 'table') return
    const tableRect = tableElement.getBoundingClientRect()
    const pawn = gameStore.addPawn(finished.pawnId, {
      x: event.clientX - tableRect.left - finished.offsetX,
      y: event.clientY - tableRect.top - finished.offsetY
    })
    if (pawn) ui.selectCard(pawn.id)
  }

  function onPointerCancel() {
    if (press) clearTimeout(press.longPressTimer)
    press = null
    if (!drag) return
    drag.ghost.remove()
    if (drag.cardElement) drag.cardElement.style.opacity = ''
    drag = null
    clearDropHighlight()
  }

  // doigt et stylet ont notre propre double toucher ; la souris garde le double-clic natif (vitesse réglée dans le système)
  function isDoubleTap(card, event) {
    const previous = lastTap
    lastTap = { cardId: card.id, time: event.timeStamp, x: event.clientX, y: event.clientY }
    const tooLate = previous && event.timeStamp - previous.time > DOUBLE_TAP_DELAY
    const tooFar = previous && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 30
    if (!previous || previous.cardId !== card.id || tooLate || tooFar) return false
    lastTap = null
    return true
  }
  /** Double-clic / double toucher : incline ou redresse une carte de la table, joue une carte de la main. */
  function doubleActivate(card) {
    if (card.zone === 'table') gameStore.toggleExhausted(card.id)
    else if (card.zone === 'hand') gameStore.playToTable(card.id)
  }
  function onDoubleClick(event) {
    if (pointerType !== 'mouse') return
    const hit = cardUnder(event.target)
    if (hit) doubleActivate(hit.card)
  }

  function onClickFirst(event) {
    if (!ignoreNextClick || event.detail === 0) return // detail 0 : activation au clavier, jamais ignorée
    ignoreNextClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  // contextmenu natif : clic droit, ou appui long sur les écrans tactiles Android et Windows
  function onContextMenuFirst(event) {
    if (!event.isTrusted) return
    if (longPressDone || drag) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (press) {
      clearTimeout(press.longPressTimer)
      press = null
      longPressDone = true
      ignoreNextClick = true
    }
  }

  /** Survol : la carte sous la souris devient la cible des raccourcis et s'affiche en grand. */
  function onMouseOver(event) {
    const hit = cardUnder(event.target)
    ui.hoveredCardId = hit ? hit.card.id : null
    if (hit && !hit.card.isPawn) ui.showPreview(hit.card.id)
  }

  // une pile du plateau (sa carte du dessus comprise) ouvre le menu de la pile ; une carte dans une
  // fenêtre de pile garde son propre menu (PileModal)
  function onContextMenu(event) {
    const pileElement = event.target.closest?.(PILE_SELECTOR)
    if (pileElement && !isInsideOverlay(pileElement)) {
      event.preventDefault()
      openPileMenu(pileElement.dataset.zone, event.clientX, event.clientY)
      return
    }
    const hit = cardUnder(event.target)
    if (hit) {
      event.preventDefault()
      openCardMenu(hit.card, event.clientX, event.clientY)
    }
  }

  // la capture sur window passe avant tout le reste de la page ; iOS n'applique :active qu'avec un écouteur touchstart
  const firstListeners = [['pointerdown', onPointerDownFirst], ['click', onClickFirst], ['contextmenu', onContextMenuFirst]]
  const listeners = [
    ['pointerdown', onPointerDown], ['pointermove', onPointerMove], ['pointerup', onPointerUp], ['pointercancel', onPointerCancel],
    ['dblclick', onDoubleClick], ['mouseover', onMouseOver], ['contextmenu', onContextMenu]
  ]
  const doNothing = () => {}
  onMounted(() => {
    for (const [type, listener] of firstListeners) window.addEventListener(type, listener, true)
    for (const [type, listener] of listeners) document.addEventListener(type, listener)
    document.addEventListener('touchstart', doNothing, { passive: true })
  })
  onBeforeUnmount(() => {
    for (const [type, listener] of firstListeners) window.removeEventListener(type, listener, true)
    for (const [type, listener] of listeners) document.removeEventListener(type, listener)
    document.removeEventListener('touchstart', doNothing)
  })
}
