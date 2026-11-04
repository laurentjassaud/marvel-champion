<script setup>
import CounterBox from './CounterBox.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()
</script>

<template>
  <header class="bar">
    <div class="brand">Marvel Champions<small>{{ game.subtitle }}</small></div>
    <div class="group actions">
      <button type="button" class="btn primary" @click="game.draw()">Piocher<kbd>D</kbd></button>
      <button type="button" class="btn" title="Redresse vos cartes et complète la main" @click="game.newTurn()">Nouveau tour<kbd>N</kbd></button>
      <button type="button" class="btn enc" title="Ajoute la menace d'accélération et révèle une carte Rencontre" @click="game.villainPhase()">Phase du méchant<kbd>V</kbd></button>
      <button type="button" class="btn enc" @click="game.reveal()">Révéler rencontre<kbd>E</kbd></button>
    </div>
    <div v-if="game.ready" class="group">
      <CounterBox v-for="(_, i) in game.s.counters" :key="i" :index="i" />
    </div>
    <div class="sp" />
    <div class="group settings">
      <label class="btn" for="card-size">Taille</label>
      <input id="card-size" v-model.number="ui.cw" type="range" min="56" max="130" aria-label="Taille des cartes sur la table">
      <button type="button" class="btn" @click="game.addToken()">+ Pion</button>
      <button type="button" class="btn" title="Défausser des cartes de la main de départ et repiocher" @click="ui.openModal('mulligan')">Mulligan</button>
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
/* touch: the bigger buttons need two rows on a landscape tablet; keep the turn actions and
   counters on the first one, title and settings on the second */
@media (pointer: coarse) {
  .brand { order: 1; }
  .sp { order: 2; }
  .settings { order: 3; }
}
</style>
