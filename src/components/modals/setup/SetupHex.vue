<script setup>
// Un hexagone de la fenêtre « Préparation de la partie » (maquette Figma) : vide, il montre un « ? » jaune ;
// rempli, le portrait du choix (ou un dé pour « au hasard »), découpé dans l'hexagone et entré en se posant.
// L'hexagone de l'étape en cours a la lueur intérieure et les deux anneaux de la maquette, qui passent d'un
// hexagone à l'autre en fondu. Un appui revient à son étape.
import { computed } from 'vue'
import DiceIcon from './DiceIcon.vue'
import { cropStyle } from './portraits.js'
import hexUrl from '../../../assets/setup/hex.svg'
import hexActiveUrl from '../../../assets/setup/hex-active.svg'
import ringUrl from '../../../assets/setup/hex-ring.svg'
import ringOuterUrl from '../../../assets/setup/hex-ring-outer.svg'

const props = defineProps({
  /** Nom de l'étape (« Héros »), pour les lecteurs d'écran. */
  name: { type: String, required: true },
  /** Ce qui a été choisi (« Spider-Man »), vide tant que rien ne l'est. */
  value: { type: String, default: '' },
  /** L'étape est faite : l'hexagone est rempli. */
  done: Boolean,
  /** Étape en cours : lueur et anneaux. */
  active: Boolean,
  /** Portrait du choix et son cadrage ([gauche, haut, côté], portraits.js). */
  imageUrl: { type: String, default: '' },
  crop: { type: Array, default: () => [0, 0, 1] },
  /** Choix « au hasard » : un dé à la place du portrait. */
  random: Boolean
})
defineEmits(['select'])

/** Ce que montre l'hexagone ; sa clé change à chaque nouveau choix, qui entre alors en se posant. */
const content = computed(() => {
  if (!props.done) return { kind: 'empty', key: 'empty' }
  if (props.random) return { kind: 'random', key: 'random' }
  if (props.imageUrl) return { kind: 'portrait', key: props.imageUrl }
  return { kind: 'none', key: 'none' }
})
</script>

<template>
  <button type="button" class="hex" :class="{ active, done }" :aria-current="active ? 'step' : undefined"
    :aria-label="`${name} : ${value || 'à choisir'}`" @click="$emit('select')">
    <span class="rings" aria-hidden="true">
      <img class="ring outer" :src="ringOuterUrl" width="129" height="111" alt="" draggable="false">
      <img class="ring inner" :src="ringUrl" width="113" height="97" alt="" draggable="false">
    </span>
    <img class="shape" :src="hexUrl" width="102.78" height="89.01" alt="" draggable="false">
    <img class="shape glow" :src="hexActiveUrl" width="102.78" height="89.01" alt="" draggable="false">
    <span class="content" aria-hidden="true">
      <Transition name="fill">
        <span v-if="content.kind === 'empty'" key="empty" class="mark">?</span>
        <span v-else-if="content.kind === 'random'" key="random" class="mark dice"><DiceIcon /></span>
        <span v-else-if="content.kind === 'portrait'" :key="content.key" class="portrait">
          <img :src="imageUrl" :style="cropStyle(crop)" alt="" draggable="false">
        </span>
        <span v-else key="none" class="mark none">–</span>
      </Transition>
    </span>
  </button>
</template>

<style scoped>
/* 102,78 × 89,01 px de la maquette ; les anneaux (113 × 97 et 129 × 111) centrés dessus, hors du flux */
.hex {
  position: relative; flex: none; display: block;
  width: calc(102.78 * var(--su)); height: calc(89.01 * var(--su));
  padding: 0; border: 0; background: none; color: inherit;
  transition: transform 160ms var(--ease-out), filter 150ms ease;
}
.hex:active { transform: scale(.97); }
.hex img { position: absolute; max-width: none; pointer-events: none; }
.shape { inset: 0; width: 100%; height: 100%; }

/* la lueur intérieure (hex-active.svg) et les anneaux : seulement sur l'hexagone de l'étape en cours. Ils
   apparaissent en se resserrant un peu, en fondu : on voit l'étape passer d'un hexagone au suivant */
.glow { opacity: 0; transition: opacity 200ms ease; }
.active .glow { opacity: 1; }
.rings {
  position: absolute; inset: 0; pointer-events: none;
  opacity: 0; transform: scale(.9);
  transition: opacity 180ms ease, transform 260ms var(--ease-out);
}
.active .rings { opacity: 1; transform: none; }
.ring { left: 50%; top: 50%; translate: -50% -50%; }
.ring.inner { width: calc(113 * var(--su)); height: calc(97 * var(--su)); }
.ring.outer { width: calc(129 * var(--su)); height: calc(111 * var(--su)); }

/* le contenu, découpé dans l'hexagone ; les deux états se superposent le temps du fondu */
.content {
  position: absolute; inset: 0; display: grid; place-items: center;
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
}
.content > * { grid-area: 1 / 1; }
.mark {
  font: italic 700 calc(72 * var(--su))/1 var(--font-display); letter-spacing: -.02em; color: var(--yellow);
  /* la police dessine ses capitales un peu haut : le « ? » redescend au centre, comme sur la maquette */
  translate: 0 calc(3 * var(--su));
}
.mark.dice { width: calc(42 * var(--su)); height: calc(42 * var(--su)); translate: none; }
.mark.dice :deep(svg) { width: 100%; height: 100%; display: block; }
.mark.none { color: var(--steel); }
/* le portrait laisse voir 3 px de l'hexagone sombre tout autour : un liseré, comme un cadre */
.portrait {
  position: relative; width: calc(100% - 6 * var(--su)); aspect-ratio: 1; overflow: hidden;
  clip-path: polygon(25% 7%, 75% 7%, 100% 50%, 75% 93%, 25% 93%, 0 50%);
}
.portrait img { position: absolute; }
/* un léger voile sur les bords : le portrait s'enfonce dans l'hexagone */
.portrait::after {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(closest-side, transparent 62%, rgb(17 23 50 / .55));
}

/* un nouveau choix se pose : il arrive un peu grand et flou, et se met au point ; l'ancien s'efface vite */
.fill-enter-active { transition: opacity 220ms var(--ease-out), transform 320ms var(--ease-out), filter 260ms var(--ease-out); }
.fill-leave-active { transition: opacity 140ms ease, transform 140ms ease; }
.fill-enter-from { opacity: 0; transform: scale(1.18); filter: blur(4px); }
.fill-leave-to { opacity: 0; transform: scale(.9); }

@media (hover: hover) and (pointer: fine) {
  .hex:hover { filter: brightness(1.18); }
}
/* le contour de focus suit l'hexagone (un cadre carré jurerait) : un liseré jaune autour de sa forme */
.hex:focus-visible { outline: none; }
.hex:focus-visible .shape:not(.glow) { filter: drop-shadow(0 0 1.5px var(--yellow)) drop-shadow(0 0 1.5px var(--yellow)); }

@media (prefers-reduced-motion: reduce) {
  .rings, .fill-enter-from, .fill-leave-to { transform: none; }
  .fill-enter-from { filter: none; }
}
</style>
