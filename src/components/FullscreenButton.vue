<script setup>
// Le bouton plein écran de la barre du haut (partie et accueil), juste avant « ? » : quatre coins qui
// s'écartent pour y entrer, qui se resserrent pour en sortir, penchés comme le texte des onglets. Absent là
// où le navigateur ne permet pas le plein écran (iPhone). Son style d'onglet vient de la barre (class).
import { useFullscreen } from '../composables/useFullscreen.js'

const { isSupported, isFullscreen, toggle } = useFullscreen()
</script>

<template>
  <button v-if="isSupported" type="button" aria-label="Plein écran" :aria-pressed="isFullscreen"
    :title="isFullscreen ? 'Quitter le plein écran (Échap)' : 'Plein écran'" @click="toggle">
    <svg class="icon" viewBox="0 0 24 24" width="25" height="25" aria-hidden="true">
      <path v-if="isFullscreen" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />
      <path v-else d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  </button>
</template>

<style scoped>
.icon { flex: none; fill: none; stroke: currentColor; stroke-width: 2.8; stroke-linecap: square; transform: skewX(-10deg); }
</style>
