<script setup>
// Le bandeau du joueur, en bas de l'écran (maquette) : à gauche ce qu'on fait de sa main (piocher,
// mulligan, carte au hasard) et ses piles ; au milieu sa main en éventail ; à droite le tour, les deux
// phases et ses PV en grand.
import { computed, nextTick } from 'vue'
import CardPile from './CardPile.vue'
import HandStrip from './HandStrip.vue'
import HudCounter from './HudCounter.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const handCount = computed(() => gameStore.cardsIn('hand').length)
// Les Démolisseurs : plusieurs méchants. Le début du libellé (« Phase du ») disparaît sur les écrans moins larges.
const villainPhaseStart = computed(() => (gameStore.game?.crew ? 'Phase des ' : 'Phase du '))
const villainPhaseNoun = computed(() => (gameStore.game?.crew ? 'méchants' : 'méchant'))

/** Tire une carte de la main au hasard et, sur téléphone (la main y défile), la fait venir à l'écran. */
async function pickRandomCard() {
  gameStore.pickRandomHandCard()
  await nextTick()
  document.querySelector(`.hand-row .card[data-id="${ui.randomlyPickedCardId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
</script>

<template>
  <footer class="dock" :class="{ inv: gameStore.hasInvocationDeck }">
    <div class="dock-left">
      <div class="actions" role="group" aria-label="Actions sur la main">
        <div class="zone-label">Main<span v-if="handCount"> · {{ handCount }}</span></div>
        <button type="button" class="slant" @click="gameStore.drawCard()">Piocher<kbd>D</kbd></button>
        <button
          type="button"
          class="slant"
          :disabled="!gameStore.canMulligan"
          :title="gameStore.canMulligan ? 'Défausser des cartes de la main de départ et repiocher' : 'Seulement au tour 1, une fois par partie'"
          @click="ui.openModal('mulligan')"
        >
          Mulligan
        </button>
        <button type="button" class="slant" :disabled="!handCount" title="Marque en rouge une carte de la main tirée au hasard" @click="pickRandomCard">Au hasard</button>
      </div>
      <div class="piles">
        <CardPile zone="playerDeck" label="Paquet" variant="p" title="Clic : piocher" />
        <CardPile zone="playerDiscard" label="Défausse" variant="p" title="Clic : voir" />
        <template v-if="gameStore.hasInvocationDeck">
          <CardPile zone="invocationDeck" label="Invocation" variant="i" title="Clic : lancer l'invocation du dessus · appui long ou clic droit : autres choix" />
          <CardPile zone="invocationDiscard" label="Défausse I." variant="i" title="Clic : voir" />
        </template>
      </div>
    </div>

    <HandStrip />

    <div class="dock-right">
      <div class="turn-row">
        <div class="turn" aria-live="polite"><span>Tour</span><output>{{ gameStore.turn }}</output></div>
        <!-- le round va phase du héros → phase du méchant → phase du héros du round suivant ; l'onglet allumé est la phase en cours -->
        <div class="phases" role="group" aria-label="Phase du tour">
          <button
            type="button"
            class="slant"
            :class="gameStore.phase === 'hero' ? 'blue' : 'dim'"
            :aria-pressed="gameStore.phase === 'hero'"
            :title="gameStore.phase === 'hero' ? 'Phase en cours : jouez votre tour' : 'Tour suivant'"
            @click="gameStore.startHeroPhase()"
          >
            <span><span class="long">Phase du </span>héros</span><kbd>N</kbd>
          </button>
          <button
            type="button"
            class="slant"
            :class="gameStore.phase === 'villain' ? 'red' : 'dim'"
            :aria-pressed="gameStore.phase === 'villain'"
            :title="gameStore.phase === 'villain' ? 'Phase en cours' : 'Complète votre main et redresse vos cartes ; la phase du méchant se joue ensuite à la main'"
            @click="gameStore.startVillainPhase()"
          >
            <span><span class="long">{{ villainPhaseStart }}</span>{{ villainPhaseNoun }}</span><kbd>V</kbd>
          </button>
        </div>
      </div>
      <HudCounter :index="0" tone="hero" size="l" unit="PV" />
    </div>
  </footer>
</template>

<style scoped>
/* trois colonnes : les côtés à leur largeur, la main au milieu ; elle se resserre quand la place manque */
.dock {
  position: relative; z-index: 2; display: grid; align-items: end;
  grid-template-columns: minmax(max-content, 1fr) minmax(calc(var(--hw) * 2.2), calc(var(--hw) * 6)) minmax(max-content, 1fr);
  column-gap: max(16px, calc(36 * var(--u)));
  padding: 0 max(12px, calc(20 * var(--u))) max(10px, calc(27 * var(--u)));
}
.dock-left { justify-self: end; display: flex; align-items: flex-end; gap: max(16px, calc(40 * var(--u))); }
.actions { display: grid; justify-items: stretch; gap: 6px; }
.actions .zone-label { padding-left: 4px; }
.actions .slant { --h: 36px; --lip-h: 4px; justify-content: flex-start; padding-left: calc(var(--cut) + 8px); }
.piles { display: flex; align-items: flex-end; gap: max(10px, calc(10 * var(--u))); }
.dock-right { justify-self: start; display: grid; justify-items: start; gap: max(8px, calc(14 * var(--u))); }
.turn-row { display: flex; align-items: center; gap: 14px; }
.turn { display: flex; align-items: baseline; gap: 6px; }
.turn span { font: italic 700 20px/1 var(--font-display); letter-spacing: -.01em; text-transform: uppercase; color: var(--muted); }
.turn output { font: italic 900 32px/1 var(--font-display); font-variant-numeric: tabular-nums; }
/* les deux phases, en onglets bord à bord ; celle en cours est allumée (bleu héros, rouge méchant) */
.phases { display: flex; }
.phases .slant + .slant { margin-left: -16px; }
.phases .slant[aria-pressed="true"] { cursor: default; }
.phases .slant[aria-pressed="true"]:active { transform: none; }
/* écrans moins larges : « Héros » et « Méchant » suffisent */
@media (max-width: 1500px) {
  .long { display: none; }
}
@media (max-width: 1100px) {
  .dock { column-gap: 14px; }
  .actions .zone-label { display: none; }
}
/* téléphones : une rangée par partie, la main d'abord */
@media (max-width: 700px) {
  .dock { grid-template-columns: 1fr; row-gap: 12px; padding-top: 8px; }
  .hand { order: -1; }
  .dock-left { justify-self: stretch; justify-content: space-between; }
  .dock-right { justify-self: stretch; }
}
</style>
