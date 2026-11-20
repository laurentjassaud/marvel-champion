<script setup>
// La fenêtre « Recommencer la partie » : rappelle la mise en place qui sera rejouée, puis confirme.
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { SCENARIOS, heroName } from '../../game/data.js'
import { setupSummary } from '../../game/engine.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()

// "Black Widow (précon Justice) contre Rhino, module Alerte à la Bombe, standard" ; ce qui a été tiré au
// hasard reste sans nom
const setupDescription = computed(() => {
  const setup = gameStore.game.setup
  const villainName = SCENARIOS.find(scenario => scenario.id === setup.scenario)?.villainName ?? ''
  return `${heroName(setup.hero)} (${setup.deckLabel}) contre ${villainName}${setupSummary(setup)}`
})

function restart() {
  gameStore.restartGame()
  ui.closeModal()
}
</script>

<template>
  <BaseModal title="Recommencer la partie">
    <p>Même mise en place : {{ setupDescription }}. La partie repart du tour 1 avec des paquets remélangés et une nouvelle main.</p>
    <p class="err">La partie en cours sera perdue.</p>
    <template #actions>
      <button type="button" class="modal-btn" @click="ui.closeModal()">Annuler</button>
      <button type="button" class="modal-btn primary" @click="restart">Recommencer</button>
    </template>
  </BaseModal>
</template>
