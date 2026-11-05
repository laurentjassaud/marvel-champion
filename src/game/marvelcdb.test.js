import { describe, it, expect } from 'vitest'
import { cdbTarget, cdbDef, fetchCdbDeck } from './marvelcdb.js'
import { BY_ID, BY_CODE, addDefs } from './data.js'
import * as E from './engine.js'

const SITE = 'https://fr.marvelcdb.com'
const API = `${SITE}/api/public/`
const DECK = { id: 69334, name: 'Natasha', hero_code: '08001a', hero_name: 'Black Widow', slots: { '08002': 1, 12019: 2, 99001: 1 } }

// a fake MarvelCDB: known paths answer their JSON, the others an empty body (as an unknown decklist
// does); an Error value is thrown, as fetch does when a private deck redirects to the login page
function fakeApi(routes) {
  const calls = []
  const fetchFn = async url => {
    const path = url.replace(API, '')
    calls.push(path)
    const body = routes[path]
    if (body instanceof Error) throw body
    return { ok: true, text: async () => (body ? JSON.stringify(body) : '') }
  }
  return { fetchFn, calls }
}

// Gambit as the API describes it (abridged): identity with its alter ego, pack with obligation and nemesis
const GAMBIT = {
  code: '37001a', type_code: 'hero', faction_code: 'hero', card_set_code: 'gambit', pack_code: 'gambit', name: 'Gambit', real_name: 'Gambit',
  quantity: 1, health: 9, hand_size: 5, imagesrc: '/bundles/cards/37001a.png',
  linked_card: { code: '37001b', type_code: 'alter_ego', name: 'Remy LeBeau', hand_size: 6, health: 9, imagesrc: '/bundles/cards/37001b.png' }
}
const card = (code, type, faction, set, name, extra = {}) => ({ code, type_code: type, faction_code: faction, card_set_code: set, name, real_name: name, quantity: 1, imagesrc: `/bundles/cards/${code}.png`, ...extra })
const GAMBIT_PACK = [
  GAMBIT,
  card('37006', 'event', 'hero', 'gambit', 'Carte Chargée', { quantity: 3 }),
  card('37025', 'obligation', 'encounter', 'gambit', 'Les Affaires de la Guilde'),
  card('37026', 'minion', 'encounter', 'gambit_nemesis', 'Belladonna', { health: 5, traits: 'Assassin. Élite.', text: 'Coup Rapide. Ténacité.\n[star] Réponse forcée…' }),
  card('37027', 'side_scheme', 'encounter', 'gambit_nemesis', 'La Guilde des Assassins', { base_threat: 4 }),
  card('37028', 'minion', 'encounter', 'gambit_nemesis', 'Assassin de la Guilde', { quantity: 2, health: 3 }),
  card('37032', 'minion', 'encounter', 'exodus', 'Exodus') // a modular set of the pack: not the hero's
]

describe('MarvelCDB : lien ou numéro', () => {
  it('reconnaît les liens de decklist et de deck, et un numéro seul', () => {
    expect(cdbTarget('https://fr.marvelcdb.com/decklist/view/69334/black-widow-cc-campaign-1.0')).toEqual({ kind: 'decklist', id: '69334' })
    expect(cdbTarget('  marvelcdb.com/deck/view/123456 ')).toEqual({ kind: 'deck', id: '123456' })
    expect(cdbTarget('https://marvelcdb.com/deck/edit/42')).toEqual({ kind: 'deck', id: '42' })
    expect(cdbTarget('69334')).toEqual({ kind: null, id: '69334' })
    expect(cdbTarget('https://example.com/decklist/view/1')).toBeNull()
    expect(cdbTarget('')).toBeNull()
  })
})

describe('MarvelCDB : cartes lues sur le site', () => {
  it('identité : alter ego au dos, tailles de main, PV, images du site', () => {
    expect(cdbDef(GAMBIT)).toMatchObject({
      id: 'cdb-37001a', code: '37001a', n: 'Gambit', t: 'hero', s: 'gambit', hp: 9, hs: 5, l: 0,
      bn: 'Remy LeBeau', bt: 'alter_ego', bhs: 6, img: `${SITE}/bundles/cards/37001a.png`, bimg: `${SITE}/bundles/cards/37001b.png`
    })
  })

  it('manigance annexe à l\'horizontale avec sa menace de départ, Ténacité, traits, manigance annexe de joueur', () => {
    const [, , , bella, guild] = GAMBIT_PACK
    expect(cdbDef(guild)).toMatchObject({ t: 'side_scheme', l: 1, bth: 4 })
    expect(cdbDef(bella)).toMatchObject({ t: 'minion', hp: 5, toughness: true, tr: ['assassin', 'élite'] })
    expect(cdbDef(card('99010', 'player_side_scheme', 'hero', 'x', 'Plan'))).toMatchObject({ t: 'side_scheme', l: 1 })
    expect(cdbDef({ ...card('99011', 'event', 'basic', null, 'Sans image'), imagesrc: null }).img).toBeNull()
  })
})

describe('MarvelCDB : import', () => {
  it('lit la decklist, ne demande que les cartes inconnues, suit les réimpressions, lit les autres sur le site', async () => {
    const api = fakeApi({
      'decklist/69334.json': DECK,
      'card/12019.json': { code: '12019', name: 'Premiers Soins', duplicate_of_code: '01086' },
      'card/99001.json': card('99001', 'event', 'justice', null, 'Carte Future', { quantity: 2 })
    })
    const r = await fetchCdbDeck('https://marvelcdb.com/decklist/view/69334/natasha-1.0', api.fetchFn)
    expect(r).toMatchObject({ hero: 'black_widow', heroName: 'Black Widow', title: 'Natasha', unknown: 0, missing: [] })
    expect(r.list.map(([id, q]) => `${q}x ${BY_ID[id].n}`).sort()).toEqual(['1x Black Widow', '1x Carte Future', '1x Le Soldat de l\'Hiver', '2x Premiers Soins'])
    expect(BY_CODE['99001']).toMatchObject({ id: 'cdb-99001', pack: 'marvelcdb', img: `${SITE}/bundles/cards/99001.png` })
    expect(api.calls.sort()).toEqual(['card/12019.json', 'card/99001.json', 'decklist/69334.json'])
  })

  it('héros absent de la table : son identité, son obligation et son set Némésis viennent de sa boîte', async () => {
    const api = fakeApi({
      'decklist/7.json': { name: 'Ragin\' Cajun', hero_code: '37001a', hero_name: 'Gambit', slots: { 37006: 3, '01088': 1, 37020: 2 } },
      'card/37001a.json': GAMBIT,
      'cards/gambit.json': GAMBIT_PACK,
      'card/37006.json': GAMBIT_PACK[1],
      // a reprint of a card not in the game: the original printing (which has the image)
      'card/37020.json': { ...card('37020', 'event', 'basic', null, 'Frappe et Court'), duplicate_of_code: '18020', imagesrc: null },
      'card/18020.json': card('18020', 'event', 'basic', null, 'Frappe et Court', { quantity: 3 })
    })
    const r = await fetchCdbDeck('7', api.fetchFn)
    expect(r).toMatchObject({ hero: 'gambit', title: 'Ragin\' Cajun', unknown: 0 })
    expect(r.list.map(([id, q]) => `${q}x ${id}`).sort()).toEqual(['1x cdb-37001a', '2x cdb-18020', '3x cdb-37006', `1x ${BY_CODE['01088'].id}`].sort())
    expect(BY_CODE['37025']).toMatchObject({ t: 'obligation', s: 'gambit' })
    expect(BY_CODE['37032']).toBeUndefined()

    // the game: alter ego Remy LeBeau, obligation in the encounter deck, nemesis aside; the cards stay with it
    const s = E.newGame({ hero: r.hero, list: r.list, villain: 'rhino', modular: 'bomb_scare', expert: false, label: 'Ragin\' Cajun' }, { w: 1200, h: 700, cw: 80 })
    const id = E.identity(s)
    expect(E.nameOf(id)).toBe('Remy LeBeau')
    expect(s.counters[0]).toMatchObject({ l: 'GAMBIT', v: 9 })
    expect(E.cardsIn(s, 'hand')).toHaveLength(6)
    expect(E.cardsIn(s, 'edeck').some(c => c.g === 'cdb-37025')).toBe(true)
    expect(E.cardsIn(s, 'aside').filter(c => E.def(c).s === 'gambit_nemesis').map(c => c.g).sort()).toEqual(['cdb-37026', 'cdb-37027', 'cdb-37028', 'cdb-37028'])
    expect(s.opt.defs.map(d => d.id).sort()).toEqual(['cdb-18020', 'cdb-37001a', 'cdb-37006', 'cdb-37025', 'cdb-37026', 'cdb-37027', 'cdb-37028'])
    expect(s.opt.defs[0].pack).toBeUndefined()
  })

  it('nos scans en français passent avant le site : identité, cartes et réimpressions de nos boîtes ne sont pas demandées', async () => {
    // a game saved with a card read online, which our packs have since (here Quake, 08012): ours stays the one used
    addDefs([cdbDef(card('08012', 'ally', 'justice', null, 'Quake (site)'))])
    const api = fakeApi({ 'decklist/3.json': { name: 'Locale', hero_code: '08001a', slots: { '08002': 1, '08012': 1, '01086': 2 } } })
    const r = await fetchCdbDeck('3', api.fetchFn)
    expect(api.calls).toEqual(['decklist/3.json'])
    expect(r.list.map(([id]) => BY_ID[id].pack)).toEqual(['black_widow', 'black_widow', 'black_widow', 'core'])
    expect(BY_CODE['08012'].n).toBe('Quake')
  })

  it('un numéro seul : decklist publiée, sinon deck partagé', async () => {
    const api = fakeApi({ 'deck/69334.json': DECK })
    const r = await fetchCdbDeck('69334', api.fetchFn)
    expect(r.hero).toBe('black_widow')
    expect(api.calls.slice(0, 2)).toEqual(['decklist/69334.json', 'deck/69334.json'])
  })

  it('deck privé ou inexistant, saisie illisible : un message en clair', async () => {
    const api = fakeApi({ 'deck/7.json': new TypeError('Failed to fetch') })
    await expect(fetchCdbDeck('https://marvelcdb.com/deck/view/7', api.fetchFn)).rejects.toThrow(/Deck introuvable sur MarvelCDB/)
    await expect(fetchCdbDeck('mon deck', api.fetchFn)).rejects.toThrow(/Collez le lien/)
  })

  it('carte que l\'API ne décrit pas : son code est listé', async () => {
    const api = fakeApi({ 'decklist/1.json': { ...DECK, slots: { 99002: 2 } } })
    expect(await fetchCdbDeck('1', api.fetchFn)).toMatchObject({ unknown: 2, missing: ['99002'] })
  })
})
