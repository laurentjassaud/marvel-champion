<script setup>
// La table de jeu : la zone du méchant en haut, celle du héros en bas, et toutes les cartes posées dessus.
// Transparente, elle laisse voir le fond et le décor du méchant (maquette). Sa taille est mesurée en
// continu pour que le moteur place les cartes (ui.layout).
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import GameCard from './GameCard.vue'
import CardCounterSteps from './CardCounterSteps.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const tableElement = ref(null)
const tableCards = computed(() => gameStore.cardsIn('table'))
/** La carte sélectionnée, si elle est sur la table (pas un pion) : ses boutons + et − (CardCounterSteps). */
const selectedTableCard = computed(() => {
  const card = gameStore.cardById(ui.selectedCardId)
  return card?.zone === 'table' && !card.isPawn ? card : null
})

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

/** Un appui sur la table hors d'une carte (et hors des boutons + et − de la carte sélectionnée) retire la sélection. */
function onPointerDown(event) {
  if (!event.target.closest('.card, .card-steps')) ui.selectCard(null)
}
</script>

<template>
  <section
    ref="tableElement"
    class="table"
    :class="{ dealing: ui.isDealing }"
    data-zone="table"
    aria-label="Table de jeu (glisser les cartes, double-clic pour incliner, clic droit ou appui long pour le menu, ? pour les raccourcis)"
    :style="{ '--cw': `${ui.cardWidth}px` }"
    @pointerdown="onPointerDown"
  >
    <GameCard v-for="card in tableCards" :key="card.id" :card="card" positioned />
    <CardCounterSteps v-if="selectedTableCard" :key="selectedTableCard.id" :card="selectedTableCard" />
  </section>
</template>

<style scoped>
/* isolation : les cartes empilées (z-index de plus en plus grands) restent sous la ligne des PV du méchant et la
   menace (VillainHud, z-index 2) ; z-index 1 : elles passent au-dessus du nom du méchant, qui n'en a pas */
.table { position: relative; z-index: 1; isolation: isolate; overflow: hidden; touch-action: none; min-height: 0; }
/* mise en place : les cartes arrivent de leur paquet, hors de la table (useDealAnimation) */
.table.dealing { overflow: visible; }
/* incliner une carte la fait pivoter sur place */
.table > .card { position: absolute; transition: transform 200ms var(--ease-in-out); }
.table > .card.tapped { transform: rotate(90deg); }
@media (max-width: 700px) {
  .table { height: 68vh; min-height: 420px; border-block: 1px solid var(--line); }
}
@media (prefers-reduced-motion: reduce) {
  .table > .card { transition: none; }
}
</style>
