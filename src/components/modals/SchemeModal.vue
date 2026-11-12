<script setup>
// La fenêtre de la manigance principale achevée (sa menace a atteint son seuil, moteur : addThreat) : le
// stade suivant l'a remplacée, avec sa menace de départ et son seuil — ou, au dernier stade, c'est la défaite.
// Le changement est déjà fait quand elle s'ouvre : « Annuler » remet la partie dans l'état d'avant.
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard, { printedCard } from '../GameCard.vue'
import { definitionOf, cardName } from '../../game/engine.js'
import { MAIN_SCHEME_NOTES } from '../../game/rules.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
/** Le résultat à présenter : {kind: 'schemeAdvance' | 'schemeDefeat', fromCardId, toCardId?, reachedThreat, threshold}. */
const result = computed(() => ui.modal.result)
const isDefeat = computed(() => result.value.kind === 'schemeDefeat')
/** La manigance achevée. */
const completedScheme = computed(() => gameStore.cardById(result.value.fromCardId))
/** Le stade qui la remplace (absent en cas de défaite). */
const nextStage = computed(() => result.value.toCardId && gameStore.cardById(result.value.toCardId))
/** "L'Effraction ! (1B)" : le nom et le stade de la face en jeu. */
const nameWithStage = card => {
  const definition = definitionOf(card)
  return `${cardName(card)} (${card.side ? definition.backStage ?? definition.stage : definition.stage})`
}
/** La carte présentée : le stade qui entre en jeu, ou la manigance achevée en cas de défaite. */
const shownCard = computed(() => nextStage.value || completedScheme.value)
const nextDefinition = computed(() => nextStage.value && definitionOf(nextStage.value))
/** Ce que demande le « Une fois révélée » de la face A du nouveau stade, s'il se joue à la main (rules.js). */
const onRevealNote = computed(() => nextStage.value && MAIN_SCHEME_NOTES[nextDefinition.value.id]?.onRevealA)
const startingThreatText = computed(() => {
  const threat = nextDefinition.value?.startingThreat ?? 0
  return `${threat} menace${threat > 1 ? 's' : ''} de départ`
})

function restart() {
  gameStore.restartGame()
  ui.closeModal()
}
</script>

<template>
  <BaseModal :title="isDefeat ? 'Défaite' : `${cardName(completedScheme)} est achevée`">
    <div class="show">
      <div class="art" :class="{ completed: isDefeat }">
        <GameCard :card="printedCard(shownCard)" :show-face="true" inert />
        <span v-if="isDefeat" class="stamp">Achevée</span>
      </div>
      <div class="txt">
        <p>La menace a atteint le seuil de la manigance principale (<strong>{{ result.reachedThreat }}/{{ result.threshold }}</strong>).</p>
        <template v-if="isDefeat">
          <p><strong>{{ nameWithStage(completedScheme) }}</strong> est achevée : c'était son dernier stade, les joueurs perdent la partie.</p>
        </template>
        <template v-else>
          <p>{{ nameWithStage(completedScheme) }} quitte la partie. <strong>{{ nameWithStage(nextStage) }}</strong> la remplace, avec <strong>{{ startingThreatText }}</strong> et un seuil de <strong>{{ nextDefinition.threshold ?? '?' }}</strong>.</p>
          <p v-if="onRevealNote">Une fois révélée : {{ onRevealNote }}.</p>
          <p class="note">Lisez sa face A, appliquez-la, puis retournez-la (F). La menace en trop ne passe pas au stade suivant.</p>
        </template>
      </div>
    </div>
    <div class="row">
      <template v-if="isDefeat">
        <button type="button" class="btn primary" @click="ui.openModal('setup')">Nouvelle partie</button>
        <button type="button" class="btn" @click="restart">Recommencer la partie</button>
        <span class="sp" />
        <button type="button" class="btn" @click="ui.closeModal()">Fermer</button>
      </template>
      <button v-else type="button" class="btn primary" @click="ui.closeModal()">Continuer</button>
      <!-- un clic de trop sur la menace : la partie revient à l'état d'avant, menace comprise -->
      <button type="button" class="btn" title="Revenir à l'état d'avant (la menace ajoutée est retirée)" @click="gameStore.cancelPresentedChange()">Annuler</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.show { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
.art { position: relative; flex: none; }
.art :deep(.card) { --w: 210px; cursor: default; }
.art :deep(.card.land) { --w: 260px; }
.art.completed :deep(.card) { filter: grayscale(.75) brightness(.8); }
.stamp { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%) rotate(-14deg); padding: 4px 16px; border: 3px solid var(--danger); border-radius: 6px; color: var(--danger); background: rgb(18 22 28 / .7); font-family: var(--font-display); font-weight: 700; font-size: 30px; letter-spacing: .14em; text-transform: uppercase; }
.txt { flex: 1 1 260px; display: grid; gap: 10px; }
.txt p { margin: 0; color: var(--fg); }
.txt .note { color: var(--muted); }
@media (max-width: 700px) {
  .art :deep(.card.land) { --w: 200px; }
}
</style>
