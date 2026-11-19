<script setup>
// La fenêtre « Rester informé », ouverte par l'onglet du même nom sur l'accueil : l'inscription aux nouvelles
// de Gamebox Hero (SignupForm). Le bouton d'envoi est au pied, en rouge, comme l'action principale des autres
// fenêtres, relié au formulaire par son attribut form ; une fois l'adresse enregistrée, il ne reste que
// « Fermer ».
import { ref, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import SignupForm from '../SignupForm.vue'
import { useUiStore } from '../../stores/ui.js'

const ui = useUiStore()
const signupForm = ref(null)
const status = computed(() => signupForm.value?.status ?? 'idle')
</script>

<template>
  <BaseModal title="Rester informé">
    <SignupForm ref="signupForm" source="marvel-champions" title="" hide-submit />
    <template #actions>
      <span class="sp" />
      <button type="button" class="slant" @click="ui.closeModal()">{{ status === 'done' ? 'Fermer' : 'Annuler' }}</button>
      <button v-if="status !== 'done'" type="submit" class="slant red" :form="signupForm?.formId"
        :disabled="status === 'sending'">{{ status === 'sending' ? 'Envoi…' : "M'inscrire" }}</button>
    </template>
  </BaseModal>
</template>
