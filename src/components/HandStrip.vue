<script setup>
// La main du joueur, en éventail au milieu du bandeau du bas (maquette) : ses cartes face visible, posées
// sur un arc lumineux. Les cartes se recouvrent davantage quand elles sont nombreuses (main.css, .hand-row).
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
  </div>
</template>

<style scoped>
.hand { position: relative; }
/* centrés sous la main, à la hauteur de la maquette au-dessus du bas de l'écran ; le bas sort de l'écran */
.glow, .arc { position: absolute; left: 50%; transform: translateX(-50%); max-width: none; pointer-events: none; z-index: 0; }
.glow { bottom: calc((82 - 441) * var(--u)); width: calc(819 * var(--u)); height: calc(441 * var(--u)); }
.arc { bottom: calc((125 - 527) * var(--u)); width: calc(977 * var(--u)); height: calc(527 * var(--u)); }
.hand-row { z-index: 1; }
@media (max-width: 700px) {
  .glow, .arc { display: none; }
}
</style>
