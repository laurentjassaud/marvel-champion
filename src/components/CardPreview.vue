<script setup>
// La carte agrandie (onglet « Carte » de la colonne de droite) : la carte survolée ou touchée, telle
// qu'imprimée, aussi grande que le panneau le permet, toujours entière.
import { computed } from 'vue'
import GameCard, { zoomedCard } from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()

/** La carte à montrer : pas un pion, ni une étape de méchant vaincue (hors jeu). */
const previewedCard = computed(() => {
  const card = ui.preview && gameStore.cardById(ui.preview.cardId)
  return card && !card.isPawn && card.zone !== 'outOfGame' ? card : null
})
/** On peut voir sa face : demandée, ou une carte de la main, ou une carte face visible. */
const isFaceVisible = computed(() => previewedCard.value && (ui.preview.showFace || previewedCard.value.zone === 'hand' || previewedCard.value.faceUp))
const shownCard = computed(() => previewedCard.value && zoomedCard(previewedCard.value))
</script>

<template>
  <div class="preview" aria-live="polite">
    <GameCard v-if="isFaceVisible" :card="shownCard" :show-face="true" inert />
    <div v-else-if="previewedCard" class="empty">Carte face cachée</div>
    <div v-else class="empty"><span class="on-mouse">Survole</span><span class="on-touch">Touche</span> une carte pour
      l'agrandir</div>
  </div>
</template>

<style scoped>
/* La carte tient toujours entière dans le panneau, en gardant son format : toute sa hauteur (100cqh), ou toute
   sa largeur (100cqw) quand la colonne est trop étroite pour elle. Le panneau a la hauteur que lui laissent
   les piles Rencontre (SideTabs), et la carte n'y entre pas en compte (container-type: size). */
.preview {
  display: grid;
  padding: 10px;
  min-height: 0;
  overflow: hidden;
  container-type: size;
  align-content: start;
}

.preview :deep(.card) {
  --w: min(100cqw, 100cqh / 1.4);
  place-self: center;
  cursor: default;
}

/* une carte couchée (manigance) : 1,4 largeur de carte de large, une de haut */
.preview :deep(.card.land) {
  --w: min(100cqw / 1.4, 100cqh);
}

.empty {
  place-self: center;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

/* téléphones : une seule colonne sous la table, sans hauteur imposée ; la carte garde une taille raisonnable */
@media (max-width: 700px) {
  .preview {
    min-height: 200px;
    container-type: inline-size;
  }

  .preview :deep(.card) {
    --w: min(100cqw, 260px);
  }

  .preview :deep(.card.land) {
    --w: min(calc(100cqw / 1.4), 220px);
  }
}
</style>
