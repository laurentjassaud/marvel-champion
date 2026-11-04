<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import GameCard from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()
const el = ref(null)
const cards = computed(() => game.zone('table'))

let ro
function measure() {
  const r = el.value.getBoundingClientRect()
  ui.setTable(r.width, r.height)
}
onMounted(() => {
  measure()
  ro = new ResizeObserver(() => { measure(); game.clamp() })
  ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => ui.cw, () => game.clamp())

function onDown(e) {
  if (!e.target.closest('.card')) ui.select(null)
}
</script>

<template>
  <section ref="el" class="table" data-zone="table" aria-label="Table de jeu" :style="{ '--cw': `${ui.cw}px` }" @pointerdown="onDown">
    <div class="area v">Zone du méchant</div>
    <div class="area h">
      Zone du héros<span class="hint on-mouse"> · glisser, double-clic pour épuiser, clic droit pour le menu, ? pour les raccourcis</span><span class="hint on-touch"> · glisser, double tap pour épuiser, appui long pour le menu</span>
    </div>
    <GameCard v-for="c in cards" :key="c.id" :card="c" positioned />
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
