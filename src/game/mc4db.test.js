// Import des decklists de MC4DB (mc4db.js) : le lien, le relais du site, les cartes officielles lues sur MarvelCDB
// et les cartes de fans sur MC4DB (identifiants, images anglaises, jamais cgbuilder), le héros de fans avec son
// obligation et son Némésis, la partie qui se met en place, et les messages d'erreur. Un faux réseau : ni
// MarvelCDB ni MC4DB ne sont contactés.
import { describe, it, expect } from 'vitest'
import { fetchMc4dbDeck, parseMc4dbLink, MC4DB_SITE_URL } from './mc4db.js'
import { DEFINITION_BY_ID, DEFINITION_BY_CODE, addImportedDefinitions } from './data.js'
import { cardImageUrl } from '../composables/useAssets.js'
import * as E from './engine.js'

const MARVELCDB_API = 'https://fr.marvelcdb.com/api/public/'
const RELAY = '/api/mc4db.php?'

/**
 * Un faux réseau : MarvelCDB (adresses de son API) et le relais du site (« /api/mc4db.php?… ») répondent d'après
 * `routes` ({ 'card/26002.json': json, 'decklist=58': json, … }) ; ce qui manque répond comme eux : 500 pour
 * MarvelCDB (une carte qu'il ne connaît pas), 404 pour le relais. Un nombre seul en valeur : ce statut d'erreur.
 */
function fakeNetwork(routes) {
  const calls = []
  const fetchFunction = async url => {
    const key = url.startsWith(MARVELCDB_API) ? url.slice(MARVELCDB_API.length) : url.startsWith(RELAY) ? url.slice(RELAY.length) : url
    calls.push(url.startsWith(RELAY) ? `relais ${key}` : `marvelcdb ${key}`)
    const body = routes[key]
    if (body instanceof Error) throw body
    const status = typeof body === 'number' ? body : body === undefined ? (url.startsWith(RELAY) ? 404 : 500) : 200
    return { ok: status === 200, status, text: async () => (status === 200 ? JSON.stringify(body) : '{"error":"x"}') }
  }
  return { fetchFunction, calls }
}

const mc4dbCard = (code, type, faction, set, name, extra = {}) => ({
  code, type_code: type, faction_code: faction, card_set_code: set, name, real_name: name, quantity: 1, creator: 'Merlin',
  pack_code: 'mystique_by_merlin', imagesrc: `/bundles/cards/EN/mystique_by_merlin/${code}.webp`, ...extra
})
// Mystique, héros de fans (comme MC4DB la décrit, abrégée) : son alter ego, ses cartes, son obligation, son Némésis
const MYSTIQUE = mc4dbCard('80301a', 'hero', 'hero', 'mystique_by_merlin', 'Mystique', {
  health: 10, hand_size: 5,
  linked_card: { code: '80301b', type_code: 'alter_ego', name: 'Raven Darkhölme', hand_size: 6, imagesrc: '/bundles/cards/EN/mystique_by_merlin/80301b.webp' }
})
const MYSTIQUE_PACK = [
  MYSTIQUE,
  mc4dbCard('80302', 'upgrade', 'hero', 'mystique_by_merlin', 'Métamorphose'),
  mc4dbCard('80310', 'obligation', 'encounter', 'mystique_by_merlin', 'Identité Dévoilée'),
  mc4dbCard('80311', 'minion', 'encounter', 'mystique_by_merlin_nemesis', 'Toad', { health: 4 }),
  mc4dbCard('80312', 'side_scheme', 'encounter', 'mystique_by_merlin_nemesis', 'Confrérie', { base_threat: 3 })
]
// une carte officielle que la table n'a pas : MarvelCDB la connaît, avec son nom français
const INTANGIBLE = {
  code: '26002', type_code: 'upgrade', faction_code: 'hero', card_set_code: 'vision', name: 'Intangible', real_name: 'Intangible',
  quantity: 1, imagesrc: '/bundles/cards/26002a.jpg', double_sided: true, back_name: 'Dense', backimagesrc: '/bundles/cards/26002b.png'
}
const DECK = { id: 58, name: 'Bad X-Men', hero_code: '80301a', hero_name: 'Mystique', slots: { 80302: 2, '01088': 1, 26002: 1, 99999: 1 } }

describe('MC4DB : lien', () => {
  it('reconnaît les liens de decklist ; un numéro seul ou un lien MarvelCDB n\'en est pas un', () => {
    expect(parseMc4dbLink('https://mc4db.merlindumesnil.net/decklist/view/58')).toBe('58')
    expect(parseMc4dbLink(' mc4db.merlindumesnil.net/decklists/58 ')).toBe('58')
    expect(parseMc4dbLink('https://mc4db.merlindumesnil.net/decklist/58/bad-x-men')).toBe('58')
    expect(parseMc4dbLink('58')).toBeNull()
    expect(parseMc4dbLink('https://fr.marvelcdb.com/decklist/view/58/x')).toBeNull()
  })
})

describe('MC4DB : import', () => {
  it('héros de fans avec son obligation et son Némésis, cartes officielles sur MarvelCDB, cartes de fans sur MC4DB', async () => {
    const network = fakeNetwork({
      'decklist=58': DECK,
      'card=80301a': MYSTIQUE,
      'pack=mystique_by_merlin': MYSTIQUE_PACK,
      'card=80302': MYSTIQUE_PACK[1],
      'card/26002.json': INTANGIBLE
    })
    const deck = await fetchMc4dbDeck('https://mc4db.merlindumesnil.net/decklist/view/58', network.fetchFunction)
    expect(deck).toMatchObject({ hero: 'mystique_by_merlin', heroName: 'Mystique', title: 'Bad X-Men', unknownCount: 1, missing: ['99999'] })
    expect(deck.deckList.map(([id, copies]) => `${copies}x ${id}`).sort())
      .toEqual(['1x cdb-26002', '1x mc4db-80301a', '2x mc4db-80302', `1x ${DEFINITION_BY_CODE['01088'].id}`].sort())

    // une carte de fans : sa fiche MC4DB avec l'adresse de son image anglaise ; affichée par le relais du site
    // (qui la garde pour tous), jamais par cgbuilder
    expect(DEFINITION_BY_ID['mc4db-80302']).toMatchObject({ source: 'mc4db', pack: 'marvelcdb', imageUrl: `${MC4DB_SITE_URL}/bundles/cards/EN/mystique_by_merlin/80302.webp` })
    expect(cardImageUrl({ definitionId: 'mc4db-80302', side: 0 })).toBe('/api/mc4db.php?image=mystique_by_merlin/80302')
    expect(cardImageUrl({ definitionId: 'mc4db-80301a', side: 1 })).toBe('/api/mc4db.php?image=mystique_by_merlin/80301b')
    // une carte de fans dont le code ressemble à une carte officielle connue de cgbuilder (60017) : pas cgbuilder
    addImportedDefinitions([{ id: 'mc4db-60017', code: '60017', name: 'Fan', type: 'event', faction: 'basic', set: '', quantity: 1, source: 'mc4db', imageUrl: `${MC4DB_SITE_URL}/bundles/cards/EN/fan_pack/60017.webp` }])
    expect(cardImageUrl({ definitionId: 'mc4db-60017', side: 0 })).toBe('/api/mc4db.php?image=fan_pack/60017')
    expect(DEFINITION_BY_ID['mc4db-80301a']).toMatchObject({ backName: 'Raven Darkhölme', backHandSize: 6, hitPoints: 10 })
    // une carte officielle : sa fiche MarvelCDB, comme pour un deck MarvelCDB
    expect(DEFINITION_BY_ID['cdb-26002'].source).toBeUndefined()
    expect(DEFINITION_BY_ID['cdb-26002'].backName).toBe('Dense')

    // chaque carte inconnue est d'abord demandée à MarvelCDB ; le relais ne sert qu'aux cartes de fans
    expect(network.calls).toContain('marvelcdb card/80302.json')
    expect(network.calls).toContain('relais card=80302')
    expect(network.calls).not.toContain('relais card=26002')
    expect(network.calls).toContain('relais pack=mystique_by_merlin')

    // la partie : l'alter ego Raven Darkhölme, l'obligation dans le paquet Rencontre, le Némésis de côté
    const game = E.newGame({ hero: deck.hero, deckList: deck.deckList, scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: deck.title }, { width: 1200, height: 700, cardWidth: 80 })
    expect(E.cardName(E.identityCard(game))).toBe('Raven Darkhölme')
    expect(game.counters[0]).toMatchObject({ label: 'MYSTIQUE', value: 10 })
    // tout le paquet, 4 cartes, est en main : moins que la main de Raven Darkhölme (6)
    expect(E.cardsInZone(game, 'hand')).toHaveLength(4)
    expect(E.cardsInZone(game, 'encounterDeck').some(card => card.definitionId === 'mc4db-80310')).toBe(true)
    expect(E.cardsInZone(game, 'setAside').map(card => card.definitionId).filter(id => id.startsWith('mc4db-')).sort()).toEqual(['mc4db-80311', 'mc4db-80312'])
    expect(game.setup.importedDefinitions.find(definition => definition.id === 'mc4db-80302').source).toBe('mc4db')
  })

  it('une carte officielle que MarvelCDB ne donne pas : lue sur MC4DB, elle garde son identifiant officiel et l\'image anglaise', async () => {
    const network = fakeNetwork({
      'decklist=7': { id: 7, name: 'Repli', hero_code: '01001a', slots: { 27015: 1 } },
      'card=27015': { ...mc4dbCard('27015', 'event', 'basic', null, 'Carte Officielle'), creator: 'FFG', imagesrc: '/bundles/cards/FR/sm/27015.webp' }
    })
    await fetchMc4dbDeck('https://mc4db.merlindumesnil.net/decklist/view/7', network.fetchFunction)
    expect(DEFINITION_BY_ID['cdb-27015']).toMatchObject({ name: 'Carte Officielle', imageUrl: `${MC4DB_SITE_URL}/bundles/cards/EN/sm/27015.webp` })
    expect(DEFINITION_BY_ID['cdb-27015'].source).toBeUndefined()
  })

  it('les erreurs : lien, deck inconnu, trop de demandes, relais en panne, hors ligne', async () => {
    await expect(fetchMc4dbDeck('58', fakeNetwork({}).fetchFunction)).rejects.toThrow(/Collez le lien d'une decklist MC4DB/)
    const url = 'https://mc4db.merlindumesnil.net/decklist/view/58'
    await expect(fetchMc4dbDeck(url, fakeNetwork({}).fetchFunction)).rejects.toThrow(/Deck introuvable sur MC4DB/)
    await expect(fetchMc4dbDeck(url, fakeNetwork({ 'decklist=58': 429 }).fetchFunction)).rejects.toThrow(/Trop de demandes/)
    await expect(fetchMc4dbDeck(url, fakeNetwork({ 'decklist=58': 502 }).fetchFunction)).rejects.toThrow(/MC4DB ne répond pas/)
    await expect(fetchMc4dbDeck(url, fakeNetwork({ 'decklist=58': new TypeError('Failed to fetch') }).fetchFunction)).rejects.toThrow(/MC4DB ne répond pas/)
  })
})
