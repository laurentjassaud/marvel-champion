<script setup>
// Les boutons + et − de la carte sélectionnée sur la table, collés à son filet de sélection, à droite, en haut (à
// gauche si la table s'arrête là), aux mesures de la maquette : petits, proportionnels à la carte (la tirette
// « Taille » les agrandit avec elle) ; ils ajoutent ou retirent 1 au compteur de la carte (engine
// counterStepKindOf) : les dégâts d'un allié ou d'un sbire (+ : un dégât de plus), la menace d'une manigance, les
// jetons d'une carte qui entre en jeu avec des jetons, même à 0 ; sur les autres cartes, le compteur qu'elles
// portent. La carte part à la défausse quand elle n'a plus de quoi rester (allié ou sbire dont les dégâts atteignent
// ses PV, manigance annexe sans menace, Utilisations sans jeton : engine stepCounter). Un personnage qui porte aussi
// des jetons (Hawkeye et ses Flèches) : ses dégâts. Posés par GameTable,
// par-dessus toutes les cartes ; ni le lasso ni la désélection de la table ne partent d'un appui sur eux
// (usePointer, GameTable).
import { ref, computed, watch } from 'vue'
import { definitionOf, counterStepKindOf, STEP_KINDS } from '../game/engine.js'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const props = defineProps({
  /** La carte sélectionnée, sur la table. */
  card: { type: Object, required: true }
})
const gameStore = useGameStore()
const ui = useUiStore()

/** Le nom de chaque compteur, pour les libellés des boutons (un personnage : + lui pose un dégât). */
const KIND_NAMES = { damage: 'Dégâts', threat: 'Menace', tokens: 'Jetons' }

/** Le compteur que le moteur donne aux boutons de cette carte (counterStepKindOf), ou null. */
const kindOnCard = computed(() => (gameStore.game ? counterStepKindOf(gameStore.game, props.card) : null))

/**
 * Le compteur que les boutons modifient : fixé à l'apparition des boutons, pour qu'un compteur revenu à 0 ne
 * passe pas la main à un autre en plein clic (les jetons d'une carte face cachée retirés, − n'agit pas ailleurs) ;
 * il ne change que pour un compteur plus prioritaire qui apparaît, ou une autre carte sélectionnée.
 */
const shownKind = ref(null)
watch([() => props.card.id, kindOnCard], ([cardId, kind], [previousCardId] = []) => {
  if (cardId !== previousCardId || !shownKind.value) shownKind.value = kind
  else if (kind && STEP_KINDS.indexOf(kind) < STEP_KINDS.indexOf(shownKind.value)) shownKind.value = kind
}, { immediate: true })
/** + ou − : le moteur défausse la carte arrivée à 0 (stepCounter). */
const step = amount => gameStore.stepCounter(props.card.id, shownKind.value, amount)

/**
 * Les mesures de la maquette, en largeurs du filet de sélection de la carte (FRAME : la carte, plus 4 px de chaque
 * côté, main.css .card.sel) : un bouton fait 0,115 de large en haut, 0,13 de haut ; le premier commence 0,093 sous
 * le haut du filet.
 */
const STEP_WIDTH = 0.115
const STEP_TOP = 0.093
/** Le filet de sélection : 2 px de trait, 2 px du bord de la carte. */
const FRAME_OUTSET = 4
/**
 * Place des boutons sur la table : collés au filet de sélection, contre le bord droit de la carte telle qu'elle se
 * voit (inclinée, elle est tournée d'un quart de tour sur son centre ; une manigance est couchée) ; contre son bord
 * gauche, et retournés, si la table s'arrête avant.
 */
const placement = computed(() => {
  const { card } = props
  const cardWidth = ui.cardWidth
  const frame = cardWidth + 2 * FRAME_OUTSET
  const isLandscape = card.faceUp && !!definitionOf(card).landscape
  const width = isLandscape ? cardWidth * 1.4 : cardWidth
  const height = isLandscape ? cardWidth : cardWidth * 1.4
  const centerX = card.x + width / 2
  const centerY = card.y + height / 2
  const [shownWidth, shownHeight] = card.exhausted ? [height, width] : [width, height]
  const stepsWidth = frame * STEP_WIDTH
  const right = centerX + shownWidth / 2 + FRAME_OUTSET
  const onLeft = right + stepsWidth > ui.tableWidth
  return {
    onLeft,
    style: {
      left: `${Math.max(0, onLeft ? centerX - shownWidth / 2 - FRAME_OUTSET - stepsWidth : right)}px`,
      top: `${Math.max(0, centerY - shownHeight / 2 - FRAME_OUTSET + frame * STEP_TOP)}px`,
      zIndex: (gameStore.game?.topZIndex ?? 0) + 1
    }
  }
})
</script>

<template>
  <div v-if="shownKind" class="card-steps" :class="{ left: placement.onLeft }" :style="placement.style">
    <button type="button" class="step plus" :aria-label="`${KIND_NAMES[shownKind]} : ajouter 1`" :title="`${KIND_NAMES[shownKind]} +1`"
      @click="step(1)" />
    <button type="button" class="step minus" :aria-label="`${KIND_NAMES[shownKind]} : retirer 1`" :title="`${KIND_NAMES[shownKind]} −1`"
      @click="step(-1)" />
  </div>
</template>

<style scoped>
/* La maquette, mesurée sur sa carte agrandie, en largeurs du filet de sélection (--frame : la carte et 4 px de
   chaque côté) : deux boutons jaunes l'un sous l'autre, 0,0074 entre eux, collés au filet ; chacun 0,115 de large
   en haut, 0,078 en bas (son bord droit en biais, le gauche droit), 0,13 de haut ; son signe bleu-violet, en
   traits de 0,013, centré à 0,042 du bord du filet et à 45 % de sa hauteur : le + fait 0,061, le − 0,045.
   Contre le bord gauche de la carte, la même chose retournée (les signes sont symétriques). */
.card-steps { --frame: calc(var(--cw) + 8px); position: absolute; display: grid; gap: calc(var(--frame) * .0074); }
.card-steps.left { scale: -1 1; }
.step {
  --w: calc(var(--frame) * .115); --h: calc(var(--frame) * .13);
  position: relative; display: block; width: var(--w); height: var(--h); padding: 0; border: 0; background: none; cursor: pointer;
}
/* la forme et le signe : dessinés à part, pour qu'au doigt la zone d'appui puisse déborder (::after) */
.step::before {
  --ink: #393e6a; --bar: calc(var(--frame) * .013); --cx: calc(var(--frame) * .042); --cy: calc(var(--h) * .45);
  content: ''; position: absolute; inset: 0;
  clip-path: polygon(0 0, 100% 0, 67.7% 100%, 0 100%);
  background:
    linear-gradient(var(--ink), var(--ink)) calc(var(--cx) - var(--len) / 2) calc(var(--cy) - var(--bar) / 2) / var(--len) var(--bar) no-repeat,
    var(--upright, linear-gradient(transparent, transparent)),
    var(--yellow);
  transition: filter 150ms ease;
}
.plus::before {
  --len: calc(var(--frame) * .061);
  --upright: linear-gradient(var(--ink), var(--ink)) calc(var(--cx) - var(--bar) / 2) calc(var(--cy) - var(--len) / 2) / var(--bar) var(--len) no-repeat;
}
.minus::before { --len: calc(var(--frame) * .045); }
.step:active::before { filter: brightness(.9); }
.step:focus-visible { outline: none; }
.step:focus-visible::before { filter: brightness(1.15); }
@media (hover: hover) and (pointer: fine) {
  .step:hover::before { filter: brightness(1.1); }
}
/* au doigt : la même forme, mais une zone d'appui qui déborde (vers l'extérieur de la carte, en haut du +, en bas du −) */
@media (pointer: coarse) {
  .step::after { content: ''; position: absolute; inset: -1px -16px -1px -2px; }
  .plus::after { top: -12px; }
  .minus::after { bottom: -12px; }
}
</style>
