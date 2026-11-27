// Les précons des héros que la table n'a pas (game/precons.js) : la liste proposée, et leur lecture sur un faux
// MarvelCDB (comme marvelcdb.test.js).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ONLINE_PRECONS, fetchOnlinePrecon } from './precons.js'
import { AVAILABLE_HEROES, DEFINITION_BY_ID } from './data.js'
import { heroPileCodes } from './rules.js'
import MARVELCDB_PRECONS from '../data/precons-marvelcdb.json'

const API = 'https://fr.marvelcdb.com/api/public/'
// un faux MarvelCDB : les chemins connus répondent leur JSON, les autres un corps vide (carte introuvable)
function fakeApi(routes) {
  const calls = []
  const fetchFn = async url => {
    const path = url.replace(API, '')
    calls.push(path)
    const body = routes[path]
    return { ok: true, text: async () => (body ? JSON.stringify(body) : '') }
  }
  return { fetchFn, calls }
}
const card = (code, type, faction, set, name, extra = {}) => ({ code, type_code: type, faction_code: faction, card_set_code: set, pack_code: set, name, real_name: name, quantity: 1, imagesrc: `/bundles/cards/${code}.png`, ...extra })
const STORM = card('36001a', 'hero', 'hero', 'storm', 'Tornade', { health: 10, hand_size: 5, linked_card: { code: '36001b', type_code: 'alter_ego', name: 'Ororo Munroe', hand_size: 6, health: 10 } })

afterEach(() => vi.unstubAllGlobals())

describe('Précons lus sur MarvelCDB', () => {
  it('tous les héros que la table n\'a pas, dans l\'ordre des boîtes, sauf Elektra et Iron Fist', () => {
    const ids = ONLINE_PRECONS.map(precon => precon.id)
    expect(ids[0]).toBe('groot')
    expect(ids).toEqual(expect.arrayContaining(['storm', 'colossus', 'gambit', 'spdr', 'deadpool', 'luke_cage']))
    expect(ids).not.toEqual(expect.arrayContaining(['elektra']))
    expect(ids).not.toContain('iron_fist')
    expect(new Set(ids).size).toBe(ids.length)
    // les héros de la table gardent leur précon hors ligne : ni Captain America, ni Black Widow, ni Ant-Man (« ant »)
    for (const id of ['captain_america', 'black_widow', 'hawkeye', 'ant', 'wsp', 'qsv', 'scw']) expect(ids).not.toContain(id)
    expect(AVAILABLE_HEROES).toHaveLength(17)
    expect(ONLINE_PRECONS.length + AVAILABLE_HEROES.length).toBe(Object.keys(MARVELCDB_PRECONS).length + 5 - 2) // + la boîte de base, − Elektra et Iron Fist
    // chacun : son identité, son affinité, un deck de 39 à 43 cartes (cartes permanentes ou de mise en place comprises)
    for (const precon of ONLINE_PRECONS) {
      expect(precon.heroCode, precon.id).toMatch(/^\d{5}a?$/)
      expect(precon.name && precon.aspect, precon.id).toBeTruthy()
      const size = Object.values(precon.slots).reduce((total, copies) => total + copies, 0)
      expect(size, precon.id).toBeGreaterThanOrEqual(39)
      expect(size, precon.id).toBeLessThanOrEqual(43)
    }
  })

  it('lu comme un deck MarvelCDB : identité, cartes, sans les cartes que le héros garde hors de son deck', async () => {
    const [weatherCode] = heroPileCodes('storm', { outsideDeck: true })
    const precon = { id: 'storm', name: 'Tornade', aspect: 'Commandement', heroCode: '36001a', slots: { 36006: 2, [weatherCode]: 1 } }
    const api = fakeApi({
      'card/36001a.json': STORM,
      'cards/storm.json': [STORM, card(weatherCode, 'support', 'hero', 'storm', 'Ciel Dégagé'), card('36030', 'obligation', 'encounter', 'storm', 'Obligation')],
      'card/36006.json': card('36006', 'event', 'hero', 'storm', 'Éclair', { quantity: 2 })
    })
    const deck = await fetchOnlinePrecon(precon, api.fetchFn)
    expect(deck).toMatchObject({ hero: 'storm', unknownCount: 0 })
    const codes = deck.deckList.map(([id]) => DEFINITION_BY_ID[id].code)
    expect(codes).toContain('36006')
    expect(codes).not.toContain(weatherCode)
    expect(api.calls).not.toContain(`card/${weatherCode}.json`)
  })

  it('hors connexion, ou MarvelCDB muet : un message qui le dit', async () => {
    const precon = ONLINE_PRECONS.find(candidate => candidate.id === 'colossus')
    vi.stubGlobal('navigator', { onLine: false })
    await expect(fetchOnlinePrecon(precon, fakeApi({}).fetchFn)).rejects.toThrow('Le précon de Colossus se lit sur MarvelCDB, injoignable pour l\'instant')
    vi.stubGlobal('navigator', { onLine: true })
    await expect(fetchOnlinePrecon(precon, fakeApi({}).fetchFn)).rejects.toThrow(/injoignable/)
  })
})
