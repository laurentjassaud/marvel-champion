// La distribution des cartes à la mise en place d'une partie (nouvelle partie, « Recommencer ») : chaque carte
// part de son paquet et se pose à sa place, une à une. Le méchant, la manigance principale et les autres
// cartes Rencontre de la table sortent du paquet Rencontre, de haut en bas ; puis l'identité et les autres
// cartes du joueur, puis la main, de gauche à droite, sortent du paquet du joueur. Une carte couchée (une
// manigance) se couche en arrivant.
//
// Animations Web (element.animate) des propriétés translate, scale et rotate : elles s'ajoutent au transform
// des cartes (carte épuisée, éventail de la main) sans le remplacer. Elles ne bloquent rien : une carte prise
// pendant qu'elle arrive se pose aussitôt, et une nouvelle mise en place arrête la précédente. Pendant la distribution,
// la table laisse déborder ses cartes (ui.isDealing) : elles sortent de dessous les paquets.
//
// Pas de distribution sous l'accueil (la partie d'exemple du premier lancement) ; après « Lancer la partie »,
// elle suit l'entrée de la table (ui.launchGame), quand les paquets sont à leur place. « Réduire les
// animations » : un simple fondu, sans trajet.
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

/** Écart entre deux cartes de la table, entre deux cartes de la main, puis entre deux groupes (ms). */
const TABLE_STAGGER = 80
const HAND_STAGGER = 60
const GROUP_GAP = 120
/** Durée d'un trajet : depuis la colonne de droite ou le bas de l'écran jusqu'à la table, puis jusqu'à la main. */
const TABLE_FLIGHT = 520
const HAND_FLIGHT = 460

export function useDealAnimation() {
  const gameStore = useGameStore()
  const ui = useUiStore()
  /** Les animations en cours (une nouvelle mise en place les arrête). */
  let running = []

  function stop() {
    for (const animation of running) animation.cancel()
    running = []
    ui.isDealing = false
  }

  // après le rendu de la nouvelle partie : les cartes sont à leur place, il reste à les faire venir
  watch(() => ui.setupCount, () => {
    stop()
    if (!ui.introOpen && !ui.scene) deal()
  }, { flush: 'post' })
  // « Lancer la partie » : la table a fini d'entrer (main.css cache ses cartes jusque-là ; la classe est
  // retirée dans le même rendu, avant que la distribution ne les cache à son tour : pas d'image entre les deux)
  watch(() => ui.scene, (scene, before) => {
    if (before === 'in' && !scene) deal()
  }, { flush: 'post' })

  // une carte prise pendant qu'elle arrive (glisser, appui long) se pose aussitôt : elle suit le doigt
  function landOnPress(event) {
    if (!running.length) return
    const element = event.target.closest?.('.card[data-id]')
    if (!element) return
    for (const animation of running) if (animation.effect?.target === element) animation.finish()
  }
  onMounted(() => window.addEventListener('pointerdown', landOnPress, true))
  onBeforeUnmount(() => window.removeEventListener('pointerdown', landOnPress, true))

  function deal() {
    const tableCards = [...document.querySelectorAll('.table > .card[data-id]')]
    const handCards = [...document.querySelectorAll('.hand-row .card[data-id]')]
    if (!tableCards.length && !handCards.length) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const element of [...tableCards, ...handCards]) {
        running.push(element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease', fill: 'backwards' }))
      }
      return
    }

    const card = element => gameStore.cardById(element.dataset.id)
    const measured = element => ({ element, rect: element.getBoundingClientRect() })
    // de haut en bas, puis de gauche à droite
    const inReadingOrder = (a, b) => (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left)
    const encounter = tableCards.filter(element => card(element)?.owner === 'encounter').map(measured).sort(inReadingOrder)
    // l'identité d'abord
    const player = tableCards.filter(element => card(element)?.owner !== 'encounter').map(measured)
      .sort((a, b) => (card(b.element)?.isIdentity ? 1 : 0) - (card(a.element)?.isIdentity ? 1 : 0) || inReadingOrder(a, b))
    const hand = handCards.map(measured)

    const encounterDeck = pileSource('encounterDeck')
    const playerDeck = pileSource('playerDeck')
    // la courbe d'arrivée d'un grand élément (main.css, comme l'illustration du méchant) : un départ franc mais
    // pas brutal sur ces longs trajets, puis la carte ralentit jusqu'à se poser
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-drawer').trim() || 'ease-out'
    ui.isDealing = true

    let at = 0
    const dealGroup = (cards, source, stagger, duration) => {
      if (!cards.length || !source) return
      cards.forEach(({ element, rect }, index) => running.push(fly(element, rect, source, at + index * stagger, duration, easing)))
      at += (cards.length - 1) * stagger + GROUP_GAP
    }
    dealGroup(encounter, encounterDeck, TABLE_STAGGER, TABLE_FLIGHT)
    dealGroup(player, playerDeck, TABLE_STAGGER, TABLE_FLIGHT)
    dealGroup(hand, playerDeck, HAND_STAGGER, HAND_FLIGHT)

    // tout est posé (ou arrêté) : la table recoupe ce qui dépasse
    const dealt = running
    Promise.allSettled(dealt.map(animation => animation.finished)).then(() => {
      if (running === dealt) ui.isDealing = false
    })
  }
}

/** Le centre et la largeur de la carte d'une pile (son cadre a 4 px de marge de chaque côté), ou null. */
function pileSource(zone) {
  const slot = document.querySelector(`.pile[data-zone="${zone}"] .slot`)
  if (!slot) return null
  const rect = slot.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: slot.offsetWidth - 8 }
}

/**
 * Fait venir une carte du paquet à sa place : elle part du centre de la pile, à la taille de la carte de la
 * pile, et y apparaît aussitôt (elle sort de dessous) ; une carte couchée part debout, comme dans le paquet.
 */
function fly(element, rect, source, delay, duration, easing) {
  const isLying = element.classList.contains('land')
  // largeur à l'écran de la carte debout : celle d'une carte couchée est sa hauteur
  const uprightWidth = isLying ? element.offsetHeight : element.offsetWidth
  const dx = source.x - (rect.left + rect.width / 2)
  const dy = source.y - (rect.top + rect.height / 2)
  return element.animate([
    { translate: `${dx}px ${dy}px`, scale: String(source.width / uprightWidth), rotate: isLying ? '-90deg' : '0deg', opacity: 0 },
    { opacity: 1, offset: 0.12 },
    { translate: '0px 0px', scale: '1', rotate: '0deg', opacity: 1 }
  ], { duration, delay, easing, fill: 'backwards' })
}
