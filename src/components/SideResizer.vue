<script setup>
// Le bord gauche de la colonne de droite : glissé (souris, doigt, stylet) ou déplacé aux flèches, il élargit
// la colonne, et la carte agrandie avec elle. Double-clic : retour à la largeur d'origine.
import { ref } from 'vue'
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
/** Largeur minimale de la colonne (px). */
const MIN_COLUMN_WIDTH = 240
/** Largeur que la table garde toujours (ui.layout lui donne au moins 400) ; main.css applique la même limite. */
const MIN_TABLE_WIDTH = 420
/** Écart entre la table et la colonne. */
const COLUMN_GAP = 10
/** Pas d'une flèche du clavier (px). */
const KEYBOARD_STEP = 20

const resizerElement = ref(null)
const isDragging = ref(false)
/** Largeur annoncée aux lecteurs d'écran. */
const announcedWidth = ref(null)
/** Début du glisser : {pointerX, columnWidth}. */
let dragStart = null

const sideColumn = () => resizerElement.value.closest('.side')
/** Donne cette largeur à la colonne, bornée pour laisser sa place à la table. */
function setColumnWidth(width) {
  const roomLeft = sideColumn().parentElement.getBoundingClientRect().width - MIN_TABLE_WIDTH - COLUMN_GAP
  ui.sideColumnWidth = Math.round(Math.min(Math.max(MIN_COLUMN_WIDTH, roomLeft), Math.max(MIN_COLUMN_WIDTH, width)))
  announcedWidth.value = ui.sideColumnWidth
}

function onPointerDown(event) {
  if (event.button !== 0) return
  event.preventDefault() // pas de sélection de texte pendant le glisser
  dragStart = { pointerX: event.clientX, columnWidth: sideColumn().getBoundingClientRect().width }
  resizerElement.value.setPointerCapture(event.pointerId)
  isDragging.value = true
}
// le bord suit le pointeur : aller vers la gauche élargit la colonne
function onPointerMove(event) {
  if (dragStart) setColumnWidth(dragStart.columnWidth + dragStart.pointerX - event.clientX)
}
function onPointerUp() {
  dragStart = null
  isDragging.value = false
}

function onKeyDown(event) {
  const change = { ArrowLeft: KEYBOARD_STEP, ArrowRight: -KEYBOARD_STEP }[event.key]
  if (!change) return
  event.preventDefault()
  setColumnWidth(sideColumn().getBoundingClientRect().width + change)
}
function resetWidth() {
  ui.sideColumnWidth = null
  announcedWidth.value = null
}
</script>

<template>
  <div ref="resizerElement" class="resizer" :class="{ on: isDragging }" role="separator" aria-orientation="vertical" tabindex="0"
    aria-label="Largeur du panneau latéral" :aria-valuenow="announcedWidth ?? undefined" :aria-valuemin="MIN_COLUMN_WIDTH"
    title="Glisser pour élargir le panneau · double-clic : largeur d'origine"
    @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" @lostpointercapture="onPointerUp"
    @dblclick="resetWidth" @keydown="onKeyDown" />
</template>

<style scoped>
/* dans l'écart entre la table et la colonne de droite, une poignée en son milieu */
.resizer { position: absolute; top: 0; bottom: 0; left: -10px; width: 10px; cursor: col-resize; touch-action: none; z-index: 5; }
.resizer::after { content: ''; position: absolute; left: 3px; top: 50%; width: 4px; height: 44px; transform: translateY(-50%); border-radius: 2px; background: var(--line); transition: background .15s, height .15s; }
.resizer.on::after, .resizer:focus-visible::after { background: var(--brass); height: 72px; }
.resizer:focus-visible { outline: none; }
@media (hover: hover) and (pointer: fine) {
  .resizer:hover::after { background: var(--brass); }
}
/* un doigt a besoin d'une cible plus large : elle déborde un peu sur le bord de la table, où aucune carte ne se pose */
@media (pointer: coarse) {
  .resizer { left: -14px; width: 18px; }
  .resizer::after { left: 7px; height: 56px; }
}
/* téléphones : une seule colonne, rien à redimensionner */
@media (max-width: 700px) {
  .resizer { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .resizer::after { transition: none; }
}
</style>
