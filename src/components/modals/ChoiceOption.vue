<script setup>
// Un bouton radio présenté comme une tuile à choisir, relié par v-model. Si `checked` est donné, c'est le
// parent qui tient l'état et écoute l'événement `pick` ; `multiple` en fait alors une case à cocher.
const selectedValue = defineModel({ type: String })
defineProps({
  /** Nom du groupe de choix (attribut name du bouton). */
  name: { type: String, required: true },
  /** Valeur de ce choix. */
  value: { type: String, required: true },
  /** Texte principal de la tuile. */
  label: { type: String, required: true },
  /** Petite ligne sous le texte (affinité, niveau…). */
  detail: { type: String, default: '' },
  /** Miniature à gauche du texte. */
  imageUrl: { type: String, default: '' },
  /** Case à cocher plutôt que bouton radio (avec `checked`). */
  multiple: Boolean,
  /** État coché tenu par le parent ; null : relié par v-model. */
  checked: { type: Boolean, default: null }
})
defineEmits(['pick'])
</script>

<template>
  <label class="choice">
    <input v-if="checked === null" v-model="selectedValue" type="radio" :name="name" :value="value">
    <input v-else :type="multiple ? 'checkbox' : 'radio'" :name="name" :value="value" :checked="checked" @change="$emit('pick')">
    <span class="tile" :class="{ withImage: imageUrl }">
      <img v-if="imageUrl" :src="imageUrl" alt="">
      <span class="txt">{{ label }}<small v-if="detail">{{ detail }}</small></span>
    </span>
  </label>
</template>

<style scoped>
.choice { position: relative; }
input { position: absolute; opacity: 0; pointer-events: none; }
.tile { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 7px 11px; background: var(--bg); cursor: pointer; min-width: 110px; }
.tile.withImage { padding: 5px 11px 5px 5px; }
.txt { display: flex; flex-direction: column; gap: 2px; }
small { color: var(--muted); font-size: 11.5px; }
img { width: 40px; height: 56px; object-fit: cover; object-position: 50% 20%; border-radius: 4px; }
input:checked + .tile { border-color: var(--brass); box-shadow: inset 0 0 0 1px var(--brass); }
input:focus-visible + .tile { outline: 2px solid var(--brass); outline-offset: 2px; }
</style>
