<script setup>
// La tirette « Taille », en bas à droite de l'écran (au pied du bandeau du joueur) : la largeur des cartes de
// la table, de 56 à 130 px (ui.cardWidth, gardée d'une visite à l'autre ; la table y replace ses cartes).
// Maquette : « − », un rail jaune jusqu'au curseur puis bleu lavande, le curseur en triangle jaune pointé sur
// le rail, « + ». La tirette est un vrai curseur (input range), invisible, posé sur le rail dessiné : la souris,
// le doigt, le clavier (flèches) et les lecteurs d'écran s'en servent comme d'habitude. − et + changent la
// taille d'un cran ; un double-clic sur « Taille » revient à la taille de départ.
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
const MIN_WIDTH = 56
const MAX_WIDTH = 130
/** Un cran de − ou de + (px). */
const STEP = 6
/** La part du rail à gauche du curseur, de 0 à 1 : le rail est jaune jusque-là, le triangle y pointe. */
const progress = computed(() => (ui.cardWidth - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH))
const nudge = delta => { ui.cardWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ui.cardWidth + delta)) }
</script>

<template>
  <div class="size-slider">
    <label class="zone-label" for="card-size" title="Double-clic : taille de départ" @dblclick="ui.resetCardWidth()">Taille</label>
    <!-- − et + : à la souris et au doigt (au clavier, les flèches de la tirette suffisent : hors de la tabulation) -->
    <button type="button" class="step" tabindex="-1" aria-label="Cartes plus petites" title="Cartes plus petites"
      :disabled="ui.cardWidth <= MIN_WIDTH" @click="nudge(-STEP)">−</button>
    <span class="rail" :style="{ '--p': progress }">
      <span class="track" aria-hidden="true" />
      <span class="thumb" aria-hidden="true" />
      <input id="card-size" v-model.number="ui.cardWidth" type="range" :min="MIN_WIDTH" :max="MAX_WIDTH"
        aria-label="Taille des cartes sur la table" :aria-valuetext="`${ui.cardWidth} pixels de large`"
        title="Taille des cartes sur la table">
    </span>
    <button type="button" class="step" tabindex="-1" aria-label="Cartes plus grandes" title="Cartes plus grandes"
      :disabled="ui.cardWidth >= MAX_WIDTH" @click="nudge(STEP)">+</button>
  </div>
</template>

<style scoped>
.size-slider { display: flex; align-items: center; gap: 8px; }
.zone-label { cursor: default; font-size: 20px; margin-right: 2px; }

/* − et + : petits, du bleu lavande du rail */
.step {
  flex: none; width: 16px; height: 32px; padding: 0; border: 0; background: none; cursor: pointer;
  font: 700 17px/1 var(--font-text); color: #7e95ca; transition: color 150ms ease;
}
.step:disabled { opacity: .4; cursor: default; }
@media (hover: hover) and (pointer: fine) {
  .step:hover:not(:disabled) { color: var(--yellow); }
}

/* le rail : 216 px sur la maquette, 40 px de haut pour la prise (le rail dessiné au milieu, le triangle au-dessus).
   --at : le milieu du curseur, comme le place le curseur invisible (son centre va de 6,5 px à la largeur − 6,5 px) */
.rail {
  position: relative; flex: none; width: max(150px, calc(216 * var(--u))); height: 40px;
  --at: calc(6.5px + (100% - 13px) * var(--p));
}
/* 7 px, bouts arrondis : jaune jusqu'au curseur, bleu lavande après */
.track {
  position: absolute; left: 0; right: 0; top: calc(50% - 3.5px); height: 7px; border-radius: 3.5px; pointer-events: none;
  background: linear-gradient(90deg, var(--yellow) var(--at), #7e95ca var(--at));
}
/* le curseur : un triangle jaune de 13 px, pointe en bas, 6 px au-dessus du rail */
.thumb {
  position: absolute; left: calc(var(--at) - 6.5px); top: calc(50% - 3.5px - 6px - 13px); width: 13px; height: 13px;
  background: var(--yellow); clip-path: polygon(0 0, 100% 0, 50% 100%); pointer-events: none;
  transition: filter 150ms ease, background-color 150ms ease;
}
/* le vrai curseur, invisible, sur toute la prise ; son curseur fait 13 px, comme le triangle */
input {
  position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer;
  -webkit-appearance: none; appearance: none; background: none;
}
input::-webkit-slider-runnable-track { height: 100%; }
input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 13px; height: 100%; }
input::-moz-range-track { height: 100%; background: none; }
input::-moz-range-thumb { width: 13px; height: 100%; border: 0; border-radius: 0; background: none; }
@media (hover: hover) and (pointer: fine) {
  .rail:hover .thumb { filter: brightness(1.15); }
}
/* au clavier : le triangle passe au blanc */
.rail:has(input:focus-visible) .thumb { background: var(--fg); }
</style>
