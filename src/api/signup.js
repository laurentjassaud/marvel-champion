/**
 * Client du script serveur api/signup.php.
 *
 * L'URL se règle avec VITE_SIGNUP_URL (fichier .env). Par défaut /api/signup.php à la racine du site,
 * même si l'appli est servie sous un sous-chemin (BASE_PATH).
 */
const ENDPOINT = import.meta.env.VITE_SIGNUP_URL || '/api/signup.php'
const TIMEOUT_MS = 10_000

export class SignupError extends Error {
  /**
   * @param {'offline'|'network'|'timeout'|'validation'|'rate-limit'|'rejected'|'server'} kind
   * @param {string} message message prêt à afficher
   * @param {Record<string, string>} [fields] erreurs par champ renvoyées par le serveur
   */
  constructor(kind, message, fields = {}) {
    super(message)
    this.name = 'SignupError'
    this.kind = kind
    this.fields = fields
  }
}

/**
 * @param {{ name: string, email: string, consent: boolean, website: string, elapsedMs: number, source: string }} payload
 * @returns {Promise<void>}
 * @throws {SignupError}
 */
export async function sendSignup(payload) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new SignupError('offline', 'Vous êtes hors ligne. Réessayez une fois connecté à Internet.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new SignupError('timeout', 'Le serveur met trop de temps à répondre. Réessayez dans un instant.')
    }
    throw new SignupError('network', 'Impossible de joindre le serveur. Vérifiez votre connexion.')
  } finally {
    clearTimeout(timer)
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    // réponse non JSON (page d'erreur Apache, proxy…) : traitée plus bas
  }

  if (res.ok && data?.ok) return

  if (res.status === 422) {
    throw new SignupError('validation', data?.message || 'Certains champs sont à corriger.', data?.errors || {})
  }
  if (res.status === 429) {
    throw new SignupError('rate-limit', data?.message || 'Trop de tentatives. Réessayez plus tard.')
  }
  if (res.status >= 400 && res.status < 500) {
    throw new SignupError('rejected', "La demande a été refusée par le serveur. Rechargez la page puis réessayez.")
  }
  throw new SignupError('server', 'Le service est momentanément indisponible. Réessayez plus tard.')
}
