<script setup>
// Le décor de la table (maquette), derrière tout le reste et sans capter le pointeur : une ville de nuit,
// vue d'en bas, assombrie sur le fond indigo ; à gauche, une grande forme en biais et, par-dessus,
// l'illustration du méchant quand il en a une (Rhino). Le moteur pose le méchant et sa rangée à côté de
// l'illustration plutôt que dessus : la place qu'elle prend est calculée par ui.layout, avec les mêmes
// mesures que ci-dessous.
import { computed } from 'vue'
import villainShapeUrl from '../assets/table/villain-shape.svg'
import { villainArtUrl, CITY_BACKGROUND_URL } from '../composables/useAssets.js'
import { useGameStore } from '../stores/game.js'

const gameStore = useGameStore()
const artUrl = computed(() => villainArtUrl(gameStore.game?.setup?.scenario))
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <img class="shape" :src="villainShapeUrl" alt="" width="1147.25" height="984.5" draggable="false">
    <img class="city" :src="CITY_BACKGROUND_URL" alt="" width="1672" height="941" draggable="false">
    <!-- une autre illustration (nouvelle partie) refait son entrée -->
    <img v-if="artUrl" :key="artUrl" class="art" :src="artUrl" alt="" width="694" height="923" draggable="false">
  </div>
</template>

<style scoped>
/* tout l'écran. Pas de z-index : la ville se mélange ainsi au fond indigo de .app (un z-index ferait du décor
   un groupe à part, et le mélange ne verrait plus le fond) ; la barre, la table et le bandeau, qui en ont
   un, passent devant */
.backdrop { position: absolute; inset: 0; pointer-events: none; }
/* la forme et le méchant sous la barre, contre le bord gauche ; en pixels de la maquette (--u), à l'échelle de l'écran */
.shape, .art { position: absolute; max-width: none; --top: calc(48px + env(safe-area-inset-top, 0px)); --left: env(safe-area-inset-left, 0px); }
.shape { left: calc(var(--left) - 683 * var(--u)); top: calc(var(--top) + 21 * var(--u)); width: calc(1147.25 * var(--u)); height: calc(984.5 * var(--u)); }
/* la ville de nuit (maquette : produit, 57 %), sur le fond et la forme, sous le méchant ; elle couvre l'écran quel que soit son format */
.city { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; mix-blend-mode: multiply; opacity: .57; }
/* 13 px à gauche du bord et 1 px sous la barre, comme sur la maquette */
.art { left: calc(var(--left) - 13 * var(--u)); top: calc(var(--top) - 1 * var(--u)); width: calc(694 * var(--u)); height: calc(923 * var(--u)); }
/* arrivée du méchant (une fois par partie) : il entre par la gauche, la forme et la ville apparaissent derrière lui */
.shape, .city { animation: backdrop-fade 500ms var(--ease-out) both; }
.art { animation: art-enter 700ms var(--ease-drawer) 80ms both; }
@keyframes backdrop-fade {
  from { opacity: 0; }
}
@keyframes art-enter {
  from { opacity: 0; transform: translateX(-6%); }
}
/* téléphones : la table est trop petite pour la forme et le méchant ; la ville reste */
@media (max-width: 700px) {
  .shape, .art { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .art { animation-name: backdrop-fade; }
}
</style>
