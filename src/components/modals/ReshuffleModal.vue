<script setup>
// La fenêtre « Remélanger dans le paquet » d'une défausse. Elle s'ouvre depuis le menu de la défausse ou le
// bouton de sa fenêtre, et d'elle-même quand on pioche ou révèle dans un paquet vide : un paquet vide ne se
// reconstitue jamais tout seul. Elle dit combien de cartes rejoignent le paquet et, s'il était vide, la
// pénalité (une carte Rencontre pour vous, ou un pion Accélération) ; après confirmation, elle refait ce
// qui avait été demandé (piocher, révéler…). Ouverte depuis la fenêtre de la défausse, « Annuler » y revient.
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { plural } from '../../game/engine.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()

/** Ce que l'action Rencontre demandée devient, dans la phrase et sur le bouton. */
const ENCOUNTER_FOLLOW_UPS = {
  revealEncounterCard: { sentence: 'la carte du dessus est révélée', button: 'révéler' },
  dealBoostCard: { sentence: 'une carte est posée face cachée (boost)', button: 'poser le boost' },
  dealEncounterCardToPlayer: { sentence: 'vous recevez une carte Rencontre face cachée', button: 'recevoir la carte' }
}

/** La défausse à remélanger : 'playerDiscard' ou 'encounterDiscard'. */
const zone = computed(() => ui.modal.zone)
const isPlayer = computed(() => zone.value === 'playerDiscard')
const discardCount = computed(() => gameStore.pileOf(zone.value).length)
const deckCount = computed(() => gameStore.pileOf(isPlayer.value ? 'playerDeck' : 'encounterDeck').length)
/** Le paquet est vide : le remélanger le reconstitue, avec la pénalité. */
const deckIsEmpty = computed(() => !deckCount.value)
/** Ce qui sera fait après : des cartes à piocher, ou l'action Rencontre demandée. */
const thenDraw = computed(() => ui.modal.thenDraw ?? 0)
const encounterFollowUp = computed(() => ENCOUNTER_FOLLOW_UPS[ui.modal.thenEncounter] ?? null)

const title = computed(() => {
  if (deckIsEmpty.value) return isPlayer.value ? 'Votre paquet est vide' : 'Paquet Rencontre épuisé'
  return isPlayer.value ? 'Remélanger la défausse' : 'Remélanger la défausse Rencontre'
})
/** « Les 12 cartes de votre défausse sont mélangées et deviennent votre paquet. » */
const summary = computed(() => {
  const count = discardCount.value
  if (!count) return 'La défausse est vide : il n\'y a rien à remélanger.'
  const cards = count > 1 ? `Les ${count} cartes` : 'La carte'
  const from = isPlayer.value ? 'votre défausse' : 'la défausse Rencontre'
  const to = isPlayer.value ? 'votre paquet' : 'le paquet Rencontre'
  if (deckIsEmpty.value) return `${cards} de ${from} ${count > 1 ? 'sont mélangées et deviennent' : 'est mélangée et devient'} ${to}.`
  return `${cards} de ${from} ${count > 1 ? 'rejoignent' : 'rejoint'} ${to} (${plural(deckCount.value, 'carte')}), qui est ensuite mélangé : ${plural(count + deckCount.value, 'carte')} en tout.`
})
/** La pénalité du paquet vide, ou son absence. */
const penalty = computed(() => {
  if (deckIsEmpty.value) {
    return isPlayer.value
      ? 'Pénalité du paquet vide : vous recevez une carte Rencontre face cachée, posée devant votre identité.'
      : 'Pénalité du paquet épuisé : un pion Accélération s\'ajoute.'
  }
  return isPlayer.value ? 'Votre paquet a encore des cartes : pas de pénalité.' : 'Le paquet Rencontre a encore des cartes : pas de pion Accélération.'
})
/** « Puis vous piochez 2 cartes. » */
const followUp = computed(() => {
  if (thenDraw.value) return `Puis vous piochez ${plural(thenDraw.value, 'carte')}.`
  return encounterFollowUp.value ? `Puis ${encounterFollowUp.value.sentence}.` : ''
})
const confirmLabel = computed(() => {
  if (thenDraw.value) return 'Remélanger et piocher'
  return encounterFollowUp.value ? `Remélanger et ${encounterFollowUp.value.button}` : 'Remélanger'
})

function confirm() {
  const { thenEncounter } = ui.modal
  const cardsToDraw = thenDraw.value
  gameStore.shuffleDiscardIntoDeck(zone.value)
  ui.closeModal()
  if (cardsToDraw) gameStore.drawCards(cardsToDraw)
  else if (ENCOUNTER_FOLLOW_UPS[thenEncounter]) gameStore[thenEncounter]()
}
/** Annuler : retour à la fenêtre de la défausse si on en vient, sinon à la table (le paquet reste vide). */
function cancel() {
  if (ui.modal.fromPile) ui.openModal('pile', { zone: zone.value })
  else ui.closeModal()
}
</script>

<template>
  <BaseModal :title="title">
    <p>{{ summary }}</p>
    <p :class="deckIsEmpty ? 'penalty' : 'note'">{{ penalty }}</p>
    <p v-if="followUp && discardCount">{{ followUp }}</p>
    <template #actions>
      <button type="button" class="modal-btn" @click="cancel">Annuler</button>
      <button type="button" class="modal-btn primary" :disabled="!discardCount" @click="confirm">{{ confirmLabel }}</button>
    </template>
  </BaseModal>
</template>

<style scoped>
/* la pénalité, à ne pas manquer */
.penalty { color: var(--yellow); }
</style>
