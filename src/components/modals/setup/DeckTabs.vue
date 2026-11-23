<script setup>
// Les sous-onglets du choix du héros (maquette Figma « Préparation de la partie », 3e version) : Préconstruits,
// Mes decks (avec leur nombre) et Charger un deck, en capitales sur la bande sombre qui les porte (posée par
// la fenêtre, SetupModal). Le choisi est jaune, souligné d'un trait de 2 px qui glisse de l'un à l'autre ;
// les autres violets. Au clavier (rôle tablist) : les flèches passent au voisin, Début et Fin aux extrémités.
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  /** Le sous-onglet choisi : 0, 1 ou 2. */
  modelValue: { type: Number, required: true },
  /** Nombre de decks sauvegardés, écrit après « Mes decks ». */
  savedCount: { type: Number, default: 0 }
})
const emit = defineEmits(['update:modelValue'])

/** Les sous-onglets ; `id` nomme aussi leur volet (HeroDecks : deck-panel-<id>). */
const DECK_TABS = [
  { id: 'precon', name: 'Préconstruits' },
  { id: 'mine', name: 'Mes decks' },
  { id: 'load', name: 'Charger un deck' }
]

const rowElement = ref(null)
/** Les boutons des sous-onglets, dans leur ordre (une ref de v-for ne le garantit pas). */
const buttons = []
/** Le trait jaune : sa place et sa largeur sous l'onglet choisi ; sans transition avant sa première place. */
const bar = reactive({ x: 0, width: 0, placed: false })
function placeBar() {
  const button = buttons[props.modelValue]
  if (!button) return
  bar.x = button.offsetLeft
  bar.width = button.offsetWidth
  if (!bar.placed) requestAnimationFrame(() => { bar.placed = true })
}
watch(() => [props.modelValue, props.savedCount], async () => { await nextTick(); placeBar() })
let resizeObserver = null
onMounted(() => {
  placeBar()
  resizeObserver = new ResizeObserver(placeBar)
  resizeObserver.observe(rowElement.value)
  document.fonts?.ready.then(placeBar)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

function onKey(event) {
  const target = { ArrowRight: props.modelValue + 1, ArrowLeft: props.modelValue - 1, Home: 0, End: DECK_TABS.length - 1 }[event.key]
  if (target === undefined) return
  event.preventDefault()
  const next = (target + DECK_TABS.length) % DECK_TABS.length
  emit('update:modelValue', next)
  nextTick(() => buttons[next]?.focus())
}
</script>

<template>
  <div ref="rowElement" class="deck-tabs" role="tablist" aria-label="Decks du héros" @keydown="onKey">
    <button v-for="(tab, index) in DECK_TABS" :id="`deck-tab-${tab.id}`" :key="tab.id" :ref="element => { buttons[index] = element }" type="button" role="tab"
      class="deck-tab" :class="{ active: modelValue === index }" :aria-selected="modelValue === index"
      :aria-controls="`deck-panel-${tab.id}`" :tabindex="modelValue === index ? 0 : -1" @click="emit('update:modelValue', index)">
      {{ tab.name }}<span v-if="tab.id === 'mine' && savedCount" class="count">{{ savedCount }}</span>
    </button>
    <span class="deck-tab-bar" :class="{ placed: bar.placed }" :style="{ '--x': `${bar.x}px`, '--w': bar.width }" aria-hidden="true" />
  </div>
</template>

<style scoped>
/* la rangée, alignée sur la grille (son bord gauche) : les noms en bas de la bande, 8 px au-dessus du trait
   (maquette : 14 px, Barlow Condensed Medium, 44 px entre eux) */
.deck-tabs { position: relative; display: flex; align-items: stretch; gap: calc(44 * var(--su)); height: 100%; }
.deck-tab {
  position: relative;
  display: flex; align-items: flex-end; gap: 5px; padding: 0 calc(8 * var(--su)) calc(8 * var(--su)); border: 0; background: none;
  font: 500 max(13px, calc(14 * var(--su)))/1.2 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
  white-space: nowrap; color: #6567c6; cursor: pointer;
  transition: color 150ms ease;
}
.deck-tab.active { color: var(--yellow); }
.count {
  display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
  background: #303365; color: #c2c3fd; font-size: 11px; letter-spacing: 0;
}
.deck-tab:focus-visible { outline: 2px solid var(--yellow); outline-offset: -2px; }
@media (hover: hover) and (pointer: fine) {
  .deck-tab:not(.active):hover { color: #8f91ea; }
}
/* le trait jaune, à ras du filet de la bande : un trait de 1 px étiré à la largeur de l'onglet (transform
   seulement), qui glisse de l'un à l'autre */
.deck-tab-bar {
  position: absolute; left: 0; bottom: 1px; width: 1px; height: 2px; background: var(--yellow); pointer-events: none;
  transform-origin: 0 0; transform: translateX(var(--x)) scaleX(var(--w));
}
.deck-tab-bar.placed { transition: transform 320ms var(--ease-in-out); }
/* au doigt : une prise d'au moins 44 px de haut, qui déborde au-dessus de la bande sans la grandir */
@media (pointer: coarse) {
  .deck-tab::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: max(100%, 44px); }
}
@media (prefers-reduced-motion: reduce) {
  .deck-tab-bar.placed { transition: none; }
}
</style>
