import { describe, it, expect } from 'vitest'
import { parseMarvelCdbLink, marvelCdbDefinition, entryTokensFromCardText, fetchMarvelCdbDeck } from './marvelcdb.js'
import { DEFINITION_BY_ID, DEFINITION_BY_CODE, addImportedDefinitions } from './data.js'
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
    expect(parseMarvelCdbLink('https://fr.marvelcdb.com/decklist/view/69334/black-widow-cc-campaign-1.0')).toEqual({ kind: 'decklist', id: '69334' })
    expect(parseMarvelCdbLink('  marvelcdb.com/deck/view/123456 ')).toEqual({ kind: 'deck', id: '123456' })
    expect(parseMarvelCdbLink('https://marvelcdb.com/deck/edit/42')).toEqual({ kind: 'deck', id: '42' })
    expect(parseMarvelCdbLink('69334')).toEqual({ kind: null, id: '69334' })
    expect(parseMarvelCdbLink('https://example.com/decklist/view/1')).toBeNull()
    expect(parseMarvelCdbLink('')).toBeNull()
  })
})

describe('MarvelCDB : cartes lues sur le site', () => {
  it('identité : alter ego au dos, tailles de main, PV, images du site', () => {
    expect(marvelCdbDefinition(GAMBIT)).toMatchObject({
      id: 'cdb-37001a', code: '37001a', name: 'Gambit', type: 'hero', set: 'gambit', hitPoints: 9, handSize: 5, landscape: false,
      backName: 'Remy LeBeau', backType: 'alter_ego', backHandSize: 6, imageUrl: `${SITE}/bundles/cards/37001a.png`, backImageUrl: `${SITE}/bundles/cards/37001b.png`
    })
  })

  it('manigance annexe à l\'horizontale avec sa menace de départ, Ténacité, traits, manigance annexe de joueur', () => {
    const [, , , bella, guild] = GAMBIT_PACK
    expect(marvelCdbDefinition(guild)).toMatchObject({ type: 'side_scheme', landscape: true, startingThreat: 4 })
    expect(marvelCdbDefinition(guild).extraThreatPerHero).toBeUndefined()
    // the threat its "When Revealed" adds per hero, or its Hinder keyword; not under a condition
    const extra = realText => marvelCdbDefinition(card('99014', 'side_scheme', 'encounter', 'x_nemesis', 'Plan', { base_threat: 3, real_text: realText })).extraThreatPerHero
    expect(extra('<b>When Revealed</b>: Place an additional 1[per_hero] threat here.')).toBe(1)
    expect(extra('Hinder 2[per_hero]. <i>(When revealed, place 2[per_hero] threat here.)</i>')).toBe(2)
    expect(extra('<b>When Revealed (Norman Osborn)</b>: Place an additional 1[per_hero] threat here.')).toBeUndefined()
    expect(marvelCdbDefinition(bella)).toMatchObject({ type: 'minion', hitPoints: 5, toughness: true, traits: ['assassin', 'élite'] })
    expect(marvelCdbDefinition(card('99010', 'player_side_scheme', 'hero', 'x', 'Plan'))).toMatchObject({ type: 'side_scheme', landscape: true })
    expect(marvelCdbDefinition({ ...card('99011', 'event', 'basic', null, 'Sans image'), imagesrc: null }).imageUrl).toBeNull()
    // the player upgrades keep their traits (Iron Man counts the Tech ones), not the other player cards
    expect(marvelCdbDefinition(card('99012', 'upgrade', 'basic', null, 'Gadget', { traits: 'Objet. Tech.' })).traits).toEqual(['objet', 'tech'])
    expect(marvelCdbDefinition(card('99013', 'event', 'basic', null, 'Coup', { traits: 'Attaque.' })).traits).toBeUndefined()
  })

  it('jetons d\'entrée en jeu : Utilisations, « entre en jeu avec », par joueur, texte anglais', () => {
    const team = card('99020', 'support', 'basic', null, 'Équipe', { text: 'Utilisations (3 jetons Soin). <i>(Entre en jeu avec 3 jetons. Quand il n\'y en a plus, défaussez cette carte)</i>' })
    expect(marvelCdbDefinition(team)).toMatchObject({ entryTokens: 3, entryTokenName: 'Soin' })
    expect(entryTokensFromCardText({ text: 'Hawkeye entre en jeu avec 4 jetons Flèche sur lui.' })).toEqual({ entryTokens: 4, entryTokenName: 'Flèche' })
    expect(entryTokensFromCardText({ text: 'Attachez cette carte à Crossbones. Utilisations (2[per_hero] jetons Munition).' })).toEqual({ entryTokens: 2, entryTokenName: 'Munition' })
    expect(entryTokensFromCardText({ text: 'Utilisations (1 jeton Fureur, plus 1[per_hero] jeton Fureur supplémentaire).' })).toEqual({ entryTokens: 2, entryTokenName: 'Fureur' })
    // the French text not translated yet: the number from the English one
    expect(entryTokensFromCardText({ text: 'Attach to Batroc. Uses (4 leap counters).', real_text: 'Attach to Batroc. Uses (4 leap counters).' })).toEqual({ entryTokens: 4 })
    // Ténacité is a status card, not counters
    expect(entryTokensFromCardText({ text: 'Ténacité. <i>(Ce personnage entre en jeu avec une carte d\'état Tenace.)</i>', real_text: 'Toughness. <i>(This character enters play with a tough status card.)</i>' })).toEqual({})
    expect(marvelCdbDefinition(card('99021', 'event', 'basic', null, 'Rien')).entryTokens).toBeUndefined()
    // Ténacité without its period (Kang I), and a mere Tenace status card given by an effect
    expect(marvelCdbDefinition(card('99022', 'villain', 'encounter', 'x', 'Kang', { text: 'Ténacité [star] <b>Interruption forcée</b> : …' })).toughness).toBe(true)
    expect(marvelCdbDefinition(card('99023', 'event', 'basic', null, 'Bouclier', { text: 'Donnez une carte d\'état Tenace à un allié.' })).toughness).toBeUndefined()
  })
})

describe('MarvelCDB : import', () => {
  it('lit la decklist, ne demande que les cartes inconnues, suit les réimpressions, lit les autres sur le site', async () => {
    const api = fakeApi({
      'decklist/69334.json': DECK,
      'card/12019.json': { code: '12019', name: 'Premiers Soins', duplicate_of_code: '01086' },
      'card/99001.json': card('99001', 'event', 'justice', null, 'Carte Future', { quantity: 2 })
    })
    const r = await fetchMarvelCdbDeck('https://marvelcdb.com/decklist/view/69334/natasha-1.0', api.fetchFn)
    expect(r).toMatchObject({ hero: 'black_widow', heroName: 'Black Widow', title: 'Natasha', unknownCount: 0, missing: [] })
    expect(r.deckList.map(([id, q]) => `${q}x ${DEFINITION_BY_ID[id].name}`).sort()).toEqual(['1x Black Widow', '1x Carte Future', '1x Le Soldat de l\'Hiver', '2x Premiers Soins'])
    expect(DEFINITION_BY_CODE['99001']).toMatchObject({ id: 'cdb-99001', pack: 'marvelcdb', imageUrl: `${SITE}/bundles/cards/99001.png` })
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
    const r = await fetchMarvelCdbDeck('7', api.fetchFn)
    expect(r).toMatchObject({ hero: 'gambit', title: 'Ragin\' Cajun', unknownCount: 0 })
    expect(r.deckList.map(([id, q]) => `${q}x ${id}`).sort()).toEqual(['1x cdb-37001a', '2x cdb-18020', '3x cdb-37006', `1x ${DEFINITION_BY_CODE['01088'].id}`].sort())
    expect(DEFINITION_BY_CODE['37025']).toMatchObject({ type: 'obligation', set: 'gambit' })
    expect(DEFINITION_BY_CODE['37032']).toBeUndefined()

    // the game: alter ego Remy LeBeau, obligation in the encounter deck, nemesis aside; the cards stay with it
    const s = E.newGame({ hero: r.hero, deckList: r.deckList, scenario: 'rhino', modulars: ['bomb_scare'], expert: false, label: 'Ragin\' Cajun' }, { w: 1200, h: 700, cw: 80 })
    const id = E.identityCard(s)
    expect(E.cardName(id)).toBe('Remy LeBeau')
    expect(s.counters[0]).toMatchObject({ label: 'GAMBIT', value: 9 })
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => c.definitionId === 'cdb-37025')).toBe(true)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'gambit_nemesis').map(c => c.definitionId).sort()).toEqual(['cdb-37026', 'cdb-37027', 'cdb-37028', 'cdb-37028'])
    expect(s.setup.importedDefinitions.map(d => d.id).sort()).toEqual(['cdb-18020', 'cdb-37001a', 'cdb-37006', 'cdb-37025', 'cdb-37026', 'cdb-37027', 'cdb-37028'])
    expect(s.setup.importedDefinitions[0].pack).toBeUndefined()
  })

  it('nos scans en français passent avant le site : identité, cartes et réimpressions de nos boîtes ne sont pas demandées', async () => {
    // a game saved with a card read online, which our packs have since (here Quake, 08012): ours stays the one used
    addImportedDefinitions([marvelCdbDefinition(card('08012', 'ally', 'justice', null, 'Quake (site)'))])
    const api = fakeApi({ 'decklist/3.json': { name: 'Locale', hero_code: '08001a', slots: { '08002': 1, '08012': 1, '01086': 2 } } })
    const r = await fetchMarvelCdbDeck('3', api.fetchFn)
    expect(api.calls).toEqual(['decklist/3.json'])
    expect(r.deckList.map(([id]) => DEFINITION_BY_ID[id].pack)).toEqual(['black_widow', 'black_widow', 'black_widow', 'core'])
    expect(DEFINITION_BY_CODE['08012'].name).toBe('Quake')
  })

  it('un numéro seul : decklist publiée, sinon deck partagé', async () => {
    const api = fakeApi({ 'deck/69334.json': DECK })
    const r = await fetchMarvelCdbDeck('69334', api.fetchFn)
    expect(r.hero).toBe('black_widow')
    expect(api.calls.slice(0, 2)).toEqual(['decklist/69334.json', 'deck/69334.json'])
  })

  it('deck privé ou inexistant, saisie illisible : un message en clair', async () => {
    const api = fakeApi({ 'deck/7.json': new TypeError('Failed to fetch') })
    await expect(fetchMarvelCdbDeck('https://marvelcdb.com/deck/view/7', api.fetchFn)).rejects.toThrow(/Deck introuvable sur MarvelCDB/)
    await expect(fetchMarvelCdbDeck('mon deck', api.fetchFn)).rejects.toThrow(/Collez le lien/)
  })

  it('carte que l\'API ne décrit pas : son code est listé', async () => {
    const api = fakeApi({ 'decklist/1.json': { ...DECK, slots: { 99002: 2 } } })
    expect(await fetchMarvelCdbDeck('1', api.fetchFn)).toMatchObject({ unknownCount: 2, missing: ['99002'] })
  })
})
