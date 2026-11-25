// Import de decks depuis MC4DB (https://mc4db.merlindumesnil.net), un dérivé de MarvelCDB qui ajoute des héros et
// des cartes créés par des fans : mêmes decklists et mêmes fiches de cartes que MarvelCDB (readOnlineDeck,
// marvelcdb.js). Son API ne se lit pas depuis le navigateur (MC4DB n'envoie pas d'en-tête CORS) : l'appli passe
// par le relais du site, /api/mc4db.php (server/public/api/mc4db.php ; VITE_MC4DB_URL pour une autre adresse),
// absent de la version artefact.
// Chaque carte absente de la table est d'abord demandée à MarvelCDB : une carte officielle y est, avec son nom
// français, et prend les scans français de cgbuilder comme toute carte lue sur MarvelCDB. MarvelCDB ne connaît pas
// une carte de fans (il répond une erreur) : elle est alors lue sur MC4DB, par le relais, avec l'identifiant
// "mc4db-<code>", la source 'mc4db' (cgbuilder n'en a pas d'image : useAssets.js) et l'image anglaise de MC4DB,
// qui n'a plus d'images françaises (son dossier FR ne renvoie que l'image « plus disponibles ») ; cette image
// s'affiche par le relais (mc4dbDisplayUrl), qui la garde pour tous les joueurs.

import { MARVELCDB_ORIGIN, marvelCdbCards, readOnlineDeck } from './marvelcdb.js'

export const MC4DB_SITE_URL = 'https://mc4db.merlindumesnil.net'
const RELAY_URL = import.meta.env?.VITE_MC4DB_URL || '/api/mc4db.php'
/** Le relais est un script du site (server/) : la version artefact, sans serveur, ne l'a pas. */
export const HAS_MC4DB_RELAY = import.meta.env?.MODE !== 'artifact'

/**
 * L'adresse d'affichage d'une image de MC4DB (gardée telle quelle dans la fiche) : par le relais du site
 * (?image=<boîte>/<code>), qui la garde un mois et la sert à tous les joueurs ; MC4DB refuse les rafales de
 * demandes (« 429 »), qu'un deck de fans, préchargé d'un coup, provoquerait. Sans relais, l'adresse de MC4DB.
 */
export function mc4dbDisplayUrl(url) {
  const match = /^https:\/\/mc4db\.merlindumesnil\.net\/bundles\/cards\/EN\/([a-z0-9_]{1,60})\/(\d{5,8}[a-z]?)\.webp$/.exec(url ?? '')
  return match && HAS_MC4DB_RELAY ? `${RELAY_URL}?image=${match[1]}/${match[2]}` : url
}

/** Une image de MC4DB, toujours dans son dossier anglais (le dossier FR ne renvoie que l'image « plus disponibles »). */
const mc4dbImageUrl = path => MC4DB_SITE_URL + path.replace('/bundles/cards/FR/', '/bundles/cards/EN/')
/** Une carte créée par des fans, lue sur MC4DB (marvelCdbDefinition). */
export const MC4DB_ORIGIN = { idPrefix: 'mc4db-', imageUrl: mc4dbImageUrl, source: 'mc4db' }
/** Une carte officielle que MarvelCDB n'a pas pu donner : lue sur MC4DB, elle garde son identifiant officiel. */
const MC4DB_OFFICIAL_ORIGIN = { ...MARVELCDB_ORIGIN, imageUrl: mc4dbImageUrl }

/**
 * Le numéro d'une decklist de MC4DB, d'après son lien : ".../decklist/view/58", ".../decklists/58" ou
 * ".../decklist/58/…" → '58' ; null pour un autre lien (un numéro seul est un numéro MarvelCDB).
 */
export function parseMc4dbLink(input) {
  const match = /mc4db\.merlindumesnil\.net\/(?:decklist\/view|decklists?)\/(\d+)/i.exec(String(input ?? ''))
  return match ? match[1] : null
}

/** Une demande au relais : {status, data} (data : le JSON, ou null ; status 0 si le relais ne répond pas). */
async function askRelay(query, fetchFunction) {
  try {
    const response = await fetchFunction(`${RELAY_URL}?${query}`)
    if (!response.ok) return { status: response.status, data: null }
    const text = await response.text()
    return { status: response.status, data: text ? JSON.parse(text) : null }
  } catch {
    return { status: 0, data: null }
  }
}

/**
 * Les cartes d'un deck MC4DB, pour readOnlineDeck : une carte officielle sur MarvelCDB, sinon sur MC4DB (une carte
 * de fans, ou une carte officielle que MarvelCDB n'a pas pu donner : son créateur, `creator`, est alors « FFG ») ;
 * les cartes d'une boîte, sur le site d'où vient le héros.
 */
function mc4dbCards(fetchFunction) {
  const marvelCdb = marvelCdbCards(fetchFunction)
  return {
    cardOf: async code => {
      const official = await marvelCdb.cardOf(code)
      if (official) return official
      const { data: apiCard } = await askRelay(`card=${encodeURIComponent(code)}`, fetchFunction)
      if (!apiCard?.code) return null
      return { apiCard, origin: apiCard.creator === 'FFG' ? MC4DB_OFFICIAL_ORIGIN : MC4DB_ORIGIN }
    },
    packCardsOf: async (packCode, origin) => {
      if (origin === MARVELCDB_ORIGIN) return marvelCdb.packCardsOf(packCode)
      const { data } = await askRelay(`pack=${encodeURIComponent(packCode)}`, fetchFunction)
      return Array.isArray(data) ? data : []
    }
  }
}

/**
 * Lit une decklist de MC4DB par son lien et reconnaît ses cartes (readOnlineDeck : {deckList, hero, unknownCount,
 * missing, title, heroName}). En cas d'échec, lance une Error dont le message, en français, est affiché tel quel
 * par l'écran Nouvelle partie.
 *   fetchFunction  la fonction d'appel réseau (les tests en donnent une fausse)
 */
export async function fetchMc4dbDeck(input, fetchFunction = url => fetch(url)) {
  const id = parseMc4dbLink(input)
  if (!id) throw new Error('Collez le lien d\'une decklist MC4DB (…/decklist/view/58).')
  const { status, data: apiDeck } = await askRelay(`decklist=${id}`, fetchFunction)
  if (!apiDeck?.slots) {
    if (globalThis.navigator?.onLine === false) throw new Error('Pas de connexion : MC4DB est injoignable.')
    if (status === 404) throw new Error('Deck introuvable sur MC4DB : seules les decklists publiées se chargent.')
    if (status === 429) throw new Error('Trop de demandes à MC4DB depuis votre connexion : réessayez dans un moment.')
    throw new Error('MC4DB ne répond pas pour l\'instant : réessayez plus tard.')
  }
  return readOnlineDeck(apiDeck, mc4dbCards(fetchFunction))
}
