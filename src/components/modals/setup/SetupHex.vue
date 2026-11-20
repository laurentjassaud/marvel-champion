<script setup>
// Une étape de la fenêtre « Préparation de la partie » (maquette Figma, 2e version) : une place de 137,94 ×
// 121,5 px entre deux crochets. Vide, les crochets sont lavande et deux flèches désignent la place à remplir ;
// remplie, ils se resserrent, en violet, autour du portrait du choix (66 px, son ombre dessous), qui entre en
// se posant. L'étape en cours luit doucement. Un appui revient à son étape.
import { computed } from 'vue'
import { cropStyle } from './portraits.js'
import hexEmptyUrl from '../../../assets/setup/hex-empty.svg'
import hexDoneUrl from '../../../assets/setup/hex-done.svg'
import shadowUrl from '../../../assets/setup/portrait-shadow.svg'

const props = defineProps({
  /** Nom de l'étape (« Héros »), pour les lecteurs d'écran. */
  name: { type: String, required: true },
  /** Ce qui a été choisi (« Spider-Man »), vide tant que rien ne l'est. */
  value: { type: String, default: '' },
  /** L'étape est faite : la place est remplie. */
  done: Boolean,
  /** Étape en cours : les crochets luisent. */
  active: Boolean,
  /** Portrait du choix et son cadrage ([gauche, haut, côté], portraits.js). */
  imageUrl: { type: String, default: '' },
  crop: { type: Array, default: () => [0, 0, 1] },
  /** Choix « au hasard » : « Hasard » à la place du portrait. */
  random: Boolean
})
defineEmits(['select'])

/** Ce que montre la place ; sa clé change à chaque nouveau choix, qui entre alors en se posant. */
const content = computed(() => {
  if (!props.done) return { kind: 'empty', key: 'empty' }
  if (props.random) return { kind: 'random', key: 'random' }
  if (props.imageUrl) return { kind: 'portrait', key: props.imageUrl }
  return { kind: 'none', key: 'none' }
})
/** Les crochets, dessinés en masque (leur couleur suit l'état) ; entre guillemets : une image intégrée, data:, en contient. */
const EMPTY_MASK = `url("${hexEmptyUrl}")`
const DONE_MASK = `url("${hexDoneUrl}")`
</script>

<template>
  <button type="button" class="hex" :class="{ active, done }" :aria-current="active ? 'step' : undefined"
    :aria-label="`${name} : ${value || 'à choisir'}`" @click="$emit('select')">
    <span class="brackets empty" :style="{ '--mask': EMPTY_MASK }" aria-hidden="true" />
    <span class="brackets filled" :style="{ '--mask': DONE_MASK }" aria-hidden="true" />
    <img class="shadow" :src="shadowUrl" width="60" height="15" alt="" draggable="false">
    <span class="content" aria-hidden="true">
      <Transition name="fill">
        <span v-if="content.kind === 'portrait'" :key="content.key" class="portrait">
          <img :src="imageUrl" :style="cropStyle(crop)" alt="" draggable="false">
        </span>
        <span v-else-if="content.kind === 'random'" key="random" class="portrait special">Hasard</span>
        <span v-else-if="content.kind === 'none'" key="none" class="portrait special">–</span>
      </Transition>
    </span>
  </button>
</template>

<style scoped>
/* la place : 137,94 × 121,5 px de la maquette */
.hex {
  position: relative; flex: none; display: block;
  width: calc(137.941 * var(--su)); height: calc(121.5 * var(--su));
  padding: 0; border: 0; background: none; color: inherit;
  transition: transform 160ms var(--ease-out), filter 150ms ease;
}
.hex:active { transform: scale(.97); }

/* les crochets : vides, toute la largeur (flèches comprises), en lavande ; remplis, 98 px au milieu, en violet.
   Ils passent de l'un à l'autre en fondu, en se resserrant */
.brackets {
  position: absolute; top: 0; height: 100%; left: 50%; translate: -50% 0; pointer-events: none;
  -webkit-mask: var(--mask) center / 100% 100% no-repeat; mask: var(--mask) center / 100% 100% no-repeat;
  transition: opacity 200ms ease, transform 260ms var(--ease-out);
}
.brackets.empty { width: 100%; background: #c2c3fd; }
.brackets.filled { width: calc(98 * var(--su)); background: #6567c6; opacity: 0; transform: scaleX(1.3); }
.done .brackets.empty { opacity: 0; transform: scaleX(.8); }
.done .brackets.filled { opacity: 1; transform: none; }
/* l'étape en cours : les crochets luisent, et les remplis s'éclaircissent */
.active .brackets { filter: drop-shadow(0 0 calc(5 * var(--su)) rgb(194 195 253 / .55)); }
.active .brackets.filled { background: #8f91ea; }

/* le portrait : 66 px, au milieu, 28 px sous le haut ; son ombre dessous (60 × 15 px) */
.content { position: absolute; left: 50%; top: calc(28 * var(--su)); translate: -50% 0; display: grid; }
.content > * { grid-area: 1 / 1; }
.shadow {
  position: absolute; left: 50%; top: calc(94 * var(--su)); translate: -50% 0; max-width: none; pointer-events: none;
  width: calc(60 * var(--su)); height: calc(15 * var(--su));
  opacity: 0; transition: opacity 200ms ease;
}
.done .shadow { opacity: 1; }
.portrait {
  position: relative; display: grid; place-items: center; overflow: hidden;
  width: calc(66 * var(--su)); height: calc(66 * var(--su));
  border: 1px solid #34426c; border-radius: 8px; background: #202651;
  box-shadow: 0 0 0 2px rgb(0 0 0 / .45);
}
.portrait img { position: absolute; max-width: none; }
/* le hasard, ou « aucun » (Les Démolisseurs, sans set modulaire) : le carré violet des cases spéciales */
.portrait.special {
  background: #3f4079; box-shadow: 0 0 0 2px rgb(0 0 0 / .45), inset -2px -2px 4px rgb(0 0 0 / .15);
  font: italic 500 max(12px, calc(15 * var(--su)))/1 var(--font-display); text-transform: uppercase; color: #fff;
  text-shadow: 0 0 8px rgb(0 0 0 / .85);
}

/* un nouveau choix se pose : il arrive un peu grand et transparent ; l'ancien s'efface vite */
.fill-enter-active { transition: opacity 220ms var(--ease-out), transform 320ms var(--ease-out); }
.fill-leave-active { transition: opacity 140ms ease, transform 140ms ease; }
.fill-enter-from { opacity: 0; transform: scale(1.18); }
.fill-leave-to { opacity: 0; transform: scale(.9); }

@media (hover: hover) and (pointer: fine) {
  .hex:hover { filter: brightness(1.18); }
}
/* le contour de focus suit les crochets (un cadre carré jurerait) : ils se cernent de jaune */
.hex:focus-visible { outline: none; }
.hex:focus-visible .brackets { filter: drop-shadow(0 0 1.5px var(--yellow)) drop-shadow(0 0 1.5px var(--yellow)); }

@media (prefers-reduced-motion: reduce) {
  .brackets, .fill-enter-from, .fill-leave-to { transform: none; }
  .brackets.filled, .done .brackets.empty { transform: none; }
}
</style>
