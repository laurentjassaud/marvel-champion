<script setup>
// Le cadre commun des fenêtres (maquette Figma « Préparation de la partie », 2e version) : le fond sombre (un
// appui dessus ferme la fenêtre), puis le panneau, en trois bandes. En haut, l'en-tête, sur les couvertures de
// comics : le titre entre ses petits traits, puis ce que la fenêtre y ajoute (slot header : les hexagones et la
// difficulté de « Nouvelle partie »). Au milieu, le contenu, plus sombre, qui défile. En bas, le pied et ses
// boutons (slot actions : les autres choix à gauche, puis Annuler ou Fermer, puis l'action principale, en jaune,
// à droite). Le milieu de l'en-tête descend un peu dans le contenu, celui du pied y remonte ; une barre rouge
// coiffe le panneau. Le décor et ses mesures sont dans main.css (« fenêtres »).
// La carte agrandie de la colonne de droite reste visible au-dessus du fond, à sa place : le fond assombrit
// et floute toute la page, alors la fenêtre montre la sienne exactement par-dessus le panneau de l'onglet
// Carte (ou Journal), et se centre à sa gauche pour ne jamais la cacher. Sur téléphone, la colonne de droite
// est sous la table, hors de l'écran : rien de tel.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import CardPreview from '../CardPreview.vue'
import topDipUrl from '../../assets/modal/top-dip.svg'
import redBarUrl from '../../assets/modal/red-bar.svg'
import edgeNotchUrl from '../../assets/modal/edge-notch.svg'
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
 * La grande fenêtre (Nouvelle partie) ouverte sur l'accueil : le haut de la place laissée sous le grand logo
 * « Marvel Champions Table » (le bas du logo et 12 px d'écart, en pixels du haut de l'écran), pour qu'elle ne
 * le cache pas ; null ailleurs (les autres fenêtres restent centrées).
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
  const first = dialog?.querySelector('.box-body input:checked, .box-body input') ?? dialog?.querySelector('.box-actions .primary:not(:disabled)')
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
      <!-- le décor du haut : le filet qui plonge sous la barre rouge -->
      <span class="box-topline" aria-hidden="true">
        <img :src="topDipUrl" width="423" height="12" alt="" draggable="false">
      </span>
      <img class="box-redbar" :src="redBarUrl" width="395" height="16" alt="" aria-hidden="true" draggable="false">
      <div class="box-head">
        <h2>{{ title }}</h2>
        <slot name="header" />
        <span class="box-edge" aria-hidden="true">
          <img :src="edgeNotchUrl" width="449.395" height="16" alt="" draggable="false">
        </span>
      </div>
      <div class="box-body">
        <slot />
      </div>
      <div v-if="$slots.actions" class="box-actions">
        <span class="box-edge" aria-hidden="true">
          <img :src="edgeNotchUrl" width="449.395" height="16" alt="" draggable="false">
        </span>
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
