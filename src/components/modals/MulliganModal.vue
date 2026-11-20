<script setup>
// La fenêtre du mulligan : on clique les cartes de la main de départ à défausser, puis on repioche.
import { ref, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard from '../GameCard.vue'
import { handSize } from '../../game/engine.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const handCards = computed(() => gameStore.cardsIn('hand'))
const targetHandSize = computed(() => handSize(gameStore.game))
/** Identifiants des cartes choisies pour être défaussées. */
const selectedCardIds = ref([])

const toggleCard = cardId => {
  selectedCardIds.value = selectedCardIds.value.includes(cardId)
    ? selectedCardIds.value.filter(selectedId => selectedId !== cardId)
    : [...selectedCardIds.value, cardId]
}
const confirmLabel = computed(() => {
  const count = selectedCardIds.value.length
  return count ? `Défausser ${count} carte${count > 1 ? 's' : ''} et repiocher` : 'Garder cette main'
})
function confirm() {
  gameStore.mulligan(selectedCardIds.value)
  ui.closeModal()
}
</script>

<template>
  <BaseModal title="Mulligan">
    <p>Pendant la mise en place, après la main de départ : défaussez autant de cartes que vous voulez, puis repiochez jusqu'à votre taille de main ({{ targetHandSize }}). Les cartes défaussées vont dans votre défausse, elles ne retournent pas dans le paquet. Une seule fois par partie.</p>
    <p v-if="gameStore.game.mulliganTaken" class="err">Le mulligan n'est plus possible : il a déjà été fait, ou une carte a été mise en jeu ou défaussée.</p>
    <p class="note">Cliquez sur les cartes à défausser.</p>
    <div class="grid-cards">
      <GameCard
        v-for="card in handCards"
        :key="card.id"
        :card="card"
        :show-face="true"
        inert
        :class="{ pick: selectedCardIds.includes(card.id) }"
        :aria-pressed="selectedCardIds.includes(card.id)"
        @click="toggleCard(card.id)"
        @mouseenter="ui.showPreview(card.id)"
      />
      <p v-if="!handCards.length">Main vide.</p>
    </div>
    <template #actions>
      <button type="button" class="modal-btn" @click="ui.closeModal()">Annuler</button>
      <button type="button" class="modal-btn primary" @click="confirm">{{ confirmLabel }}</button>
    </template>
  </BaseModal>
</template>
