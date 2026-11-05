<script setup>
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { VILLAINS, heroName } from '../../game/data.js'
import { setupText } from '../../game/engine.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()

// "Black Widow (précon Justice) contre Rhino, module Alerte à la Bombe, standard"; what was drawn at
// random stays unnamed
const setup = computed(() => {
  const o = game.s.opt
  return `${heroName(o.hero)} (${o.label}) contre ${VILLAINS.find(v => v.id === o.villain)?.name ?? ''}${setupText(o)}`
})

function restart() {
  game.restart()
  ui.closeModal()
}
</script>

<template>
  <BaseModal title="Recommencer la partie">
    <p>Même mise en place : {{ setup }}. La partie repart du tour 1 avec des paquets remélangés et une nouvelle main.</p>
    <p class="err">La partie en cours sera perdue.</p>
    <div class="row">
      <button type="button" class="btn primary" @click="restart">Recommencer</button>
      <span class="sp" />
      <button type="button" class="btn" @click="ui.closeModal()">Annuler</button>
    </div>
  </BaseModal>
</template>
