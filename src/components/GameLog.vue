<script setup>
// Le journal de la partie (onglet « Journal » de la colonne de droite) : les derniers messages, l'heure
// devant ; les messages de règle sont mis en valeur. Il défile tout seul jusqu'au dernier message.
import { ref, computed, watch, nextTick } from 'vue'
import { useGameStore } from '../stores/game.js'

/** Nombre de messages affichés (le journal en garde plus, voir logMessage). */
const SHOWN_ENTRIES = 90

const gameStore = useGameStore()
const logElement = ref(null)
const entries = computed(() => gameStore.game?.log.slice(-SHOWN_ENTRIES) ?? [])

// défile jusqu'au dernier message à chaque nouveau message. On surveille le dernier message lui-même : la
// longueur du journal, elle, ne change plus une fois sa limite atteinte (les plus anciens s'effacent)
watch(() => gameStore.game?.log.at(-1), async () => {
  await nextTick()
  if (logElement.value) logElement.value.scrollTop = logElement.value.scrollHeight
}, { immediate: true })
</script>

<template>
  <div ref="logElement" class="log">
    <p v-for="(entry, index) in entries" :key="index" :class="{ sys: entry.important }"><time>{{ entry.time }}</time>{{ entry.text }}</p>
  </div>
</template>

<style scoped>
/* dans l'onglet Journal de la colonne de droite, qui dessine le panneau */
.log { padding: 10px 12px; overflow: auto; overscroll-behavior: contain; touch-action: pan-y pinch-zoom; min-height: 0; font-size: 12.5px; line-height: 1.45; }
p { margin: 0 0 3px; }
p.sys { color: var(--brass); }
time { font-family: var(--f-mono); color: var(--muted); font-size: 11px; margin-right: 6px; }
@media (max-width: 700px) {
  .log { max-height: 220px; }
}
</style>
