<script setup>
// La main du joueur, en éventail au milieu du bandeau du bas (maquette) : ses cartes face visible, posées
// sur un arc lumineux, et dessous leur nombre (« MAIN • 6 »). Les cartes se recouvrent davantage quand
// elles sont nombreuses (main.css, .hand-row).
import { computed, watch } from 'vue'
import GameCard from './GameCard.vue'
import handArcUrl from '../assets/table/hand-arc.svg'
import handGlowUrl from '../assets/table/hand-glow.svg'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const handCards = computed(() => gameStore.cardsIn('hand'))
/** Nombre de cartes, et place du milieu de l'éventail : chaque carte s'incline selon son écart à ce milieu. */
const fanStyle = computed(() => ({ '--n': handCards.value.length, '--mid': (handCards.value.length - 1) / 2 }))

// la carte tirée au hasard ne reste marquée que tant qu'elle est dans la main
watch(handCards, cards => {
  if (ui.randomlyPickedCardId && !cards.some(card => card.id === ui.randomlyPickedCardId)) ui.randomlyPickedCardId = null
})
</script>

<template>
  <div class="drop hand" data-zone="hand" role="group" aria-label="Main">
    <!-- le halo et l'arc de la maquette, sous les cartes -->
    <img class="glow" :src="handGlowUrl" alt="" width="819" height="441" draggable="false">
    <img class="arc" :src="handArcUrl" alt="" width="977" height="527" draggable="false">
    <div class="hand-row" :style="fanStyle">
      <GameCard v-for="(card, index) in handCards" :key="card.id" :card="card" :show-face="true" :style="{ '--i': index }" />
      <span v-if="!handCards.length" class="hand-empty">Main vide. <span class="on-mouse">Pioche avec D.</span><span class="on-touch">Touche le paquet pour piocher.</span></span>
    </div>
    <!-- entre deux petits traits triples, comme sur la maquette -->
    <div class="hand-count"><span class="lines" />Main • {{ handCards.length }}<span class="lines after" /></div>
  </div>
</template>

<style scoped>
.hand { position: relative; }
/* centrés sous la main, à la hauteur de la maquette au-dessus du bas de l'écran (le bas de la main) ; le
   bas sort de l'écran. z-index -1 : au fond du bandeau du joueur (PlayerDock), sous ses piles et ses
   textes qu'ils traversent */
.glow, .arc { position: absolute; left: 50%; transform: translateX(-50%); max-width: none; pointer-events: none; z-index: -1; }
/* seul leur haut se voit, jusqu'au bas de la main : le reste est coupé, comme par le bas de l'écran de la
   maquette (sur une tablette en portrait, la main n'est pas au bas de l'écran) */
.glow { bottom: calc((109 - 441) * var(--u)); width: calc(819 * var(--u)); height: calc(441 * var(--u)); clip-path: inset(0 0 calc((441 - 109) * var(--u)) 0); }
.arc { bottom: calc((152 - 527) * var(--u)); width: calc(977 * var(--u)); height: calc(527 * var(--u)); clip-path: inset(0 0 calc((527 - 152) * var(--u)) 0); }
.hand-row { z-index: 1; padding-bottom: 4px; }
/* « MAIN • 6 » : 16 px comme sur la maquette, à 15 px du bas de l'écran */
.hand-count {
  display: flex; align-items: center; gap: 8px; margin-bottom: max(10px, calc(15 * var(--u)));
  font: italic 700 16px/19px var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #789eca;
}
/* trois traits d'un pixel : celui du milieu plus long, vers l'extérieur ; celui de droite en miroir */
.lines {
  width: 16px; height: 5px;
  background:
    linear-gradient(currentColor, currentColor) right top / 13px 1px no-repeat,
    linear-gradient(currentColor, currentColor) right center / 16px 1px no-repeat,
    linear-gradient(currentColor, currentColor) right bottom / 13px 1px no-repeat;
}
.lines.after { transform: scaleX(-1); }
@media (max-width: 700px) {
  .glow, .arc { display: none; }
}
</style>
