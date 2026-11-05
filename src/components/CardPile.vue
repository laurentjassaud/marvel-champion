<script setup>
import { computed } from 'vue'
import GameCard from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useZoneActions } from '../composables/useZoneActions.js'

const props = defineProps({
  zone: { type: String, required: true },
  label: { type: String, required: true },
  variant: { type: String, default: '' }, // 'p' player | 'e' encounter
  title: { type: String, default: '' }
})

const game = useGameStore()
const { activateZone } = useZoneActions()
const cards = computed(() => game.pile(props.zone))
const top = computed(() => cards.value.at(-1))
// draw piles and the set-aside pile keep their top card hidden (not the Invocation deck: its top card is face up)
const showFace = computed(() => !['deck', 'edeck', 'aside'].includes(props.zone) && !!top.value?.faceUp)

function onClick(e) {
  if (!e.target.closest('.card')) activateZone(props.zone)
}
</script>

<template>
  <div class="drop pile" :class="variant" :data-zone="zone" :title="title" @click="onClick">
    <div class="zone-label">{{ label }}</div>
    <div class="slot">
      <div v-if="cards.length > 1" class="stack" />
      <GameCard v-if="top" :key="top.id" :card="top" :face="showFace" />
    </div>
    <div class="count">{{ cards.length }}</div>
  </div>
</template>
