<script setup>
// La fenêtre de fin quand le héros tombe à 0 PV (moteur : addDamage, heroDefeated) : « Spider-Man a été
// battu par Rhino. » La partie est perdue ; « Annuler » remet la partie dans l'état d'avant le dernier dégât.
// Deadpool, lui, n'est pas battu sous forme de héros (heroRegenerates, rules.js regeneratesAtZero) : la même
// fenêtre explique ce qui s'est passé (1 PV, alter ego, 1 pion Accélération), et la partie continue.
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard, { printedCard } from '../GameCard.vue'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
/** Le résultat à présenter : {kind: 'heroDefeat' | 'heroRegenerates', fromCardId, text, accelerationTokens?}. */
const result = computed(() => ui.modal.result)
/** Deadpool tombé à 0 PV sous forme de héros : il n'est pas battu. */
const regenerates = computed(() => result.value.kind === 'heroRegenerates')
/** L'identité du joueur, sur la face où elle est tombée (Deadpool : déjà passé en alter ego). */
const identity = computed(() => gameStore.cardById(result.value.fromCardId))

function restart() {
  gameStore.restartGame()
  ui.closeModal()
}
</script>

<template>
  <BaseModal :title="regenerates ? 'Pas mort !' : 'Défaite'">
    <div class="show">
      <div v-if="identity" class="art" :class="{ alive: regenerates }">
        <GameCard :card="printedCard(identity)" :show-face="true" inert />
        <span class="stamp">{{ regenerates ? 'Pas mort' : 'Vaincu' }}</span>
      </div>
      <div class="txt">
        <p class="verdict">{{ result.text }}</p>
        <template v-if="regenerates">
          <p>Le Dégénéré qui Régénère : tombé à 0 PV sous forme de héros, il n'est pas vaincu.</p>
          <ul class="effects">
            <li>Ses points de vie reviennent à <b>1</b>.</li>
            <li>Il passe sous forme d'<b>alter ego</b>.</li>
            <li>La manigance principale reçoit <b>1 pion Accélération</b> ({{ result.accelerationTokens }} en tout : +{{ result.accelerationTokens }} menace par phase du méchant).</li>
          </ul>
          <p>La partie continue.</p>
        </template>
        <p v-else>Ses points de vie sont tombés à 0 au tour {{ gameStore.turn }} : la partie est perdue.</p>
      </div>
    </div>
    <template #actions>
      <!-- un clic de trop sur les PV : la partie revient à l'état d'avant ce dégât -->
      <button type="button" class="modal-btn" title="Revenir à l'état d'avant ce dernier dégât" @click="gameStore.cancelPresentedChange()">Annuler</button>
      <span class="sp" />
      <button v-if="regenerates" type="button" class="modal-btn primary" @click="ui.closeModal()">Continuer</button>
      <template v-else>
        <button type="button" class="modal-btn" @click="ui.closeModal()">Fermer</button>
        <button type="button" class="modal-btn" @click="restart">Recommencer la partie</button>
        <button type="button" class="modal-btn primary" @click="ui.openModal('setup')">Nouvelle partie</button>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
.show { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
.art { position: relative; flex: none; }
.art :deep(.card) { --w: 180px; cursor: default; filter: grayscale(.75) brightness(.8); }
/* Deadpool n'est pas battu : sa carte garde ses couleurs, le tampon passe au jaune */
.art.alive :deep(.card) { filter: none; }
.stamp { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%) rotate(-14deg); padding: 4px 16px; border: 3px solid var(--danger); border-radius: 6px; color: var(--danger); background: rgb(18 22 28 / .7); font-family: var(--font-display); font-weight: 700; font-size: 30px; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
.art.alive .stamp { border-color: var(--yellow); color: var(--yellow); }
.txt { flex: 1 1 260px; display: grid; gap: 10px; }
.txt p { margin: 0; color: var(--fg); }
.effects { margin: 0; padding-left: 1.2em; display: grid; gap: 4px; color: var(--fg); }
/* la phrase de défaite, en grand, dans la police des titres */
.txt .verdict { font: italic 700 28px/1.15 var(--font-display); letter-spacing: -.01em; text-wrap: balance; }
@media (max-width: 700px) {
  .art :deep(.card) { --w: 130px; }
  .txt .verdict { font-size: 24px; }
}
</style>
