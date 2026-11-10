<script setup>
// La barre du haut : titre et sous-titre de la partie, Piocher, numéro du tour, les deux boutons de phase,
// les trois compteurs, puis les réglages (taille des cartes, pion, recommencer, aide, nouvelle partie).
import { computed } from 'vue'
import CounterBox from './CounterBox.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
// Les Démolisseurs : plusieurs méchants
const villainPhaseLabel = computed(() => (gameStore.game?.crew ? 'Phase des méchants' : 'Phase du méchant'))
</script>

<template>
  <header class="bar">
    <div class="brand">Marvel Champions<small>{{ gameStore.subtitle }}</small></div>
    <div class="group actions">
      <button type="button" class="btn primary" @click="gameStore.drawCard()">Piocher<kbd>D</kbd></button>
      <div class="turn" aria-live="polite"><span>Tour</span><output>{{ gameStore.turn }}</output></div>
      <!-- le round va phase du héros → phase du méchant → phase du héros du round suivant ; le bouton allumé est la phase en cours -->
      <div class="phases" role="group" aria-label="Phase du tour">
        <button
          type="button"
          class="btn phase hero"
          :class="{ on: gameStore.phase === 'hero' }"
          :aria-pressed="gameStore.phase === 'hero'"
          :title="gameStore.phase === 'hero' ? 'Phase en cours : jouez votre tour' : 'Tour suivant'"
          @click="gameStore.startHeroPhase()"
        >
          Phase du héros<kbd>N</kbd>
        </button>
        <button
          type="button"
          class="btn phase villain"
          :class="{ on: gameStore.phase === 'villain' }"
          :aria-pressed="gameStore.phase === 'villain'"
          :title="gameStore.phase === 'villain' ? 'Phase en cours' : 'Complète votre main et redresse vos cartes ; la phase du méchant se joue ensuite à la main'"
          @click="gameStore.startVillainPhase()"
        >
          {{ villainPhaseLabel }}<kbd>V</kbd>
        </button>
      </div>
    </div>
    <div v-if="gameStore.isReady" class="group">
      <CounterBox v-for="(_, index) in gameStore.game.counters" :key="index" :index="index" />
    </div>
    <div class="sp" />
    <div class="group settings">
      <label class="btn" for="card-size">Taille</label>
      <input id="card-size" v-model.number="ui.cardWidth" type="range" min="56" max="130" aria-label="Taille des cartes sur la table">
      <button type="button" class="btn" @click="gameStore.addPawn()">+ Pion</button>
      <button type="button" class="btn" :disabled="!gameStore.isReady" title="Même héros, même deck, même scénario, depuis le début" @click="ui.openModal('restart')">Recommencer la partie</button>
      <button type="button" class="btn" title="Raccourcis clavier (?)" aria-label="Raccourcis clavier" @click="ui.openModal('help')">?</button>
      <button type="button" class="btn primary" @click="ui.openModal('setup')">Nouvelle partie</button>
    </div>
  </header>
</template>

<style scoped>
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.brand { font-family: var(--f-display); font-weight: 700; font-size: 22px; letter-spacing: .02em; white-space: nowrap; margin-right: 4px; line-height: 1.1; }
.brand small { display: block; font-weight: 500; color: var(--muted); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
.group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.turn { display: flex; align-items: baseline; gap: 6px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--brass); border-radius: 6px; padding: 4px 10px; align-self: stretch; }
.turn span { font-family: var(--f-display); font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); align-self: center; }
.turn output { font-family: var(--f-mono); font-size: 17px; font-variant-numeric: tabular-nums; align-self: center; }
/* interrupteur à deux segments */
.phases { display: flex; }
.phases .btn { border-radius: 0; }
.phases .btn:first-child { border-radius: 6px 0 0 6px; }
.phases .btn:last-child { border-radius: 0 6px 6px 0; margin-left: -1px; }
.phase:not(.on) { color: var(--muted); }
.phase.on { color: var(--fg); font-weight: 600; cursor: default; position: relative; }
.phase.on:active { transform: none; }
.phase.on.hero { background: color-mix(in srgb, var(--hero) 32%, var(--panel)); border-color: var(--hero); }
.phase.on.villain { background: color-mix(in srgb, var(--enc) 32%, var(--panel)); border-color: var(--enc); }
/* écran tactile : les boutons plus grands demandent deux rangées sur une tablette en paysage ; les actions
   du tour et les compteurs restent sur la première, le titre et les réglages passent sur la seconde */
@media (pointer: coarse) {
  .brand { order: 1; }
  .sp { order: 2; }
  .settings { order: 3; }
}
</style>
