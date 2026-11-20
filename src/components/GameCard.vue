<script>
/**
 * La carte telle qu'imprimée (menu, fenêtres) : sans rotation d'épuisement, ni pions ni cartes d'état
 * par-dessus le texte. `printed` : même la menace du compteur n'y est pas posée.
 */
export const printedCard = card => ({ ...card, exhausted: false, damage: 0, threat: 0, tokens: 0, stunned: false, confused: false, tough: false, printed: true })

/** La carte agrandie de la colonne de droite : droite, sans ses cartes d'état (son texte reste lisible), avec ses pions. */
export const zoomedCard = card => ({ ...card, exhausted: false, stunned: false, confused: false, tough: false })

/** Nombre entre 0 et 1, toujours le même pour un même texte (hachage FNV-1a) : un pion ne bouge pas d'un affichage à l'autre. */
function stableRandom(text) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

/** Les pions posés sur une carte : dégâts (personnages), menace (manigances), jetons (les autres cartes, et la manigance principale). */
const TOKEN_KINDS = [
  { kind: 'damage', singular: 'dégât', plural: 'dégâts' },
  { kind: 'threat', singular: 'menace', plural: 'menaces' },
  { kind: 'tokens', singular: 'jeton', plural: 'jetons' }
]

/**
 * Où poser le centre d'un pion, en % de la carte : toujours sur l'illustration, jamais sur le texte (zones
 * relevées sur les cartes imprimées, vérifiées au pire cas : coins de la zone, pion penché de ±30°). Elles
 * tiennent compte de la taille du pion (main.css : 30 % de la largeur d'une carte, 36 % pour le triangle)
 * et de son inclinaison : penché de 30°, un carré ou un triangle déborde d'un tiers de plus. Le pion y est
 * posé au hasard.
 *  - upright : carte debout (allié, soutien, amélioration, pièce jointe, sbire, traîtrise, méchant…) :
 *    l'illustration est entre le bandeau du titre et l'encadré du texte (qui commence parfois vers 48 % de
 *    la hauteur, sur une pièce jointe), à droite des caractéristiques ou du titre vertical d'une
 *    amélioration ; le rond des dégâts, qui ne déborde pas en penchant, y a plus de place ;
 *  - uprightPair : personnage debout qui porte aussi des jetons (Hawkeye : dégâts et jetons Flèche) : deux
 *    places côte à côte sur l'illustration, gardées même quand l'une est vide. Les dégâts à gauche, juste
 *    à droite des caractéristiques ; les jetons à droite, au-dessus des PV imprimés, penchés de ±15° au plus
 *    (PAIR_MAX_TOKEN_ANGLE) : leurs centres sont toujours à 34 % de largeur l'un de l'autre, plus que le
 *    rayon du rond (15 %) et la demi-largeur du carré penché (18,4 %) réunis, ils ne se touchent jamais ;
 *  - artRight : manigance principale (couchée) : le texte à gauche (jusqu'à 58 % de la largeur),
 *    l'illustration à droite ; la menace en haut, les jetons en bas (une carte qui porte les deux) ;
 *  - artLeft : manigance annexe (couchée) : l'illustration à gauche, entre le titre en haut, les icônes
 *    d'accélération à gauche et la menace de départ en bas ;
 *  - back : carte face cachée : le dos, sans texte.
 */
const TOKEN_ZONES = {
  upright: {
    damage: { x: [36, 64], y: [25, 34] },
    tokens: { x: [42, 60], y: [28, 31] },
    threat: { x: [44, 58], y: [29, 30] }
  },
  uprightPair: {
    damage: { x: [37, 40], y: [24, 34] },
    tokens: { x: [74, 77], y: [27, 32] },
    threat: { x: [44, 58], y: [29, 30] }
  },
  artRight: {
    damage: { x: [74, 82], y: [44, 56] },
    threat: { x: [75, 80], y: [39, 43] },
    tokens: { x: [74, 82], y: [60, 65] }
  },
  artLeft: {
    damage: { x: [22, 27], y: [40, 57] },
    threat: { x: [22, 27], y: [40, 57] },
    tokens: { x: [22, 27], y: [40, 57] }
  },
  back: {
    damage: { x: [40, 60], y: [38, 62] },
    threat: { x: [40, 60], y: [38, 62] },
    tokens: { x: [40, 60], y: [38, 62] }
  }
}
/** Angle d'un pion : de -30° à +30°. */
const MAX_TOKEN_ANGLE = 30
/** Angle d'un pion sur un personnage qui porte dégâts et jetons (uprightPair) : de -15° à +15°. */
const PAIR_MAX_TOKEN_ANGLE = 15
</script>

<script setup>
// Une carte (ou un pion) : sa face ou son dos, ses cartes d'état, ses pions (dégâts, menace, jetons) posés de
// travers, et, avec les Démolisseurs, le badge « Actif ». Sur la table elle est placée à sa position (positioned).
import { computed } from 'vue'
import { definitionOf, cardName, characterTakesTokens } from '../game/engine.js'
import { STATUS_CARDS, PAWN_KIND_BY_ID, pawnSize } from '../game/data.js'
import { cardImageUrl, cardBackUrl, statusImageUrl, tokenImageUrl, pawnImageUrl } from '../composables/useAssets.js'
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
/** Un pion de la liste « Pions » (une image) ; les pions des anciennes parties sont des ronds de couleur. */
const pawnKind = computed(() => (isPawn.value ? PAWN_KIND_BY_ID[props.card.pawn] ?? null : null))
const isFaceShown = computed(() => props.showFace ?? props.card.faceUp)
const classes = computed(() => ({
  token: isPawn.value,
  pictured: !!pawnKind.value,
  land: !isPawn.value && isFaceShown.value && !!definitionOf(props.card).landscape,
  tapped: props.positioned && props.card.exhausted,
  sel: !props.inert && ui.selectedCardId === props.card.id,
  rand: !props.inert && ui.randomlyPickedCardId === props.card.id
}))
const style = computed(() => {
  const cardStyle = {}
  if (props.positioned) Object.assign(cardStyle, { left: `${props.card.x}px`, top: `${props.card.y}px`, zIndex: props.card.zIndex })
  if (pawnKind.value) {
    const [width, height] = pawnSize(props.card)
    Object.assign(cardStyle, { '--pawn-w': width, '--pawn-h': height })
  } else if (isPawn.value) cardStyle['--tok'] = props.card.color
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
/**
 * Les pions à poser : {kind, value, label, style}. La manigance principale porte la menace du compteur (le
 * moteur la garde là, pas sur la carte), sauf sur une carte « telle qu'imprimée ». Place et angle viennent
 * de l'identité de la carte : différents d'une carte à l'autre, les mêmes à chaque affichage.
 */
/** La mise en page de la carte telle qu'elle se voit, pour savoir où est son illustration (TOKEN_ZONES). */
const tokenLayout = computed(() => {
  if (!isFaceShown.value) return 'back'
  const definition = definitionOf(props.card)
  if (!definition.landscape) return characterTakesTokens(props.card) ? 'uprightPair' : 'upright'
  return definition.type === 'main_scheme' ? 'artRight' : 'artLeft'
})
const maxTokenAngle = computed(() => (tokenLayout.value === 'uprightPair' ? PAIR_MAX_TOKEN_ANGLE : MAX_TOKEN_ANGLE))
const tokens = computed(() => {
  const card = props.card
  const counterThreat = !card.printed && card.id === gameStore.threatSchemeId ? gameStore.game.counters[2].value : 0
  const values = { damage: card.damage, threat: card.threat || counterThreat, tokens: card.tokens }
  return TOKEN_KINDS.filter(({ kind }) => values[kind] > 0).map(({ kind, singular, plural }) => {
    const { x, y } = TOKEN_ZONES[tokenLayout.value][kind]
    const random = axis => stableRandom(`${card.id}:${kind}:${axis}`)
    const between = ([low, high], axis) => `${(low + (high - low) * random(axis)).toFixed(1)}%`
    return {
      kind,
      value: values[kind],
      label: `${values[kind]} ${values[kind] > 1 ? plural : singular}`,
      // place du pion (droit, il porte l'ombre) et angle de sa face (main.css, .chip et .chip-face)
      style: {
        '--x': between(x, 'x'),
        '--y': between(y, 'y'),
        '--angle': `${Math.round((random('angle') * 2 - 1) * maxTokenAngle.value)}deg`
      },
      // la grande version sur la carte agrandie (une carte d'affichage), la petite sur la table et dans la main
      faceStyle: { backgroundImage: `url('${tokenImageUrl(kind, props.inert ? 'zoom' : 'table')}')` }
    }
  })
})
// nom lu par les lecteurs d'écran, avec ce qui est posé sur la carte
const accessibleLabel = computed(() => {
  let name = 'Carte face cachée'
  if (isPawn.value) name = cardName(props.card)
  else if (isFaceShown.value) name = cardName(props.card)
  const notes = [...(isActiveVillain.value ? ['actif'] : []), ...statuses.value.map(status => status.label), ...tokens.value.map(token => token.label)]
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
    <img v-if="pawnKind" class="pawn-image" :src="pawnImageUrl(pawnKind.id)" alt="" draggable="false">
    <template v-if="!isPawn">
      <div v-if="isFaceShown && faceImageUrl" class="face" :style="{ backgroundImage: `url('${faceImageUrl}')` }" />
      <!-- une carte de MarvelCDB sans image sur le site : son nom -->
      <div v-else-if="isFaceShown" class="face plain"><span>{{ cardName(card) }}</span></div>
      <div v-else class="back" :style="{ backgroundImage: `url('${cardBackUrl(card)}')` }" />
    </template>
    <div v-if="statuses.length" class="status">
      <img v-for="status in statuses" :key="status.id" :src="statusImageUrl(status.id)" alt="" draggable="false">
    </div>
    <span v-for="token in tokens" :key="token.kind" class="chip" :class="token.kind" :style="token.style" :title="token.label">
      <span class="chip-face" :style="token.faceStyle"><span class="chip-value">{{ token.value }}</span></span>
    </span>
    <span v-if="isActiveVillain" class="mk act" title="Jeton Actif">Actif</span>
  </div>
</template>
