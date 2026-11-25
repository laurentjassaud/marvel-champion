<script setup>
// Une pile (paquet, défausse, deck Rencontre, De côté…) : son nom, sa carte du dessus et le nombre de
// cartes. Un clic hors de la carte du dessus déclenche l'action de la pile (useZoneActions).
import { computed } from 'vue'
import GameCard from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useZoneActions } from '../composables/useZoneActions.js'

const props = defineProps({
  /** La zone montrée (data.js : ZONE_LABELS). */
  zone: { type: String, required: true },
  /** Le nom affiché au-dessus de la pile. */
  label: { type: String, required: true },
  /** Couleur de la pile : 'p' joueur, 'e' Rencontre, 'i' Invocation. */
  variant: { type: String, default: '' },
  /** Bulle d'aide. */
  title: { type: String, default: '' }
})

const gameStore = useGameStore()
const { activateZone } = useZoneActions()
const cards = computed(() => gameStore.pileOf(props.zone))
const topCard = computed(() => cards.value.at(-1))
// les pioches et « De côté » cachent leur carte du dessus (pas le deck Invocation : sa carte du dessus est visible),
// sauf celle qu'un héros montre (Magik : son paquet ; Faucon : le paquet Rencontre, gameStore.showsTopCardOf)
const showsTopFace = computed(() => gameStore.showsTopCardOf(props.zone)
  || (!['playerDeck', 'encounterDeck', 'scenarioDeck', 'setAside'].includes(props.zone) && !!topCard.value?.faceUp))

function onClick(event) {
  if (!event.target.closest('.card')) activateZone(props.zone)
}
</script>

<template>
  <div class="drop pile" :class="variant" :data-zone="zone" :title="title" @click="onClick">
    <div class="zone-label">{{ label }}</div>
    <div class="slot">
      <div v-if="cards.length > 1" class="stack" />
      <GameCard v-if="topCard" :key="topCard.id" :card="topCard" :show-face="showsTopFace" />
    </div>
    <div class="count">{{ cards.length }}</div>
  </div>
</template>
