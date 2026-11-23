<script>
// La fenêtre « Signaler un bug », ouverte par l'onglet du même nom de la barre du haut (TopBar) : un titre, une
// description et, si le joueur veut une réponse, son e-mail. « Envoyer » passe le rapport au script serveur du
// site (src/api/bugReport.js → server/public/api/bug-report.php), qui l'envoie par e-mail à l'auteur de l'appli,
// avec le contexte, le journal et la partie complète en pièce jointe ; aucun compte n'est nécessaire. Une fois
// parti, il ne reste que « Fermer ».
// Si le serveur ne répond pas (hors ligne, panne), le message d'erreur propose d'envoyer le même rapport depuis
// la messagerie du joueur : la partie est alors téléchargée, à joindre. La version artefact, sans serveur,
// n'a que ce chemin-là.
// Le bouton d'envoi est au pied, relié au formulaire par son attribut form (comme « Rester informé »). Sous le
// formulaire, « Ce que devient votre rapport » montre les mentions légales à sa place (LegalNotice), « Retour »
// y ramène. L'état de la partie est pris à l'ouverture : ce qu'on voit au moment de signaler. Un appui à côté
// ou Échap ferment la fenêtre comme les autres, mais le texte saisi est gardé (draft) jusqu'à l'envoi.
import { reactive } from 'vue'

/** Le titre, la description et l'e-mail en cours de saisie, gardés d'une ouverture à l'autre (jusqu'au rechargement). */
const draft = reactive({ title: '', description: '', email: '' })
</script>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import BaseModal from './BaseModal.vue'
import LegalNotice from '../LegalNotice.vue'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'
import { reportContext, reportPayload, sendBugReport, buildMailUrl, gameFileName } from '../../api/bugReport.js'

const gameStore = useGameStore()
const ui = useUiStore()
/** Le script serveur n'est pas joignable depuis la version artefact : le rapport y part de la messagerie. */
const viaServer = import.meta.env.MODE !== 'artifact'

// la partie et l'écran, pris à l'ouverture (une copie : la partie peut continuer derrière la fenêtre)
const game = gameStore.game ? JSON.parse(JSON.stringify(gameStore.game)) : null
const table = { width: Math.round(ui.tableWidth), height: Math.round(ui.tableHeight), cardWidth: ui.cardWidth }
const isTouch = globalThis.matchMedia?.('(pointer: coarse)').matches
const isInstalled = globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
const screenText = `${innerWidth} × ${innerHeight} px (×${devicePixelRatio}), ${isTouch ? 'tactile' : 'souris'}${isInstalled ? ', appli installée' : ''}`
const context = reportContext({ game, table, screen: screenText, page: `${location.origin}${location.pathname}${location.search}` })
const fileName = game ? gameFileName() : ''

/** 'idle', 'sending', 'sent' (le rapport est parti) ou 'error'. */
const status = ref('idle')
const errorMessage = ref('')
/**
 * Le genre d'erreur (BugReportError.kind) : une erreur de saisie (un champ à corriger, un envoi trop rapide) ne
 * propose pas la messagerie ; le message s'affiche quand aucun champ ne porte l'erreur.
 */
const errorKind = ref('')
const fieldErrors = ref({})
/** L'e-mail laissé avec le rapport parti, pour le remerciement. */
const sentEmail = ref('')
/** Champ piège : invisible, rempli seulement par les robots. */
const website = ref('')
let shownAt = 0
onMounted(() => { shownAt = performance.now() })

const formElement = ref(null)
const thanksElement = ref(null)
const mailUrl = computed(() => buildMailUrl({ title: draft.title, description: draft.description, context, fileName }))
/** Après une panne, le même rapport peut partir de la messagerie du joueur. */
const offersMailbox = computed(() => status.value === 'error' && errorKind.value !== 'validation')

async function submit() {
  if (status.value === 'sending') return
  fieldErrors.value = {}
  if (!draft.title.trim()) {
    fieldErrors.value = { title: 'Donnez un titre au rapport.' }
    formElement.value?.querySelector('#bug-title')?.focus()
    return
  }
  status.value = 'sending'
  try {
    await sendBugReport(reportPayload({ ...draft, context, game, website: website.value, elapsedMs: performance.now() - shownAt }))
    sentEmail.value = draft.email.trim()
    Object.assign(draft, { title: '', description: '', email: '' })
    status.value = 'sent'
    await nextTick()
    thanksElement.value?.focus()
  } catch (error) {
    status.value = 'error'
    errorKind.value = error.kind ?? 'server'
    errorMessage.value = error.message
    fieldErrors.value = error.fields ?? {}
    const firstField = Object.keys(fieldErrors.value)[0]
    if (firstField) formElement.value?.querySelector(`#bug-${firstField}`)?.focus()
  }
}

/** Télécharge la partie complète, telle qu'elle est enregistrée dans le navigateur, à joindre à l'e-mail. */
function downloadGameFile() {
  if (!game) return
  const url = URL.createObjectURL(new Blob([JSON.stringify(game)], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/**
 * Le rapport depuis la messagerie (version artefact) : la partie est téléchargée, le lien ouvre la messagerie,
 * puis le brouillon est vidé et la fenêtre se ferme, au tour suivant seulement. Vue met la page à jour avant que
 * le navigateur suive le lien : vider le brouillon pendant le clic changerait l'adresse du lien.
 */
function sendFromMailbox(event) {
  if (!draft.title.trim()) {
    event.preventDefault()
    fieldErrors.value = { title: 'Donnez un titre au rapport.' }
    return
  }
  downloadGameFile()
  setTimeout(() => {
    Object.assign(draft, { title: '', description: '', email: '' })
    ui.closeModal()
  }, 0)
}

const showsLegal = ref(false)
const legalLink = ref(null)
const backButton = ref(null)
/** Montre les mentions légales, depuis leur début, et met le focus sur « Retour » (le formulaire reste monté, caché). */
async function openLegal() {
  showsLegal.value = true
  await nextTick()
  backButton.value?.closest('.box')?.querySelector('.box-body')?.scrollTo(0, 0)
  backButton.value?.focus({ preventScroll: true })
}
async function closeLegal() {
  showsLegal.value = false
  await nextTick()
  legalLink.value?.focus()
}
</script>

<template>
  <BaseModal :title="showsLegal ? 'Mentions légales' : 'Signaler un bug'">
    <LegalNotice v-if="showsLegal" />
    <div v-else-if="status === 'sent'" class="report">
      <p ref="thanksElement" class="thanks" tabindex="-1">Merci&nbsp;! Votre rapport est bien parti.</p>
      <p v-if="sentEmail">Une réponse pourra vous arriver à {{ sentEmail }}.</p>
      <p v-else>Vous pouvez reprendre votre partie.</p>
    </div>
    <form v-show="!showsLegal && status !== 'sent'" id="bug-form" ref="formElement" class="report" novalidate
      :aria-busy="status === 'sending'" @submit.prevent="submit">
      <p v-if="viaServer">Votre rapport est envoyé à l'auteur de l'appli, avec la partie en cours et son journal, pour
        reproduire le problème. Aucun compte n'est nécessaire.</p>
      <p v-else>Votre messagerie s'ouvre avec le rapport déjà écrit, à envoyer à l'auteur de l'appli. La partie en
        cours est téléchargée en même temps (<strong>{{ fileName }}</strong>)&nbsp;: joignez ce fichier au message, il
        permet de reproduire le problème.</p>
      <div class="field">
        <label for="bug-title" class="label">Titre</label>
        <input id="bug-title" v-model="draft.title" class="input" type="text" maxlength="120" autocomplete="off"
          placeholder="Un titre concis" :aria-invalid="fieldErrors.title ? 'true' : undefined"
          :aria-describedby="fieldErrors.title ? 'bug-title-error' : undefined">
        <p v-if="fieldErrors.title" id="bug-title-error" class="error">{{ fieldErrors.title }}</p>
      </div>
      <div class="field">
        <label for="bug-description" class="label">Description</label>
        <textarea id="bug-description" v-model="draft.description" class="input" rows="4" maxlength="5000"
          placeholder="Ce qui s'est passé, et ce que vous attendiez" />
      </div>
      <div v-if="viaServer" class="field">
        <label for="bug-email" class="label">Votre e-mail <span class="optional">(facultatif)</span></label>
        <input id="bug-email" v-model="draft.email" class="input" type="email" inputmode="email" autocomplete="email"
          autocapitalize="off" spellcheck="false" maxlength="254" placeholder="Seulement pour vous répondre"
          :aria-invalid="fieldErrors.email ? 'true' : undefined" :aria-describedby="fieldErrors.email ? 'bug-email-error' : undefined">
        <p v-if="fieldErrors.email" id="bug-email-error" class="error">{{ fieldErrors.email }}</p>
      </div>
      <!-- champ piège : invisible pour les joueurs, rempli par les robots -->
      <div class="trap" aria-hidden="true">
        <label for="bug-website">Ne pas remplir ce champ</label>
        <input id="bug-website" v-model="website" type="text" name="website" tabindex="-1" autocomplete="off">
      </div>
      <p v-if="status === 'error' && !Object.keys(fieldErrors).length" class="alert" role="alert">{{ errorMessage }}
        <template v-if="offersMailbox"> Vous pouvez aussi <a :href="mailUrl" @click="downloadGameFile">l'envoyer depuis
          votre messagerie</a>, avec la partie téléchargée en pièce jointe.</template></p>
      <p class="hint"><button ref="legalLink" type="button" class="legal-link" @click="openLegal">Ce que devient votre rapport</button></p>
    </form>
    <template #actions>
      <span class="sp" />
      <button v-if="showsLegal" ref="backButton" type="button" class="modal-btn primary" @click="closeLegal">Retour</button>
      <button v-else-if="status === 'sent'" type="button" class="modal-btn primary" @click="ui.closeModal()">Fermer</button>
      <template v-else>
        <button type="button" class="modal-btn" @click="ui.closeModal()">Annuler</button>
        <button v-if="viaServer" type="submit" form="bug-form" class="modal-btn primary" :disabled="status === 'sending'">
          {{ status === 'sending' ? 'Envoi…' : 'Envoyer' }}</button>
        <a v-else class="modal-btn primary" :href="mailUrl" @click="sendFromMailbox">Envoyer par e-mail</a>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
/* le texte des fenêtres (.modal p, main.css) ; les champs, erreurs et lien comme ceux de « Rester informé »
   (SignupForm, SignupModal) */
.report { display: grid; gap: 14px; }
.report strong { color: var(--fg); font-weight: 600; overflow-wrap: anywhere; }
.thanks { color: var(--fg); font-weight: 600; }
.thanks:focus { outline: none; }
.field { display: grid; gap: 6px; }
.label { font: italic 700 20px/1.1 var(--font-display); letter-spacing: -.01em; text-transform: uppercase; color: var(--label); }
.optional { font: 400 14px/1 var(--font-text); letter-spacing: 0; text-transform: none; color: var(--muted); }
.input {
  width: 100%; min-height: 40px; padding: 8px 12px; font: inherit;
  background: rgb(17 23 50 / .6); border: 1px solid #34426c; border-radius: 6px; color: var(--fg);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
textarea.input { min-height: 96px; resize: vertical; line-height: 1.45; }
.input::placeholder { color: #6567c6; }
.input:focus-visible { outline: none; border-color: var(--yellow); box-shadow: 0 0 0 1px var(--yellow); }
.input[aria-invalid='true'] { border-color: var(--danger); }
.input[aria-invalid='true']:focus-visible { box-shadow: 0 0 0 1px var(--danger); }
.error { margin: 0; font-size: 14px; color: var(--danger); }
.error::before { content: '⚠ '; }
.alert { margin: 0; padding: 8px 12px; border-left: 3px solid var(--danger); background: rgb(255 106 90 / .1); color: var(--fg); font-size: 14px; }
.alert a { color: var(--label); }
.hint { font-size: 14px; }
.legal-link {
  padding: 0; border: 0; background: none; cursor: pointer;
  font: inherit; color: var(--label); text-decoration: underline; text-underline-offset: 2px;
}
.legal-link:focus-visible, .alert a:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
.trap { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
/* « Envoyer par e-mail » (version artefact) est un lien : sans soulignement */
a.modal-btn { text-decoration: none; }
/* sous 16 px, iOS zoome la page quand le champ prend le focus */
@media (pointer: coarse) {
  .input { font-size: 16px; min-height: 44px; }
}
</style>
