<script setup>
// La fenêtre « Mentions légales », ouverte par le lien en bas de l'accueil : l'éditeur, l'hébergeur et ce que
// l'appli fait des données personnelles (LegalNotice).
import BaseModal from './BaseModal.vue'
import LegalNotice from '../LegalNotice.vue'
import { useUiStore } from '../../stores/ui.js'

const ui = useUiStore()
</script>

<template>
  <BaseModal title="Mentions légales">
    <LegalNotice />
    <template #actions>
      <button type="button" class="modal-btn primary" @click="ui.closeModal()">Fermer</button>
    </template>
  </BaseModal>
</template>
