<script setup>
import { onMounted } from 'vue'
import TopBar from './components/TopBar.vue'
import GameTable from './components/GameTable.vue'
import CardPile from './components/CardPile.vue'
import HandStrip from './components/HandStrip.vue'
import CardPreview from './components/CardPreview.vue'
import GameLog from './components/GameLog.vue'
import ContextMenu from './components/ContextMenu.vue'
import SetupModal from './components/modals/SetupModal.vue'
import PileModal from './components/modals/PileModal.vue'
import MulliganModal from './components/modals/MulliganModal.vue'
import HelpModal from './components/modals/HelpModal.vue'
import RestartModal from './components/modals/RestartModal.vue'
import VillainModal from './components/modals/VillainModal.vue'
import { useGameStore } from './stores/game.js'
import { useUiStore } from './stores/ui.js'
import { usePointer } from './composables/usePointer.js'
import { useKeyboard } from './composables/useKeyboard.js'

const game = useGameStore()
const ui = useUiStore()
usePointer()
useKeyboard()

// children are mounted first, so the table has been measured by now
onMounted(() => { if (!game.ready) game.defaultGame() })
</script>

<template>
  <div class="app">
    <TopBar />
    <main class="mid">
      <GameTable />
      <aside class="side">
        <div class="encrow">
          <CardPile zone="edeck" label="Rencontre" variant="e" title="Clic : révéler" />
          <CardPile zone="ediscard" label="Défausse R." variant="e" title="Clic : voir" />
          <CardPile zone="aside" label="De côté" title="Clic : voir" />
        </div>
        <CardPreview />
        <GameLog />
      </aside>
    </main>
    <footer class="bottom" :class="{ inv: game.hasInvocation }">
      <CardPile zone="deck" label="Paquet" variant="p" title="Clic : piocher" />
      <HandStrip />
      <CardPile zone="discard" label="Défausse" variant="p" title="Clic : voir" />
      <template v-if="game.hasInvocation">
        <CardPile zone="ideck" label="Invocation" variant="i" title="Clic : lancer l'invocation du dessus · appui long ou clic droit : autres choix" />
        <CardPile zone="idiscard" label="Défausse I." variant="i" title="Clic : voir" />
      </template>
    </footer>

    <ContextMenu />
    <SetupModal v-if="ui.modal?.type === 'setup'" />
    <PileModal v-else-if="ui.modal?.type === 'pile'" :key="ui.modal.zone" :zone="ui.modal.zone" />
    <MulliganModal v-else-if="ui.modal?.type === 'mulligan' && game.ready" />
    <HelpModal v-else-if="ui.modal?.type === 'help'" />
    <RestartModal v-else-if="ui.modal?.type === 'restart' && game.ready" />
    <VillainModal v-else-if="ui.modal?.type === 'villain' && game.ready" :key="ui.modal.result.kind + ui.modal.result.from" />
  </div>
</template>
