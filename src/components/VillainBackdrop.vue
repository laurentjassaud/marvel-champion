<script setup>
// Le décor du méchant, à gauche de la table (maquette) : une grande forme en biais et, par-dessus,
// l'illustration du méchant quand il en a une (Rhino). Il passe derrière les cartes et ne capte aucun
// pointeur. Le moteur pose le méchant et sa rangée à côté de l'illustration plutôt que dessus : la place
// qu'elle prend est calculée par ui.layout, avec les mêmes mesures que ci-dessous.
import { computed } from 'vue'
import villainShapeUrl from '../assets/table/villain-shape.svg'
import { villainArtUrl } from '../composables/useAssets.js'
import { useGameStore } from '../stores/game.js'

const gameStore = useGameStore()
const artUrl = computed(() => villainArtUrl(gameStore.game?.setup?.scenario))
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <img class="shape" :src="villainShapeUrl" alt="" width="1147.25" height="984.5" draggable="false">
    <!-- une autre illustration (nouvelle partie) refait son entrée -->
    <img v-if="artUrl" :key="artUrl" class="art" :src="artUrl" alt="" width="694" height="923" draggable="false">
  </div>
</template>

<style scoped>
/* sous la barre, contre le bord gauche ; tout est en pixels de la maquette (--u), à l'échelle de l'écran */
.backdrop { position: absolute; z-index: 0; left: env(safe-area-inset-left, 0px); top: calc(48px + env(safe-area-inset-top, 0px)); pointer-events: none; }
.shape { position: absolute; left: calc(-683 * var(--u)); top: calc(21 * var(--u)); width: calc(1147.25 * var(--u)); height: calc(984.5 * var(--u)); max-width: none; }
.art { position: absolute; left: 0; top: 0; width: calc(694 * var(--u)); height: calc(923 * var(--u)); max-width: none; }
/* arrivée du méchant (une fois par partie) : il entre par la gauche, la forme apparaît derrière lui */
.shape { animation: backdrop-fade 500ms var(--ease-out) both; }
.art { animation: art-enter 700ms var(--ease-drawer) 80ms both; }
@keyframes backdrop-fade {
  from { opacity: 0; }
}
@keyframes art-enter {
  from { opacity: 0; transform: translateX(-6%); }
}
/* téléphones : la table est trop petite pour le décor */
@media (max-width: 700px) {
  .backdrop { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .art { animation-name: backdrop-fade; }
}
</style>
