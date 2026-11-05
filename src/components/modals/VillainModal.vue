<script setup>
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import GameCard, { bareCard } from '../GameCard.vue'
import { def, nameOf } from '../../game/engine.js'
import { STATUSES, VICTORY } from '../../game/data.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

// what a villain's defeat led to (engine defeatVillain): the next stage, the next active villain, or the victory
const game = useGameStore()
const ui = useUiStore()
const r = computed(() => ui.modal.result)
const card = id => game.card(id)
const stage = c => `${nameOf(c)} ${def(c).st}`

const from = computed(() => card(r.value.from ?? r.value.villain))
// the card presented: the stage entering play, the villain now active, or the last one defeated
const shown = computed(() => card(r.value.kind === 'stage' ? r.value.to : r.value.kind === 'crew' ? r.value.active : r.value.villain))
const title = computed(() => ({
  stage: `${nameOf(shown.value)} passe à l'étape ${def(shown.value).st}`,
  crew: `${nameOf(from.value)} est vaincu`,
  victory: 'Victoire !'
})[r.value.kind])
const kept = computed(() => STATUSES.filter(st => shown.value[st.id]).map(st => st.label))
const scheme = computed(() => r.value.scheme && card(r.value.scheme))
const prevented = computed(() => (scheme.value && VICTORY[scheme.value.g]) || `Vous avez déjoué les plans de ${nameOf(from.value)}.`)
const side = computed(() => r.value.side && card(r.value.side))

function restart() {
  game.restart()
  ui.closeModal()
}
</script>

<template>
  <BaseModal :title="title">
    <div class="show" :class="r.kind">
      <div class="art" :class="{ defeated: r.kind === 'victory' }">
        <GameCard :card="bareCard(shown)" :face="true" inert />
        <span v-if="r.kind === 'victory'" class="stamp">Vaincu</span>
      </div>
      <div class="txt">
        <template v-if="r.kind === 'stage'">
          <p>{{ stage(from) }} est vaincu. <strong>{{ stage(shown) }}</strong> entre en jeu avec <strong>{{ def(shown).hp }} PV</strong>.</p>
          <p v-if="kept.length">Ses cartes d'état restent : {{ kept.join(', ') }}.</p>
          <p class="note">Les attachements du méchant restent en jeu ; les dégâts ne sont pas reportés.</p>
        </template>
        <template v-else-if="r.kind === 'crew'">
          <p>{{ nameOf(from) }} quitte la partie<template v-if="side"> avec sa manigance annexe « {{ nameOf(side) }} »</template>.</p>
          <p>Jeton Actif sur <strong>{{ nameOf(shown) }}</strong> : les piles Rencontre affichées sont désormais les siennes.</p>
        </template>
        <template v-else>
          <p><strong>{{ game.s.crew ? 'Les Démolisseurs sont vaincus' : `${nameOf(shown)} est vaincu` }}</strong> en {{ game.turn }} tour{{ game.turn > 1 ? 's' : '' }}.</p>
          <blockquote>
            <span v-if="scheme" class="scheme">{{ nameOf(scheme) }}</span>
            {{ prevented }}
          </blockquote>
        </template>
      </div>
    </div>
    <div class="row">
      <template v-if="r.kind === 'victory'">
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
