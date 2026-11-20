<script setup>
// Une case de la grille de la fenêtre « Préparation de la partie » (maquette Figma, 2e version) : 88 × 88 px,
// fond sombre, filet discret et coins marqués de traits de 20 px ; dedans, le portrait (78 px, coins de 8 px,
// cerné de noir). Choisie, ses coins et son filet passent au lavande. Une case spéciale (« Au hasard ») montre
// son nom sur un carré violet, comme la case « Random » de la maquette ; le slot peut y ajouter un signe
// au-dessus du nom. Une case vide (filler) complète la rangée, comme sur la maquette.
// Le nom et le détail ne s'affichent pas dans la case : la fenêtre les montre au pied quand on la survole ou
// qu'elle a le focus ; ils sont dans l'aria-label pour les lecteurs d'écran.
import { cropStyle } from './portraits.js'

defineProps({
  /** Nom du choix (« Spider-Man »), écrit dans une case spéciale. */
  label: { type: String, default: '' },
  /** Seconde ligne (aspect d'un héros, niveau d'un scénario, « Deck importé »). */
  detail: { type: String, default: '' },
  /** Portrait et son cadrage ([gauche, haut, côté], portraits.js). */
  imageUrl: { type: String, default: '' },
  crop: { type: Array, default: () => [0, 0, 1] },
  /** La case est le choix fait. */
  selected: Boolean,
  /** Choix conseillé (set modulaire du méchant) : une petite pastille jaune. */
  advised: Boolean,
  /** Case spéciale : une action plutôt qu'un portrait (tirer au hasard). */
  special: Boolean,
  /** Case vide, qui complète la grille : ni bouton, ni contenu. */
  filler: Boolean
})
defineEmits(['pick'])
</script>

<template>
  <span v-if="filler" class="choice filler" aria-hidden="true" />
  <button v-else type="button" class="choice" :class="{ selected, special }" :aria-pressed="selected"
    :aria-label="[label, detail, advised ? 'conseillé' : ''].filter(Boolean).join(', ')" @click="$emit('pick')">
    <span class="thumb">
      <span v-if="special" class="special-label" aria-hidden="true"><slot />{{ label }}</span>
      <img v-else-if="imageUrl" :src="imageUrl" :style="cropStyle(crop)" alt="" draggable="false">
    </span>
    <span v-if="advised" class="advised" aria-hidden="true">★</span>
  </button>
</template>

<style scoped>
/* la case ; ses quatre coins : deux traits de 20 px chacun, par-dessus le filet (--corner) */
.choice {
  --corner: #3f4079; --c: calc(20 * var(--su));
  position: relative; display: grid; place-items: center;
  width: calc(88 * var(--su)); height: calc(88 * var(--su)); padding: 0;
  border: 1px solid rgb(52 66 108 / .5); background: rgb(13 16 37 / .5); color: inherit;
  transition: border-color 150ms ease;
}
.choice::before {
  content: ''; position: absolute; inset: -1px; pointer-events: none;
  background:
    linear-gradient(var(--corner), var(--corner)) left top / var(--c) 1px no-repeat,
    linear-gradient(var(--corner), var(--corner)) left top / 1px var(--c) no-repeat,
    linear-gradient(var(--corner), var(--corner)) right top / var(--c) 1px no-repeat,
    linear-gradient(var(--corner), var(--corner)) right top / 1px var(--c) no-repeat,
    linear-gradient(var(--corner), var(--corner)) left bottom / var(--c) 1px no-repeat,
    linear-gradient(var(--corner), var(--corner)) left bottom / 1px var(--c) no-repeat,
    linear-gradient(var(--corner), var(--corner)) right bottom / var(--c) 1px no-repeat,
    linear-gradient(var(--corner), var(--corner)) right bottom / 1px var(--c) no-repeat;
}

/* le portrait : 78 px, 5 px du bord de la case */
.thumb {
  position: relative; display: grid; place-items: center; overflow: hidden;
  width: calc(78 * var(--su)); height: calc(78 * var(--su));
  border: 1px solid #34426c; border-radius: 8px; background: #202651;
  box-shadow: 0 0 0 2px rgb(0 0 0 / .45);
  transition: transform 160ms var(--ease-out), border-color 150ms ease;
}
.thumb img { position: absolute; max-width: none; transition: filter 150ms ease; }
/* case spéciale : le carré violet, son nom en blanc, ombré */
.special .thumb {
  background: #3f4079;
  box-shadow: 0 0 0 2px rgb(0 0 0 / .45), inset -2px -2px 4px rgb(0 0 0 / .15);
}
.special-label {
  display: grid; justify-items: center; gap: 2px; padding: 0 4px; text-align: center;
  font: italic 500 max(13px, calc(16 * var(--su)))/1.05 var(--font-display); text-transform: uppercase; color: #fff;
  text-shadow: 0 0 8px rgb(0 0 0 / .85);
}

/* choisie : coins, filet et cadre du portrait en lavande */
.choice.selected { --corner: #c2c3fd; border-color: rgb(194 195 253 / .45); }
.selected .thumb { border-color: #c2c3fd; }
.choice:active .thumb { transform: scale(.96); }

/* conseillé : une pastille jaune, à cheval sur le coin haut droit, par-dessus la case voisine (dessinée après) */
.advised {
  position: absolute; z-index: 1; right: calc(-8 * var(--su)); top: calc(-8 * var(--su));
  display: grid; place-items: center; width: calc(22 * var(--su)); height: calc(19 * var(--su));
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  background: var(--yellow); color: var(--brass-ink); font-size: calc(12 * var(--su)); line-height: 1;
}

@media (hover: hover) and (pointer: fine) {
  .choice:not(.filler):hover { --corner: #6567c6; }
  .choice.selected:hover { --corner: #c2c3fd; }
  .choice:hover .thumb img { filter: brightness(1.12); }
}
.choice:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
</style>
