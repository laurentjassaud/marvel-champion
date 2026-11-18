<script setup>
// Une vignette à choisir de la fenêtre « Préparation de la partie » (maquette Figma : 78 × 78 px, coins de
// 8 px, filet bleu, anneau sombre de 7 px) : le portrait, et son nom dessous. Choisie, son filet et son
// anneau passent au jaune. Le slot remplace le portrait (le « + » du deck personnalisé, le dé du hasard).
import { cropStyle } from './portraits.js'

defineProps({
  /** Nom affiché sous la vignette. */
  label: { type: String, required: true },
  /** Seconde ligne, plus discrète (niveau d'un scénario, « Deck importé »). */
  detail: { type: String, default: '' },
  /** Portrait et son cadrage ([gauche, haut, côté], portraits.js). */
  imageUrl: { type: String, default: '' },
  crop: { type: Array, default: () => [0, 0, 1] },
  /** La vignette est le choix fait. */
  selected: Boolean,
  /** Choix conseillé (set modulaire du méchant) : une petite pastille jaune. */
  advised: Boolean,
  /** Vignette en pointillés : une action plutôt qu'un choix (importer un deck). */
  dashed: Boolean
})
defineEmits(['pick'])
</script>

<template>
  <button type="button" class="choice" :class="{ selected, dashed }" :aria-pressed="dashed ? undefined : selected"
    :aria-label="[label, detail, advised ? 'conseillé' : ''].filter(Boolean).join(', ')" @click="$emit('pick')">
    <span class="frame">
      <span class="thumb">
        <slot>
          <img v-if="imageUrl" :src="imageUrl" :style="cropStyle(crop)" alt="" draggable="false">
        </slot>
      </span>
      <span v-if="advised" class="advised" aria-hidden="true">★</span>
    </span>
    <span class="name" aria-hidden="true">{{ label }}<small v-if="detail">{{ detail }}</small></span>
  </button>
</template>

<style scoped>
.choice {
  display: grid; justify-items: center; align-content: start; gap: calc(16 * var(--su));
  /* assez large pour « Intermédiaire » en 14 px, même quand la fenêtre rapetisse */
  width: max(96px, calc(100 * var(--su))); padding: 0; border: 0; background: none; color: inherit;
}
.frame { position: relative; }
.thumb {
  position: relative; display: grid; place-items: center; overflow: hidden;
  width: calc(78 * var(--su)); height: calc(78 * var(--su));
  border: 1px solid #34426c; border-radius: 8px; background: #202651;
  box-shadow: 0 0 0 7px rgb(0 0 0 / .15);
  color: var(--yellow);
  transition: transform 160ms var(--ease-out), border-color 150ms ease, box-shadow 150ms ease;
}
.thumb img { position: absolute; max-width: none; transition: filter 150ms ease; }
.dashed .thumb { border-style: dashed; border-color: rgb(101 103 198 / .7); background: transparent; }

/* choisie : le filet et l'anneau en jaune */
.selected .thumb { border-color: var(--yellow); box-shadow: 0 0 0 7px rgb(255 193 25 / .22); }
.choice:active .thumb { transform: scale(.97); }

/* conseillé : une pastille jaune, à cheval sur le coin haut droit */
.advised {
  position: absolute; right: calc(-9 * var(--su)); top: calc(-9 * var(--su));
  display: grid; place-items: center; width: calc(24 * var(--su)); height: calc(21 * var(--su));
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  background: var(--yellow); color: var(--brass-ink); font-size: calc(13 * var(--su)); line-height: 1;
}

.name {
  display: grid; gap: 2px; text-align: center; font-size: 14px; line-height: 1.25; color: var(--muted);
  transition: color 150ms ease;
}
.name small { font-size: 14px; color: var(--label); }
.selected .name { color: var(--fg); }

@media (hover: hover) and (pointer: fine) {
  .choice:hover .thumb { border-color: #6567c6; transform: translateY(-2px); }
  .choice.selected:hover .thumb { border-color: var(--yellow); }
  .choice:hover .thumb img { filter: brightness(1.12); }
  .choice:hover .name { color: var(--fg); }
  .choice:active .thumb { transform: translateY(-2px) scale(.97); }
}
.choice:focus-visible { outline: none; }
.choice:focus-visible .thumb { outline: 2px solid var(--fg); outline-offset: 9px; }
</style>
