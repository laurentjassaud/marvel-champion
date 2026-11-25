// Préchargement des images : celles des cartes de la partie sont chargées en tâche de fond une fois la
// partie mise en place. Les cartes de la boîte de base sont déjà toutes dans le cache du service worker
// depuis son installation (vite.config.js) : elles reviennent aussitôt. Les autres (decks importés, cartes
// lues sur MarvelCDB, avec leurs scans français de cgbuilder) sont gardées par le service worker à ce
// moment-là (caches mc-cards, mc-cgbuilder, mc-marvelcdb et mc-mc4db) : une carte révélée plus tard s'affiche aussitôt,
// même hors ligne. Sans service worker (serveur de développement, version artefact), elles vont dans le cache
// HTTP du navigateur.

import { watch } from 'vue'
import { isEncounterCard } from '../game/engine.js'
import { cardImageUrl, INTRO_SKY_URL } from './useAssets.js'
import { useGameStore } from '../stores/game.js'

/** Nombre d'images demandées en même temps. */
const BATCH_SIZE = 4
/** Images déjà chargées : « Recommencer » ne les redemande pas. */
const loadedUrls = new Set()
/** Images qui restent à charger. */
let queue = []
/** Un chargement est en cours. */
let isRunning = false

/** Lance `task` quand le navigateur n'a rien d'autre à faire (Safari sur iPad n'a pas requestIdleCallback). */
const whenIdle = typeof requestIdleCallback === 'function'
  ? task => requestIdleCallback(task, { timeout: 2000 })
  : task => setTimeout(task, 300)

/** Toutes les images de la partie (face A, B, C), les cartes Rencontre d'abord : elles arrivent sans prévenir. */
function imagesOfGame(game) {
  const cards = game.cards.filter(card => !card.isPawn && card.definitionId && card.zone !== 'outOfGame')
    .sort((first, second) => isEncounterCard(second) - isEncounterCard(first))
  const urls = new Set()
  for (const card of cards) {
    for (const side of [0, 1, 2]) {
      const url = cardImageUrl({ ...card, side }) // une face que la carte n'a pas redonne sa face A : le Set l'élimine
      if (url) urls.add(url)
    }
  }
  return [...urls]
}

/** Charge une image jusqu'au bout (pour que le cache la garde) et la note comme chargée. */
async function loadImage(url) {
  // les images de cgbuilder et de MarvelCDB (cartes importées) viennent d'un autre site : demandées comme le ferait une <img>
  const fromOtherSite = new URL(url, location.href).origin !== location.origin
  const response = await fetch(url, { priority: 'low', ...(fromOtherSite ? { mode: 'no-cors' } : {}) })
  await response.blob()
  if (response.ok || response.type === 'opaque') loadedUrls.add(url)
}

/**
 * À la première visite, le service worker s'installe après le chargement de la page, puis la prend en
 * charge (clientsClaim) : on l'attend, sinon les images manqueraient son cache. Pas de service worker sur
 * le serveur de développement ni dans la version artefact ; un navigateur qui le refuse n'est pas attendu
 * longtemps (15 s).
 */
function serviceWorkerReady() {
  const serviceWorker = navigator.serviceWorker
  if (!serviceWorker || serviceWorker.controller || import.meta.env.DEV || import.meta.env.MODE === 'artifact') return Promise.resolve()
  return new Promise(resolve => {
    serviceWorker.addEventListener('controllerchange', resolve, { once: true })
    setTimeout(resolve, 15000)
  })
}

/** Charge le lot suivant, puis recommence au prochain moment libre ; s'arrête quand la file est vide. */
function loadNextBatch() {
  const batch = queue.splice(0, BATCH_SIZE)
  if (!batch.length) {
    isRunning = false
    return
  }
  Promise.allSettled(batch.map(loadImage)).then(() => whenIdle(loadNextBatch))
}

/** Charge ces images en tâche de fond, quelques-unes à la fois quand le navigateur est libre ; remplace la liste précédente. */
export function preloadImages(urls) {
  queue = urls.filter(url => !loadedUrls.has(url))
  if (isRunning || !queue.length) return
  isRunning = true
  serviceWorkerReady().then(() => whenIdle(loadNextBatch))
}

/** Délai avant de télécharger la vidéo de l'accueil : elle ne dispute pas le réseau à l'ouverture de l'appli. */
const INTRO_VIDEO_DELAY = 20000

/**
 * La vidéo du ciel de l'accueil, gardée pour les prochaines ouvertures, même hors ligne : la balise <video>
 * ne la demande que par morceaux, que le service worker ne garde pas ; on la télécharge donc une fois en
 * entier (11 Mo), en tâche de fond, et le service worker la range dans son cache mc-intro (vite.config.js).
 * Rien sans service worker (serveur de développement, version artefact) ni si elle y est déjà.
 */
async function keepIntroVideo() {
  if (!navigator.serviceWorker?.controller || typeof caches === 'undefined') return
  if (await caches.match(INTRO_SKY_URL)) return
  const response = await fetch(INTRO_SKY_URL, { priority: 'low' })
  await response.blob()
}

/**
 * Précharge les images de chaque nouvelle partie (mise en place, « Recommencer ») et de la partie trouvée à
 * l'ouverture de la page, et, une fois, la vidéo de l'accueil. Rien sur une connexion en mode économie de
 * données : les images viennent alors une à une, quand elles s'affichent, et l'accueil n'a pas de vidéo.
 */
export function usePreload() {
  const gameStore = useGameStore()
  if (navigator.connection?.saveData) return
  serviceWorkerReady().then(() => setTimeout(() => whenIdle(() => keepIntroVideo().catch(() => {})), INTRO_VIDEO_DELAY))
  // une nouvelle partie remplace l'objet d'état ; un déplacement dans la partie ne déclenche rien
  watch(() => gameStore.game, game => { if (game?.cards) preloadImages(imagesOfGame(game)) }, { immediate: true })
}
