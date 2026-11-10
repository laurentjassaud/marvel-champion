<script setup>
// La main du joueur : ses cartes face visible, le bouton Mulligan et le bouton « Carte au hasard ».
import { computed, watch, nextTick } from 'vue'
import GameCard from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const handCards = computed(() => gameStore.cardsIn('hand'))

// la carte tirée au hasard ne reste marquée que tant qu'elle est dans la main
watch(handCards, cards => {
  if (ui.randomlyPickedCardId && !cards.some(card => card.id === ui.randomlyPickedCardId)) ui.randomlyPickedCardId = null
})

/** Tire une carte de la main au hasard et la fait défiler jusqu'à être visible. */
async function pickRandomCard() {
  gameStore.pickRandomHandCard()
  await nextTick()
  document.querySelector(`.hand-row .card[data-id="${ui.randomlyPickedCardId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
</script>

<template>
  <div class="drop hand p" data-zone="hand">
    <div class="head">
      <div class="zone-label">Main <span v-if="handCards.length">· {{ handCards.length }}</span></div>
      <button
        type="button"
        class="btn small"
        :disabled="!gameStore.canMulligan"
        :title="gameStore.canMulligan ? 'Défausser des cartes de la main de départ et repiocher' : 'Seulement au tour 1, une fois par partie'"
        @click="ui.openModal('mulligan')"
      >
        Mulligan
      </button>
      <button type="button" class="btn small" :disabled="!handCards.length" title="Marque en rouge une carte de la main tirée au hasard" @click="pickRandomCard">Carte au hasard</button>
    </div>
    <div class="hand-row">
      <GameCard v-for="card in handCards" :key="card.id" :card="card" :show-face="true" />
      <span v-if="!handCards.length" class="hand-empty">Main vide. <span class="on-mouse">Pioche avec D.</span><span class="on-touch">Touche le paquet pour piocher.</span></span>
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 8px; }
.head .zone-label { margin: 0 6px 0 0; }
.btn.small { padding: 3px 9px; font-size: 12.5px; }
@media (pointer: coarse) {
  .btn.small { min-height: 32px; padding: 5px 11px; }
}
</style>
