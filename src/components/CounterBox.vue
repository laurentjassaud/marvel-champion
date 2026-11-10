<script setup>
// Un compteur du haut de l'écran (PV du héros, PV du méchant, menace) : son nom modifiable, − et +.
import { computed } from 'vue'
import { useGameStore } from '../stores/game.js'

const props = defineProps({
  /** Numéro du compteur : 0 PV du héros, 1 PV du méchant, 2 menace de la manigance principale. */
  index: { type: Number, required: true }
})
const gameStore = useGameStore()
const counter = computed(() => gameStore.game.counters[props.index])
</script>

<template>
  <div class="counter" :style="{ '--cc': counter.color }">
    <!-- le champ prend la largeur de son nom (une copie cachée derrière), dans certaines limites -->
    <span class="name">
      <span class="sizer" aria-hidden="true">{{ counter.label }}</span>
      <input
        :id="`counter-${index}`"
        class="lbl"
        :value="counter.label"
        aria-label="Nom du compteur"
        @change="gameStore.renameCounter(index, $event.target.value)"
      >
    </span>
    <button type="button" aria-label="Moins" @click="gameStore.changeCounter(index, -1)">−</button>
    <output>{{ counter.value }}</output>
    <button type="button" aria-label="Plus" @click="gameStore.changeCounter(index, 1)">+</button>
  </div>
</template>

<style scoped>
.counter { display: flex; align-items: center; gap: 2px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--cc, var(--line)); border-radius: 6px; padding: 2px 4px; }
.name { display: inline-grid; min-width: 96px; max-width: 200px; }
.name > * { grid-area: 1 / 1; font-family: var(--f-display); font-size: 13px; letter-spacing: .05em; text-transform: uppercase; padding: 2px 4px; white-space: pre; }
.sizer { visibility: hidden; overflow: hidden; }
.lbl { width: 100%; min-width: 0; background: transparent; border: 0; color: var(--muted); }
output { font-family: var(--f-mono); min-width: 28px; text-align: center; font-size: 16px; font-variant-numeric: tabular-nums; }
button { background: none; border: 0; width: 24px; height: 24px; border-radius: 4px; font-size: 16px; }
button:active { background: var(--line); }
@media (hover: hover) and (pointer: fine) {
  button:hover { background: var(--line); }
}
/* boutons à la taille d'un doigt ; texte de 16 px pour que iOS ne zoome pas sur le champ */
@media (pointer: coarse) {
  button { width: 32px; height: 36px; font-size: 18px; }
  .name { min-width: 84px; }
  .name > * { font-size: 16px; letter-spacing: 0; }
}
</style>
