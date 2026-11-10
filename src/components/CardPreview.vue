<script setup>
// La carte agrandie (onglet « Carte » de la colonne de droite) : la carte survolée ou touchée, telle
// qu'imprimée, sur toute la largeur de la colonne.
import { ref, computed, watch } from 'vue'
import GameCard, { printedCard } from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const previewElement = ref(null)

/** La carte à montrer : pas un pion, ni une étape de méchant vaincue (hors jeu). */
const previewedCard = computed(() => {
  const card = ui.preview && gameStore.cardById(ui.preview.cardId)
  return card && !card.isPawn && card.zone !== 'outOfGame' ? card : null
})
/** On peut voir sa face : demandée, ou une carte de la main, ou une carte face visible. */
const isFaceVisible = computed(() => previewedCard.value && (ui.preview.showFace || previewedCard.value.zone === 'hand' || previewedCard.value.faceUp))
const shownCard = computed(() => previewedCard.value && printedCard(previewedCard.value))

// une carte plus haute que le panneau défile : chaque nouvelle carte est montrée depuis son haut
watch(() => ui.preview?.cardId, () => { if (previewElement.value) previewElement.value.scrollTop = 0 })
</script>

<template>
  <div ref="previewElement" class="preview" aria-live="polite">
    <GameCard v-if="isFaceVisible" :card="shownCard" :show-face="true" inert />
    <div v-else-if="previewedCard" class="empty">Carte face cachée</div>
    <div v-else class="empty"><span class="on-mouse">Survole</span><span class="on-touch">Touche</span> une carte pour l'agrandir</div>
  </div>
</template>

<style scoped>
/* La carte prend toute la largeur de la colonne de droite (colonne plus large, carte plus grande) en gardant
   son format ; plus haute que la place, elle défile (molette ou doigt, sans barre : elle rétrécirait la carte) */
.preview { display: grid; padding: 10px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y pinch-zoom; scrollbar-width: none; container-type: inline-size; }
.preview::-webkit-scrollbar { display: none; }
.preview :deep(.card) { --w: 100cqw; place-self: center; cursor: default; }
.preview :deep(.card.land) { --w: calc(100cqw / 1.4); }
.empty { place-self: center; color: var(--muted); font-size: 13px; text-align: center; }
/* téléphones : une seule colonne sous la table, la carte garde une taille raisonnable */
@media (max-width: 700px) {
  .preview { min-height: 200px; }
  .preview :deep(.card) { --w: min(100cqw, 260px); }
  .preview :deep(.card.land) { --w: min(calc(100cqw / 1.4), 220px); }
}
</style>
