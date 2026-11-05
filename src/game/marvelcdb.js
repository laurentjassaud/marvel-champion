// MarvelCDB public API (https://fr.marvelcdb.com/api/): published decklists, and decks whose author
// shares them, read by link or number. No account needed; the answers allow any origin (CORS).
// A card that is not in the game's packs is read from the API too, with the site's image (an English
// scan: MarvelCDB has a single image per card) and its French name.
import { parseCdbDeck } from './engine.js'
import { BY_CODE, addDefs } from './data.js'

const SITE = 'https://fr.marvelcdb.com'
const API = `${SITE}/api/public`
const LANDSCAPE = ['main_scheme', 'side_scheme']
// MarvelCDB types the table handles as one of its own
const TYPES = { player_side_scheme: 'side_scheme' }

/**
 * What the player pasted: "https://marvelcdb.com/decklist/view/40213/…" → {kind: 'decklist', id: '40213'},
 * ".../deck/view/123" → {kind: 'deck', id: '123'}, a bare number → {kind: null, id} (decklist, else deck),
 * anything else → null.
 */
export function cdbTarget(input) {
  const s = String(input ?? '').trim()
  const m = /marvelcdb\.com\/(decklist|deck)\/(?:view|edit)\/(\d+)/i.exec(s)
  if (m) return { kind: m[1].toLowerCase(), id: m[2] }
  return /^\d+$/.test(s) ? { kind: null, id: s } : null
}

/**
 * A MarvelCDB card as a card definition of the table (see data.js); a hero carries its alter ego
 * (`linked_card`) as the back side.
 */
export function cdbDef(c) {
  const t = TYPES[c.type_code] ?? c.type_code
  const d = {
    id: `cdb-${c.code}`, code: c.code, n: c.name, en: c.real_name, t, f: c.faction_code,
    s: c.card_set_code ?? '', q: c.quantity ?? 1, l: LANDSCAPE.includes(t) ? 1 : 0,
    img: c.imagesrc ? SITE + c.imagesrc : null
  }
  if (c.health != null) d.hp = c.health
  if (c.hand_size != null) d.hs = c.hand_size
  if (t === 'side_scheme' && c.base_threat != null) d.bth = c.base_threat
  if (c.traits && ['villain', 'minion'].includes(t)) d.tr = c.traits.split('.').map(x => x.trim().toLowerCase()).filter(Boolean)
  // keyword Ténacité: the card enters play with a Tenace status
  if (/(^|[\s.>])Ténacité\s*\./.test(c.text ?? '') || /(^|[\s.>])Toughness\s*\./.test(c.real_text ?? '')) d.toughness = true
  const b = c.linked_card
  if (b) Object.assign(d, { bn: b.name, bt: b.type_code, bhs: b.hand_size ?? undefined, bimg: b.imagesrc ? SITE + b.imagesrc : null })
  return d
}

// null when the API has nothing to give: an unknown decklist answers an empty body, an unshared deck
// redirects to the login page (a cross-origin request cannot read it), the network may be down
async function getJson(path, fetchFn) {
  try {
    const r = await fetchFn(`${API}/${path}`)
    if (!r.ok) return null
    const text = await r.text()
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

/**
 * Fetch a MarvelCDB deck and match its cards: parseCdbDeck's result plus `heroName` (as MarvelCDB
 * names the identity). The cards read from the API are added to the game's cards (addDefs); newGame
 * keeps those it uses with the game. Throws an Error with a French message the setup screen shows as is.
 */
export async function fetchCdbDeck(input, fetchFn = url => fetch(url)) {
  const target = cdbTarget(input)
  if (!target) throw new Error('Collez le lien d\'un deck MarvelCDB (…/decklist/view/12345 ou …/deck/view/12345) ou le numéro d\'une decklist publiée.')
  let deck = null
  for (const kind of target.kind ? [target.kind] : ['decklist', 'deck']) {
    deck = await getJson(`${kind}/${target.id}.json`, fetchFn)
    if (deck?.slots) break
  }
  if (!deck?.slots) {
    if (globalThis.navigator?.onLine === false) throw new Error('Pas de connexion : MarvelCDB est injoignable.')
    throw new Error('Deck introuvable sur MarvelCDB. Un deck non publié ne se lit que si son auteur partage ses decks (option de son profil MarvelCDB).')
  }

  const card = code => getJson(`card/${code}.json`, fetchFn)
  const defs = new Map() // code → definition read from the API
  const cards = {} // code in the deck → its API card (name, duplicate_of_code), for parseCdbDeck

  // an identity of a pack not in the game: its card, then its obligation and nemesis set from its pack
  if (deck.hero_code && !BY_CODE[deck.hero_code]) {
    const hero = await card(deck.hero_code)
    if (hero?.type_code === 'hero') {
      defs.set(hero.code, cdbDef(hero))
      const set = hero.card_set_code
      for (const c of (await getJson(`cards/${hero.pack_code}.json`, fetchFn)) ?? []) {
        if (c.faction_code === 'encounter' && (c.card_set_code === set || c.card_set_code === `${set}_nemesis`)) defs.set(c.code, cdbDef(c))
      }
    }
  }

  // the other cards not in the game; a reprint is the card it reprints (ours, else the original
  // printing, which has the image)
  const unknown = Object.keys(deck.slots).filter(c => !BY_CODE[c] && !defs.has(c))
  await Promise.all(unknown.map(async code => {
    const c = await card(code)
    if (!c) return
    cards[code] = c
    const dup = c.duplicate_of_code
    if (!dup) { defs.set(c.code, cdbDef(c)); return }
    if (BY_CODE[dup] || defs.has(dup)) return
    const original = await card(dup)
    defs.set(dup, cdbDef(original?.code ? original : { ...c, code: dup }))
  }))

  addDefs([...defs.values()])
  return { ...parseCdbDeck(deck, cards), heroName: deck.hero_name ?? null }
}
