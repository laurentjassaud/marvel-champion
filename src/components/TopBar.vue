<script setup>
import { computed } from 'vue'
import CounterBox from './CounterBox.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()
// Les Démolisseurs: several villains
const villains = computed(() => (game.s?.crew ? 'Phase des méchants' : 'Phase du méchant'))
</script>

<template>
  <header class="bar">
    <div class="brand">Marvel Champions<small>{{ game.subtitle }}</small></div>
    <div class="group actions">
      <button type="button" class="btn primary" @click="game.draw()">Piocher<kbd>D</kbd></button>
      <div class="turn" aria-live="polite"><span>Tour</span><output>{{ game.turn }}</output></div>
      <!-- the round goes hero phase → villain phase → hero phase of the next round; the lit button is the phase in play -->
      <div class="phases" role="group" aria-label="Phase du tour">
        <button
          type="button"
          class="btn phase hero"
          :class="{ on: game.phase === 'hero' }"
          :aria-pressed="game.phase === 'hero'"
          :title="game.phase === 'hero' ? 'Phase en cours : jouez votre tour' : 'Tour suivant'"
          @click="game.toHeroPhase()"
        >
          Phase du héros<kbd>N</kbd>
        </button>
        <button
          type="button"
          class="btn phase villain"
          :class="{ on: game.phase === 'villain' }"
          :aria-pressed="game.phase === 'villain'"
          :title="game.phase === 'villain' ? 'Phase en cours' : 'Complète votre main et redresse vos cartes ; la phase du méchant se joue ensuite à la main'"
          @click="game.toVillainPhase()"
        >
          {{ villains }}<kbd>V</kbd>
        </button>
      </div>
    </div>
    <div v-if="game.ready" class="group">
      <CounterBox v-for="(_, i) in game.s.counters" :key="i" :index="i" />
    </div>
    <div class="sp" />
    <div class="group settings">
      <label class="btn" for="card-size">Taille</label>
      <input id="card-size" v-model.number="ui.cw" type="range" min="56" max="130" aria-label="Taille des cartes sur la table">
      <button type="button" class="btn" @click="game.addToken()">+ Pion</button>
      <button type="button" class="btn" :disabled="!game.ready" title="Même héros, même deck, même scénario, depuis le début" @click="ui.openModal('restart')">Recommencer la partie</button>
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
/* two-segment switch */
.phases { display: flex; }
.phases .btn { border-radius: 0; }
.phases .btn:first-child { border-radius: 6px 0 0 6px; }
.phases .btn:last-child { border-radius: 0 6px 6px 0; margin-left: -1px; }
.phase:not(.on) { color: var(--muted); }
.phase.on { color: var(--fg); font-weight: 600; cursor: default; position: relative; }
.phase.on:active { transform: none; }
.phase.on.hero { background: color-mix(in srgb, var(--hero) 32%, var(--panel)); border-color: var(--hero); }
.phase.on.villain { background: color-mix(in srgb, var(--enc) 32%, var(--panel)); border-color: var(--enc); }
/* touch: the bigger buttons need two rows on a landscape tablet; keep the turn actions and
   counters on the first one, title and settings on the second */
@media (pointer: coarse) {
  .brand { order: 1; }
  .sp { order: 2; }
  .settings { order: 3; }
}
</style>
