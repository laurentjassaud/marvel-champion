<script setup>
// La tirette « Taille », en bas à droite de l'écran (au pied du bandeau du joueur) : la largeur des cartes de
// la table, de 56 à 130 px (ui.cardWidth, gardée d'une visite à l'autre ; la table y replace ses cartes). Une
// petite carte à gauche, une grande à droite ; la partie déjà parcourue de la rainure est violette. Au clavier,
// les flèches la règlent ; un double-clic sur « Taille » revient à la taille de départ.
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
const MIN_WIDTH = 56
const MAX_WIDTH = 130
/** La part de la rainure à gauche du curseur, pour la peindre. */
const progress = computed(() => `${((ui.cardWidth - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)) * 100}%`)
</script>

<template>
  <div class="size-slider">
    <label class="zone-label" for="card-size" title="Double-clic : taille de départ" @dblclick="ui.resetCardWidth()">Taille</label>
    <span class="glyph small" aria-hidden="true" />
    <input id="card-size" v-model.number="ui.cardWidth" type="range" :min="MIN_WIDTH" :max="MAX_WIDTH"
      aria-label="Taille des cartes sur la table" :aria-valuetext="`${ui.cardWidth} pixels de large`"
      title="Taille des cartes sur la table" :style="{ '--progress': progress }">
    <span class="glyph big" aria-hidden="true" />
  </div>
</template>

<style scoped>
.size-slider { display: flex; align-items: center; gap: 10px; }
.zone-label { cursor: default; font-size: 20px; }

/* les deux cartes, au trait : la petite et la grande, au bout de la rainure */
.glyph { flex: none; border: 1.5px solid var(--label); border-radius: 2px; opacity: .8; }
.glyph.small { width: 9px; height: 13px; }
.glyph.big { width: 14px; height: 20px; }

/* la tirette : une rainure de 4 px (violette jusqu'au curseur), un curseur en biais jaune, comme les onglets */
input {
  -webkit-appearance: none; appearance: none;
  width: max(120px, calc(170 * var(--u))); height: 28px; margin: 0; background: none; cursor: pointer;
}
input::-webkit-slider-runnable-track {
  height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, #6567c6 var(--progress), rgb(83 105 146 / .5) var(--progress));
}
input::-moz-range-track { height: 4px; border-radius: 2px; background: rgb(83 105 146 / .5); }
input::-moz-range-progress { height: 4px; border-radius: 2px; background: #6567c6; }
input::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 16px; height: 26px; margin-top: -11px; border: 0; background: var(--yellow);
  clip-path: polygon(7px 0, 100% 0, 9px 100%, 0 100%);
  transition: filter 150ms ease;
}
input::-moz-range-thumb {
  width: 16px; height: 26px; border: 0; border-radius: 0; background: var(--yellow);
  clip-path: polygon(7px 0, 100% 0, 9px 100%, 0 100%);
  transition: filter 150ms ease;
}
@media (hover: hover) and (pointer: fine) {
  input:hover::-webkit-slider-thumb { filter: brightness(1.15); }
  input:hover::-moz-range-thumb { filter: brightness(1.15); }
}
/* au doigt : une zone de prise plus haute */
@media (pointer: coarse) {
  input { height: 40px; }
}
/* le contour de focus serait coupé par le biais : le curseur passe au blanc */
input:focus-visible { outline: none; }
input:focus-visible::-webkit-slider-thumb { background: var(--fg); }
input:focus-visible::-moz-range-thumb { background: var(--fg); }
</style>
