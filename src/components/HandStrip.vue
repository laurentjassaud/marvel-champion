<script setup>
import { computed, watch, nextTick } from 'vue'
import GameCard from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()
const cards = computed(() => game.zone('hand'))

// the card picked at random only stays marked while it is in the hand
watch(cards, list => { if (ui.randomPick && !list.some(c => c.id === ui.randomPick)) ui.randomPick = null })

async function pickRandom() {
  game.randomHandCard()
  await nextTick()
  document.querySelector(`.hand-row .card[data-id="${ui.randomPick}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
</script>

<template>
  <div class="drop hand p" data-zone="hand">
    <div class="head">
      <div class="zone-label">Main <span v-if="cards.length">· {{ cards.length }}</span></div>
      <button
        type="button"
        class="btn small"
        :disabled="!game.canMulligan"
        :title="game.canMulligan ? 'Défausser des cartes de la main de départ et repiocher' : 'Seulement au tour 1, une fois par partie'"
        @click="ui.openModal('mulligan')"
      >
        Mulligan
      </button>
      <button type="button" class="btn small" :disabled="!cards.length" title="Marque en rouge une carte de la main tirée au hasard" @click="pickRandom">Carte au hasard</button>
    </div>
    <div class="hand-row">
      <GameCard v-for="c in cards" :key="c.id" :card="c" :face="true" />
      <span v-if="!cards.length" class="hand-empty">Main vide. <span class="on-mouse">Pioche avec D.</span><span class="on-touch">Touche le paquet pour piocher.</span></span>
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
