// « Signaler un bug » (onglet de la barre du haut, BugReportModal) : le rapport part au script serveur du site
// (server/public/api/bug-report.php), qui l'envoie par e-mail à l'auteur de l'appli, la partie en cours en
// pièce jointe ; le joueur n'a besoin d'aucun compte. Rien n'est enregistré sur le serveur.
//
// Le rapport : un titre, une description, l'e-mail du joueur s'il veut une réponse (facultatif), le contexte en
// clair (partie, situation, table, écran, page), les derniers messages du journal, la version de l'appli et la
// partie complète, telle qu'elle est enregistrée dans le navigateur (le serveur la joint au mail).
// Un set modulaire ou une difficulté tirés au hasard ne sont pas nommés en clair dans le contexte : la partie
// jointe, elle, les contient.
//
// Sans serveur (version artefact) ou s'il ne répond pas, le même rapport part de la messagerie du joueur
// (buildMailUrl), la partie téléchargée à joindre.
//
// L'adresse du script se règle avec VITE_BUG_REPORT_URL ; par défaut /api/bug-report.php à la racine du site,
// comme l'inscription (src/api/signup.js).

import { version as PACKAGE_VERSION } from '../../package.json'
import { SCENARIOS, heroName } from '../game/data.js'
import { setupSummary } from '../game/engine.js'

const ENDPOINT = import.meta.env.VITE_BUG_REPORT_URL || '/api/bug-report.php'
/** Le serveur envoie le mail avant de répondre : on lui laisse le temps de joindre le serveur SMTP. */
const TIMEOUT_MS = 25_000
/** L'adresse de l'onglet Contact, pour un rapport envoyé depuis la messagerie du joueur. */
export const CONTACT_EMAIL = 'contact@gameboxheroes.fr'
/** Nombre de messages du journal recopiés en clair dans le rapport (la partie jointe a tout le journal). */
export const REPORT_ENTRIES = 50

/** Version de l'appli : celle de package.json, et le commit construit (vite.config.js, __APP_COMMIT__). */
const APP_COMMIT = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : ''
export const APP_VERSION = [PACKAGE_VERSION, APP_COMMIT].filter(Boolean).join(' · ')

// un e-mail trop long est coupé par certaines messageries
const MAX_MAIL_DESCRIPTION = 1200

/** Le fichier de la partie, joint au rapport : "bug-report_mc-table_2026-11-23_08-15.json". */
export function gameFileName(date = new Date()) {
  const twoDigits = number => String(number).padStart(2, '0')
  const day = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
  return `bug-report_mc-table_${day}_${twoDigits(date.getHours())}-${twoDigits(date.getMinutes())}.json`
}

/** Les messages du journal en clair, du plus ancien au plus récent : "08:15 ★ Rhino attaque" (★ : message de règle). */
export const logLines = entries => entries.map(entry => `${entry.time ?? ''} ${entry.important ? '★ ' : ''}${entry.text ?? ''}`.trim())

/**
 * Le contexte en clair, [[libellé, valeur]…] : la partie (héros, deck, méchant, sets et difficulté, sauf ceux
 * tirés au hasard), les cartes lues sur MarvelCDB, la situation (round, phase, compteurs), puis ce que la fenêtre
 * mesure : table ({width, height, cardWidth}), écran et page (textes).
 */
export function reportContext({ game, table = null, screen = '', page = '' }) {
  const context = []
  const setup = game?.setup
  if (setup) {
    const scenario = SCENARIOS.find(candidate => candidate.id === setup.scenario)
    const deck = setup.deckLabel ? ` (${setup.deckLabel})` : ''
    context.push(['Partie', `${heroName(setup.hero)}${deck} contre ${scenario?.villainName ?? setup.scenario}${setupSummary(setup)}`])
    const importedCount = setup.importedDefinitions?.length ?? 0
    if (importedCount) context.push(['Cartes lues sur MarvelCDB', String(importedCount)])
    const counters = (game.counters ?? []).map(counter => `${counter.label} ${counter.value}`).join(', ')
    context.push(['Situation', `round ${game.turn ?? 1}, phase ${game.phase === 'villain' ? 'du méchant' : 'du héros'}${counters ? ` ; ${counters}` : ''}`])
  } else {
    context.push(['Partie', 'aucune partie en cours'])
  }
  if (table) context.push(['Table', `${table.width} × ${table.height} px, cartes de ${table.cardWidth} px`])
  if (screen) context.push(['Écran', screen])
  if (page) context.push(['Page', page])
  return context
}

/**
 * Le corps envoyé au script serveur : le texte du joueur, le contexte, les REPORT_ENTRIES derniers messages du
 * journal, la version, la partie (en JSON, ou null sans partie), le champ piège et le temps passé à l'écrire.
 */
export function reportPayload({ title, description, email = '', context, game, website = '', elapsedMs }) {
  return {
    title: title.trim(),
    description: description.trim(),
    email: email.trim(),
    context,
    journal: logLines((game?.log ?? []).slice(-REPORT_ENTRIES)),
    version: APP_VERSION,
    game: game ? JSON.stringify(game) : null,
    website,
    elapsedMs: Math.round(elapsedMs)
  }
}

export class BugReportError extends Error {
  /**
   * @param {'offline'|'network'|'timeout'|'validation'|'rate-limit'|'rejected'|'unavailable'|'server'} kind
   * @param {string} message message prêt à afficher
   * @param {Record<string, string>} [fields] erreurs par champ renvoyées par le serveur (title, email)
   */
  constructor(kind, message, fields = {}) {
    super(message)
    this.name = 'BugReportError'
    this.kind = kind
    this.fields = fields
  }
}

/**
 * Envoie le rapport (reportPayload) au script serveur ; lève une BugReportError avec un message en français si
 * le rapport n'est pas parti.
 *   fetchFunction  la fonction d'appel réseau (les tests en donnent une fausse)
 */
export async function sendBugReport(payload, fetchFunction = (...args) => fetch(...args)) {
  if (globalThis.navigator?.onLine === false) {
    throw new BugReportError('offline', 'Vous êtes hors ligne : le rapport partira une fois connecté à Internet.')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetchFunction(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: controller.signal
    })
  } catch (error) {
    if (error.name === 'AbortError') throw new BugReportError('timeout', 'Le serveur met trop de temps à répondre. Réessayez dans un instant.')
    throw new BugReportError('network', 'Impossible de joindre le serveur. Vérifiez votre connexion.')
  } finally {
    clearTimeout(timer)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // réponse non JSON (page d'erreur d'Apache, du proxy…) : traitée plus bas
  }
  if (response.ok && data?.ok) return

  if (response.status === 422) throw new BugReportError('validation', data?.message || 'Certains champs sont à corriger.', data?.errors || {})
  if (response.status === 429) throw new BugReportError('rate-limit', data?.message || 'Trop de rapports envoyés. Réessayez plus tard.')
  if (response.status === 502 || response.status === 503) {
    throw new BugReportError('unavailable', data?.message || "Le rapport n'a pas pu partir. Réessayez plus tard.")
  }
  if (response.status >= 400 && response.status < 500) {
    throw new BugReportError('rejected', 'Le rapport a été refusé par le serveur. Rechargez la page puis réessayez.')
  }
  throw new BugReportError('server', 'Le service est momentanément indisponible. Réessayez plus tard.')
}

/**
 * Le même rapport depuis la messagerie du joueur (version artefact, serveur injoignable) : description, contexte,
 * version, navigateur, et le fichier de la partie à joindre.
 */
export function buildMailUrl({ title, description, context, fileName = '' }) {
  const text = description.trim()
  const body = [
    text.length > MAX_MAIL_DESCRIPTION ? `${text.slice(0, MAX_MAIL_DESCRIPTION)}…` : text || '(pas de description)',
    '', 'Contexte :',
    ...context.map(([label, value]) => `- ${label} : ${value}`),
    `- Version : ${APP_VERSION || 'inconnue'}`,
    `- Navigateur : ${globalThis.navigator?.userAgent ?? 'inconnu'}`,
    ...(fileName ? ['', `Le fichier de la partie (${fileName}) vient d'être téléchargé : vous pouvez le joindre à ce message.`] : [])
  ].join('\n')
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[Bug] ${title.trim() || 'Signalement'}`)}&body=${encodeURIComponent(body)}`
}
