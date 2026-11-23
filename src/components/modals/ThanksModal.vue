<script setup>
// La fenêtre « Remerciements », ouverte par le lien du même nom en bas de l'accueil (IntroScreen, à côté des
// mentions légales) : Ireception, de cgbuilder, pour l'autorisation d'utiliser ses packs d'images (les scans
// français des cartes lues sur MarvelCDB, useAssets.js), et la communauté qui traduit les cartes. Le lien vers
// cgbuilder s'ouvre dans une nouvelle fenêtre.
import BaseModal from './BaseModal.vue'
import { useUiStore } from '../../stores/ui.js'

const ui = useUiStore()
const CGBUILDER_URL = 'https://mc.cgbuilder.fr/'
</script>

<template>
  <BaseModal title="Remerciements">
    <div class="thanks">
      <p>Merci à <strong>Ireception</strong>, du site <a :href="CGBUILDER_URL" target="_blank" rel="noopener noreferrer">mc.cgbuilder.fr</a>,
        pour l'autorisation d'utiliser ses packs d'images.</p>
      <p>Merci aussi à tous les membres de la communauté qui travaillent sur les traductions.</p>
    </div>
    <template #actions>
      <button type="button" class="modal-btn primary" @click="ui.closeModal()">Fermer</button>
    </template>
  </BaseModal>
</template>

<style scoped>
/* le texte des fenêtres (.modal p, main.css), comme « À propos » */
.thanks { display: grid; gap: 14px; }
strong { color: var(--fg); font-weight: 600; }
a { color: var(--label); }
a:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
</style>
