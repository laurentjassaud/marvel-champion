<script setup>
// La fenêtre du mulligan, première décision de la partie : elle s'ouvre d'elle-même une fois les cartes
// distribuées (App.vue) et attend une réponse (ui.modal.required : ni le fond ni Échap ne la ferment). On clique
// les cartes de la main de départ à défausser, puis on repioche ; ou on garde sa main. La carte que la mise en
// place de l'identité ajoute ensuite à la main (Bouclier de Captain America) ou met en jeu est annoncée. Quand
// cette mise en place laisse le choix (T'Challa : une de ses améliorations Black Panther, en main ; Cable : une
// de ses manigances annexes de joueur, mise en jeu ; Tornade : un soutien de son deck Climat, mis en jeu), la fenêtre passe à ce choix, puis se ferme ; la carte prise
// s'allume un instant, dans la main ou sur la table (ui.flashCard).
import { ref, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard from '../GameCard.vue'
import { handSize, identitySetupOf, cardName, ofName } from '../../game/engine.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const handCards = computed(() => gameStore.cardsIn('hand'))
const targetHandSize = computed(() => handSize(gameStore.game))
/**
 * La mise en place de l'identité qui ajoute une carte à la main, ou la met en jeu : {alterEgoName, label,
 * candidates, fromDiscard, intoPlay}, ou null.
 */
const identitySetup = computed(() => identitySetupOf(gameStore.game))
/** « de Steve Rogers », « d'Anna Marie » : l'alter ego qui fait cette mise en place. */
const ofAlterEgo = computed(() => (identitySetup.value?.alterEgoName ? ` ${ofName(identitySetup.value.alterEgoName)}` : ''))
/** Où elle cherche : « de votre paquet », « de votre paquet ou de votre défausse », « du deck Climat » (Tornade). */
const searchedPiles = computed(() => identitySetup.value?.fromText ?? 'de votre paquet')
/** Ce qui suit le choix : « la carte choisie entre en jeu, puis le paquet est mélangé » (pas de mélange pour Tornade). */
const choiceOutcome = computed(() => {
  const outcome = identitySetup.value?.intoPlay ? 'entre en jeu' : 'rejoint votre main'
  return `la carte choisie ${outcome}${identitySetup.value?.shufflesDeck ? ', puis le paquet est mélangé' : ''}`
})
/** Ce que la mise en place fera après le mulligan : « Ensuite, mise en place de Steve Rogers : … », ou ''. */
const setupCardNote = computed(() => {
  const candidates = identitySetup.value?.candidates ?? []
  if (!candidates.length) return ''
  const intoPlay = identitySetup.value.intoPlay
  const outcome = intoPlay ? 'entrera en jeu' : 'rejoindra votre main'
  const what = candidates.length > 1
    ? `vous choisirez ${identitySetup.value.label} ${searchedPiles.value}, qui ${outcome}`
    : `« ${cardName(candidates[0])} » ${outcome}`
  return `Ensuite, mise en place${ofAlterEgo.value} : ${what}${intoPlay ? '' : ', en plus de ces cartes'}.`
})
/** Étape de la fenêtre : 'mulligan', puis 'setupChoice' si la mise en place de l'identité laisse le choix. */
const step = computed(() => (gameStore.identitySetupChoice ? 'setupChoice' : 'mulligan'))

/** Identifiants des cartes choisies pour être défaussées. */
const selectedCardIds = ref([])
/** La carte choisie pour la mise en place de l'identité. */
const chosenCardId = ref(null)

const toggleCard = cardId => {
  selectedCardIds.value = selectedCardIds.value.includes(cardId)
    ? selectedCardIds.value.filter(selectedId => selectedId !== cardId)
    : [...selectedCardIds.value, cardId]
}
const confirmLabel = computed(() => {
  if (step.value === 'setupChoice') {
    const chosen = gameStore.cardById(chosenCardId.value)
    if (!chosen) return 'Choisissez une carte'
    return `${identitySetup.value?.intoPlay ? 'Mettre en jeu' : 'Prendre'} « ${cardName(chosen)} »`
  }
  const count = selectedCardIds.value.length
  return count ? `Défausser ${count} carte${count > 1 ? 's' : ''} et repiocher` : 'Garder cette main'
})
// après le mulligan, la fenêtre reste ouverte si la mise en place de l'identité attend un choix
function confirm() {
  if (step.value === 'setupChoice') {
    if (!chosenCardId.value) return
    gameStore.chooseIdentitySetupCard(chosenCardId.value)
  } else gameStore.mulligan(selectedCardIds.value)
  if (!gameStore.identitySetupChoice) ui.closeModal()
}
</script>

<template>
  <BaseModal :title="step === 'mulligan' ? 'Mulligan' : `Mise en place${ofAlterEgo}`">
    <template v-if="step === 'mulligan'">
      <p>Votre main de départ : défaussez autant de cartes que vous voulez, puis repiochez jusqu'à votre taille de main ({{ targetHandSize }}). Les cartes défaussées vont dans votre défausse, elles ne retournent pas dans le paquet. Une seule fois par partie.</p>
      <p v-if="setupCardNote">{{ setupCardNote }}</p>
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
    </template>
    <template v-else>
      <p>Choisissez {{ identitySetup?.label }} {{ searchedPiles }} : {{ choiceOutcome }}.</p>
      <p class="note">Cliquez sur la carte {{ identitySetup?.intoPlay ? 'à mettre en jeu' : 'à prendre' }}.</p>
      <div class="grid-cards">
        <GameCard
          v-for="card in identitySetup?.candidates ?? []"
          :key="card.id"
          :card="card"
          :show-face="true"
          inert
          :class="{ chosen: chosenCardId === card.id }"
          :aria-pressed="chosenCardId === card.id"
          @click="chosenCardId = card.id"
          @mouseenter="ui.showPreview(card.id, true)"
        />
      </div>
    </template>
    <template #actions>
      <button type="button" class="modal-btn primary" :disabled="step === 'setupChoice' && !chosenCardId" @click="confirm">{{ confirmLabel }}</button>
    </template>
  </BaseModal>
</template>
