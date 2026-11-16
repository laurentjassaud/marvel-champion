<script setup>
// Le cadre commun des fenêtres : le fond sombre (un appui dessus ferme la fenêtre), la boîte et son titre.
// La carte agrandie de la colonne de droite reste visible au-dessus du fond, à sa place : le fond assombrit
// et floute toute la page, alors la fenêtre montre la sienne exactement par-dessus le panneau de l'onglet
// Carte (ou Journal), et se centre à sa gauche pour ne jamais la cacher. Sur téléphone, la colonne de droite
// est sous la table, hors de l'écran : rien de tel.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import CardPreview from '../CardPreview.vue'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'
import { swallowNextClick } from '../../composables/usePointer.js'

defineProps({
  /** Titre de la fenêtre, aussi annoncé aux lecteurs d'écran. */
  title: { type: String, required: true }
})
const gameStore = useGameStore()
const ui = useUiStore()
const dialogElement = ref(null)

/**
 * La place du panneau de la colonne de droite (SideTabs, data-zoom-anchor), en pixels de la fenêtre du
 * navigateur : {left, top, width, height, room}, room étant la largeur qu'il occupe à droite de l'écran ;
 * null sur téléphone, sans partie, ou si le panneau n'est pas à l'écran.
 */
const zoomPlace = ref(null)
function measureZoomPlace() {
  const pane = document.querySelector('[data-zoom-anchor]')
  const rect = pane?.getBoundingClientRect()
  const isPhone = window.matchMedia('(max-width: 700px)').matches
  zoomPlace.value = gameStore.isReady && !isPhone && rect?.width && rect.height
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height, room: window.innerWidth - rect.left }
    : null
}

onMounted(() => {
  measureZoomPlace()
  window.addEventListener('resize', measureZoomPlace)
  // focus sans défilement : le premier bouton peut être « Fermer », en bas d'une longue pile
  dialogElement.value?.querySelector('button, input:checked, input')?.focus({ preventScroll: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', measureZoomPlace))

// l'appui sur le fond ne doit pas ensuite cliquer la pile que la fenêtre découvre en se fermant
function closeFromBackdrop() {
  swallowNextClick()
  ui.closeModal()
}
</script>

<template>
  <div class="modal" :class="{ 'beside-zoom': zoomPlace }" :style="zoomPlace ? { '--zoom-room': `${zoomPlace.room}px` } : null"
    @pointerdown.self="closeFromBackdrop">
    <div ref="dialogElement" class="box" role="dialog" aria-modal="true" :aria-label="title">
      <h2>{{ title }}</h2>
      <slot />
    </div>
    <!-- la carte agrandie, nette, par-dessus le panneau de la colonne de droite (lu une fois : aria-hidden) -->
    <div v-if="zoomPlace" class="modal-zoom" aria-hidden="true"
      :style="{ left: `${zoomPlace.left}px`, top: `${zoomPlace.top}px`, width: `${zoomPlace.width}px`, height: `${zoomPlace.height}px` }">
      <CardPreview />
    </div>
  </div>
</template>
