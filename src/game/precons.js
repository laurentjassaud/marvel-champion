// Les decks préconstruits des héros que la table n'a pas : leurs listes viennent de src/data/precons-marvelcdb.json
// (scripts/marvelcdb-precons.mjs, d'après le module OCTGN et les boîtes de MarvelCDB), au format des decklists de
// MarvelCDB ; leurs cartes se lisent sur MarvelCDB au choix du héros, comme un deck chargé par son lien
// (marvelcdb.js, readOnlineDeck : noms français, scans français de cgbuilder, obligation et set Némésis lus dans la
// boîte, règles particulières du héros). L'écran « Nouvelle partie » les propose dans « Préconstruits », après les
// héros de la table (data.js AVAILABLE_HEROES, précons hors ligne).

import MARVELCDB_PRECONS from '../data/precons-marvelcdb.json'
import { DEFINITION_BY_CODE } from './data.js'
import { heroPileCodes, unavailableHeroOf } from './rules.js'
import { readOnlineDeck, marvelCdbCards } from './marvelcdb.js'

/** Le héros de cette identité (code MarvelCDB, « 08001a ») est dans les boîtes de la table. */
const isTableHero = heroCode => !!DEFINITION_BY_CODE[heroCode] && DEFINITION_BY_CODE[heroCode].pack !== 'marvelcdb'

/**
 * Les précons à lire en ligne, dans l'ordre de sortie des boîtes : {id (le set de l'identité sur MarvelCDB, qui
 * devient le héros de la partie), name, aspect, heroCode, slots}. Ni les héros de la table (leur précon est hors
 * ligne, data.js PRECON_DECKS), ni ceux qu'elle refuse pour l'instant (rules.js UNAVAILABLE_HEROES : Elektra, Iron Fist).
 */
export const ONLINE_PRECONS = Object.entries(MARVELCDB_PRECONS)
  .filter(([set, precon]) => !isTableHero(precon.hero) && !unavailableHeroOf({ set, code: precon.hero }))
  .map(([set, precon]) => ({ id: set, name: precon.name, aspect: precon.aspect, heroCode: precon.hero, slots: precon.slots }))

/**
 * Lit le précon d'un héros sur MarvelCDB (readOnlineDeck) : rend le deck reconnu ({hero, deckList, …}). Les cartes
 * que le héros garde hors de son deck (rules.js heroPileCodes : le Climat de Tornade) n'y sont pas : la mise en place
 * les crée. Hors connexion, ou si MarvelCDB n'a pas répondu pour toutes les cartes, lance une Error au message en
 * français, affiché par l'écran Nouvelle partie.
 *   fetchFunction  la fonction d'appel réseau (les tests en donnent une fausse)
 */
export async function fetchOnlinePrecon(precon, fetchFunction = url => fetch(url)) {
  const unreachable = `Le précon de ${precon.name} se lit sur MarvelCDB, injoignable pour l'instant : réessayez une fois connecté.`
  if (globalThis.navigator?.onLine === false) throw new Error(unreachable)
  const outsideDeck = new Set(heroPileCodes(precon.id, { outsideDeck: true }))
  const slots = Object.fromEntries(Object.entries(precon.slots).filter(([code]) => !outsideDeck.has(code)))
  const deck = await readOnlineDeck({ hero_code: precon.heroCode, hero_name: precon.name, slots }, marvelCdbCards(fetchFunction))
  if (!deck.hero || deck.unknownCount) throw new Error(unreachable)
  return deck
}
