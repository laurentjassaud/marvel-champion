import { describe, it, expect } from 'vitest'
import { parseMarvelCdbLink, marvelCdbDefinition, entryTokensFromCardText, fetchMarvelCdbDeck, readMissingSetAsideCards } from './marvelcdb.js'
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

  it('carte recto verso sous un seul code (Intangible / Dense de Vision) : sa face B, qui se retourne sur la table', () => {
    const intangible = card('26002', 'upgrade', 'hero', 'vision', 'Intangible', {
      double_sided: true, back_name: 'Dense', imagesrc: '/bundles/cards/26002a.jpg', backimagesrc: '/bundles/cards/26002b.png'
    })
    const definition = marvelCdbDefinition(intangible)
    expect(definition).toMatchObject({
      backName: 'Dense', backType: 'upgrade', imageUrl: `${SITE}/bundles/cards/26002a.jpg`, backImageUrl: `${SITE}/bundles/cards/26002b.png`
    })
    // une carte simple n'a pas de face B
    expect(marvelCdbDefinition(card('26003', 'ally', 'hero', 'vision', 'Vivian')).backName).toBeUndefined()
    // une ancienne fiche (sans `revision`, sans face B), gardée avec un deck : la nouvelle la remplace sur place
    const { backName, backType, backImageUrl, revision, ...oldDefinition } = definition
    addImportedDefinitions([oldDefinition])
    const sameObject = DEFINITION_BY_ID['cdb-26002']
    expect(sameObject.backName).toBeUndefined()
    addImportedDefinitions([definition])
    expect(DEFINITION_BY_ID['cdb-26002']).toBe(sameObject)
    expect(DEFINITION_BY_CODE['26002']).toMatchObject({ backName: 'Dense', revision: definition.revision })
    // l'inverse ne se fait pas : une fiche plus ancienne ne remplace pas une plus récente
    addImportedDefinitions([oldDefinition])
    expect(DEFINITION_BY_ID['cdb-26002'].backName).toBe('Dense')
    // sur la table, « retourner » passe d'une face à l'autre, au lieu de la mettre face cachée
    const game = { cards: [{ id: 'v1', definitionId: 'cdb-26002', owner: 'player', zone: 'table', side: 0, faceUp: true, x: 0, y: 0 }], log: [] }
    E.flipCard(game, game.cards[0])
    expect(game.cards[0]).toMatchObject({ side: 1, faceUp: true })
    expect(E.cardName(game.cards[0])).toBe('Dense')
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

  it('Iceberg : ses Pris Dans la Glace, hors de la liste du deck, sont lus dans sa boîte et mis de côté au début de la partie', async () => {
    const iceman = {
      code: '46001a', type_code: 'hero', faction_code: 'hero', card_set_code: 'iceman', pack_code: 'iceman', name: 'Iceberg', real_name: 'Iceman',
      quantity: 1, health: 11, hand_size: 5, imagesrc: '/bundles/cards/46001a.png',
      linked_card: { code: '46001b', type_code: 'alter_ego', name: 'Bobby Drake', hand_size: 6, health: 11, imagesrc: '/bundles/cards/46001b.png' }
    }
    const frostbite = card('46002', 'upgrade', 'hero', 'iceman_frostbite', 'Pris Dans la Glace', { quantity: 6, traits: 'Condition. Glace.' })
    const api = fakeApi({
      'decklist/8.json': { name: 'Glaçon', hero_code: '46001a', hero_name: 'Iceman', slots: { 46003: 2, '01088': 1 } },
      'card/46001a.json': iceman,
      'cards/iceman.json': [iceman, frostbite, card('46003', 'event', 'hero', 'iceman', 'Mur de Glace', { quantity: 2 })],
      'card/46003.json': card('46003', 'event', 'hero', 'iceman', 'Mur de Glace', { quantity: 2 })
    })
    const r = await fetchMarvelCdbDeck('8', api.fetchFn)
    expect(r.hero).toBe('iceman')
    expect(r.deckList.some(([id]) => id === 'cdb-46002')).toBe(false)
    expect(DEFINITION_BY_CODE['46002']).toMatchObject({ id: 'cdb-46002', name: 'Pris Dans la Glace', set: 'iceman_frostbite' })
    const s = E.newGame({ hero: r.hero, deckList: r.deckList, scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'Glaçon' }, { width: 1200, height: 700, cardWidth: 80 })
    expect(E.cardsInZone(s, 'heroSetAside').map(c => c.definitionId)).toEqual(Array(6).fill('cdb-46002'))
    expect(s.setup.importedDefinitions.map(d => d.id)).toContain('cdb-46002')
  })

  it('Angel et SP//dr : leur identité est assemblée avec d\'autres cartes de leur boîte (troisième face, alter ego, combinaison)', async () => {
    const hero = (code, set, name, linked, extra = {}) => ({ ...card(code, 'hero', 'hero', set, name, { hand_size: 5, health: 12, ...extra }), pack_code: set, linked_card: linked })
    // Angel : Archangel, sa troisième face, est une carte à part (42001c)
    const angel = hero('42001a', 'angel', 'Angel', { code: '42001b', type_code: 'alter_ego', name: 'Warren Worthington III', hand_size: 6, imagesrc: '/bundles/cards/42001b.png' })
    const archangel = card('42001c', 'hero', 'hero', 'angel', 'Archangel', { hand_size: 5, health: 12 })
    const angelApi = fakeApi({
      'decklist/10.json': { name: 'Ailes', hero_code: '42001a', hero_name: 'Angel', slots: { '01088': 1 } },
      'card/42001a.json': angel,
      'cards/angel.json': [angel, archangel]
    })
    expect((await fetchMarvelCdbDeck('10', angelApi.fetchFn)).hero).toBe('angel')
    expect(DEFINITION_BY_CODE['42001a']).toMatchObject({ backName: 'Warren Worthington III', thirdName: 'Archangel', thirdHandSize: 5, thirdCode: '42001c', forms: ['Angel', 'Archangel'] })
    const layout = { width: 1200, height: 700, cardWidth: 80 }
    const angelGame = E.newGame({ hero: 'angel', deckList: [['cdb-42001a', 1], [DEFINITION_BY_CODE['01088'].id, 3]], scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'Ailes' }, layout)
    E.setIdentityForm(angelGame, E.identityCard(angelGame), 2)
    expect(E.cardName(E.identityCard(angelGame))).toBe('Archangel')
    expect(E.handSize(angelGame)).toBe(5)

    // SP//dr : la carte héros (SP//dr Suit) a la combinaison Inactive au dos ; l'alter ego est Peni Parker, au dos de
    // laquelle est la carte « SP//dr »
    const suit = hero('31001a', 'spdr', 'SP//dr Suit', { code: '31001b', type_code: 'support', name: 'SP//dr Suit', imagesrc: '/bundles/cards/31001b.png' }, { hand_size: 3, health: 14 })
    const suitBack = card('31001b', 'support', 'hero', 'spdr', 'SP//dr Suit')
    const peni = card('31002a', 'alter_ego', 'hero', 'spdr', 'Peni Parker', { hand_size: 4, health: 14, linked_card: { code: '31002b', type_code: 'upgrade', name: 'SP//dr' } })
    const spdrBack = card('31002b', 'upgrade', 'hero', 'spdr', 'SP//dr')
    const spdrApi = fakeApi({
      'decklist/11.json': { name: 'Pilote', hero_code: '31001a', hero_name: 'SP//dr', slots: { '01088': 1 } },
      'card/31001a.json': suit,
      'cards/spdr.json': [suit, suitBack, peni, spdrBack]
    })
    expect((await fetchMarvelCdbDeck('11', spdrApi.fetchFn)).hero).toBe('spdr')
    expect(DEFINITION_BY_CODE['31001a']).toMatchObject({ name: 'SP//dr Suit', handSize: 3, backName: 'Peni Parker', backType: 'alter_ego', backHandSize: 4, backCode: '31002a' })
    expect(DEFINITION_BY_CODE['31002b']).toMatchObject({ name: 'SP//dr', type: 'upgrade', backName: 'SP//dr Suit', backType: 'support', backCode: '31001b' })
    const spdr = E.newGame({ hero: 'spdr', deckList: [['cdb-31001a', 1], [DEFINITION_BY_CODE['01088'].id, 3]], scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'Pilote' }, layout)
    expect(E.cardName(E.identityCard(spdr))).toBe('Peni Parker')
    expect(E.cardsInZone(spdr, 'hand')).toHaveLength(3) // le deck n'a que 3 cartes : la main de 4 de Peni n'est pas pleine
    const [combinaison] = E.companionCards(spdr)
    expect(combinaison).toMatchObject({ side: 1, faceUp: true, zone: 'table' })
    expect(E.cardName(combinaison)).toBe('SP//dr Suit')
    expect(spdr.log.some(entry => entry.text.includes('et « SP//dr Suit » en jeu (mise en place de SP//dr Suit)'))).toBe(true)
    // en héros : SP//dr Suit, et la carte « SP//dr » de Peni ; retour en alter ego : Peni et la combinaison Inactive
    E.flipCard(spdr, E.identityCard(spdr))
    expect(E.cardName(E.identityCard(spdr))).toBe('SP//dr Suit')
    expect(E.handSize(spdr)).toBe(3)
    expect(combinaison.side).toBe(0)
    expect(E.cardName(combinaison)).toBe('SP//dr')
    expect(spdr.log.at(-1).text).toBe('Changement de forme : SP//dr Suit (héros) ; « SP//dr » se retourne avec elle.')
    E.flipCard(spdr, E.identityCard(spdr))
    expect(combinaison.side).toBe(1)
  })

  it("Elektra et Iron Fist : héros non disponibles sur la table pour l'instant, leur deck ne se charge pas", async () => {
    for (const [heroCode, name] of [['63001a', 'Elektra'], ['64001a', 'Iron Fist']]) {
      const api = fakeApi({ 'decklist/9.json': { name: 'Refusé', hero_code: heroCode, hero_name: name, slots: { [heroCode.slice(0, 2) + '002']: 1, '01088': 1 } } })
      await expect(fetchMarvelCdbDeck('9', api.fetchFn)).rejects.toThrow(`${name} : héros non disponible sur cette plateforme.`)
      // rien d'autre n'est demandé au site
      expect(api.calls).toEqual(['decklist/9.json'])
    }
  })

  it('Tornade : un deck sauvegardé sans ses cartes Climat les fait lire sur MarvelCDB avant la partie', async () => {
    const storm = { id: 'cdb-36001a', code: '36001a', name: 'Tornade', type: 'hero', faction: 'hero', set: 'storm', quantity: 1, hitPoints: 10, handSize: 5, backName: 'Ororo Munroe', backType: 'alter_ego', backHandSize: 6 }
    addImportedDefinitions([storm])
    const deckList = [['cdb-36001a', 1], ...E.newGame({ hero: 'spider_man', deckList: [['01001a', 1], ['01088', 3]], scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'x' }, { width: 1200, height: 700, cardWidth: 80 }).setup.deckList.slice(1)]
    const options = { hero: 'storm', deckList, scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'Tornade' }
    const layout = { width: 1200, height: 700, cardWidth: 80 }
    // sans les fiches : la pile Climat reste vide, et le journal le dit
    const without = E.newGame(options, layout)
    expect(E.cardsInZone(without, 'heroSetAside')).toEqual([])
    expect(without.log.at(-1).text).toBe('Mise en place de Tornade : 4 cartes à mettre de côté manquent (MarvelCDB injoignable) ; relancez la partie une fois en ligne, ou rechargez le deck depuis son lien.')
    // lues sur MarvelCDB, une seule fois
    const weather = ['36002', '36003', '36004', '36005'].map((code, index) => card(code, 'support', 'hero', 'storm_weather_deck', ['Ciel Dégagé', 'Ouragan', 'Orage', 'Blizzard'][index]))
    const api = fakeApi(Object.fromEntries(weather.map(apiCard => [`card/${apiCard.code}.json`, apiCard])))
    expect((await readMissingSetAsideCards('storm', api.fetchFn)).map(d => d.id)).toEqual(['cdb-36002', 'cdb-36003', 'cdb-36004', 'cdb-36005'])
    expect(await readMissingSetAsideCards('storm', api.fetchFn)).toEqual([])
    expect(api.calls).toHaveLength(4)
    const withCards = E.newGame(options, layout)
    expect(E.cardsInZone(withCards, 'heroSetAside').map(c => E.cardName(c)).sort()).toEqual(['Blizzard', 'Ciel Dégagé', 'Orage', 'Ouragan'])
    // un héros sans cartes à lire ne demande rien
    expect(await readMissingSetAsideCards('spider_man', api.fetchFn)).toEqual([])
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

  it('une carte lue par une version plus ancienne de l\'import est redemandée au site, et sa fiche mise à jour', async () => {
    // gardée avec un deck avant que l'import connaisse les cartes recto verso sous un seul code : sans revision ni face B
    addImportedDefinitions([{ id: 'cdb-95002', code: '95002', name: 'Recto', type: 'upgrade', faction: 'hero', set: 'test', quantity: 1 }])
    const stale = DEFINITION_BY_ID['cdb-95002']
    const api = fakeApi({
      'decklist/5.json': { name: 'Recto verso', hero_code: '08001a', slots: { 95002: 1 } },
      'card/95002.json': card('95002', 'upgrade', 'hero', 'test', 'Recto', { double_sided: true, back_name: 'Verso', backimagesrc: '/bundles/cards/95002b.png' })
    })
    await fetchMarvelCdbDeck('5', api.fetchFn)
    expect(api.calls).toContain('card/95002.json')
    expect(DEFINITION_BY_ID['cdb-95002']).toBe(stale)
    expect(stale).toMatchObject({ backName: 'Verso', backImageUrl: `${SITE}/bundles/cards/95002b.png` })
    // à jour, elle n'est plus redemandée
    const again = fakeApi({ 'decklist/5.json': { name: 'Recto verso', hero_code: '08001a', slots: { 95002: 1 } } })
    await fetchMarvelCdbDeck('5', again.fetchFn)
    expect(again.calls).toEqual(['decklist/5.json'])
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
