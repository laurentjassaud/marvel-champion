<script setup>
// La barre du haut (maquette) : le titre dans son bandeau rouge, l'affiche de la partie (« Spider-Man VS
// Rhino »), puis les onglets en biais : poser un pion, taille des cartes, aide, recommencer, nouvelle partie.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import brandShapeUrl from '../assets/table/brand-shape.svg'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()

/** Le petit panneau « Taille des cartes » est ouvert, sous son onglet. */
const isSizePanelOpen = ref(false)
/** L'onglet « Taille » et son panneau : un appui ailleurs le ferme. */
const sizeElement = ref(null)
const sizeTabElement = ref(null)

function closeSizePanelFromOutside(event) {
  if (isSizePanelOpen.value && !sizeElement.value?.contains(event.target)) isSizePanelOpen.value = false
}
// Échap ferme le panneau et rend le focus à son onglet (useKeyboard ferme, lui, les menus et les fenêtres)
function closeSizePanelOnEscape(event) {
  if (event.key !== 'Escape' || !isSizePanelOpen.value) return
  isSizePanelOpen.value = false
  sizeTabElement.value?.focus()
}
onMounted(() => {
  document.addEventListener('pointerdown', closeSizePanelFromOutside, true)
  document.addEventListener('keydown', closeSizePanelOnEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeSizePanelFromOutside, true)
  document.removeEventListener('keydown', closeSizePanelOnEscape)
})
</script>

<template>
  <header class="bar">
    <!-- le bandeau rouge de la maquette déborde sous la barre -->
    <div class="brand">
      <img class="brand-shape" :src="brandShapeUrl" alt="" width="335.384" height="70" draggable="false">
      <span class="brand-title">Marvel Champions</span>
    </div>
    <p v-if="gameStore.matchup" class="matchup" :title="gameStore.subtitle">
      {{ gameStore.matchup.hero }} <span class="vs">vs</span> {{ gameStore.matchup.villain }}<span v-if="gameStore.matchup.expert" class="expert"> · expert</span>
    </p>
    <div class="sp" />
    <nav class="tabs" aria-label="Partie">
      <button type="button" class="slant tab" title="Poser un pion sur la table" @click="gameStore.addPawn()">Pions</button>
      <div ref="sizeElement" class="size">
        <button
          ref="sizeTabElement"
          type="button"
          class="slant tab"
          :class="{ on: isSizePanelOpen }"
          :aria-expanded="isSizePanelOpen"
          aria-controls="size-panel"
          title="Taille des cartes sur la table"
          @click="isSizePanelOpen = !isSizePanelOpen"
        >
          Taille
        </button>
        <div v-if="isSizePanelOpen" id="size-panel" class="size-panel">
          <label for="card-size">Taille des cartes</label>
          <input id="card-size" v-model.number="ui.cardWidth" type="range" min="56" max="130">
        </div>
      </div>
      <button type="button" class="slant tab" title="Raccourcis clavier (?)" aria-label="Raccourcis clavier" @click="ui.openModal('help')">?</button>
      <button type="button" class="slant tab" :disabled="!gameStore.isReady" title="Même héros, même deck, même scénario, depuis le début" @click="ui.openModal('restart')">Recommencer</button>
      <button type="button" class="slant tab red" @click="ui.openModal('setup')">Nouvelle partie</button>
    </nav>
  </header>
</template>

<style scoped>
.bar {
  display: flex; align-items: flex-start; height: 48px; min-width: 0;
  background: linear-gradient(90deg, rgb(19 21 39 / .6), rgb(69 76 141 / .6));
}
/* le bandeau rouge : 329 × 68 px, à cheval sur le bord gauche (maquette) */
.brand { position: relative; flex: none; width: 302px; height: 68px; }
.brand-shape { position: absolute; left: -27.38px; top: -1px; width: 335.384px; height: 70px; max-width: none; pointer-events: none; }
.brand-title {
  position: absolute; left: 0; top: 0; width: 272px; height: 68px; display: grid; place-items: center;
  font: italic 700 36px/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #fff; white-space: nowrap;
}
.matchup {
  margin: 0 0 0 28px; align-self: center; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font: italic 700 24px/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
}
.vs { color: var(--yellow); }
.expert { color: var(--muted); }
/* les onglets : 55 px de haut (7 px de liseré sous la barre), en biais, posés bord à bord */
.tabs { display: flex; flex: none; margin-right: 20px; }
.tab { --h: 55px; --lip-h: 7px; --cut: 24.25px; padding-inline: 37px; font-size: 24px; }
.tabs > * + * { margin-left: -23px; }
.tab.on { --fill: #6a82ad; }
.size { position: relative; display: flex; }
/* le réglage de la taille, sous son onglet ; il s'ouvre depuis lui */
.size-panel {
  position: absolute; top: 62px; right: 18px; z-index: 10; width: 250px; display: grid; gap: 8px; padding: 12px 14px;
  background: var(--panel); border: 1px solid var(--line); border-radius: 4px; box-shadow: 0 18px 40px -8px rgb(6 7 20 / .7);
  transform-origin: top right; transition: opacity 150ms var(--ease-out), transform 150ms var(--ease-out);
}
@starting-style {
  .size-panel { opacity: 0; transform: translateY(-4px) scale(.97); }
}
.size-panel label { color: var(--muted); }
.size-panel input { width: 100%; accent-color: var(--yellow); }
/* écran moins large : l'affiche s'efface, puis le titre et les onglets se resserrent */
@media (max-width: 1240px) {
  .matchup { display: none; }
}
@media (max-width: 900px) {
  .brand { width: 238px; }
  .brand-shape { transform: scale(.79); transform-origin: 0 0; }
  .brand-title { width: 215px; height: 54px; font-size: 28px; }
  .tab { --h: 50px; --lip-h: 6px; --cut: 22px; padding-inline: 30px; font-size: 20px; }
  .tabs { margin-right: 8px; }
  .tabs > * + * { margin-left: -21px; }
}
/* téléphones : les onglets passent sous le titre, sur deux rangées s'il le faut */
@media (max-width: 700px) {
  .bar { flex-wrap: wrap; height: auto; row-gap: 4px; }
  .tabs { width: 100%; flex-wrap: wrap; justify-content: center; row-gap: 6px; margin: 0 0 6px; }
  .tab { --h: 44px; --lip-h: 5px; --cut: 19px; padding-inline: 26px; font-size: 20px; }
  .tabs > * + * { margin-left: -17px; }
}
@media (prefers-reduced-motion: reduce) {
  .size-panel { transition: opacity 150ms ease; }
}
</style>
