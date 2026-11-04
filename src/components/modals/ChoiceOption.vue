<script setup>
// A radio button styled as a selectable tile.
const model = defineModel({ type: String })
defineProps({
  name: { type: String, required: true },
  value: { type: String, required: true },
  label: { type: String, required: true },
  sub: { type: String, default: '' },
  image: { type: String, default: '' }
})
</script>

<template>
  <label class="choice">
    <input v-model="model" type="radio" :name="name" :value="value">
    <span class="tile" :class="{ withImage: image }">
      <img v-if="image" :src="image" alt="">
      <span class="txt">{{ label }}<small v-if="sub">{{ sub }}</small></span>
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
