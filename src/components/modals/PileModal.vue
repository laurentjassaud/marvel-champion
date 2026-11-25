<script setup>
// La fenêtre d'une pile (paquet, défausse, « De côté », decks Invocation et du scénario) : toutes ses cartes,
// face visible et debout, du dessus vers le dessous. Toutes se regardent de la même façon : un clic
// sélectionne la carte et l'agrandit dans la colonne de droite, visible par-dessus la fenêtre (BaseModal ;
// sur téléphone, au-dessus des cartes), comme dans la main ; le clic droit ou l'appui long ouvre son menu
// par-dessus la fenêtre, qui reste ouverte (la prendre en main, la mettre en jeu…). Fouiller une pioche la
// mélange à la fermeture ; une défausse du joueur ou Rencontre se remélange dans son paquet.
import { computed, onBeforeUnmount } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard, { printedCard } from '../GameCard.vue'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'
import { useCardMenu, DECK_PILES } from '../../composables/useCardMenu.js'
import { DECK_OF_DISCARD } from '../../game/engine.js'

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
  heroSetAside: 'Cartes mises de côté par votre identité',
  heroSetAside2: 'Cartes mises de côté par votre identité',
  invocationDeck: 'Chercher dans le deck Invocation',
  invocationDiscard: 'Défausse Invocation'
}
/** Ce que fait le clic droit, pile par pile ; le reste de l'aide est commun (HELP_START, HELP_END). */
const MENU_HINTS = {
  playerDeck: 'la prendre en main',
  encounterDeck: 'la mettre en jeu',
  playerDiscard: 'la reprendre en main',
  encounterDiscard: 'la remettre en jeu',
  setAside: 'la mettre en jeu (les compteurs se mettent à jour)',
  heroSetAside: 'la poser sur la table',
  heroSetAside2: 'la poser sur la table',
  invocationDeck: 'la poser sur la table',
  invocationDiscard: 'la poser sur la table, la remettre sur le deck',
  scenarioDeck: 'la mettre en jeu'
}
/** Ce que montre la pile, avant le mode d'emploi. */
const HELP_START = {
  playerDeck: 'Du dessus vers le dessous.',
  encounterDeck: 'Du dessus vers le dessous.',
  setAside: 'Étapes suivantes du méchant et de la manigance, set Némésis, cartes mises de côté par le scénario.',
  heroSetAside: "Hors jeu, jusqu'à ce qu'une capacité de votre identité les joue ; « Mettre de côté » (X) les y range.",
  heroSetAside2: "Hors jeu, jusqu'à ce qu'une capacité de votre identité les joue ; « Mettre de côté » (X) les y range.",
  invocationDeck: 'Du dessus vers le dessous.',
  invocationDiscard: 'Invocations déjà lancées.',
  scenarioDeck: 'Du dessus vers le dessous.'
}
const helpText = computed(() => {
  const shuffled = DECK_PILES.includes(props.zone) ? ` ${props.zone === 'playerDeck' || props.zone === 'encounterDeck' ? 'Le paquet' : 'Le deck'} est mélangé à la fermeture.` : ''
  const start = HELP_START[props.zone] ? `${HELP_START[props.zone]} ` : ''
  return `${start}Clic : agrandir la carte. Clic droit ou appui long : ${MENU_HINTS[props.zone] ?? 'ses actions'}, autres choix.${shuffled}`
})

/** Les cartes de la pile, du dessus vers le dessous. */
const cards = computed(() => gameStore.pileOf(props.zone).slice().reverse())
// le deck propre au scénario prend le nom du scénario (Armes Expérimentales, Manigance Annexe) ; la pile du
// héros, celui de son deck quand elle en a un (« Deck Climat » de Tornade)
const title = computed(() => {
  let name = TITLES[props.zone]
  if (props.zone === 'scenarioDeck') name = `Chercher dans le deck ${gameStore.scenarioDeck?.name ?? ''}`
  else {
    const heroPile = gameStore.heroPiles.find(pile => pile.zone === props.zone)
    if (heroPile && heroPile.label !== 'De côté') name = `${heroPile.isDeck ? 'Deck' : 'Pile'} ${heroPile.label}`
  }
  return `${name} · ${cards.value.length}`
})
/** La carte sélectionnée, si elle est dans cette pile : montrée en grand au-dessus des cartes, sur téléphone. */
const selectedCard = computed(() => cards.value.find(card => card.id === ui.selectedCardId) ?? null)

/** Clic sur une carte : elle est sélectionnée et agrandie ; ce qu'on en fait passe par son menu. */
function onCardClick(card) {
  ui.selectCard(card.id)
  ui.showPreview(card.id, true)
  ui.sideTab = 'card' // l'onglet Carte la montre encore une fois la fenêtre fermée
}

/**
 * Clic droit ou appui long sur une carte de la fenêtre : son menu (le sien, même dans une pioche) s'ouvre
 * par-dessus la fenêtre, qui reste ouverte : on y continue après avoir pris ou mis en jeu une carte ; un
 * appui à côté du menu, ou Échap, ne ferme que lui.
 */
function openMenuOf(card, event) {
  openCardMenu(card, event.clientX, event.clientY, { inPileWindow: true })
}

// chercher dans une pioche se termine toujours par un mélange, quelle que soit la façon de fermer la fenêtre
onBeforeUnmount(() => { if (DECK_PILES.includes(props.zone)) gameStore.shuffleAfterSearch(props.zone) })
</script>

<template>
  <BaseModal :title="title" class="with-zoom">
    <p>{{ helpText }}</p>
    <div class="pile-body">
      <!-- toutes les cartes sont debout (main.css), la carte sélectionnée cerclée de jaune -->
      <div class="grid-cards upright">
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
      <div v-if="cards.length" class="zoom" aria-live="polite">
        <GameCard v-if="selectedCard" :key="selectedCard.id" :card="printedCard(selectedCard)" :show-face="true" inert />
        <p v-else class="zoom-empty"><span class="on-mouse">Cliquez</span><span class="on-touch">Touchez</span> une carte pour l'agrandir</p>
      </div>
    </div>
    <template #actions>
      <!-- défausse du joueur ou Rencontre : tout remélanger dans le paquet, après confirmation (ReshuffleModal) -->
      <template v-if="DECK_OF_DISCARD[zone]">
        <button type="button" class="modal-btn" :disabled="!cards.length" @click="ui.openModal('reshuffle', { zone, fromPile: true })">
          Remélanger dans le paquet{{ zone === 'encounterDiscard' ? ' Rencontre' : '' }}…
        </button>
        <span class="sp" />
      </template>
      <button type="button" class="modal-btn primary" @click="ui.closeModal()">Fermer</button>
    </template>
  </BaseModal>
</template>

<style scoped>
/* la carte agrandie d'une pile ne sert que sur téléphone : ailleurs, celle de la colonne de droite reste
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
