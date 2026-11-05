<script setup>
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { MODULARS } from '../../game/data.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()

// "Black Widow (précon Justice) contre Rhino, module Alerte à la Bombe, standard"
const setup = computed(() => {
  const o = game.s.opt
  const modular = MODULARS.find(m => m.id === o.modular)?.name
  const [hero, villain] = game.subtitle.replace(' · expert', '').split(' contre ')
  return `${hero} (${o.label}) contre ${villain}${modular ? `, module ${modular}` : ''}, ${o.expert ? 'expert' : 'standard'}`
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
