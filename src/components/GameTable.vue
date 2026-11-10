<script setup>
// La table de jeu : la zone du méchant en haut, celle du héros en bas, et toutes les cartes posées dessus.
// Sa taille est mesurée en continu pour que le moteur place les cartes (ui.layout).
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
  <section ref="tableElement" class="table" data-zone="table" aria-label="Table de jeu" :style="{ '--cw': `${ui.cardWidth}px` }" @pointerdown="onPointerDown">
    <div class="area v">Zone du méchant</div>
    <div class="area h">
      Zone du héros<span class="hint on-mouse"> · glisser, double-clic pour épuiser, clic droit pour le menu, ? pour les raccourcis</span><span class="hint on-touch"> · glisser, double tap pour épuiser, appui long pour le menu</span>
    </div>
    <GameCard v-for="card in tableCards" :key="card.id" :card="card" positioned />
  </section>
</template>

<style scoped>
.table {
  position: relative; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); touch-action: none; min-height: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--enc) 9%, transparent), transparent 38%, transparent 62%, color-mix(in srgb, var(--hero) 9%, transparent)),
    repeating-linear-gradient(0deg, transparent 0 39px, var(--table-line) 39px 40px),
    repeating-linear-gradient(90deg, transparent 0 39px, var(--table-line) 39px 40px),
    var(--table);
}
.table > .card { position: absolute; transition: transform .15s; }
.table > .card.tapped { transform: rotate(90deg); }
.area { position: absolute; font-family: var(--f-display); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; pointer-events: none; opacity: .55; }
.area.v { top: 6px; left: 12px; color: var(--enc); }
.area.h { bottom: 6px; right: 12px; color: var(--hero); text-align: right; }
@media (max-width: 700px) {
  .table { height: 68vh; min-height: 420px; }
  .hint { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .table > .card { transition: none; }
}
</style>
