<script setup>
import { computed } from 'vue'
import GameCard from './GameCard.vue'
import { useGameStore } from '../stores/game.js'

const game = useGameStore()
const cards = computed(() => game.zone('hand'))
</script>

<template>
  <div class="drop hand p" data-zone="hand">
    <div class="zone-label">Main <span v-if="cards.length">· {{ cards.length }}</span></div>
    <div class="hand-row">
      <GameCard v-for="c in cards" :key="c.id" :card="c" :face="true" />
      <span v-if="!cards.length" class="hand-empty">Main vide. <span class="on-mouse">Pioche avec D.</span><span class="on-touch">Touche le paquet pour piocher.</span></span>
    </div>
  </div>
</template>
