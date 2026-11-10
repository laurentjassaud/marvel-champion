<script setup>
// La fenêtre d'une pile : toutes ses cartes, face visible, du dessus vers le dessous. Un clic agit sur la
// carte (takeFromPile), un clic droit ouvre son menu. Chercher dans une pioche la mélange à la fermeture.
import { computed, onBeforeUnmount } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard from '../GameCard.vue'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'
import { useCardMenu, DECK_PILES } from '../../composables/useCardMenu.js'

const props = defineProps({
  /** La zone montrée. */
  zone: { type: String, required: true }
})
const gameStore = useGameStore()
const ui = useUiStore()
const { openCardMenu } = useCardMenu()

const TITLES = {
  playerDeck: 'Chercher dans le paquet',
  encounterDeck: 'Chercher dans le paquet Rencontre',
  playerDiscard: 'Défausse',
  encounterDiscard: 'Défausse Rencontre',
  setAside: 'Cartes mises de côté',
  invocationDeck: 'Chercher dans le deck Invocation',
  invocationDiscard: 'Défausse Invocation'
}
const HELP_TEXTS = {
  playerDeck: 'Du dessus vers le dessous. Clic : prendre en main. Le paquet est mélangé à la fermeture.',
  encounterDeck: 'Du dessus vers le dessous. Clic : mettre en jeu. Le paquet est mélangé à la fermeture.',
  playerDiscard: 'Clic : reprendre en main. Clic droit ou appui long : autres choix.',
  encounterDiscard: 'Clic : remettre en jeu. Clic droit ou appui long : autres choix.',
  setAside: 'Étapes suivantes du méchant et de la manigance, set Némésis, cartes mises de côté par le scénario. Clic : mettre en jeu (les compteurs se mettent à jour).',
  invocationDeck: 'Du dessus vers le dessous. Clic : poser sur la table. Le deck est mélangé à la fermeture.',
  invocationDiscard: 'Invocations déjà lancées. Clic : poser sur la table. Clic droit ou appui long : autres choix (sur le deck…).',
  scenarioDeck: 'Du dessus vers le dessous. Clic : mettre en jeu. Le deck est mélangé à la fermeture.'
}

/** Les cartes de la pile, du dessus vers le dessous. */
const cards = computed(() => gameStore.pileOf(props.zone).slice().reverse())
// le deck propre au scénario prend le nom du scénario (Armes Expérimentales, Manigance Annexe)
const title = computed(() => {
  const name = props.zone === 'scenarioDeck' ? `Chercher dans le deck ${gameStore.scenarioDeck?.name ?? ''}` : TITLES[props.zone]
  return `${name} · ${cards.value.length}`
})

/** Clic droit sur une carte de la fenêtre : la fenêtre se ferme, le menu de la carte s'ouvre. */
function openMenuOf(card, event) {
  ui.closeModal()
  openCardMenu(card, event.clientX, event.clientY)
}

// chercher dans une pioche se termine toujours par un mélange, quelle que soit la façon de fermer la fenêtre
onBeforeUnmount(() => { if (DECK_PILES.includes(props.zone)) gameStore.shuffleAfterSearch(props.zone) })
</script>

<template>
  <BaseModal :title="title">
    <p>{{ HELP_TEXTS[zone] }}</p>
    <div class="grid-cards">
      <GameCard
        v-for="card in cards"
        :key="card.id"
        :card="card"
        :show-face="true"
        inert
        @click="gameStore.takeFromPile(card.id, zone)"
        @contextmenu.prevent.stop="openMenuOf(card, $event)"
        @mouseenter="ui.showPreview(card.id, true)"
      />
      <p v-if="!cards.length">Aucune carte.</p>
    </div>
    <div class="row"><button type="button" class="btn primary" @click="ui.closeModal()">Fermer</button></div>
  </BaseModal>
</template>
