<script>
/** The card as printed, for enlarged views: no rotation, tokens or status cards over the text. */
export const bareCard = c => ({ ...c, tapped: false, dmg: 0, thr: 0, tok: 0, stunned: false, confused: false, tough: false })
</script>

<script setup>
import { computed } from 'vue'
import { def, nameOf } from '../game/engine.js'
import { STATUSES } from '../game/data.js'
import { cardImage, backImage, statusImage } from '../composables/useAssets.js'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const props = defineProps({
  card: { type: Object, required: true },
  /** force face up (true) / down (false); null = follow card.faceUp */
  face: { type: Boolean, default: null },
  /** absolutely placed on the table at card.x / card.y */
  positioned: Boolean,
  /** display only: no data-id, so pointer and keyboard handlers ignore it */
  inert: Boolean
})

const game = useGameStore()
const ui = useUiStore()

const token = computed(() => props.card.kind === 'token')
const showFace = computed(() => props.face ?? props.card.faceUp)
const classes = computed(() => ({
  token: token.value,
  land: !token.value && showFace.value && !!def(props.card).l,
  tapped: props.positioned && props.card.tapped,
  sel: !props.inert && ui.sel === props.card.id,
  rand: !props.inert && ui.randomPick === props.card.id
}))
const style = computed(() => {
  const st = {}
  if (props.positioned) Object.assign(st, { left: `${props.card.x}px`, top: `${props.card.y}px`, zIndex: props.card.z })
  if (token.value) st['--tok'] = props.card.color
  return st
})
// A playable card is driven by pointer events only (usePointer). Its touches must not start a
// browser gesture (tap, long press): when the card leaves the page during that gesture (drawn,
// played, dragged out of the hand), the unfinished gesture swallows the next tap elsewhere.
const onTouchStart = e => { if (!props.inert) e.preventDefault() }
const image = computed(() => cardImage(props.card))
const statuses = computed(() => STATUSES.filter(st => props.card[st.id]))
// several villains (Les Démolisseurs): the one holding the Active token
const active = computed(() => props.positioned && !!game.s?.active && def(props.card).t === 'villain' && def(props.card).s === game.s.active)
const label = computed(() => {
  const name = token.value ? 'Pion' : showFace.value ? nameOf(props.card) : 'Carte face cachée'
  const notes = [...(active.value ? ['actif'] : []), ...statuses.value.map(st => st.label)]
  return notes.length ? `${name} (${notes.join(', ')})` : name
})
</script>

<template>
  <div
    class="card"
    :class="classes"
    :style="style"
    :data-id="inert ? undefined : card.id"
    :tabindex="inert ? -1 : 0"
    :role="inert ? 'img' : 'button'"
    :aria-label="label"
    @touchstart="onTouchStart"
  >
    <template v-if="!token">
      <div v-if="showFace && image" class="face" :style="{ backgroundImage: `url('${image}')` }" />
      <!-- a MarvelCDB card without an image on the site: its name -->
      <div v-else-if="showFace" class="face plain"><span>{{ nameOf(card) }}</span></div>
      <div v-else class="back" :style="{ backgroundImage: `url('${backImage(card)}')` }" />
    </template>
    <div v-if="statuses.length" class="status">
      <img v-for="st in statuses" :key="st.id" :src="statusImage(st.id)" alt="" draggable="false">
    </div>
    <span v-if="card.dmg" class="mk dmg" title="Dégâts">{{ card.dmg }}</span>
    <span v-if="card.thr" class="mk thr" title="Menace">{{ card.thr }}</span>
    <span v-if="card.tok" class="mk tok" title="Jetons">{{ card.tok }}</span>
    <span v-if="active" class="mk act" title="Jeton Actif">Actif</span>
  </div>
</template>
