<script>
/**
 * La carte telle qu'imprimée, pour les vues agrandies : sans rotation d'épuisement, ni jetons ni cartes
 * d'état par-dessus le texte.
 */
export const printedCard = card => ({ ...card, exhausted: false, damage: 0, threat: 0, tokens: 0, stunned: false, confused: false, tough: false })
</script>

<script setup>
// Une carte (ou un pion) : sa face ou son dos, ses cartes d'état, ses compteurs (dégâts, menace, jetons) et,
// avec les Démolisseurs, le badge « Actif ». Sur la table elle est placée à sa position (positioned).
import { computed } from 'vue'
import { definitionOf, cardName } from '../game/engine.js'
import { STATUS_CARDS } from '../game/data.js'
import { cardImageUrl, cardBackUrl, statusImageUrl } from '../composables/useAssets.js'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const props = defineProps({
  card: { type: Object, required: true },
  /** Force la face visible (true) ou cachée (false) ; null : suit card.faceUp. */
  showFace: { type: Boolean, default: null },
  /** Placée en absolu sur la table, à card.x / card.y. */
  positioned: Boolean,
  /** Pour l'affichage seulement : pas de data-id, les gestionnaires du pointeur et du clavier l'ignorent. */
  inert: Boolean
})

const gameStore = useGameStore()
const ui = useUiStore()

const isPawn = computed(() => !!props.card.isPawn)
const isFaceShown = computed(() => props.showFace ?? props.card.faceUp)
const classes = computed(() => ({
  token: isPawn.value,
  land: !isPawn.value && isFaceShown.value && !!definitionOf(props.card).landscape,
  tapped: props.positioned && props.card.exhausted,
  sel: !props.inert && ui.selectedCardId === props.card.id,
  rand: !props.inert && ui.randomlyPickedCardId === props.card.id
}))
const style = computed(() => {
  const cardStyle = {}
  if (props.positioned) Object.assign(cardStyle, { left: `${props.card.x}px`, top: `${props.card.y}px`, zIndex: props.card.zIndex })
  if (isPawn.value) cardStyle['--tok'] = props.card.color
  return cardStyle
})
// Une carte jouable n'est pilotée que par les événements de pointeur (usePointer). Ses touchers ne doivent
// lancer aucun geste du navigateur (toucher, appui long) : si la carte quitte la page pendant ce geste
// (piochée, jouée, glissée hors de la main), le geste inachevé avale le toucher suivant ailleurs.
const onTouchStart = event => { if (!props.inert) event.preventDefault() }
const faceImageUrl = computed(() => cardImageUrl(props.card))
const statuses = computed(() => STATUS_CARDS.filter(status => props.card[status.id]))
// plusieurs méchants (Les Démolisseurs) : celui qui a le jeton Actif
const isActiveVillain = computed(() => {
  const activeSet = gameStore.game?.activeVillainSet
  const definition = definitionOf(props.card)
  return props.positioned && !!activeSet && definition.type === 'villain' && definition.set === activeSet
})
// nom lu par les lecteurs d'écran, avec ce qui est posé sur la carte
const accessibleLabel = computed(() => {
  let name = 'Carte face cachée'
  if (isPawn.value) name = 'Pion'
  else if (isFaceShown.value) name = cardName(props.card)
  const notes = [...(isActiveVillain.value ? ['actif'] : []), ...statuses.value.map(status => status.label)]
  return notes.length ? `${name} (${notes.join(', ')})` : name
})
</script>

<template>
  <div
    class="card"
    :class="classes"
    :style="style"
    :data-id="inert ? undefined : card.id"
    :tabindex="inert ? -1 : 0"
    :role="inert ? 'img' : 'button'"
    :aria-label="accessibleLabel"
    @touchstart="onTouchStart"
  >
    <template v-if="!isPawn">
      <div v-if="isFaceShown && faceImageUrl" class="face" :style="{ backgroundImage: `url('${faceImageUrl}')` }" />
      <!-- une carte de MarvelCDB sans image sur le site : son nom -->
      <div v-else-if="isFaceShown" class="face plain"><span>{{ cardName(card) }}</span></div>
      <div v-else class="back" :style="{ backgroundImage: `url('${cardBackUrl(card)}')` }" />
    </template>
    <div v-if="statuses.length" class="status">
      <img v-for="status in statuses" :key="status.id" :src="statusImageUrl(status.id)" alt="" draggable="false">
    </div>
    <span v-if="card.damage" class="mk dmg" title="Dégâts">{{ card.damage }}</span>
    <span v-if="card.threat" class="mk thr" title="Menace">{{ card.threat }}</span>
    <span v-if="card.tokens" class="mk tok" title="Jetons">{{ card.tokens }}</span>
    <span v-if="isActiveVillain" class="mk act" title="Jeton Actif">Actif</span>
  </div>
</template>
