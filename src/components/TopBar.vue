<script setup>
// La barre du haut (maquette) : le titre dans son bandeau rouge, l'affiche de la partie (le héros sur un
// bandeau rouge, le logo VS, le méchant en cours sur un bandeau bleu acier, le badge Expert), puis les
// onglets en biais : poser un pion, taille des cartes, aide, recommencer, nouvelle partie.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import brandShapeUrl from '../assets/table/brand-shape.svg'
import vsLogoUrl from '../assets/table/vs-logo.svg'
import expertFrameUrl from '../assets/table/expert-frame.svg'
import expertDotUrl from '../assets/table/expert-dot.svg'
import expertBarUrl from '../assets/table/expert-bar.svg'
import expertHookUrl from '../assets/table/expert-hook.svg'
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
      <span class="plate hero">{{ gameStore.matchup.hero }}</span>
      <img class="vs" :src="vsLogoUrl" alt="contre" width="31.0062" height="25.987" draggable="false">
      <span class="plate villain">{{ gameStore.matchup.villain }}</span>
      <!-- le badge Expert de la maquette : son cadre, son point, son mot, son trait et son crochet -->
      <span v-if="gameStore.matchup.expert" class="expert">
        <img class="expert-frame" :src="expertFrameUrl" alt="" width="88.1245" height="26" draggable="false">
        <img class="expert-dot" :src="expertDotUrl" alt="" width="6" height="6" draggable="false">
        <span class="expert-label">Expert</span>
        <img class="expert-bar" :src="expertBarUrl" alt="" width="56" height="3" draggable="false">
        <img class="expert-hook" :src="expertHookUrl" alt="" width="7.72742" height="7" draggable="false">
      </span>
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
/* l'affiche : elle commence sous le bout du bandeau du titre (son début est transparent) ; mesures de la maquette */
.matchup { position: relative; display: flex; align-items: center; height: 48px; margin: 0 0 0 -32px; min-width: 0; white-space: nowrap; }
/* un bandeau de 40 px en biais derrière chaque nom, en dégradé qui s'efface vers l'extérieur ; ils s'ouvrent en V
   de part et d'autre du VS */
.plate {
  display: flex; align-items: center; height: 40px;
  font: italic 700 28px/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #fff;
}
.plate.hero {
  padding: 0 28px 0 50px;
  background: linear-gradient(to left, #990000, rgb(255 0 0 / 0) 92.79%);
  clip-path: polygon(0 0, calc(100% - 24.25px) 0, 100% 100%, 24.25px 100%);
}
.plate.villain {
  margin-left: 6px; padding: 0 85px 0 30px;
  background: linear-gradient(to right, #324567, rgb(101 103 198 / 0) 92.79%);
  clip-path: polygon(24.25px 0, 100% 0, calc(100% - 24.25px) 100%, 0 100%);
}
.vs { flex: none; width: 31.0062px; height: 25.987px; margin-left: -1px; }
/* le badge Expert, posé sur la fin du bandeau du méchant ; son mot fait 16 px, comme sur la maquette */
.expert { position: relative; top: 2px; flex: none; width: 95.5px; height: 26px; margin-left: -63px; }
.expert > img { position: absolute; max-width: none; }
.expert-frame { left: 3.686px; top: 0; width: 88.1245px; height: 26px; transform: scaleY(-1); }
.expert-dot { left: 20px; top: 8px; width: 6px; height: 6px; }
.expert-bar { left: 35px; top: 23px; width: 56px; height: 3px; }
.expert-hook { left: 84px; top: 17px; width: 7.72742px; height: 7px; }
.expert-label {
  position: absolute; left: 13px; top: -9px; width: 79px; height: 40px; display: grid; place-items: center;
  font: italic 500 16px/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #6567c6;
}
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
/* écran moins large : le badge Expert s'efface, puis l'affiche, puis le titre et les onglets se resserrent */
@media (max-width: 1500px) {
  .expert { display: none; }
}
@media (max-width: 1340px) {
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
