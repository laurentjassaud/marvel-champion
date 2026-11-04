<script setup>
import { computed } from 'vue'
import { useGameStore } from '../stores/game.js'

const props = defineProps({ index: { type: Number, required: true } })
const game = useGameStore()
const k = computed(() => game.s.counters[props.index])
</script>

<template>
  <div class="counter" :style="{ '--cc': k.c }">
    <input
      :id="`counter-${index}`"
      class="lbl"
      :value="k.l"
      aria-label="Nom du compteur"
      @change="game.counterLabel(index, $event.target.value)"
    >
    <button type="button" aria-label="Moins" @click="game.counterAdd(index, -1)">−</button>
    <output>{{ k.v }}</output>
    <button type="button" aria-label="Plus" @click="game.counterAdd(index, 1)">+</button>
  </div>
</template>

<style scoped>
.counter { display: flex; align-items: center; gap: 2px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--cc, var(--line)); border-radius: 6px; padding: 2px 4px; }
.lbl { width: 96px; background: transparent; border: 0; font-family: var(--f-display); font-size: 13px; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); padding: 2px 4px; }
output { font-family: var(--f-mono); min-width: 28px; text-align: center; font-size: 16px; font-variant-numeric: tabular-nums; }
button { background: none; border: 0; width: 24px; height: 24px; border-radius: 4px; font-size: 16px; }
button:active { background: var(--line); }
@media (hover: hover) and (pointer: fine) {
  button:hover { background: var(--line); }
}
/* finger-sized buttons; 16px text so iOS does not zoom into the field */
@media (pointer: coarse) {
  button { width: 32px; height: 36px; font-size: 18px; }
  .lbl { font-size: 16px; width: 84px; letter-spacing: 0; }
}
</style>
