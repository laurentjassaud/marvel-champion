<script setup>
import { ref, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard from '../GameCard.vue'
import { handSize } from '../../game/engine.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()
const hand = computed(() => game.zone('hand'))
const size = computed(() => handSize(game.s))
const picked = ref([])

const toggle = id => {
  picked.value = picked.value.includes(id) ? picked.value.filter(x => x !== id) : [...picked.value, id]
}
const action = computed(() => {
  const n = picked.value.length
  return n ? `Défausser ${n} carte${n > 1 ? 's' : ''} et repiocher` : 'Garder cette main'
})
function confirm() {
  game.mulligan(picked.value)
  ui.closeModal()
}
</script>

<template>
  <BaseModal title="Mulligan">
    <p>Pendant la mise en place, après la main de départ : défaussez autant de cartes que vous voulez, puis repiochez jusqu'à votre taille de main ({{ size }}). Les cartes défaussées vont dans votre défausse, elles ne retournent pas dans le paquet. Une seule fois par partie.</p>
    <p v-if="game.s.mull" class="err">Vous avez déjà fait un mulligan dans cette partie.</p>
    <p class="note">Cliquez sur les cartes à défausser.</p>
    <div class="grid-cards">
      <GameCard
        v-for="c in hand"
        :key="c.id"
        :card="c"
        :face="true"
        inert
        :class="{ pick: picked.includes(c.id) }"
        :aria-pressed="picked.includes(c.id)"
        @click="toggle(c.id)"
        @mouseenter="ui.showPreview(c.id)"
      />
      <p v-if="!hand.length">Main vide.</p>
    </div>
    <div class="row">
      <button type="button" class="btn primary" @click="confirm">{{ action }}</button>
      <span class="sp" />
      <button type="button" class="btn" @click="ui.closeModal()">Annuler</button>
    </div>
  </BaseModal>
</template>
