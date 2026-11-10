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
      <button v-for="tab in TABS" :id="`tab-${tab.id}`" :key="tab.id" type="button" role="tab" class="tab" :class="{ on: ui.sideTab === tab.id }"
        :aria-selected="ui.sideTab === tab.id" :aria-controls="`pane-${tab.id}`" :tabindex="ui.sideTab === tab.id ? 0 : -1"
        @click="ui.sideTab = tab.id" @keydown.left.prevent="moveToNextTab" @keydown.right.prevent="moveToNextTab">
        {{ tab.label }}
        <span v-if="tab.id === 'log' && unreadCount" class="badge" :title="`${unreadCount} nouvelle${unreadCount > 1 ? 's' : ''} entrée${unreadCount > 1 ? 's' : ''}`">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
      </button>
    </div>
    <CardPreview v-if="ui.sideTab === 'card'" id="pane-card" role="tabpanel" aria-labelledby="tab-card" />
    <GameLog v-else id="pane-log" role="tabpanel" aria-labelledby="tab-log" />
  </section>
</template>

<style scoped>
.side-tabs { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; overflow: hidden; }
.tabbar { display: flex; gap: 4px; padding: 0 8px; border-bottom: 1px solid var(--line); }
.tab { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; padding: 8px 10px 6px; font-family: var(--f-display); font-weight: 600; font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); transition: color .15s, border-color .15s; }
.tab.on { color: var(--fg); border-bottom-color: var(--brass); }
@media (hover: hover) and (pointer: fine) {
  .tab:not(.on):hover { color: var(--fg); }
}
.badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--brass); color: var(--brass-ink); font-family: var(--f-mono); font-size: 11px; font-weight: 600; letter-spacing: 0; display: grid; place-items: center; }
@media (pointer: coarse) {
  .tab { min-height: 40px; padding-inline: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .tab { transition: none; }
}
</style>
