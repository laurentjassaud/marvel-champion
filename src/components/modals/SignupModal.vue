<script setup>
// La fenêtre « Rester informé », ouverte par l'onglet du même nom sur l'accueil : l'inscription aux nouvelles
// de Gamebox Hero (SignupForm). Le bouton d'envoi est au pied, en jaune, comme l'action principale des autres
// fenêtres, relié au formulaire par son attribut form ; une fois l'adresse enregistrée, il ne reste que
// « Fermer ».
// Sous le formulaire, « Vos données et vos droits » montre les mentions légales (LegalNotice) à sa place, dans
// la même fenêtre : le formulaire reste monté, caché, et ce qui est déjà saisi est encore là au retour.
import { ref, computed, nextTick } from 'vue'
import BaseModal from './BaseModal.vue'
import SignupForm from '../SignupForm.vue'
import LegalNotice from '../LegalNotice.vue'
import { useUiStore } from '../../stores/ui.js'

const ui = useUiStore()
const signupForm = ref(null)
const status = computed(() => signupForm.value?.status ?? 'idle')

const showsLegal = ref(false)
const legalLink = ref(null)
const backButton = ref(null)
/** Montre les mentions légales, depuis leur début, et met le focus sur « Retour » (le lien est caché). */
async function openLegal() {
  showsLegal.value = true
  await nextTick()
  backButton.value?.closest('.box')?.querySelector('.box-body')?.scrollTo(0, 0)
  backButton.value?.focus({ preventScroll: true })
}
/** Revient au formulaire, le focus sur le lien qui l'avait quitté. */
async function closeLegal() {
  showsLegal.value = false
  await nextTick()
  legalLink.value?.focus()
}
</script>

<template>
  <BaseModal :title="showsLegal ? 'Mentions légales' : 'Rester informé'">
    <SignupForm v-show="!showsLegal" ref="signupForm" source="marvel-champions" title="" hide-submit>
      <template #privacy>
        <button ref="legalLink" type="button" class="legal-link" @click="openLegal">Vos données et vos droits</button>
      </template>
    </SignupForm>
    <LegalNotice v-if="showsLegal" />
    <template #actions>
      <span class="sp" />
      <button v-if="showsLegal" ref="backButton" type="button" class="modal-btn primary" @click="closeLegal">Retour</button>
      <template v-else>
        <button type="button" class="modal-btn" @click="ui.closeModal()">{{ status === 'done' ? 'Fermer' : 'Annuler' }}</button>
        <button v-if="status !== 'done'" type="submit" class="modal-btn primary" :form="signupForm?.formId"
          :disabled="status === 'sending'">{{ status === 'sending' ? 'Envoi…' : "M'inscrire" }}</button>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
/* un lien, comme celui de la politique de confidentialité de SignupForm, mais qui reste dans la fenêtre */
.legal-link {
  padding: 0; border: 0; background: none; cursor: pointer;
  font: inherit; color: var(--label); text-decoration: underline; text-underline-offset: 2px;
}
.legal-link:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
</style>
