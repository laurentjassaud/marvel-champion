<script setup>
// La fenêtre du méchant : ce qu'a donné la défaite d'un méchant (moteur, defeatVillain) — l'étape suivante,
// le nouveau méchant actif des Démolisseurs, un changement de stade de Kang en attente, ou la victoire.
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard, { printedCard } from '../GameCard.vue'
import { definitionOf, cardName } from '../../game/engine.js'
import { STATUS_CARDS, VICTORY_TEXTS } from '../../game/data.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
/** Le résultat à présenter (voir defeatVillain dans engine/villains.js). */
const result = computed(() => ui.modal.result)
const cardById = cardId => gameStore.cardById(cardId)
/** "Rhino II" : le nom et l'étape. */
const nameWithStage = card => `${cardName(card)} ${definitionOf(card).stage}`

/** La carte d'où part le résultat : l'étape vaincue (ou le stade de Kang achevé). */
const fromCard = computed(() => cardById(result.value.fromCardId ?? result.value.villainId))
// la carte présentée : l'étape qui entre en jeu, le méchant maintenant actif, le dernier vaincu, ou (Kang,
// changement de stade en attente de la fin de la phase) le méchant vaincu ou le stade achevé
const shownCard = computed(() => {
  const shownId = { stage: result.value.toCardId, crew: result.value.activeVillainId, pending: result.value.fromCardId }[result.value.kind]
  return cardById(shownId ?? result.value.villainId)
})
const title = computed(() => ({
  stage: `${cardName(shownCard.value)} passe à l'étape ${definitionOf(shownCard.value).stage}`,
  crew: `${cardName(fromCard.value)} est vaincu`,
  pending: result.value.title ?? `${nameWithStage(fromCard.value)} est vaincu`,
  victory: 'Victoire !'
})[result.value.kind])
// un méchant vaincu est montré grisé, avec le tampon « Vaincu »
const isDefeatedShown = computed(() => result.value.kind === 'victory' || (result.value.kind === 'pending' && definitionOf(shownCard.value).type === 'villain'))
// les cartes d'état reportées de l'étape vaincue (une étape avec Ténacité apporte sa propre carte Tenace)
const keptStatusLabels = computed(() => STATUS_CARDS
  .filter(status => (result.value.keptStatuses ? result.value.keptStatuses.includes(status.id) : shownCard.value[status.id]))
  .map(status => status.label))
const mainScheme = computed(() => result.value.mainSchemeId && cardById(result.value.mainSchemeId))
const victoryText = computed(() => (mainScheme.value && VICTORY_TEXTS[mainScheme.value.definitionId]) || `Vous avez déjoué les plans de ${cardName(fromCard.value)}.`)
const sideScheme = computed(() => result.value.sideSchemeId && cardById(result.value.sideSchemeId))

function restart() {
  gameStore.restartGame()
  ui.closeModal()
}
</script>

<template>
  <BaseModal :title="title">
    <div class="show" :class="result.kind">
      <div class="art" :class="{ defeated: isDefeatedShown }">
        <GameCard :card="printedCard(shownCard)" :show-face="true" inert />
        <span v-if="isDefeatedShown" class="stamp">Vaincu</span>
      </div>
      <div class="txt">
        <template v-if="result.kind === 'pending'">
          <p>{{ result.note }}</p>
          <p class="note">Terminez la phase en cours : le changement de stade se fait au passage à la phase suivante.</p>
        </template>
        <template v-else-if="result.kind === 'stage'">
          <p>{{ nameWithStage(fromCard) }} {{ result.stageLeft ? 'quitte la partie' : 'est vaincu' }}. <strong>{{ nameWithStage(shownCard) }}</strong> entre en jeu avec <strong>{{ definitionOf(shownCard).hitPoints }} PV</strong>.</p>
          <!-- Kang : ce qu'a amené le changement de stade (stade 3 tiré, pions Accélération, Empire de Kang) -->
          <p v-if="result.note">{{ result.note }}</p>
          <p v-if="keptStatusLabels.length">Ses cartes d'état restent : {{ keptStatusLabels.join(', ') }}.</p>
          <p class="note">Les attachements du méchant restent en jeu ; les dégâts ne sont pas reportés.</p>
        </template>
        <template v-else-if="result.kind === 'crew'">
          <p>{{ cardName(fromCard) }} quitte la partie<template v-if="sideScheme"> avec sa manigance annexe « {{ cardName(sideScheme) }} »</template>.</p>
          <p>Jeton Actif sur <strong>{{ cardName(shownCard) }}</strong> : les piles Rencontre affichées sont désormais les siennes.</p>
        </template>
        <template v-else>
          <p><strong>{{ gameStore.game.crew ? 'Les Démolisseurs sont vaincus' : `${cardName(shownCard)} est vaincu` }}</strong> en {{ gameStore.turn }} tour{{ gameStore.turn > 1 ? 's' : '' }}.</p>
          <blockquote>
            <span v-if="mainScheme" class="scheme">{{ cardName(mainScheme) }}</span>
            {{ victoryText }}
          </blockquote>
        </template>
      </div>
    </div>
    <div class="row">
      <template v-if="result.kind === 'victory'">
        <button type="button" class="btn primary" @click="ui.openModal('setup')">Nouvelle partie</button>
        <button type="button" class="btn" @click="restart">Recommencer la partie</button>
        <span class="sp" />
        <button type="button" class="btn" @click="ui.closeModal()">Fermer</button>
      </template>
      <button v-else type="button" class="btn primary" @click="ui.closeModal()">Continuer</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.show { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
.art { position: relative; flex: none; }
.art :deep(.card) { --w: 210px; cursor: default; }
.art :deep(.card.land) { --w: 230px; }
.art.defeated :deep(.card) { filter: grayscale(.75) brightness(.8); }
.stamp { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%) rotate(-14deg); padding: 4px 16px; border: 3px solid var(--danger); border-radius: 6px; color: var(--danger); background: rgb(18 22 28 / .7); font-family: var(--f-display); font-weight: 700; font-size: 30px; letter-spacing: .14em; text-transform: uppercase; }
.txt { flex: 1 1 260px; display: grid; gap: 10px; }
.txt p { margin: 0; color: var(--fg); }
.txt .note { color: var(--muted); }
blockquote { margin: 0; padding: 12px 16px; border-left: 3px solid var(--brass); background: var(--bg); border-radius: 0 8px 8px 0; font-style: italic; line-height: 1.5; }
.scheme { display: block; font-style: normal; font-family: var(--f-display); font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--brass); margin-bottom: 4px; }
@media (max-width: 700px) {
  .art :deep(.card) { --w: 150px; }
}
</style>
