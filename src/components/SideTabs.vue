<script setup>
// La colonne de droite, sous les piles Rencontre : la carte agrandie ou le journal, un onglet à la fois.
// L'onglet Journal compte les messages arrivés pendant qu'on regardait la carte.
import { ref, computed, watch } from 'vue'
import CardPreview from './CardPreview.vue'
import GameLog from './GameLog.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const TABS = [{ id: 'card', label: 'Carte' }, { id: 'log', label: 'Journal' }]

// Les messages écrits pendant que le journal est caché sont comptés sur son onglet. Le journal ne garde que
// ses 300 derniers messages : le dernier message lu est suivi par son identité, pas par sa position ; une
// nouvelle partie commence non lue.
const log = computed(() => gameStore.game?.log ?? [])
/** Le dernier message lu ; à l'ouverture de la page, le journal de la partie enregistrée compte comme lu. */
const lastReadEntry = ref(log.value.at(-1) ?? null)
watch(() => ui.sideTab, (tab, previousTab) => { if (previousTab === 'log') lastReadEntry.value = log.value.at(-1) ?? null })
const unreadCount = computed(() => {
  if (ui.sideTab === 'log') return 0
  const lastReadIndex = lastReadEntry.value ? log.value.lastIndexOf(lastReadEntry.value) : -1
  return log.value.length - 1 - lastReadIndex
})

const tabBar = ref(null)
// les flèches gauche et droite passent d'un onglet à l'autre (modèle d'onglets WAI-ARIA)
function moveToNextTab(event) {
  const offset = event.key === 'ArrowRight' ? 1 : TABS.length - 1
  const nextIndex = (TABS.findIndex(tab => tab.id === ui.sideTab) + offset) % TABS.length
  ui.sideTab = TABS[nextIndex].id
  tabBar.value?.querySelectorAll('[role="tab"]')[nextIndex]?.focus()
}
</script>

<template>
  <section class="side-tabs">
    <div ref="tabBar" class="tabbar" role="tablist" aria-label="Panneau latéral">
      <button v-for="tab in TABS" :id="`tab-${tab.id}`" :key="tab.id" type="button" role="tab" class="slant tab"
        :class="{ dim: ui.sideTab !== tab.id }" :aria-selected="ui.sideTab === tab.id" :aria-controls="`pane-${tab.id}`"
        :tabindex="ui.sideTab === tab.id ? 0 : -1" @click="ui.sideTab = tab.id" @keydown.left.prevent="moveToNextTab"
        @keydown.right.prevent="moveToNextTab">
        {{ tab.label }}
        <span v-if="tab.id === 'log' && unreadCount" class="badge"
          :title="`${unreadCount} nouvelle${unreadCount > 1 ? 's' : ''} entrée${unreadCount > 1 ? 's' : ''}`">{{
            unreadCount > 9 ? '9+' : unreadCount }}</span>
      </button>
    </div>
    <div class="pane">
      <CardPreview v-if="ui.sideTab === 'card'" id="pane-card" role="tabpanel" aria-labelledby="tab-card" />
      <GameLog v-else id="pane-log" role="tabpanel" aria-labelledby="tab-log" />
    </div>
  </section>
</template>

<style scoped>
/* les onglets en biais de la maquette au-dessus d'un panneau translucide posé sur la table */
.side-tabs {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  min-height: 0;
}

.tabbar {
  display: flex;
}

.tab {
  --h: 36px;
  --lip-h: 4px;
  padding-inline: 26px;
}

.tab+.tab {
  margin-left: -14px;
}

.tab[aria-selected="true"] {
  cursor: default;
}

.tab[aria-selected="true"]:active {
  transform: none;
}

.pane {
  /* une seule rangée, de la hauteur du panneau : la carte agrandie s'y ajuste (CardPreview) */
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  /* la place du filet, dessiné par ::before */
  padding: 1px;
  border-radius: 12px;
}

/* le fond et le filet du panneau s'estompent de haut en bas, de 100 % à 0 % d'opacité ; le dégradé est un
   masque posé sur ce calque seulement : la carte agrandie et le journal restent nets */
.pane::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border: 1px solid var(--line);
  border-radius: inherit;
  background: var(--panel-glass);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .05);
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent);
  mask-image: linear-gradient(to bottom, #000, transparent);
  pointer-events: none;
}

.badge {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--yellow);
  color: var(--brass-ink);
  font: normal 600 14px/1 var(--font-text);
  letter-spacing: 0;
  display: grid;
  place-items: center;
}

@media (pointer: coarse) {
  .tab {
    --h: 44px;
  }
}
</style>
