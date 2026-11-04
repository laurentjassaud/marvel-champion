<script setup>
import { computed } from 'vue'
import GameCard, { bareCard } from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()

const card = computed(() => {
  const c = ui.preview && game.card(ui.preview.id)
  return c && c.kind !== 'token' ? c : null
})
const visible = computed(() => card.value && (ui.preview.face || card.value.zone === 'hand' || card.value.faceUp))
const shown = computed(() => card.value && bareCard(card.value))
</script>

<template>
  <div class="preview" aria-live="polite">
    <GameCard v-if="visible" :card="shown" :face="true" inert />
    <div v-else-if="card" class="empty">Carte face cachée</div>
    <div v-else class="empty"><span class="on-mouse">Survole</span><span class="on-touch">Touche</span> une carte pour l'agrandir</div>
  </div>
</template>

<style scoped>
/* the card grows to fill the space the side column gives it, up to 280px wide */
.preview { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px; display: grid; place-items: center; min-height: 0; container-type: size; }
.preview :deep(.card) { --w: min(280px, calc(100cqh / 1.4), 100cqw); cursor: default; }
.preview :deep(.card.land) { --w: min(290px, 100cqh, calc(100cqw / 1.4)); }
.empty { color: var(--muted); font-size: 13px; text-align: center; }
@media (max-width: 700px) {
  .preview { container-type: normal; min-height: 200px; }
  .preview :deep(.card) { --w: 150px; }
}
</style>
