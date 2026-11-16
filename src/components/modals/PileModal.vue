<script setup>
// La fenêtre d'une pile : toutes ses cartes, face visible, du dessus vers le dessous. Dans une pioche ou
// « De côté », un clic agit sur la carte (takeFromPile) ; chercher dans une pioche la mélange à la fermeture.
// Dans une défausse, les cartes sont debout ; un clic sélectionne la carte et l'agrandit dans la colonne de
// droite, visible par-dessus la fenêtre (BaseModal ; sur téléphone, au-dessus des cartes), comme dans la
// main ; le clic droit ou l'appui long ouvre son menu. Une défausse du joueur ou Rencontre se remélange dans
// son paquet.
import { computed, onBeforeUnmount } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard, { printedCard } from '../GameCard.vue'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'
import { useCardMenu, DECK_PILES } from '../../composables/useCardMenu.js'
import { DISCARD_ZONES, DECK_OF_DISCARD } from '../../game/engine.js'

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
  playerDiscard: 'Clic : agrandir la carte. Clic droit ou appui long : la reprendre en main, autres choix.',
  encounterDiscard: 'Clic : agrandir la carte. Clic droit ou appui long : la remettre en jeu, autres choix.',
  setAside: 'Étapes suivantes du méchant et de la manigance, set Némésis, cartes mises de côté par le scénario. Clic : mettre en jeu (les compteurs se mettent à jour).',
  invocationDeck: 'Du dessus vers le dessous. Clic : poser sur la table. Le deck est mélangé à la fermeture.',
  invocationDiscard: 'Invocations déjà lancées. Clic : agrandir la carte. Clic droit ou appui long : la poser sur la table, la remettre sur le deck…',
  scenarioDeck: 'Du dessus vers le dessous. Clic : mettre en jeu. Le deck est mélangé à la fermeture.'
}

/** Les cartes de la pile, du dessus vers le dessous. */
const cards = computed(() => gameStore.pileOf(props.zone).slice().reverse())
// le deck propre au scénario prend le nom du scénario (Armes Expérimentales, Manigance Annexe)
const title = computed(() => {
  const name = props.zone === 'scenarioDeck' ? `Chercher dans le deck ${gameStore.scenarioDeck?.name ?? ''}` : TITLES[props.zone]
  return `${name} · ${cards.value.length}`
})
/** Une défausse : on y regarde les cartes (clic) avant d'en faire quelque chose (menu). */
const isDiscard = computed(() => DISCARD_ZONES.includes(props.zone))
/** La carte sélectionnée, si elle est dans cette défausse : montrée en grand au-dessus des cartes, sur téléphone. */
const selectedCard = computed(() => (isDiscard.value ? cards.value.find(card => card.id === ui.selectedCardId) ?? null : null))

/** Clic sur une carte : dans une défausse, elle est sélectionnée et agrandie ; ailleurs, elle est prise ou mise en jeu. */
function onCardClick(card) {
  if (!isDiscard.value) {
    gameStore.takeFromPile(card.id, props.zone)
    return
  }
  ui.selectCard(card.id)
  ui.showPreview(card.id, true)
  ui.sideTab = 'card' // l'onglet Carte la montre encore une fois la fenêtre fermée
}

/**
 * Clic droit ou appui long sur une carte de la fenêtre : son menu s'ouvre. Dans une défausse, par-dessus la
 * fenêtre, qui reste ouverte (on y continue après avoir repris ou remis en jeu une carte ; un appui à côté
 * du menu ne ferme que lui) ; ailleurs, la fenêtre se ferme d'abord (dans une pioche, c'est le menu de la pile).
 */
function openMenuOf(card, event) {
  if (!isDiscard.value) ui.closeModal()
  openCardMenu(card, event.clientX, event.clientY)
}

// chercher dans une pioche se termine toujours par un mélange, quelle que soit la façon de fermer la fenêtre
onBeforeUnmount(() => { if (DECK_PILES.includes(props.zone)) gameStore.shuffleAfterSearch(props.zone) })
</script>

<template>
  <BaseModal :title="title" :class="{ 'with-zoom': isDiscard }">
    <p>{{ HELP_TEXTS[zone] }}</p>
    <div class="pile-body">
      <!-- dans une défausse, toutes les cartes sont debout (main.css), la carte sélectionnée cerclée de jaune -->
      <div class="grid-cards" :class="{ upright: isDiscard }">
        <GameCard
          v-for="card in cards"
          :key="card.id"
          :card="card"
          :show-face="true"
          :class="{ sel: card === selectedCard }"
          inert
          @click="onCardClick(card)"
          @contextmenu.prevent.stop="openMenuOf(card, $event)"
          @mouseenter="ui.showPreview(card.id, true)"
        />
        <p v-if="!cards.length">Aucune carte.</p>
      </div>
      <!-- sur téléphone, la carte sélectionnée en grand, telle qu'imprimée : la colonne de droite est sous la
           table, hors de l'écran (ailleurs, sa carte agrandie reste visible par-dessus la fenêtre) -->
      <div v-if="isDiscard && cards.length" class="zoom" aria-live="polite">
        <GameCard v-if="selectedCard" :key="selectedCard.id" :card="printedCard(selectedCard)" :show-face="true" inert />
        <p v-else class="zoom-empty"><span class="on-mouse">Cliquez</span><span class="on-touch">Touchez</span> une carte pour l'agrandir</p>
      </div>
    </div>
    <div class="row">
      <button type="button" class="btn primary" @click="ui.closeModal()">Fermer</button>
      <!-- défausse du joueur ou Rencontre : tout remélanger dans le paquet, après confirmation (ReshuffleModal) -->
      <template v-if="DECK_OF_DISCARD[zone]">
        <span class="sp" />
        <button type="button" class="btn" :disabled="!cards.length" @click="ui.openModal('reshuffle', { zone, fromPile: true })">
          Remélanger dans le paquet{{ zone === 'encounterDiscard' ? ' Rencontre' : '' }}…
        </button>
      </template>
    </div>
  </BaseModal>
</template>

<style scoped>
/* la carte agrandie d'une défausse ne sert que sur téléphone : ailleurs, celle de la colonne de droite reste
   visible par-dessus la fenêtre */
.zoom { display: none; }
/* téléphones : la carte agrandie au-dessus des cartes */
@media (max-width: 700px) {
  .with-zoom .pile-body { display: grid; gap: 18px; }
  .zoom { --zoom-w: min(200px, 60vw); display: grid; justify-items: center; order: -1; }
  .zoom :deep(.card) { --w: var(--zoom-w); cursor: default; }
  /* une manigance, couchée et lisible : aussi large qu'une carte debout */
  .zoom :deep(.card.land) { --w: calc(var(--zoom-w) / 1.4); }
  .zoom-empty { width: 100%; display: grid; place-items: center; padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: 6px; font-size: 14px; }
}
</style>
