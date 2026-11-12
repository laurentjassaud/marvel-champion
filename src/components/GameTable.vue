<script setup>
// La table de jeu : la zone du méchant en haut, celle du héros en bas, et toutes les cartes posées dessus.
// Transparente, elle laisse voir le fond et le décor du méchant (maquette). Sa taille est mesurée en
// continu pour que le moteur place les cartes (ui.layout).
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import GameCard from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const tableElement = ref(null)
const tableCards = computed(() => gameStore.cardsIn('table'))

let resizeObserver
/** Mesure la table et donne sa taille à l'interface. */
function measureTable() {
  const rect = tableElement.value.getBoundingClientRect()
  ui.setTableSize(rect.width, rect.height)
}
onMounted(() => {
  measureTable()
  // après un redimensionnement, les cartes qui dépassent sont ramenées sur la table
  resizeObserver = new ResizeObserver(() => { measureTable(); gameStore.keepCardsOnTable() })
  resizeObserver.observe(tableElement.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
watch(() => ui.cardWidth, () => gameStore.keepCardsOnTable())

/** Un appui sur la table hors d'une carte retire la sélection. */
function onPointerDown(event) {
  if (!event.target.closest('.card')) ui.selectCard(null)
}
</script>

<template>
  <section
    ref="tableElement"
    class="table"
    data-zone="table"
    aria-label="Table de jeu (glisser les cartes, double-clic pour épuiser, clic droit ou appui long pour le menu, ? pour les raccourcis)"
    :style="{ '--cw': `${ui.cardWidth}px` }"
    @pointerdown="onPointerDown"
  >
    <GameCard v-for="card in tableCards" :key="card.id" :card="card" positioned />
  </section>
</template>

<style scoped>
/* isolation : les cartes empilées (z-index de plus en plus grands) restent sous les PV du méchant (VillainHud) */
.table { position: relative; isolation: isolate; overflow: hidden; touch-action: none; min-height: 0; }
/* épuiser une carte la fait pivoter sur place */
.table > .card { position: absolute; transition: transform 200ms var(--ease-in-out); }
.table > .card.tapped { transform: rotate(90deg); }
@media (max-width: 700px) {
  .table { height: 68vh; min-height: 420px; border-block: 1px solid var(--line); }
}
@media (prefers-reduced-motion: reduce) {
  .table > .card { transition: none; }
}
</style>
