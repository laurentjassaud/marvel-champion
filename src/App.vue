<script setup>
// L'application (maquette Figma « Table de jeu ») : la barre du haut ; la table, avec à gauche le décor et
// les PV du méchant, et à droite les piles Rencontre au-dessus des onglets Carte / Journal ; en bas, de bord
// à bord, le bandeau du joueur (piles, main en éventail, tour et PV). Puis les fenêtres (une seule ouverte à
// la fois) et le menu contextuel. Au lancement, la page d'accueil couvre le tout : la table est déjà montée et
// mesurée dessous, mais inerte (ni clavier, ni lecteur d'écran) tant que l'accueil est là.
import { onMounted } from 'vue'
import IntroScreen from './components/IntroScreen.vue'
import TopBar from './components/TopBar.vue'
import VillainBackdrop from './components/VillainBackdrop.vue'
import VillainHud from './components/VillainHud.vue'
import GameTable from './components/GameTable.vue'
import CardPile from './components/CardPile.vue'
import PlayerDock from './components/PlayerDock.vue'
import SideTabs from './components/SideTabs.vue'
import SideResizer from './components/SideResizer.vue'
import ContextMenu from './components/ContextMenu.vue'
import PawnTray from './components/PawnTray.vue'
import SetupModal from './components/modals/SetupModal.vue'
import PileModal from './components/modals/PileModal.vue'
import MulliganModal from './components/modals/MulliganModal.vue'
import HelpModal from './components/modals/HelpModal.vue'
import SignupModal from './components/modals/SignupModal.vue'
import LegalModal from './components/modals/LegalModal.vue'
import AboutModal from './components/modals/AboutModal.vue'
import BugReportModal from './components/modals/BugReportModal.vue'
import ThanksModal from './components/modals/ThanksModal.vue'
import RestartModal from './components/modals/RestartModal.vue'
import VillainModal from './components/modals/VillainModal.vue'
import SchemeModal from './components/modals/SchemeModal.vue'
import DefeatModal from './components/modals/DefeatModal.vue'
import ReshuffleModal from './components/modals/ReshuffleModal.vue'
import { useGameStore } from './stores/game.js'
import { useUiStore } from './stores/ui.js'
import { usePointer } from './composables/usePointer.js'
import { useKeyboard } from './composables/useKeyboard.js'
import { usePreload } from './composables/usePreload.js'
import { useDealAnimation } from './composables/useDealAnimation.js'

const gameStore = useGameStore()
const ui = useUiStore()
usePointer()
useKeyboard()
// les images des cartes de la partie, chargées en tâche de fond et gardées (aussi hors ligne)
usePreload()
// à chaque mise en place, les cartes partent de leur paquet et se posent à leur place
useDealAnimation()

// les composants enfants sont montés d'abord : la table est déjà mesurée ici
onMounted(() => { if (!gameStore.isReady) gameStore.startExampleGame() })
</script>

<template>
  <!-- « Lancer la partie » (ui.launchGame) : scene-out pendant la sortie, scene-in pendant l'entrée de la
       table (main.css, « changement de scène ») -->
  <div class="app" :class="{ 'scene-out': ui.scene === 'out', 'scene-in': ui.scene === 'in', 'under-intro': ui.introOpen }">
    <!-- derrière tout le reste, sans rien capter ; il refait son entrée avec la table (sceneCount) -->
    <VillainBackdrop :key="ui.sceneCount" />
    <TopBar :inert="ui.introOpen" />
    <!-- --side : la largeur de la colonne de droite, une fois son bord gauche glissé -->
    <main class="mid" :inert="ui.introOpen" :style="ui.sideColumnWidth ? { '--side': `${ui.sideColumnWidth}px` } : null">
      <!-- la table, et par-dessus, en bas à gauche, le méchant en grand -->
      <div class="play">
        <GameTable />
        <VillainHud />
      </div>
      <!-- colonne de droite, jusqu'au bandeau du joueur -->
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
    <PlayerDock :inert="ui.introOpen" />

    <!-- la page d'accueil, par-dessus la table et sous les fenêtres (« Scénarios » ouvre « Nouvelle partie ») ;
         après « Lancer la partie », elle a déjà disparu (sa sortie) : retirée aussitôt, sans fondu -->
    <Transition name="fade-intro" :css="ui.scene !== 'in'">
      <IntroScreen v-if="ui.introOpen" />
    </Transition>
    <ContextMenu />
    <PawnTray />
    <SetupModal v-if="ui.modal?.type === 'setup'" />
    <PileModal v-else-if="ui.modal?.type === 'pile'" :key="ui.modal.zone" :zone="ui.modal.zone" />
    <MulliganModal v-else-if="ui.modal?.type === 'mulligan' && gameStore.isReady" />
    <HelpModal v-else-if="ui.modal?.type === 'help'" />
    <SignupModal v-else-if="ui.modal?.type === 'signup'" />
    <LegalModal v-else-if="ui.modal?.type === 'legal'" />
    <AboutModal v-else-if="ui.modal?.type === 'about'" />
    <BugReportModal v-else-if="ui.modal?.type === 'bug'" />
    <ThanksModal v-else-if="ui.modal?.type === 'thanks'" />
    <RestartModal v-else-if="ui.modal?.type === 'restart' && gameStore.isReady" />
    <!-- une clé par changement présenté (la fenêtre repart de zéro pour le suivant), préfixée : deux branches
         d'un même v-if ne peuvent pas avoir la même clé -->
    <VillainModal v-else-if="ui.modal?.type === 'villain' && gameStore.isReady" :key="`villain-${ui.modal.result.kind}-${ui.modal.result.fromCardId}`" />
    <SchemeModal v-else-if="ui.modal?.type === 'scheme' && gameStore.isReady" :key="`scheme-${ui.modal.result.kind}-${ui.modal.result.fromCardId}`" />
    <DefeatModal v-else-if="ui.modal?.type === 'defeat' && gameStore.isReady" />
    <ReshuffleModal v-else-if="ui.modal?.type === 'reshuffle' && gameStore.isReady" />
  </div>
</template>
