<script setup>
// Le formulaire « Rester informé » : le visiteur laisse son nom et son e-mail pour recevoir les nouvelles de
// Gamebox Hero. Envoi vers le script serveur api/signup.php (src/api/signup.js), installé sur le VPS à part
// (dossier gamebox-signup) : il enregistre l'adresse, et la mailing list part ensuite de là.
// Contrôles avant l'envoi (nom, format de l'adresse, consentement), puis ceux du serveur (domaine qui reçoit
// du courrier, anti-spam : champ piège invisible, délai minimal d'1,5 s, 5 envois par heure). Une fois inscrit,
// le navigateur garde le nom (localStorage, clé gbh-signup) : le formulaire affiche « Merci… » aux visites
// suivantes, avec de quoi enregistrer une autre adresse.
//
//   <SignupForm source="marvel-champions" privacy-url="…" hide-submit @success="…" />
// hide-submit : le bouton d'envoi est posé ailleurs (le pied d'une fenêtre, SignupModal), relié au formulaire
// par son attribut form="…" : le composant expose formId et status ('idle', 'sending', 'done').
import { nextTick, onMounted, reactive, ref, useId, watch } from 'vue'
import { sendSignup } from '../api/signup.js'

const props = defineProps({
  /** Origine de l'inscription, enregistrée avec l'adresse (le même script peut servir d'autres modules). */
  source: { type: String, default: 'marvel-champions' },
  /** Titre affiché en tête ; vide dans une fenêtre, qui a déjà le sien. */
  title: { type: String, default: 'Rester informé' },
  intro: {
    type: String,
    default: 'Laissez votre nom et votre e-mail : nous vous préviendrons des nouveaux héros, scénarios et modules Gamebox Hero.'
  },
  /** Lien vers la politique de confidentialité, affiché sous la case à cocher. */
  privacyUrl: { type: String, default: '' },
  /** Pas de bouton d'envoi dans le formulaire : il est posé ailleurs (voir plus haut). */
  hideSubmit: Boolean
})
const emit = defineEmits(['success'])

const STORAGE_KEY = 'gbh-signup'
const NAME_MAX = 80
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD_ORDER = ['name', 'email', 'consent']

const uid = useId()
const ids = {
  form: `${uid}-form`,
  title: `${uid}-title`,
  name: `${uid}-name`,
  email: `${uid}-email`,
  consent: `${uid}-consent`,
  website: `${uid}-website`
}

/** Le nom gardé après une inscription précédente : lu tout de suite, la fenêtre s'ouvre sur le bon écran. */
function savedName() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')?.name || ''
  } catch {
    return '' // stockage indisponible (navigation privée, quota) : on affiche le formulaire
  }
}

const form = reactive({ name: '', email: '', consent: false, website: '' })
const errors = reactive({ name: '', email: '', consent: '' })
const doneName = ref(savedName())
/** 'idle' (à remplir), 'sending' (envoi en cours) ou 'done' (inscrit). */
const status = ref(doneName.value ? 'done' : 'idle')
const globalError = ref('')
const submitted = ref(false)
const doneMessage = ref(null)
let shownAt = 0

onMounted(() => { shownAt = performance.now() })

function checkFields() {
  const found = { name: '', email: '', consent: '' }
  const name = form.name.trim()
  const email = form.email.trim()
  if (!name) found.name = 'Indiquez votre nom.'
  else if (name.length > NAME_MAX) found.name = `Le nom ne doit pas dépasser ${NAME_MAX} caractères.`
  if (!email) found.email = 'Indiquez votre adresse e-mail.'
  else if (!EMAIL_RE.test(email)) found.email = 'Format attendu : nom@exemple.fr'
  if (!form.consent) found.consent = "Cochez la case pour accepter l'enregistrement de votre adresse."
  return found
}

function setErrors(found) {
  for (const key of FIELD_ORDER) errors[key] = found[key] || ''
}

function focusFirstError() {
  const first = FIELD_ORDER.find(key => errors[key])
  if (first) document.getElementById(ids[first])?.focus()
  return Boolean(first)
}

// après un premier envoi, les messages se mettent à jour pendant la saisie
watch(
  () => [form.name, form.email, form.consent],
  () => { if (submitted.value && status.value === 'idle') setErrors(checkFields()) }
)

async function onSubmit() {
  if (status.value === 'sending') return
  submitted.value = true
  globalError.value = ''
  setErrors(checkFields())
  if (focusFirstError()) return

  status.value = 'sending'
  const name = form.name.trim()
  const email = form.email.trim()
  try {
    await sendSignup({
      name,
      email,
      consent: form.consent,
      website: form.website,
      elapsedMs: Math.round(performance.now() - shownAt),
      source: props.source
    })
  } catch (error) {
    status.value = 'idle'
    setErrors(error.fields || {})
    globalError.value = error.message
    await nextTick()
    focusFirstError()
    return
  }

  doneName.value = name
  status.value = 'done'
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, at: Date.now() }))
  } catch {
    // pas grave : seul l'affichage « déjà inscrit » est perdu
  }
  emit('success', { name, email })
  await nextTick()
  doneMessage.value?.focus()
}

function restart() {
  Object.assign(form, { name: '', email: '', consent: false, website: '' })
  setErrors({})
  submitted.value = false
  globalError.value = ''
  status.value = 'idle'
  shownAt = performance.now()
  nextTick(() => document.getElementById(ids.name)?.focus())
}

defineExpose({ status, formId: ids.form })
</script>

<template>
  <section class="signup" :aria-labelledby="title ? ids.title : undefined">
    <h2 v-if="title" :id="ids.title" class="signup-title">{{ title }}</h2>

    <div v-if="status === 'done'" class="done">
      <p ref="doneMessage" class="lead" tabindex="-1">Merci {{ doneName }}, votre adresse est bien enregistrée.</p>
      <p class="hint">Vous recevrez les nouvelles de Gamebox Hero. Un lien de désinscription figure dans chaque message.</p>
      <button type="button" class="btn" @click="restart">Enregistrer une autre adresse</button>
    </div>

    <form v-else :id="ids.form" class="fields" novalidate :aria-busy="status === 'sending'" @submit.prevent="onSubmit">
      <p class="intro">{{ intro }}</p>
      <p class="hint">Tous les champs sont obligatoires.</p>

      <div class="field">
        <label :for="ids.name" class="label">Nom</label>
        <input :id="ids.name" v-model="form.name" class="input" type="text" name="name" autocomplete="name"
          :maxlength="NAME_MAX" required :aria-invalid="errors.name ? 'true' : undefined"
          :aria-describedby="errors.name ? `${ids.name}-error` : undefined">
        <p v-if="errors.name" :id="`${ids.name}-error`" class="error">{{ errors.name }}</p>
      </div>

      <div class="field">
        <label :for="ids.email" class="label">E-mail <span class="example">(exemple : nom@exemple.fr)</span></label>
        <input :id="ids.email" v-model="form.email" class="input" type="email" name="email" inputmode="email"
          autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="254" required
          :aria-invalid="errors.email ? 'true' : undefined" :aria-describedby="errors.email ? `${ids.email}-error` : undefined">
        <p v-if="errors.email" :id="`${ids.email}-error`" class="error">{{ errors.email }}</p>
      </div>

      <div class="field check">
        <input :id="ids.consent" v-model="form.consent" class="checkbox" type="checkbox" name="consent" required
          :aria-invalid="errors.consent ? 'true' : undefined" :aria-describedby="errors.consent ? `${ids.consent}-error` : undefined">
        <label :for="ids.consent" class="check-label">J'accepte que Gamebox Hero conserve mon nom et mon e-mail pour
          m'envoyer ses nouvelles. Je peux me désinscrire à tout moment.</label>
        <p v-if="errors.consent" :id="`${ids.consent}-error`" class="error">{{ errors.consent }}</p>
      </div>
      <p v-if="privacyUrl" class="hint"><a :href="privacyUrl" class="link" target="_blank" rel="noopener">Politique de confidentialité</a></p>

      <!-- champ piège : invisible pour les visiteurs, rempli par les robots -->
      <div class="trap" aria-hidden="true">
        <label :for="ids.website">Ne pas remplir ce champ</label>
        <input :id="ids.website" v-model="form.website" type="text" name="website" tabindex="-1" autocomplete="off">
      </div>

      <p v-if="globalError" class="alert" role="alert">{{ globalError }}</p>

      <button v-if="!hideSubmit" type="submit" class="slant red submit" :disabled="status === 'sending'">
        {{ status === 'sending' ? 'Envoi en cours…' : "M'inscrire" }}
      </button>
      <p class="sr" role="status">{{ status === 'sending' ? 'Envoi en cours' : '' }}</p>
    </form>
  </section>
</template>

<style scoped>
/* aux couleurs de la table : libellés en Barlow comme ceux des fenêtres, champs comme celui du lien MarvelCDB
   (« Préparation de la partie »), contour jaune au focus, erreurs en rouge clair */
.signup { max-width: 34rem; }
.signup-title {
  margin: 0 0 12px; font: italic 700 28px/1.1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
}
.fields, .done { display: grid; gap: 16px; }
.intro, .lead { margin: 0; line-height: 1.5; }
.lead { color: var(--fg); font-weight: 600; }
.lead:focus { outline: none; }
.hint { margin: -6px 0 0; font-size: 14px; color: var(--muted); }
.done .btn { justify-self: start; }

.field { display: grid; gap: 6px; }
.label { font: italic 700 20px/1.1 var(--font-display); letter-spacing: -.01em; text-transform: uppercase; color: var(--label); }
.example { font: 400 14px/1 var(--font-text); letter-spacing: 0; text-transform: none; color: var(--muted); }
.input {
  width: 100%; min-height: 40px; padding: 8px 12px;
  background: rgb(17 23 50 / .6); border: 1px solid #34426c; border-radius: 6px; color: var(--fg);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.input:focus-visible { outline: none; border-color: var(--yellow); box-shadow: 0 0 0 1px var(--yellow); }
.input[aria-invalid='true'] { border-color: var(--danger); }
.input[aria-invalid='true']:focus-visible { box-shadow: 0 0 0 1px var(--danger); }
/* sous 16 px, iOS zoome la page quand le champ prend le focus */
@media (pointer: coarse) {
  .input { font-size: 16px; min-height: 44px; }
}

.check { grid-template-columns: auto 1fr; gap: 6px 12px; align-items: start; }
.checkbox { width: 20px; height: 20px; margin: 1px 0 0; accent-color: var(--yellow); cursor: pointer; }
.checkbox:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
.checkbox[aria-invalid='true'] { outline: 1px solid var(--danger); outline-offset: 2px; }
.check-label { line-height: 1.45; color: var(--muted); cursor: pointer; }
.check .error { grid-column: 2; }

.error { margin: 0; font-size: 14px; color: var(--danger); }
.error::before { content: '⚠ '; }
.alert { margin: 0; padding: 8px 12px; border-left: 3px solid var(--danger); background: rgb(255 106 90 / .1); color: var(--fg); font-size: 14px; }
.link { color: var(--label); }
.link:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
.submit { justify-self: start; }

.trap, .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.trap { left: -10000px; }
</style>
