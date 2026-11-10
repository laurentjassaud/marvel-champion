<script setup>
// L'application : la barre du haut, puis deux colonnes — à gauche la table au-dessus du bandeau du joueur
// (paquet, main, défausse), à droite les piles Rencontre au-dessus des onglets Carte / Journal — et les
// fenêtres (une seule ouverte à la fois) et le menu contextuel.
import { onMounted } from 'vue'
import TopBar from './components/TopBar.vue'
import GameTable from './components/GameTable.vue'
import CardPile from './components/CardPile.vue'
import HandStrip from './components/HandStrip.vue'
import SideTabs from './components/SideTabs.vue'
import SideResizer from './components/SideResizer.vue'
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
import { usePreload } from './composables/usePreload.js'

const gameStore = useGameStore()
const ui = useUiStore()
usePointer()
useKeyboard()
// les images des cartes de la partie, chargées en tâche de fond et gardées (aussi hors ligne)
usePreload()

// les composants enfants sont montés d'abord : la table est déjà mesurée ici
onMounted(() => { if (!gameStore.isReady) gameStore.startExampleGame() })
</script>

<template>
  <div class="app">
    <TopBar />
    <!-- --side : la largeur de la colonne de droite, une fois son bord gauche glissé -->
    <main class="mid" :style="ui.sideColumnWidth ? { '--side': `${ui.sideColumnWidth}px` } : null">
      <!-- colonne de gauche : la table au-dessus du bandeau du joueur (paquet, main, défausse), même largeur -->
      <div class="play">
        <GameTable />
        <footer class="bottom" :class="{ inv: gameStore.hasInvocationDeck }">
          <CardPile zone="playerDeck" label="Paquet" variant="p" title="Clic : piocher" />
          <HandStrip />
          <CardPile zone="playerDiscard" label="Défausse" variant="p" title="Clic : voir" />
          <template v-if="gameStore.hasInvocationDeck">
            <CardPile zone="invocationDeck" label="Invocation" variant="i" title="Clic : lancer l'invocation du dessus · appui long ou clic droit : autres choix" />
            <CardPile zone="invocationDiscard" label="Défausse I." variant="i" title="Clic : voir" />
          </template>
        </footer>
      </div>
      <!-- colonne de droite, jusqu'en bas de l'écran -->
      <aside class="side">
        <SideResizer />
        <div class="encrow" :class="{ x4: gameStore.scenarioDeck }">
          <CardPile zone="encounterDeck" label="Rencontre" variant="e" title="Clic : révéler" />
          <CardPile zone="encounterDiscard" label="Défausse R." variant="e" title="Clic : voir" />
          <!-- le deck propre au scénario : Armes Expérimentales (Crossbones), Manigance Annexe (Crâne Rouge) -->
          <CardPile v-if="gameStore.scenarioDeck" zone="scenarioDeck" :label="gameStore.scenarioDeck.shortName" variant="e"
            :title="`Deck ${gameStore.scenarioDeck.name} · clic : révéler la carte du dessus · appui long ou clic droit : autres choix`" />
          <CardPile zone="setAside" label="De côté" title="Clic : voir" />
        </div>
        <!-- la carte agrandie et le journal, chacun dans son onglet -->
        <SideTabs />
      </aside>
    </main>

    <ContextMenu />
    <SetupModal v-if="ui.modal?.type === 'setup'" />
    <PileModal v-else-if="ui.modal?.type === 'pile'" :key="ui.modal.zone" :zone="ui.modal.zone" />
    <MulliganModal v-else-if="ui.modal?.type === 'mulligan' && gameStore.isReady" />
    <HelpModal v-else-if="ui.modal?.type === 'help'" />
    <RestartModal v-else-if="ui.modal?.type === 'restart' && gameStore.isReady" />
    <VillainModal v-else-if="ui.modal?.type === 'villain' && gameStore.isReady" :key="ui.modal.result.kind + ui.modal.result.fromCardId" />
  </div>
</template>
