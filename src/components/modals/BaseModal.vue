<script setup>
// Le cadre commun des fenêtres (maquette « fenêtre ») : le fond sombre (un appui dessus ferme la fenêtre), le
// panneau en biais, son titre et son contenu, qui défile, et en bas, sur la bande du pied, les boutons
// d'action (slot actions : les autres choix à gauche, puis Annuler ou Fermer, puis l'action principale en
// rouge, à droite).
// La carte agrandie de la colonne de droite reste visible au-dessus du fond, à sa place : le fond assombrit
// et floute toute la page, alors la fenêtre montre la sienne exactement par-dessus le panneau de l'onglet
// Carte (ou Journal), et se centre à sa gauche pour ne jamais la cacher. Sur téléphone, la colonne de droite
// est sous la table, hors de l'écran : rien de tel.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import CardPreview from '../CardPreview.vue'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'
import { swallowNextClick } from '../../composables/usePointer.js'

const props = defineProps({
  /** Titre de la fenêtre, aussi annoncé aux lecteurs d'écran. */
  title: { type: String, required: true },
  /** Grande fenêtre, à la taille de la maquette (Nouvelle partie) : elle ne change pas de taille d'un écran à l'autre. */
  wide: { type: Boolean, default: false }
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
/**
 * La grande fenêtre (Nouvelle partie) ouverte sur l'accueil : le haut de la place laissée sous le grand titre
 * « Marvel Champions » (le bas du titre et 12 px d'écart, en pixels du haut de l'écran), pour qu'elle ne le
 * cache pas ; null ailleurs (les autres fenêtres restent centrées).
 */
const titleRoom = ref(null)
function measurePlaces() {
  const pane = document.querySelector('[data-zoom-anchor]')
  const rect = pane?.getBoundingClientRect()
  const isPhone = window.matchMedia('(max-width: 700px)').matches
  // sur l'accueil, la colonne de droite est cachée dessous : pas de carte agrandie
  zoomPlace.value = gameStore.isReady && !ui.introOpen && !isPhone && rect?.width && rect.height
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height, room: window.innerWidth - rect.left }
    : null
  const introTitle = props.wide && ui.introOpen ? document.querySelector('.intro-screen .title') : null
  titleRoom.value = introTitle ? Math.round(introTitle.getBoundingClientRect().bottom + 12) : null
}
const modalStyle = computed(() => ({
  '--zoom-room': zoomPlace.value ? `${zoomPlace.value.room}px` : null,
  '--title-room': titleRoom.value ? `${titleRoom.value}px` : null
}))

onMounted(() => {
  measurePlaces()
  window.addEventListener('resize', measurePlaces)
  // focus sans défilement : le choix coché ou le premier champ, sinon l'action principale, sinon le premier
  // bouton actif (un bouton désactivé ne prend pas le focus)
  const dialog = dialogElement.value
  const first = dialog?.querySelector('.box-body input:checked, .box-body input') ?? dialog?.querySelector('.box-actions .red:not(:disabled)')
    ?? dialog?.querySelector('button:not(:disabled)')
  first?.focus({ preventScroll: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', measurePlaces))

// l'appui sur le fond ne doit pas ensuite cliquer la pile que la fenêtre découvre en se fermant
function closeFromBackdrop() {
  swallowNextClick()
  ui.closeModal()
}
</script>

<template>
  <div class="modal" :class="{ 'beside-zoom': zoomPlace, 'below-title': titleRoom }" :style="modalStyle"
    @pointerdown.self="closeFromBackdrop">
    <div ref="dialogElement" class="box" :class="{ wide }" role="dialog" aria-modal="true" :aria-label="title">
      <div class="box-body">
        <h2>{{ title }}</h2>
        <slot />
      </div>
      <div v-if="$slots.actions" class="box-actions">
        <slot name="actions" />
      </div>
    </div>
    <!-- la carte agrandie, nette, par-dessus le panneau de la colonne de droite (lu une fois : aria-hidden) -->
    <div v-if="zoomPlace" class="modal-zoom" aria-hidden="true"
      :style="{ left: `${zoomPlace.left}px`, top: `${zoomPlace.top}px`, width: `${zoomPlace.width}px`, height: `${zoomPlace.height}px` }">
      <CardPreview />
    </div>
  </div>
</template>
