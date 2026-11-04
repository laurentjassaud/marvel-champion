<script setup>
import { computed, onBeforeUnmount } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard from '../GameCard.vue'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'
import { useCardMenu } from '../../composables/useCardMenu.js'

const props = defineProps({ zone: { type: String, required: true } })
const game = useGameStore()
const ui = useUiStore()
const { openCardMenu } = useCardMenu()

const TITLES = { deck: 'Chercher dans le paquet', edeck: 'Chercher dans le paquet Rencontre', discard: 'Défausse', ediscard: 'Défausse Rencontre', aside: 'Cartes mises de côté' }
const HELP = {
  deck: 'Du dessus vers le dessous. Clic : prendre en main. Le paquet est mélangé à la fermeture.',
  edeck: 'Du dessus vers le dessous. Clic : mettre en jeu. Le paquet est mélangé à la fermeture.',
  discard: 'Clic : reprendre en main. Clic droit ou appui long : autres choix.',
  ediscard: 'Clic : remettre en jeu. Clic droit ou appui long : autres choix.',
  aside: 'Étapes suivantes du méchant et de la manigance, set Némésis. Clic : mettre en jeu (les compteurs se mettent à jour).'
}

const cards = computed(() => game.zone(props.zone).slice().reverse())
const title = computed(() => `${TITLES[props.zone]} · ${cards.value.length}`)

function menu(c, e) {
  ui.closeModal()
  openCardMenu(c, e.clientX, e.clientY)
}

// searching a draw pile always ends with a shuffle, however the window is closed
onBeforeUnmount(() => { if (props.zone === 'deck' || props.zone === 'edeck') game.searched(props.zone) })
</script>

<template>
  <BaseModal :title="title">
    <p>{{ HELP[zone] }}</p>
    <div class="grid-cards">
      <GameCard
        v-for="c in cards"
        :key="c.id"
        :card="c"
        :face="true"
        inert
        @click="game.takeFromPile(c.id, zone)"
        @contextmenu.prevent.stop="menu(c, $event)"
        @mouseenter="ui.showPreview(c.id, true)"
      />
      <p v-if="!cards.length">Aucune carte.</p>
    </div>
    <div class="row"><button type="button" class="btn primary" @click="ui.closeModal()">Fermer</button></div>
  </BaseModal>
</template>
