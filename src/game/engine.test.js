import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import * as E from './engine.js'
import { CARD_DEFINITIONS, PRECON_DECKS, HEROES, SCENARIOS, DEFINITION_BY_ID, DEFINITION_BY_CODE, MODULAR_SETS, VICTORY_TEXTS } from './data.js'
import { HERO_RULES, SCENARIO_RULES } from './rules.js'
import { migrateSavedGame, SAVED_GAME_VERSION } from './savedGame.js'

const L = { width: 1100, height: 580, cardWidth: 80 }

// small seeded PRNG so shuffles are reproducible
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const game = (over = {}) =>
  E.newGame({ hero: 'spider_man', deckList: PRECON_DECKS.spider_man, scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'test', ...over }, L)
const qty = pred => CARD_DEFINITIONS.filter(pred).reduce((n, d) => n + d.quantity, 0)
// puts the first card of type `t` from a pile face up on the table
const onTable = (s, t, zone = 'encounterDeck') => {
  const c = E.cardsInZone(s, zone).find(x => E.definitionOf(x).type === t)
  E.moveCard(s, c, 'table', {}, true)
  return c
}

beforeEach(() => E.setRandomSource(seeded(42)))

describe('données', () => {
  it('chaque précon fait 40 cartes hors identité et obligation', () => {
    for (const h of HEROES) {
      const n = PRECON_DECKS[h.id].reduce((t, [g, q]) => t + (['hero', 'obligation'].includes(DEFINITION_BY_ID[g].type) ? 0 : q), 0)
      expect(n, h.id).toBe(40)
    }
  })

  it('chaque carte a son image, et son verso (et sa troisième face) si elle en a un', () => {
    const cards = new URL('../../public/cards/', import.meta.url)
    const files = CARD_DEFINITIONS.flatMap(d => [`${d.imageFolder}/${d.id}.jpg`, ...(d.backName ? [`${d.imageFolder}/${d.id}.b.jpg`] : []), ...(d.thirdName ? [`${d.imageFolder}/${d.id}.c.jpg`] : [])])
    expect(files.filter(f => !existsSync(new URL(f, cards)))).toEqual([])
  })

  it('les sets du Bouffon Vert ont le nombre de cartes imprimé', () => {
    const sizes = { risky_business: 24, mutagen_formula: 31, goblin_gimmicks: 8, a_mess_of_things: 5, power_drain: 5, running_interference: 5 }
    for (const [set, n] of Object.entries(sizes)) expect(qty(d => d.set === set), set).toBe(n)
  })

  it('les sets des Démolisseurs ont le nombre de cartes imprimé', () => {
    const sizes = { wrecking_crew: 1, wrecker: 18, thunderball: 18, piledriver: 18, bulldozer: 18 }
    for (const [set, n] of Object.entries(sizes)) expect(qty(d => d.set === set), set).toBe(n)
  })
})

describe('mise en place', () => {
  it('Spider-Man contre Rhino standard', () => {
    const s = game()
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    const id = E.identityCard(s)
    expect(id.zone).toBe('table')
    expect(id.side).toBe(1) // alter ego
    expect(E.handSize(s)).toBe(6)
    const table = E.cardsInZone(s, 'table').map(c => E.definitionOf(c).type)
    expect(table.sort()).toEqual(['hero', 'main_scheme', 'villain'])
    expect(E.definitionOf(E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')).stage).toBe('I')
    const enc = qty(d => d.faction === 'encounter' && ['rhino', 'bomb_scare', 'standard'].includes(d.set) && !['villain', 'main_scheme'].includes(d.type)) + 1
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(enc)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).type === 'obligation')).toBe(true)
    expect(E.cardsInZone(s, 'setAside')).toHaveLength(1 + qty(d => d.set === 'spider_man_nemesis'))
    expect(s.counters.map(counter => counter.value)).toEqual([10, 14, 0])
    expect(s.counters[2].label).toBe('Menace /7')
  })

  it('expert : étapes II et III et set Expert', () => {
    const s = game({ scenario: 'ultron', modulars: ['under_attack'], expert: true })
    const v = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')
    expect(E.definitionOf(v).stage).toBe('II')
    expect(E.cardsInZone(s, 'setAside').some(c => E.definitionOf(c).type === 'villain' && E.definitionOf(c).stage === 'III')).toBe(true)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).type === 'main_scheme')).toHaveLength(2)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).set === 'expert')).toBe(true)
  })

  it('Black Widow : précon Justice, obligation dans la Rencontre, Némésis de côté', () => {
    const s = game({ hero: 'black_widow', deckList: PRECON_DECKS.black_widow })
    expect(E.cardName(E.identityCard(s))).toBe('Natasha Romanoff')
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ label: 'BLACK WIDOW', value: 9 })
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.cardName(c) === 'Désaveu Officiel')).toBe(true)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'black_widow_nemesis')).toHaveLength(5)
    // the core cards reprinted in the pack are in the deck
    expect([...E.cardsInZone(s, 'playerDeck'), ...E.cardsInZone(s, 'hand')].filter(c => E.cardName(c) === 'Nick Fury')).toHaveLength(1)
  })

  it('Docteur Strange : deck Invocation à part, face visible, remélangé sans pénalité', () => {
    const s = game({ hero: 'doctor_strange', deckList: PRECON_DECKS.doctor_strange })
    expect(E.cardName(E.identityCard(s))).toBe('Stephen Strange')
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    expect(E.cardsInZone(s, 'invocationDeck')).toHaveLength(5)
    expect(E.cardsInZone(s, 'invocationDeck').every(c => c.faceUp)).toBe(true)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.cardName(c) === 'Séquelle Physique')).toBe(true)
    expect(E.cardsInZone(s, 'setAside')).toHaveLength(1 + 5) // étape II de Rhino + Némésis
    const edeck = E.cardsInZone(s, 'encounterDeck').length
    const first = E.castInvocation(s)
    expect(first.zone).toBe('invocationDiscard')
    E.castInvocationAndKeep(s)
    expect(E.cardsInZone(s, 'invocationDeck')).toHaveLength(4)
    // a cast card sent "to the deck" goes back on top of the Invocation deck, face up
    E.moveCard(s, first, 'deck')
    expect(E.cardsInZone(s, 'invocationDeck').at(-1)).toBe(first)
    expect(first.faceUp).toBe(true)
    for (let i = 0; i < 5; i++) E.castInvocation(s, i % 2 === 0)
    expect(E.cardsInZone(s, 'invocationDeck')).toHaveLength(5)
    expect(E.cardsInZone(s, 'invocationDiscard')).toHaveLength(0)
    expect(s.accelerationTokens).toBe(0)
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(edeck)
  })

  it('Captain America : le Bouclier est ajouté à la main de départ (mise en place de Steve Rogers)', () => {
    const s = game({ hero: 'captain_america', deckList: PRECON_DECKS.captain_america })
    expect(E.cardName(E.identityCard(s))).toBe('Steve Rogers')
    expect(s.counters[0]).toMatchObject({ label: 'CAPTAIN AMERICA', value: 11 })
    const shield = c => E.cardName(c) === 'Bouclier de Captain America'
    expect(E.cardsInZone(s, 'hand').filter(shield)).toHaveLength(1)
    expect(E.cardsInZone(s, 'playerDeck').length + E.cardsInZone(s, 'hand').length).toBe(40)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.cardName(c) === "Homme d'une Autre Époque")).toBe(true)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'captain_america_nemesis')).toHaveLength(5)
  })

  it('Captain America : le Bouclier ne compte pas dans la main du mulligan, et revient s\'il est défaussé', () => {
    const s = game({ hero: 'captain_america', deckList: PRECON_DECKS.captain_america })
    const isShield = c => E.cardName(c) === 'Bouclier de Captain America'
    const hand = E.cardsInZone(s, 'hand')
    expect(hand).toHaveLength(hand.some(c => c.id === s.setupCardId) ? 7 : 6)
    // keep the shield, discard 2 others: back to 6 + the shield
    E.mulligan(s, L, hand.filter(c => !isShield(c)).slice(0, 2).map(c => c.id))
    expect(E.cardsInZone(s, 'hand')).toHaveLength(7)
    // discard the shield too: it comes back from the discard pile
    const s2 = game({ hero: 'captain_america', deckList: PRECON_DECKS.captain_america })
    E.mulligan(s2, L, E.cardsInZone(s2, 'hand').filter(isShield).map(c => c.id))
    expect(E.cardsInZone(s2, 'hand').filter(isShield)).toHaveLength(1)
    expect(E.cardsInZone(s2, 'hand')).toHaveLength(7)
  })

  it('Hulk : sous forme de héros, il défausse sa main à la fin de son tour (Enragé)', () => {
    const s = game({ hero: 'hulk', deckList: PRECON_DECKS.hulk })
    expect(E.cardName(E.identityCard(s))).toBe('Bruce Banner')
    expect(s.counters[0]).toMatchObject({ label: 'HULK', value: 18 })
    expect(E.cardsInZone(s, 'hand')).toHaveLength(5)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'hulk_nemesis')).toHaveLength(5)
    // alter ego: the hand stays
    E.startVillainPhase(s, L)
    expect(E.cardsInZone(s, 'hand')).toHaveLength(5)
    E.startHeroPhase(s)
    // hero form: the hand is discarded, then drawn up to 4 at the end of the hero phase
    E.flipCard(s, E.identityCard(s))
    const hand = E.cardsInZone(s, 'hand')
    E.startVillainPhase(s, L)
    expect(hand.every(c => c.zone === 'playerDiscard')).toBe(true)
    expect(E.cardsInZone(s, 'hand')).toHaveLength(4)
  })

  it('Miss Marvel : précon Protection, obligation dans la Rencontre, Némésis de côté', () => {
    const s = game({ hero: 'ms_marvel', deckList: PRECON_DECKS.ms_marvel })
    expect(E.cardName(E.identityCard(s))).toBe('Kamala Khan')
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ label: 'MISS MARVEL', value: 10 })
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.cardName(c) === "Rentrer Avant l'Aube")).toBe(true)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'ms_marvel_nemesis')).toHaveLength(5)
  })

  it('Thor : précon Agressivité, Némésis de côté, le Géant de Glace entre en jeu Tenace', () => {
    const s = game({ hero: 'thor', deckList: PRECON_DECKS.thor })
    expect(E.cardName(E.identityCard(s))).toBe('Odinson')
    expect(E.cardsInZone(s, 'hand')).toHaveLength(5)
    expect(E.cardsInZone(s, 'playerDeck').length + 5).toBe(40)
    expect(s.counters[0]).toMatchObject({ label: 'THOR', value: 14 })
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.cardName(c) === "Colère d'Odin")).toBe(true)
    const nemesis = E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'thor_nemesis')
    expect(nemesis).toHaveLength(5)
    const giant = nemesis.find(c => E.cardName(c) === 'Géant de Glace')
    E.takeFromPile(s, L, giant, 'setAside')
    expect(giant.tough).toBe(true)
    // a boost (face down) is not a character entering play
    const other = nemesis.find(c => c !== giant && E.cardName(c) === 'Géant de Glace')
    E.moveCard(s, other, 'table', { faceDown: true }, true)
    expect(other.tough).toBeFalsy()
  })

  it('Vif-Argent : précon Protection, obligation dans la Rencontre, Némésis de côté', () => {
    const s = game({ hero: 'quicksilver', deckList: PRECON_DECKS.quicksilver })
    expect(E.cardName(E.identityCard(s))).toBe('Pietro Maximoff')
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ label: 'VIF-ARGENT', value: 9 })
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.cardName(c) === 'Besoin de Vitesse')).toBe(true)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'quicksilver_nemesis')).toHaveLength(5)
    // the core Veste Blindée reprinted in the pack; MarvelCDB codes of the pack start with 14
    expect([...E.cardsInZone(s, 'playerDeck'), ...E.cardsInZone(s, 'hand')].filter(c => c.definitionId === DEFINITION_BY_CODE['01081'].id)).toHaveLength(2)
    expect(DEFINITION_BY_CODE['14001a']).toMatchObject({ type: 'hero', set: 'quicksilver' })
    expect(E.parseMarvelCdbDeck({ name: 'Q', hero_code: '14001a', slots: { '14016': 2 } }, { '14016': { duplicate_of_code: '01081' } }).hero).toBe('quicksilver')
    // Zola's Prison d'Hydra holds La Sorcière Rouge (cost 3)
    const zola = game({ hero: 'quicksilver', deckList: PRECON_DECKS.quicksilver, scenario: 'zola', modulars: ['under_attack'] })
    expect(zola.cards.find(c => E.cardName(c) === 'Prison d\'Hydra').threat).toBe(1 + 3)
  })

  it('La Sorcière Rouge : précon Justice, obligation dans la Rencontre, Némésis de côté', () => {
    const s = game({ hero: 'scarlet_witch', deckList: PRECON_DECKS.scarlet_witch })
    expect(E.cardName(E.identityCard(s))).toBe('Wanda Maximoff')
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ label: 'LA SORCIÈRE ROUGE', value: 10 })
    expect(E.cardsInZone(s, 'encounterDeck').filter(c => E.cardName(c) === 'Santé Mentale Précaire')).toHaveLength(1)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'scarlet_witch_nemesis')).toHaveLength(4)
    // Ordre et Chaos, printed in both packs, is the card of the Vif-Argent pack; a MarvelCDB deck finds it by its reprint
    expect([...E.cardsInZone(s, 'playerDeck'), ...E.cardsInZone(s, 'hand')].filter(c => c.definitionId === 'qsv-18')).toHaveLength(1)
    const r = E.parseMarvelCdbDeck({ name: 'W', hero_code: '15001a', slots: { '15002': 1, '15018': 1 } }, { '15018': { duplicate_of_code: '14018' } })
    expect(r.deckList.map(([id]) => id)).toEqual(['scw-01', 'scw-02', 'qsv-18'])
    // Zola's Prison d'Hydra holds Vif-Argent (cost 4)
    const zola = game({ hero: 'scarlet_witch', deckList: PRECON_DECKS.scarlet_witch, scenario: 'zola', modulars: ['under_attack'] })
    expect(zola.cards.find(c => E.cardName(c) === 'Prison d\'Hydra').threat).toBe(1 + 4)
  })

  it('La Guêpe : précon Agressivité, deux formes de héros (Minuscule, Géant) et Nadia Van Dyne', () => {
    const s = game({ hero: 'wasp', deckList: PRECON_DECKS.wasp })
    const id = E.identityCard(s)
    expect(E.cardName(id)).toBe('Nadia Van Dyne')
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ label: 'LA GUÊPE', value: 11 })
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.cardName(c) === 'Rêves Rouges')).toBe(true)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'wasp_nemesis')).toHaveLength(5)
    // F: alter ego → Minuscule (A) → alter ego; Géant (C) is a form of its own, statuses kept
    E.flipCard(s, id)
    expect(id.side).toBe(0)
    expect(E.handSize(s)).toBe(5)
    expect(s.log.at(-1).text).toBe('Changement de forme : La Guêpe (héros Minuscule).')
    E.toggleStatus(s, id, 'stunned')
    E.setIdentityForm(s, id, 2)
    expect(id).toMatchObject({ side: 2, stunned: true })
    expect(E.isAlterEgo(id)).toBe(false)
    expect(E.handSize(s)).toBe(5)
    expect(s.log.at(-1).text).toBe('Changement de forme : La Guêpe (héros Géant).')
    E.flipCard(s, id)
    expect(id.side).toBe(1)
    expect(E.handSize(s)).toBe(6)
    // a hero without a third side does not take one
    const thor = game({ hero: 'thor', deckList: PRECON_DECKS.thor })
    E.setIdentityForm(thor, E.identityCard(thor), 2)
    expect(E.identityCard(thor).side).toBe(1)
    // Tactique d'Essaim, printed in the Ant-Man pack too: a single card, MarvelCDB decks name it 12020 or 13020
    expect(DEFINITION_BY_CODE['12020']).toBe(DEFINITION_BY_ID['wsp-20'])
    expect(DEFINITION_BY_CODE['13020']).toBe(DEFINITION_BY_ID['wsp-20'])
    const r = E.parseMarvelCdbDeck({ name: 'N', hero_code: '13001a', slots: { 12020: 1, '08023': 1 } })
    expect(r.deckList.map(([g]) => DEFINITION_BY_ID[g].name)).toEqual(['La Guêpe', 'Tactique d\'Essaim', 'Quinporteur'])
  })

  it('Ant-Man : précon Commandement, deux formes de héros (Minuscule, Géant) et Scott Lang', () => {
    const s = game({ hero: 'ant_man', deckList: PRECON_DECKS.ant_man })
    const id = E.identityCard(s)
    expect(E.cardName(id)).toBe('Scott Lang')
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ label: 'ANT-MAN', value: 12 })
    expect(E.cardsInZone(s, 'encounterDeck').filter(c => E.cardName(c) === 'Veiller sur Cassie')).toHaveLength(1)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'ant_man_nemesis')).toHaveLength(5)
    // Géant (C) straight from the alter ego, then Minuscule (A): each its own hand size
    E.setIdentityForm(s, id, 2)
    expect(id.side).toBe(2)
    expect(E.handSize(s)).toBe(4)
    expect(s.log.at(-1).text).toBe('Changement de forme : Ant-Man (héros Géant).')
    E.setIdentityForm(s, id, 0)
    expect(E.handSize(s)).toBe(5)
    expect(s.log.at(-1).text).toBe('Changement de forme : Ant-Man (héros Minuscule).')
    // Tactique d'Essaim is the card of the Wasp pack; the core reprints (Premiers Soins) are the core cards
    const own = [...E.cardsInZone(s, 'playerDeck'), ...E.cardsInZone(s, 'hand')]
    expect(own.filter(c => c.definitionId === 'wsp-20')).toHaveLength(1)
    expect(own.filter(c => c.definitionId === DEFINITION_BY_CODE['01086'].id)).toHaveLength(2)
    const r = E.parseMarvelCdbDeck({ name: 'S', hero_code: '12001a', slots: { 12002: 1, 12019: 2, 12020: 1, 12025: 1 } }, { 12019: { duplicate_of_code: '01086' } })
    expect(r.hero).toBe('ant_man')
    expect(r.deckList.map(([g, q]) => `${q}x ${DEFINITION_BY_ID[g].name}`)).toEqual(['1x Ant-Man', '1x La Guêpe', '2x Premiers Soins', '1x Tactique d\'Essaim'])
    // MarvelCDB text: the pack in brackets tells the Ant-Man ally of this pack from the one of the Wasp pack
    const t = E.parseDeckFile('Fourmis\n\nAnt-Man\nPacks: Ant-Man, Wasp\n\n1x Ant-Man (Ant-Man)\n1x Ant-Man (Wasp)\n1x Swarm Tactics (Ant-Man)')
    expect(t.hero).toBe('ant_man')
    expect(t.deckList.map(([g]) => g)).toEqual(['ant-01', 'ant-11', 'wsp-02', 'wsp-20'])
    // Zola's Prison d'Hydra holds La Guêpe (cost 3)
    const zola = game({ hero: 'ant_man', deckList: PRECON_DECKS.ant_man, scenario: 'zola', modulars: ['under_attack'] })
    expect(zola.cards.find(c => E.cardName(c) === 'Prison d\'Hydra').threat).toBe(1 + 3)
  })

  it('set modulaire et difficulté au hasard : tirés à la mise en place, jamais nommés', () => {
    const s = game({ modulars: 'random', expert: 'random' })
    expect(s.setup.modulars).toHaveLength(1)
    expect(MODULAR_SETS.map(m => m.id)).toContain(s.setup.modulars[0])
    expect(typeof s.setup.expert).toBe('boolean')
    expect(s.setup.randomChoices).toEqual(['modular', 'expert'])
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).set === s.setup.modulars[0])).toBe(true)
    const text = s.log.map(e => e.text).join(' ')
    expect(text).toContain('module tiré au hasard, difficulté tirée au hasard')
    expect(text).not.toMatch(new RegExp(`${MODULAR_SETS.find(m => m.id === s.setup.modulars[0]).name}|expert|standard`, 'i'))
    // a choice made by hand is named
    expect(E.setupSummary({ modulars: ['bomb_scare'], expert: true, randomChoices: ['modular'] })).toBe(', module tiré au hasard, expert')
    expect(E.setupSummary({ modulars: ['bomb_scare'], expert: false, randomChoices: [] })).toBe(', module Alerte à la Bombe, standard')
    // several draws do not always give the same set
    const sets = new Set(Array.from({ length: 12 }, () => game({ modulars: 'random' }).setup.modulars[0]))
    expect(sets.size).toBeGreaterThan(1)
    // Les Démolisseurs have no modular set: nothing to draw
    const crew = game({ scenario: 'wrecking_crew', modulars: 'random' })
    expect(crew.setup).toMatchObject({ modulars: [], randomChoices: [] })
  })

  it('refuse un héros inconnu', () => {
    expect(() => game({ hero: 'heros_inconnu' })).toThrow()
  })
})

describe('paquets', () => {
  it('paquet vide : remélange la défausse et donne une Rencontre face cachée', () => {
    const s = game()
    E.cardsInZone(s, 'playerDeck').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    const enc = E.cardsInZone(s, 'encounterDeck').length
    const total = E.cardsInZone(s, 'playerDiscard').length
    expect(E.drawCard(s, L)).toBe(true)
    // the discard became the deck, one card of it drawn
    expect(E.cardsInZone(s, 'playerDiscard')).toHaveLength(0)
    expect(E.cardsInZone(s, 'playerDeck')).toHaveLength(total - 1)
    expect(E.cardsInZone(s, 'hand').length).toBeGreaterThan(0)
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(enc - 1)
    // the encounter card, face down in front of the identity (above it)
    const id = E.identityCard(s)
    const dealt = E.cardsInZone(s, 'table').filter(c => E.isEncounterCard(c) && !c.faceUp)
    expect(dealt).toHaveLength(1)
    expect(dealt[0]).toMatchObject({ dealtToPlayer: true, x: id.x, y: id.y - L.cardWidth * 1.4 - 12 })
    expect(s.log.at(-2).text).toBe(`Paquet vide : votre défausse est remélangée et devient votre paquet. Vous recevez une carte Rencontre face cachée, posée devant ${E.cardName(id)}.`)
    // it follows the identity once moved; a second one fans out to the right
    id.x = 300
    E.cardsInZone(s, 'playerDeck').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    E.drawCard(s, L)
    const next = E.cardsInZone(s, 'table').find(c => c.dealtToPlayer && c !== dealt[0])
    expect(next).toMatchObject({ x: 300 + L.cardWidth * 0.35, y: id.y - L.cardWidth * 1.4 - 12 })
    // back in a pile, it is no longer dealt
    E.moveCard(s, next, 'discard')
    expect(next.dealtToPlayer).toBeUndefined()
    // a boost stays in the villain row
    expect(E.dealBoostCard(s, L).dealtToPlayer).toBeUndefined()
    // nothing left to draw at all
    E.cardsInZone(s, 'playerDeck').forEach(c => E.moveCard(s, c, 'hand', {}, true))
    expect(E.drawCard(s, L)).toBe(false)
  })

  it('Rencontre vide : remélange et ajoute un jeton d\'accélération', () => {
    const s = game()
    E.cardsInZone(s, 'encounterDeck').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    expect(E.cardsInZone(s, 'encounterDiscard').length).toBeGreaterThan(0)
    const c = E.revealEncounterCard(s, L)
    expect(c.zone).toBe('table')
    expect(s.accelerationTokens).toBe(1)
  })

  it('une carte Rencontre défaussée va dans la défausse Rencontre', () => {
    const s = game()
    const c = E.revealEncounterCard(s, L)
    E.moveCard(s, c, 'discard')
    expect(c.zone).toBe('encounterDiscard')
  })

  it('phase du méchant : aucun automatisme côté méchant, seul un rappel au journal', () => {
    const s = game()
    s.accelerationTokens = 1
    const edeck = E.cardsInZone(s, 'encounterDeck').length
    const table = E.cardsInZone(s, 'table').length
    E.startVillainPhase(s, L)
    expect(s.counters[2].value).toBe(0)
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(edeck)
    expect(E.cardsInZone(s, 'table')).toHaveLength(table)
    expect(s.log.at(-1).text).toBe("Phase du méchant : à jouer à la main (menace sur la manigance principale (+1 d'accélération), activations, cartes Rencontre).")
  })

  it('passage à la phase du méchant : redresse et complète la main selon la forme', () => {
    const s = game()
    const [a, b, c] = E.cardsInZone(s, 'hand')
    E.playToTable(s, L, a)
    E.toggleExhausted(s, a)
    E.toggleExhausted(s, E.identityCard(s))
    E.moveCard(s, b, 'discard')
    E.moveCard(s, c, 'discard')
    E.startVillainPhase(s, L)
    expect(a.exhausted).toBe(false)
    expect(E.identityCard(s).exhausted).toBe(false)
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6) // Peter Parker, alter ego
    // in hero form (Spider-Man, hand size 5) a hand of 3 is drawn up to 5 only
    E.startHeroPhase(s)
    E.flipCard(s, E.identityCard(s))
    E.cardsInZone(s, 'hand').slice(0, 3).forEach(x => E.moveCard(s, x, 'discard', {}, true))
    E.startVillainPhase(s, L)
    expect(E.cardsInZone(s, 'hand')).toHaveLength(5)
  })

  it('tours et phases : on commence au tour 1 en phase du héros, le tour avance au retour du héros', () => {
    const s = game()
    expect(s).toMatchObject({ turn: 1, phase: 'hero' })
    expect(E.startHeroPhase(s)).toBe(false) // already in the hero phase
    expect(s.turn).toBe(1)
    const edeck = E.cardsInZone(s, 'encounterDeck').length
    expect(E.startVillainPhase(s, L)).toBe(true)
    expect(s).toMatchObject({ turn: 1, phase: 'villain' })
    // a second click on the phase in play does nothing: no second refill
    const hand = E.cardsInZone(s, 'hand').length
    E.moveCard(s, E.cardsInZone(s, 'hand')[0], 'discard', {}, true)
    expect(E.startVillainPhase(s, L)).toBe(false)
    expect(E.cardsInZone(s, 'hand')).toHaveLength(hand - 1)
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(edeck)
    expect(E.startHeroPhase(s)).toBe(true)
    expect(s).toMatchObject({ turn: 2, phase: 'hero' })
  })
})

describe('mulligan', () => {
  it('défausse la sélection et repioche jusqu\'à la taille de main', () => {
    const s = game()
    const ids = E.cardsInZone(s, 'hand').slice(0, 3).map(c => c.id)
    expect(E.mulligan(s, L, ids)).toBe(3)
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDiscard')).toHaveLength(3)
    expect(E.cardsInZone(s, 'playerDeck')).toHaveLength(31)
    expect(s.mulliganTaken).toBe(true)
  })

  it('sans sélection, garde la main : la décision est prise, le mulligan est passé', () => {
    const s = game()
    const hand = E.cardsInZone(s, 'hand').map(c => c.id)
    expect(E.mulligan(s, L, [])).toBe(0)
    expect(E.cardsInZone(s, 'hand').map(c => c.id)).toEqual(hand)
    expect(s.mulliganTaken).toBe(true)
  })
})

describe('main et partie', () => {
  it('carte de la main au hasard : une carte de la main, annoncée au journal', () => {
    const s = game()
    const picks = new Set()
    for (let i = 0; i < 20; i++) {
      const c = E.pickRandomHandCard(s)
      expect(c.zone).toBe('hand')
      expect(s.log.at(-1).text).toBe(`Carte de la main au hasard : « ${E.cardName(c)} ».`)
      picks.add(c.id)
    }
    expect(picks.size).toBeGreaterThan(1)
    E.cardsInZone(s, 'hand').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    expect(E.pickRandomHandCard(s)).toBeNull()
  })

  it('la mise en place jouée est mémorisée : la rejouer (Recommencer) redonne la même', () => {
    const list = PRECON_DECKS.black_widow.slice(0, -2)
    const s = game({ hero: 'black_widow', deckList: list, modulars: 'random', expert: 'random', deckLabel: 'mon deck' })
    E.mulligan(s, L, [])
    E.startVillainPhase(s, L)
    E.startHeroPhase(s)
    const setup = s.setup
    expect(setup.deckList).toBe(list)
    const again = E.newGame({ hero: setup.hero, deckList: setup.deckList, scenario: setup.scenario, modulars: setup.modulars, expert: setup.expert, deckLabel: setup.deckLabel, randomChoices: setup.randomChoices }, L)
    expect(again.setup).toEqual(setup)
    expect(again).toMatchObject({ turn: 1, phase: 'hero', mulliganTaken: false })
    // replayed, what was drawn at random is still not named
    expect(again.log[0].text).toMatch(/module tiré au hasard, difficulté tirée au hasard\.$/)
    expect(E.cardsInZone(again, 'playerDeck').length + E.cardsInZone(again, 'hand').length).toBe(E.cardsInZone(s, 'playerDeck').length + E.cardsInZone(s, 'hand').length + E.cardsInZone(s, 'playerDiscard').length)
  })
})

describe('dégâts et menace', () => {
  it('dégâts : compteurs pour le méchant et l\'identité, jeton sur les sbires, rien sur les manigances', () => {
    const s = game()
    const villain = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')
    E.addDamage(s, villain, 3)
    expect(s.counters[1].value).toBe(11)
    E.addDamage(s, null, 1)
    expect(s.counters[1].value).toBe(10)
    E.addDamage(s, E.identityCard(s), 2)
    expect(s.counters[0].value).toBe(8)
    const minion = onTable(s, 'minion')
    E.addDamage(s, minion, 2)
    E.addDamage(s, minion, -1)
    expect(minion.damage).toBe(1)
    E.addDamage(s, minion, -5)
    expect(minion.damage).toBe(0)
    const side = onTable(s, 'side_scheme')
    E.addDamage(s, side, 2)
    expect(side.damage).toBe(0)
    expect(s.counters[1].value).toBe(10)
  })

  it('menace : compteur pour la manigance principale, jeton sur les annexes, rien sur les personnages', () => {
    const s = game()
    E.addThreat(s, null, 2)
    const scheme = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'main_scheme')
    E.addThreat(s, scheme, 1)
    expect(s.counters[2].value).toBe(3)
    const side = onTable(s, 'side_scheme')
    E.addThreat(s, side, 2)
    expect(side.threat).toBe(2)
    expect(s.counters[2].value).toBe(3)
    const minion = onTable(s, 'minion')
    E.addThreat(s, minion, 1)
    expect(minion.threat).toBe(0)
  })

  it('jetons : sur les autres cartes seulement, retirés quand la carte quitte la table', () => {
    const s = game()
    // a support that enters play without counters (Équipe de Surveillance has 3 of its own)
    const support = E.cardsInZone(s, 'playerDeck').find(x => E.definitionOf(x).type === 'support' && !E.definitionOf(x).entryTokens)
    E.moveCard(s, support, 'table', {}, true)
    expect(support.tokens).toBe(0)
    E.addTokens(s, support, 3)
    E.addTokens(s, support, -1)
    expect(support.tokens).toBe(2)
    E.addDamage(s, support, 1)
    E.addThreat(s, support, 1)
    expect(support).toMatchObject({ damage: 0, threat: 0 })
    const minion = onTable(s, 'minion')
    E.addTokens(s, minion, 1)
    expect(minion.tokens).toBe(0)
    E.moveCard(s, support, 'discard')
    expect(support.tokens).toBe(0)
  })

  it('nouvelle étape du méchant depuis « De côté » met à jour les PV', () => {
    const s = game()
    const next = E.cardsInZone(s, 'setAside').find(c => E.definitionOf(c).type === 'villain')
    E.takeFromPile(s, L, next, 'setAside')
    expect(s.counters[1]).toMatchObject({ value: 15, label: 'Rhino II' })
  })

  it('méchant vaincu : l\'étape suivante le remplace, au même endroit, avec ses cartes d\'état', () => {
    const s = game()
    const rhino = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')
    const { x, y } = rhino
    E.toggleStatus(s, rhino, 'stunned')
    E.addDamage(s, null, 10)
    expect(E.addDamage(s, null, 3)).toBeUndefined() // 1 PV left
    const r = E.addDamage(s, rhino, 5)
    expect(r.kind).toBe('stage')
    const next = E.cardById(s, r.toCardId)
    expect(next).toMatchObject({ zone: 'table', x, y, stunned: true, damage: 0 })
    expect(E.definitionOf(next).stage).toBe('II')
    expect(rhino.zone).toBe('outOfGame')
    expect(E.cardsInZone(s, 'setAside').some(c => E.definitionOf(c).type === 'villain')).toBe(false)
    expect(s.counters[1]).toMatchObject({ value: 15, label: 'Rhino II' })
  })

  it('dernière étape vaincue : victoire, avec la manigance en jeu ; pas de second déclenchement', () => {
    const s = game()
    E.addDamage(s, null, 14)
    const r = E.addDamage(s, null, 15)
    const scheme = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'main_scheme')
    expect(r).toMatchObject({ kind: 'victory', mainSchemeId: scheme.id })
    expect(VICTORY_TEXTS[scheme.definitionId]).toMatch(/Rhino/)
    expect(s.log.at(-1).text).toBe('Victoire : « Rhino » est vaincu en 1 tour !')
    expect(E.addDamage(s, null, 1)).toBeUndefined() // already at 0
    // every main scheme has its victory text
    expect(CARD_DEFINITIONS.filter(d => d.type === 'main_scheme').filter(d => !VICTORY_TEXTS[d.id]).map(d => d.name)).toEqual([])
  })
})

describe('scénarios du Bouffon Vert', () => {
  const onTableNamed = (s, name) => E.cardsInZone(s, 'table').filter(c => E.cardName(c) === name)

  it('Entreprise à Risques : Norman Osborn, Entreprise Criminelle en jeu avec 2 jetons', () => {
    const s = game({ scenario: 'risky_business', modulars: ['goblin_gimmicks'] })
    const villain = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')
    expect(E.cardName(villain)).toBe('Norman Osborn')
    const [env] = onTableNamed(s, 'Entreprise Criminelle')
    expect(env.tokens).toBe(2)
    // the environment starts in play, the rest of the set goes into the deck with the obligation
    const enc = qty(d => d.faction === 'encounter' && ['risky_business', 'goblin_gimmicks', 'standard'].includes(d.set) && !['villain', 'main_scheme', 'environment'].includes(d.type)) + 1
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(enc)
    expect(s.counters.map(counter => counter.value)).toEqual([10, 14, 2])
    expect(s.counters[2].label).toBe('Menace /7')
  })

  it('Entreprise à Risques : Norman Osborn retourné devient Le Bouffon Vert (compteur et traits)', () => {
    const s = game({ scenario: 'risky_business', modulars: ['goblin_gimmicks'] })
    const villain = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')
    E.flipCard(s, villain)
    expect(s.counters[1].label).toBe('Le Bouffon Vert I')
    expect(E.traitsOf(villain)).toContain('bouffon')
    const [env] = onTableNamed(s, 'Entreprise Criminelle')
    E.flipCard(s, env)
    expect(E.cardName(env)).toBe('Accès de Folie')
  })

  it('Entreprise à Risques : 2 jetons Infamie à la mise en place, 2 jetons Folie une fois retournée', () => {
    const s = game({ scenario: 'risky_business', modulars: ['goblin_gimmicks'] })
    const [env] = onTableNamed(s, 'Entreprise Criminelle')
    expect(s.log.at(-1).text).toContain('« Entreprise Criminelle » avec 2 jetons Infamie en jeu')
    env.tokens = 0 // the last infamy counter removed: flip it
    E.flipCard(s, env)
    expect(env.tokens).toBe(2)
    expect(s.log.at(-1).text).toBe('« Entreprise Criminelle » retournée sur la face B, avec 2 jetons Folie.')
    env.tokens = 0
    E.flipCard(s, env)
    expect(env.tokens).toBe(2)
    expect(E.cardName(env)).toBe('Entreprise Criminelle')
  })

  it('Formule Mutagène : un Esclave Bouffon en jeu, Le Bouffon Vert à 16 PV', () => {
    const s = game({ scenario: 'mutagen_formula', modulars: ['goblin_gimmicks'] })
    expect(onTableNamed(s, 'Esclave Bouffon')).toHaveLength(1)
    expect(E.cardsInZone(s, 'encounterDeck').filter(c => E.cardName(c) === 'Esclave Bouffon')).toHaveLength(5)
    expect(s.counters.map(counter => counter.value)).toEqual([10, 16, 2])
  })

  it('Nuage Mutagène posé depuis « De côté » : menace de départ et seuil de la manigance', () => {
    const s = game({ scenario: 'mutagen_formula', modulars: ['goblin_gimmicks'] })
    const cloud = E.cardsInZone(s, 'setAside').find(c => E.definitionOf(c).type === 'main_scheme')
    E.takeFromPile(s, L, cloud, 'setAside')
    expect(s.counters[2]).toMatchObject({ value: 4, label: 'Menace /11' })
  })
})

describe('Les Démolisseurs', () => {
  const crewGame = (over = {}) => game({ scenario: 'wrecking_crew', modulars: [], ...over })
  const villains = s => E.cardsInZone(s, 'table').filter(c => E.definitionOf(c).type === 'villain')
  const villainOf = (s, set) => villains(s).find(c => E.definitionOf(c).set === set)
  const sideOf = (s, set) => E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'side_scheme' && E.definitionOf(c).set === set)

  it('mise en place : 4 méchants A, leurs manigances annexes, un paquet de 15 cartes chacun', () => {
    const s = crewGame()
    expect(villains(s).map(c => `${E.cardName(c)} ${E.definitionOf(c).stage}`)).toEqual(['Le Démolisseur A', 'Le Boulet A', 'Le Compresseur A', 'Le Bulldozer A'])
    expect(['wrecker', 'thunderball', 'piledriver', 'bulldozer'].map(set => sideOf(s, set).threat)).toEqual([6, 5, 3, 4])
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(60)
    expect(E.encounterPile(s, 'encounterDeck')).toHaveLength(15)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).type === 'obligation')).toBe(false)
    expect(E.cardsInZone(s, 'setAside')).toHaveLength(0) // ni Némésis
    expect(s.activeVillainSet).toBe('wrecker')
    expect(s.counters.map(counter => counter.value)).toEqual([10, 14, 0])
    expect(s.counters.map(counter => counter.label).slice(1)).toEqual(['Le Démolisseur A', 'Menace /6'])
  })

  it('expert : les versions B', () => {
    const s = crewGame({ expert: true })
    expect(villains(s).map(c => E.definitionOf(c).stage)).toEqual(['B', 'B', 'B', 'B'])
    expect(s.counters[1].value).toBe(18)
  })

  it('phase des méchants : ni menace ni jeton Actif déplacé, tout se joue à la main', () => {
    const s = crewGame()
    sideOf(s, 'thunderball').threat = 9
    const edeck = E.cardsInZone(s, 'encounterDeck').length
    E.startVillainPhase(s, L)
    expect(sideOf(s, 'thunderball').threat).toBe(9)
    expect(sideOf(s, 'wrecker').threat).toBe(6)
    expect(s.activeVillainSet).toBe('wrecker')
    expect(s.counters[2].value).toBe(0)
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(edeck)
    expect(s.log.at(-1).text).toMatch(/^Phase des méchants : à jouer à la main/)
  })

  it('dégâts : chaque méchant garde les siens, le compteur suit le méchant actif', () => {
    const s = crewGame()
    E.addDamage(s, villainOf(s, 'piledriver'), 2)
    expect(villainOf(s, 'piledriver').damage).toBe(2)
    expect(s.counters[1].value).toBe(14)
    E.addDamage(s, null, 3)
    expect(villainOf(s, 'wrecker').damage).toBe(3)
    expect(s.counters[1].value).toBe(11)
    E.setActiveVillain(s, 'piledriver')
    expect(s.counters[1]).toMatchObject({ label: 'Le Compresseur A', value: 9 })
  })

  it('méchant vaincu : il part avec sa manigance, le jeton Actif passe, victoire après les quatre', () => {
    const s = crewGame()
    sideOf(s, 'bulldozer').threat = 8
    E.moveCard(s, villainOf(s, 'wrecker'), 'discard')
    expect(sideOf(s, 'wrecker')).toBeUndefined()
    expect(s.activeVillainSet).toBe('bulldozer')
    for (const c of villains(s)) E.moveCard(s, c, 'discard')
    expect(s.log.at(-1).text).toContain('vous gagnez la partie')
  })

  it('méchant à 0 PV : il quitte la partie seul, sa manigance hors jeu ; victoire au dernier', () => {
    const s = crewGame()
    sideOf(s, 'piledriver').threat = 9
    const wrecker = villainOf(s, 'wrecker')
    const side = sideOf(s, 'wrecker')
    const r = E.addDamage(s, null, 14) // the active villain, Le Démolisseur A
    expect(r).toMatchObject({ kind: 'crew', fromCardId: wrecker.id, sideSchemeId: side.id, activeVillainId: villainOf(s, 'piledriver').id })
    expect([wrecker.zone, side.zone]).toEqual(['outOfGame', 'outOfGame'])
    expect(s.counters[1]).toMatchObject({ label: 'Le Compresseur A', value: 11 })
    let last
    for (const v of villains(s)) last = E.addDamage(s, v, E.definitionOf(v).hitPoints)
    expect(last).toMatchObject({ kind: 'victory', mainSchemeId: E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'main_scheme').id })
    expect(villains(s)).toHaveLength(0)
    // the defeated villains are not shuffled back into an encounter deck
    expect(E.cardsInZone(s, 'encounterDiscard').some(c => E.definitionOf(c).type === 'villain')).toBe(false)
  })

  it('paquet du méchant actif vide : seule sa défausse est remélangée, +1 accélération', () => {
    const s = crewGame()
    E.encounterPile(s, 'encounterDeck').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(45)
    E.revealEncounterCard(s, L)
    expect(s.accelerationTokens).toBe(1)
    expect(E.encounterPile(s, 'encounterDeck')).toHaveLength(14)
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(59)
  })
})

describe('L\'Avènement de Crâne Rouge', () => {
  const named = (s, zone, name) => E.cardsInZone(s, zone).filter(c => E.cardName(c) === name)
  const ofType = (s, zone, t) => E.cardsInZone(s, zone).filter(c => E.definitionOf(c).type === t)
  const logText = s => s.log.map(e => e.text).join('\n')
  const rrs = over => game({ hero: 'hawkeye', deckList: PRECON_DECKS.hawkeye, ...over })
  // puts a card of the encounter deck on its top, to be revealed next
  const onTop = (s, name) => { const c = named(s, 'encounterDeck', name)[0]; E.moveCard(s, c, 'deck', {}, true); return c }

  it('les sets ont le nombre de cartes imprimé', () => {
    const sizes = {
      crossbones: 19, experimental_weapons: 4, absorbing_man: 25, taskmaster: 23, zola: 31, red_skull: 28,
      hydra_assault: 6, weapon_master: 5, hydra_patrol: 6, hawkeye_nemesis: 5, spider_woman_nemesis: 5
    }
    for (const [set, n] of Object.entries(sizes)) expect(qty(d => d.set === set), set).toBe(n)
  })

  it('Hawkeye : précon Commandement, obligation dans la Rencontre, Némésis de côté', () => {
    const s = rrs()
    expect(E.cardName(E.identityCard(s))).toBe('Clint Barton')
    expect(E.cardsInZone(s, 'hand')).toHaveLength(6)
    expect(E.cardsInZone(s, 'playerDeck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ label: 'HAWKEYE', value: 9 })
    expect(named(s, 'encounterDeck', 'Passé Criminel')).toHaveLength(1)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'hawkeye_nemesis')).toHaveLength(5)
    // reprints: core cards and the Tour des Avengers of the Captain America pack
    const deck = [...E.cardsInZone(s, 'playerDeck'), ...E.cardsInZone(s, 'hand')]
    expect(deck.filter(c => E.cardName(c) === 'Tour des Avengers')).toHaveLength(1)
    E.flipCard(s, E.identityCard(s))
    expect(E.handSize(s)).toBe(5)
  })

  it('Spider-Woman : précon Agressivité et Justice (Agent Double)', () => {
    const s = game({ hero: 'spider_woman', deckList: PRECON_DECKS.spider_woman })
    expect(E.cardName(E.identityCard(s))).toBe('Jessica Drew')
    expect(s.counters[0]).toMatchObject({ label: 'SPIDER-WOMAN', value: 11 })
    const aspects = [...E.cardsInZone(s, 'playerDeck'), ...E.cardsInZone(s, 'hand')].map(c => E.definitionOf(c)).filter(d => d.set !== 'spider_woman').map(d => d.faction)
    expect(new Set(aspects)).toEqual(new Set(['aggression', 'justice', 'basic']))
    expect(named(s, 'encounterDeck', 'Loyauté Douteuse')).toHaveLength(1)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).set === 'spider_woman_nemesis')).toHaveLength(5)
  })

  it('codes MarvelCDB : boîte 04, réimpressions par leur carte d\'origine, noms anglais du texte', () => {
    expect(DEFINITION_BY_CODE['04001a']).toMatchObject({ type: 'hero', set: 'hawkeye' })
    expect(DEFINITION_BY_CODE['04061a'].name).toBe('Attaque sur le Mont Athéna')
    const r = E.parseMarvelCdbDeck({ name: 'Clint', hero_code: '04001a', slots: { '04002': 1, '04018': 2 } }, { '04018': { name: 'Commander en Première Ligne', duplicate_of_code: '01070' } })
    expect(r.deckList.slice(1).map(([id, q]) => `${q}x ${DEFINITION_BY_ID[id].name}`)).toEqual(['1x Arc de Hawkeye', '2x Commander en Première Ligne'])
    const t = E.parseDeckFile('Test\n\nSpider-Woman\nPacks: Core Set\n\n2x Venom Blast (The Rise of Red Skull)\n1x Hawkeye\'s Bow (The Rise of Red Skull)\n')
    expect(t).toMatchObject({ hero: 'spider_woman', unknownCount: 0 })
    expect(t.deckList.slice(1).map(([id]) => DEFINITION_BY_ID[id].name)).toEqual(['Rayon Venimeux', 'Arc de Hawkeye'])
  })

  it('Crossbones : trois sets modulaires, deck Armes Expérimentales à côté du paquet Rencontre', () => {
    const s = rrs({ scenario: 'crossbones', modulars: ['hydra_assault', 'weapon_master', 'legions_of_hydra'] })
    const enc = qty(d => d.faction === 'encounter' && ['crossbones', 'hydra_assault', 'weapon_master', 'legions_of_hydra', 'standard'].includes(d.set) && !['villain', 'main_scheme'].includes(d.type)) + 1
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(enc)
    expect(E.cardsInZone(s, 'scenarioDeck')).toHaveLength(4)
    expect(E.cardsInZone(s, 'scenarioDeck').every(c => !c.faceUp && E.definitionOf(c).set === 'experimental_weapons')).toBe(true)
    expect(ofType(s, 'setAside', 'main_scheme')).toHaveLength(2)
    expect(E.setupSummary(s.setup)).toBe(', modules Offensive d\'Hydra, Maîtrise des Armes et Légions d\'Hydra, standard')
    expect(E.zoneLabel(s, 'scenarioDeck')).toBe('deck Armes Expérimentales')
    // 1B: its "Une fois révélée" is recalled; the weapons are revealed one at a time
    E.flipCard(s, ofType(s, 'table', 'main_scheme')[0])
    expect(s.log.at(-1).text).toMatch(/Armes Expérimentales/)
    const weapon = E.revealScenarioDeckCard(s, L)
    expect(weapon).toMatchObject({ zone: 'table', faceUp: true })
    // a weapon sent back "to the deck" returns to its own deck, a discarded one to the encounter discard
    E.moveCard(s, weapon, 'deck')
    expect(weapon.zone).toBe('scenarioDeck')
    for (let i = 0; i < 4; i++) E.moveCard(s, E.revealScenarioDeckCard(s, L), 'discard')
    expect(E.cardsInZone(s, 'encounterDiscard')).toHaveLength(4)
    expect(E.revealScenarioDeckCard(s, L)).toBeNull()
    expect(s.log.at(-1).text).toBe('Deck Armes Expérimentales vide.')
  })

  it('plusieurs sets modulaires au hasard : autant que le scénario, tous différents, jamais un set déjà là', () => {
    const s = rrs({ scenario: 'crossbones', modulars: 'random' })
    expect(s.setup.modulars).toHaveLength(3)
    expect(new Set(s.setup.modulars).size).toBe(3)
    expect(logText(s)).toContain('modules tirés au hasard')
    for (const id of s.setup.modulars) expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).set === id), id).toBe(true)
    // Taskmaster always plays Patrouille d'Hydra: never drawn as its modular set
    for (let i = 0; i < 20; i++) expect(rrs({ scenario: 'taskmaster', modulars: 'random' }).setup.modulars).not.toBe('hydra_patrol')
  })

  it('L\'Homme Absorbant : un environnement en jeu dès la mise en place, un seul à la fois', () => {
    const s = rrs({ scenario: 'absorbing_man', modulars: ['hydra_patrol'] })
    const [env] = ofType(s, 'table', 'environment')
    expect(ofType(s, 'table', 'environment')).toHaveLength(1)
    expect(ofType(s, 'encounterDeck', 'environment')).toHaveLength(3)
    expect(E.cardsInZone(s, 'encounterDiscard')).toHaveLength(0)
    expect(s.counters.map(counter => counter.value)).toEqual([9, 14, 2])
    expect(s.counters[2].label).toBe('Menace /12')
    // another environment entering play (revealed, or a boost turned face up) discards the one in play
    const next = ofType(s, 'encounterDeck', 'environment')[0]
    E.moveCard(s, next, 'deck', {}, true)
    E.revealEncounterCard(s, L)
    expect(env.zone).toBe('encounterDiscard')
    const boost = ofType(s, 'encounterDeck', 'environment')[0]
    E.moveCard(s, boost, 'table', { faceDown: true }, true)
    expect(next.zone).toBe('table')
    E.flipCard(s, boost)
    expect(next.zone).toBe('encounterDiscard')
    // Retard tokens on the main scheme (generic tokens), recalled at the villain phase once on 1B
    const scheme = ofType(s, 'table', 'main_scheme')[0]
    E.addTokens(s, scheme, 2)
    expect(scheme.tokens).toBe(2)
    expect(s.counters[2].value).toBe(2)
    E.flipCard(s, scheme)
    E.startVillainPhase(s, L)
    expect(s.log.at(-1).text).toMatch(/jeton Retard/)
  })

  it('Taskmaster : Patrouille d\'Hydra en jeu, alliés Captifs de côté, Capturé par Hydra en garde un au hasard', () => {
    const s = rrs({ scenario: 'taskmaster', modulars: ['weapon_master'] })
    const [patrol] = named(s, 'table', 'Patrouille d\'Hydra')
    expect(patrol.threat).toBe(2)
    const captives = E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).captive)
    expect(captives).toHaveLength(4)
    expect(captives.every(c => c.owner === 'player')).toBe(true) // player cards once freed
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).captive)).toBe(false)
    expect(E.cardsInZone(s, 'encounterDeck').filter(c => E.definitionOf(c).set === 'hydra_patrol')).toHaveLength(5)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).set === 'weapon_master')).toBe(true)
    onTop(s, 'Capturé par Hydra')
    const scheme = E.revealEncounterCard(s, L)
    expect(scheme.threat).toBe(5)
    const held = E.cardsInZone(s, 'table').find(c => c.underSchemeId === scheme.id)
    expect(held).toMatchObject({ faceUp: false, owner: 'player', x: scheme.x + L.cardWidth * 0.2, y: scheme.y })
    expect(E.definitionOf(held).captive).toBe(true)
    expect(scheme.zIndex).toBeGreaterThan(held.zIndex)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).captive)).toHaveLength(3)
    // the held ally takes no place in the hero row; freed, it goes to the hand
    const before = E.nextHeroSpot(s, L)
    E.moveCard(s, held, 'hand')
    expect(held.underSchemeId).toBeUndefined()
    expect(E.nextHeroSpot(s, L)).toEqual(before)
  })

  it('Zola : Prison d\'Hydra avec l\'allié du héros dessous et sa menace, un Bio-Serviteur Ultime engagé', () => {
    const s = rrs({ scenario: 'zola', modulars: ['under_attack'] })
    const [prison] = named(s, 'table', 'Prison d\'Hydra')
    const [mockingbird] = named(s, 'table', 'Mockingbird')
    expect(mockingbird).toMatchObject({ faceUp: false, underSchemeId: prison.id })
    expect(prison.threat).toBe(1 + 3) // starting threat + Mockingbird's cost
    expect(E.cardsInZone(s, 'playerDeck').length + E.cardsInZone(s, 'hand').length).toBe(39)
    const [servant] = named(s, 'table', 'Bio-Serviteur Ultime')
    expect(servant.tough).toBe(true) // Ténacité
    expect(named(s, 'encounterDeck', 'Bio-Serviteur Ultime')).toHaveLength(3)
    expect(s.counters.map(counter => counter.value)).toEqual([9, 12, 0])
    // Hulk has no ally of his own: the prison keeps its starting threat
    const hulk = game({ hero: 'hulk', deckList: PRECON_DECKS.hulk, scenario: 'zola', modulars: ['under_attack'] })
    expect(named(hulk, 'table', 'Prison d\'Hydra')[0].threat).toBe(1)
  })

  it('Crâne Rouge : La Maison Rouge en jeu, deck Manigance Annexe, Le Dormeur de côté', () => {
    const s = rrs({ scenario: 'red_skull', modulars: ['hydra_assault', 'hydra_patrol'] })
    expect(named(s, 'table', 'La Maison Rouge')[0].threat).toBe(3)
    expect(E.cardsInZone(s, 'scenarioDeck')).toHaveLength(5)
    expect(E.cardsInZone(s, 'scenarioDeck').every(c => E.definitionOf(c).type === 'side_scheme' && E.definitionOf(c).set === 'red_skull')).toBe(true)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).type === 'side_scheme' && E.definitionOf(c).set === 'red_skull')).toBe(false)
    expect(named(s, 'setAside', 'Le Dormeur')).toHaveLength(1)
    expect(named(s, 'encounterDeck', 'Le Dormeur')).toHaveLength(0)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).set === 'hydra_patrol')).toBe(true)
    expect(logText(s)).toContain('deck Manigance Annexe de 5 cartes')
    // a side scheme from its deck enters play with its starting threat
    const side = E.revealScenarioDeckCard(s, L)
    expect(side.threat).toBe(E.definitionOf(side).startingThreat)
    // 1B: a side scheme each villain phase, recalled in the log
    E.flipCard(s, ofType(s, 'table', 'main_scheme')[0])
    E.startVillainPhase(s, L)
    expect(s.log.at(-1).text).toMatch(/deck Manigance Annexe/)
    // 2A: its "Une fois révélée" is recalled when it is put into play
    E.takeFromPile(s, L, ofType(s, 'setAside', 'main_scheme')[0], 'setAside')
    expect(s.log.at(-2).text).toMatch(/^Nouvelle manigance : « Nouvel Ordre Mondial d'Hydra » \(2A\)\. Une fois révélée : révélez la carte du dessus du deck Manigance Annexe/)
  })

  it('une manigance annexe révélée du paquet Rencontre arrive avec sa menace de départ', () => {
    const s = game()
    const side = ofType(s, 'encounterDeck', 'side_scheme')[0]
    E.moveCard(s, side, 'deck', {}, true)
    expect(E.revealEncounterCard(s, L)).toBe(side)
    expect(side.threat).toBe(E.definitionOf(side).startingThreat)
    expect(s.log.at(-1).text).toContain(`${E.definitionOf(side).startingThreat} menaces`)
  })
})

describe('Kang le Conquérant', () => {
  const kang = over => game({ hero: 'hawkeye', deckList: PRECON_DECKS.hawkeye, scenario: 'kang', modulars: ['temporal'], ...over })
  const ofType = (s, zone, t) => E.cardsInZone(s, zone).filter(c => E.definitionOf(c).type === t)
  const villain = s => ofType(s, 'table', 'villain')[0]
  const kill = s => E.addDamage(s, null, s.counters[1].value, L)

  it('les sets ont le nombre de cartes imprimé', () => {
    const sizes = { kang: 43, kang_expert: 6, temporal: 7, anachronauts: 9, master_of_time: 8 }
    for (const [set, n] of Object.entries(sizes)) expect(qty(d => d.set === set), set).toBe(n)
  })

  it('mise en place : Kang (I) Tenace, Kang (II) et (III) de côté, Empire de Kang de côté, sans obligation du héros', () => {
    const s = kang()
    expect(villain(s)).toMatchObject({ tough: true })
    expect(E.definitionOf(villain(s))).toMatchObject({ stage: 'I', set: 'kang' })
    expect(s.counters.map(counter => counter.value)).toEqual([9, 12, 0])
    expect(s.counters[2].label).toBe('Menace /7')
    const aside = E.cardsInZone(s, 'setAside')
    expect(aside.filter(c => E.definitionOf(c).type === 'villain').map(c => E.definitionOf(c).stage).sort()).toEqual(['II', 'II', 'II', 'II', 'III'])
    expect(aside.filter(c => E.definitionOf(c).type === 'main_scheme')).toHaveLength(6)
    expect(aside.filter(c => E.cardName(c) === 'Empire de Kang')).toHaveLength(4)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.cardName(c) === 'Passé Criminel')).toBe(false)
    expect(s.log.map(e => e.text).join('\n')).toContain('« Passé Criminel » retirée de la partie')
    const enc = qty(d => ['kang', 'temporal', 'standard'].includes(d.set) && !['villain', 'main_scheme'].includes(d.type)) - 4
    expect(E.cardsInZone(s, 'encounterDeck')).toHaveLength(enc)
  })

  it('expert : les cartes Kang Expert à la place des Kang', () => {
    const s = kang({ expert: true })
    expect(E.definitionOf(villain(s))).toMatchObject({ stage: 'I', set: 'kang_expert', hitPoints: 15 })
    expect(E.cardsInZone(s, 'setAside').filter(c => E.definitionOf(c).type === 'villain').every(c => E.definitionOf(c).set === 'kang_expert')).toBe(true)
    expect(E.cardsInZone(s, 'encounterDeck').some(c => E.definitionOf(c).set === 'expert')).toBe(true)
  })

  // Kang (I) defeated in the hero phase: the stage change comes when the phase ends
  const toStage3 = s => { kill(s); return E.startVillainPhase(s, L) }

  it('Kang (I) vaincu : le changement de stade attend la fin de la phase', () => {
    const s = kang()
    const kangI = villain(s)
    const r = kill(s)
    expect(r).toMatchObject({ kind: 'pending', fromCardId: kangI.id })
    expect(kangI.zone).toBe('outOfGame')
    expect(villain(s)).toBeUndefined()
    expect(ofType(s, 'table', 'main_scheme').map(c => E.cardName(c))).toEqual(['L\'Arrivée de Kang'])
    expect(E.masterOfTimeScheme(s)).toBeNull()
    expect(s.pendingStageChange).toMatchObject({ step: 3 })
    // the end of the hero phase: stage 2, then stage 3 with its Kang (II); the phase still changes
    const end = E.startVillainPhase(s, L)
    expect(end).toMatchObject({ kind: 'stage', fromCardId: kangI.id, toCardId: villain(s).id })
    expect(s.phase).toBe('villain')
    expect(s.pendingStageChange).toBeUndefined()
    // defeated in the villain phase: the change comes at the end of it, when the next round starts
    const v = kang()
    E.startVillainPhase(v, L)
    expect(kill(v).kind).toBe('pending')
    const next = E.startHeroPhase(v, L)
    expect(next).toMatchObject({ kind: 'stage' })
    expect(v).toMatchObject({ phase: 'hero', turn: 2 })
    expect(E.kangStage3Scheme(v)).toBeTruthy()
  })

  it('fin de la phase après Kang (I) : stade 2 à côté avec les pions Accélération, un stade 3 au hasard avec son Kang (II), une carte Rencontre', () => {
    const s = kang()
    const side = ofType(s, 'encounterDeck', 'side_scheme').find(c => E.cardName(c) !== 'Empire de Kang')
    E.moveCard(s, side, 'table', {}, true)
    const r = toStage3(s)
    const third = E.kangStage3Scheme(s)
    const keeper = E.masterOfTimeScheme(s)
    expect(r).toMatchObject({ kind: 'stage', keptStatuses: [] })
    expect(E.cardById(s, r.toCardId)).toBe(villain(s))
    expect(E.cardName(villain(s))).toBe(E.definitionOf(third).bringsKang)
    expect(villain(s).tough).toBe(true)
    expect(keeper).toMatchObject({ side: 1, tokens: 1, ...E.SPOTS.masterOfTime(L) })
    expect(s.accelerationTokens).toBe(1)
    expect(side.zone).toBe('encounterDiscard')
    expect(E.cardsInZone(s, 'outOfGame').filter(c => E.definitionOf(c).stage === '3A')).toHaveLength(3)
    expect(E.cardsInZone(s, 'outOfGame').filter(c => E.definitionOf(c).stage === 'II')).toHaveLength(3)
    expect(E.cardsInZone(s, 'table').filter(c => !c.faceUp)).toHaveLength(1) // the encounter card dealt
    expect(s.counters[1]).toMatchObject({ value: 18, label: `${E.definitionOf(third).bringsKang} II` })
    expect(s.counters[2]).toMatchObject({ value: E.definitionOf(third).startingThreat, label: 'Menace /9' })
    // the acceleration tokens wait on Le Maître du Temps
    E.startHeroPhase(s, L)
    E.cardsInZone(s, 'encounterDeck').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    E.revealEncounterCard(s, L)
    expect(keeper.tokens).toBe(2)
    E.startVillainPhase(s, L)
    expect(s.log.map(e => e.text).join('\n')).toContain('les 2 pions Accélération restent sur « Le Maître du Temps »')
    // the stage drawn changes from one game to the next
    const drawn = new Set(Array.from({ length: 12 }, () => { const kangGame = kang(); toStage3(kangGame); return E.kangStage3Scheme(kangGame).definitionId }))
    expect(drawn.size).toBeGreaterThan(1)
  })

  it('Kang (II) vaincu : son stade 3 quitte la partie, le stade 4 et Kang (III) à la fin de la phase ; Kang (III) vaincu : victoire', () => {
    const s = kang()
    toStage3(s)
    E.startHeroPhase(s, L)
    const third = E.kangStage3Scheme(s)
    expect(kill(s)).toMatchObject({ kind: 'pending' })
    expect(third.zone).toBe('outOfGame')
    expect(E.masterOfTimeScheme(s)).toBeTruthy()
    const r = E.startVillainPhase(s, L)
    expect(E.definitionOf(E.cardById(s, r.toCardId))).toMatchObject({ stage: 'III', hitPoints: 20 })
    expect(E.masterOfTimeScheme(s)).toBeNull()
    expect(E.kangStage3Scheme(s)).toBeNull()
    expect(ofType(s, 'table', 'main_scheme').map(c => E.cardName(c))).toEqual(['La Colère de Kang'])
    expect(s.counters[2].label).toBe('Menace /10')
    expect(E.cardsInZone(s, 'table').some(c => E.cardName(c) === 'Empire de Kang')).toBe(false)
    const end = kill(s)
    expect(end.kind).toBe('victory')
    expect(VICTORY_TEXTS[E.cardById(s, end.mainSchemeId).definitionId]).toMatch(/Kang/)
  })

  it('stade 3 achevé : à la fin de la phase, Kang (II) quitte la partie et une carte Empire de Kang est révélée au stade 4', () => {
    const s = kang()
    toStage3(s)
    E.addThreat(s, null, 9)
    expect(s.log.at(-1).text).toMatch(/Stade achevé/)
    const foe = villain(s)
    expect(E.completeKangStage3(s)).toMatchObject({ kind: 'pending', fromCardId: E.kangStage3Scheme(s).id })
    expect(E.completeKangStage3(s)).toBeNull() // once
    expect(foe.zone).toBe('table') // until the end of the phase
    const r = E.startHeroPhase(s, L)
    expect(r).toMatchObject({ kind: 'stage', fromCardId: foe.id, stageLeft: true })
    expect(foe.zone).toBe('outOfGame')
    const empire = E.cardsInZone(s, 'table').filter(c => E.cardName(c) === 'Empire de Kang')
    expect(empire).toHaveLength(1)
    expect(empire[0].threat).toBe(3)
    expect(E.cardsInZone(s, 'setAside').filter(c => E.cardName(c) === 'Empire de Kang')).toHaveLength(3)
    expect(E.definitionOf(villain(s)).stage).toBe('III')
    expect(E.completeKangStage3(s)).toBeNull() // no stage 3 any more
  })
})

describe('jetons d\'entrée en jeu', () => {
  const named = (s, name) => s.cards.find(c => c.zone !== 'table' && E.cardName(c) === name)

  it('les cartes qui entrent en jeu avec des jetons ont leur nombre et leur nom', () => {
    const tk = CARD_DEFINITIONS.filter(d => d.entryTokens)
    expect(tk.map(d => d.name)).toHaveLength(14)
    expect(tk.every(d => d.entryTokens > 0 && d.entryTokenName)).toBe(true)
    expect(DEFINITION_BY_CODE['01066']).toMatchObject({ name: 'Hawkeye', entryTokens: 4, entryTokenName: 'Flèche' })
  })

  it('Lance-toile joué : 3 jetons Toile ; quitte la table : tout est remis à zéro', () => {
    const s = game()
    const web = named(s, 'Lance-toile')
    E.moveCard(s, web, 'hand', {}, true)
    E.playToTable(s, L, web)
    expect(web.tokens).toBe(3)
    expect(s.log.at(-1).text).toBe('« Lance-toile » : main → table, avec 3 jetons Toile.')
    // used and exhausted, with a status card, then discarded: nothing left on it
    Object.assign(web, { tokens: 1, exhausted: true, damage: 2, stunned: true })
    E.moveCard(s, web, 'discard')
    expect(web).toMatchObject({ zone: 'playerDiscard', tokens: 0, exhausted: false, damage: 0, side: 0, faceUp: true })
    expect(web.stunned).toBeUndefined()
    // back into play: 3 again
    E.moveCard(s, web, 'table', { x: 200, y: 300 })
    expect(web.tokens).toBe(3)
  })

  it('joué face cachée puis retourné : ses jetons, une seule fois', () => {
    const s = game()
    const web = named(s, 'Lance-toile')
    E.moveCard(s, web, 'hand', {}, true)
    E.playToTable(s, L, web, true)
    expect(web.tokens).toBe(0)
    E.flipCard(s, web)
    expect(web.tokens).toBe(3)
    expect(s.log.at(-1).text).toBe('Retournée : « Lance-toile » (3 jetons Toile).')
    // turned face down and up again by mistake: its counters stay as they were
    web.tokens = 2
    E.flipCard(s, web)
    E.flipCard(s, web)
    expect(web.tokens).toBe(2)
    // face down on the table, taken back into the hand: face up there
    E.flipCard(s, web)
    E.moveCard(s, web, 'hand')
    expect(web).toMatchObject({ faceUp: true, tokens: 0 })
  })

  it('Mitrailleuse de Crossbones : révélée, reçue face cachée puis retournée, pas en boost', () => {
    const s = game({ hero: 'hawkeye', deckList: PRECON_DECKS.hawkeye, scenario: 'crossbones', modulars: ['hydra_assault', 'weapon_master', 'legions_of_hydra'] })
    const gun = s.cards.find(c => E.definitionOf(c).id === 'rrs-064')
    E.moveCard(s, gun, 'deck', {}, true) // on top of the encounter deck
    expect(E.revealEncounterCard(s, L)).toBe(gun)
    expect(gun.tokens).toBe(2)
    expect(s.log.at(-1).text).toContain('« Mitrailleuse de Crossbones » (')
    expect(s.log.at(-1).text).toContain(', 2 jetons Munition).')
    // dealt to you face down, then revealed
    E.moveCard(s, gun, 'deck', {}, true)
    E.dealEncounterCardToPlayer(s, L)
    expect(gun).toMatchObject({ faceUp: false, tokens: 0, dealtToPlayer: true })
    E.flipCard(s, gun)
    expect(gun.tokens).toBe(2)
    expect(gun.dealtToPlayer).toBeUndefined()
    expect(s.log.at(-1).text).toBe('Retournée : « Mitrailleuse de Crossbones » (2 jetons Munition).')
    // a boost turned face up is only looked at
    E.moveCard(s, gun, 'deck', {}, true)
    E.dealBoostCard(s, L)
    E.flipCard(s, gun)
    expect(gun.tokens).toBe(0)
  })
})

describe('règles spéciales (rules.js)', () => {
  const msgs = s => s.log.map(e => e.text)

  it('une entrée par héros et par scénario, des cartes qui existent, du bon type', () => {
    expect(Object.keys(HERO_RULES).sort()).toEqual(HEROES.map(h => h.id).sort())
    expect(Object.keys(SCENARIO_RULES).sort()).toEqual(SCENARIOS.map(v => v.id).sort())
    const missing = []
    const known = (id, t) => { if (!DEFINITION_BY_ID[id] || (t && DEFINITION_BY_ID[id].type !== t)) missing.push(`${id}${t ? ` (${t})` : ''}`) }
    for (const r of Object.values(HERO_RULES)) if (r.setupCardId) known(r.setupCardId)
    for (const r of Object.values(SCENARIO_RULES)) {
      for (const step of r.setupSteps ?? []) if (step.definitionId) known(step.definitionId)
      for (const g of r.setAside ?? []) known(g)
      if (r.kang) known(r.kang.empireCardId, 'side_scheme')
      for (const id of Object.keys(r.mainSchemes ?? {})) known(id, 'main_scheme')
      for (const [id, st] of Object.entries(r.villainStages ?? {})) {
        known(id, 'villain')
        if (st.revealCardId) known(st.revealCardId)
      }
      for (const set of r.crew ?? []) if (!CARD_DEFINITIONS.some(d => d.type === 'villain' && d.set === set)) missing.push(set)
      for (const set of [...(r.extraSets ?? []), ...(r.expertSet ? [r.expertSet] : []), ...(r.scenarioDeck ? [r.scenarioDeck.set] : [])]) {
        if (!CARD_DEFINITIONS.some(d => d.set === set)) missing.push(set)
      }
    }
    expect(missing).toEqual([])
    // every text is a sentence of its own
    const texts = [...Object.values(HERO_RULES), ...Object.values(SCENARIO_RULES)].flatMap(r => [...(r.automated ?? []), ...(r.byHand ?? [])])
    expect(texts.filter(t => !/^[A-ZÀ-Ý«].*\.$/.test(t))).toEqual([])
  })

  it('Klaw : Réseau de Défense révélée à la mise en place ; Ultron : Drones d\'Ultron en jeu', () => {
    const klaw = game({ scenario: 'klaw', modulars: ['masters_of_evil'] })
    const net = E.cardsInZone(klaw, 'table').find(c => E.cardName(c) === 'Réseau de Défense')
    expect(net.threat).toBe(2)
    expect(msgs(klaw).at(-1)).toContain('« Réseau de Défense » avec 2 menaces en jeu')
    expect(E.cardsInZone(klaw, 'encounterDeck').some(c => E.cardName(c) === 'Réseau de Défense')).toBe(false)
    const ultron = game({ scenario: 'ultron', modulars: ['under_attack'] })
    expect(E.cardsInZone(ultron, 'table').some(c => E.cardName(c) === 'Drones d\'Ultron')).toBe(true)
    expect(msgs(ultron).at(-1)).toContain('« Drones d\'Ultron » en jeu')
  })

  const villainOn = s => E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')
  const named = (s, n, zone = 'table') => E.cardsInZone(s, zone).filter(c => E.cardName(c) === n)

  it('Rhino II révélé : Casser et Emporter cherchée (paquet ou défausse) et révélée', () => {
    const s = game()
    E.defeatVillain(s, villainOn(s), L)
    const [side] = named(s, 'Casser et Emporter')
    expect(side).toMatchObject({ faceUp: true, threat: 2 })
    expect(named(s, 'Casser et Emporter', 'encounterDeck')).toHaveLength(0)
    expect(msgs(s).at(-1)).toBe('« Rhino » II, une fois révélé : « Casser et Emporter » révélée (Manigance annexe, 2 menaces), paquet Rencontre mélangé.')
    // from the encounter discard pile; nowhere to be found
    const t = game()
    const [card] = named(t, 'Casser et Emporter', 'encounterDeck')
    E.moveCard(t, card, 'discard', {}, true)
    E.defeatVillain(t, villainOn(t), L)
    expect(card.zone).toBe('table')
    const u = game()
    E.moveCard(u, named(u, 'Casser et Emporter', 'encounterDeck')[0], 'outOfGame', {}, true)
    E.defeatVillain(u, villainOn(u), L)
    expect(msgs(u).at(-1)).toBe('« Rhino » II, une fois révélé : « Casser et Emporter » n\'est ni dans le paquet Rencontre ni dans sa défausse.')
  })

  it('Rhino III révélé : votre héros sonné, pas votre alter ego', () => {
    const s = game({ expert: true })
    E.setIdentityForm(s, E.identityCard(s), 0)
    E.defeatVillain(s, villainOn(s), L)
    expect(E.identityCard(s).stunned).toBe(true)
    expect(msgs(s).at(-1)).toBe('« Rhino » III, une fois révélé : Spider-Man reçoit une carte d\'état Sonné.')
    const t = game({ expert: true })
    E.defeatVillain(t, villainOn(t), L)
    expect(E.identityCard(t).stunned).toBeUndefined()
    expect(msgs(t).at(-1)).toContain('Peter Parker est en alter ego : aucun héros à sonner')
  })

  it('cartes Rencontre pour vous : Taskmaster II (1), Le Bouffon Vert II (2), devant votre identité', () => {
    const s = game({ scenario: 'taskmaster', modulars: ['weapon_master'] })
    E.defeatVillain(s, villainOn(s), L)
    expect(s.cards.filter(c => c.dealtToPlayer && !c.faceUp)).toHaveLength(1)
    expect(msgs(s).at(-1)).toBe('« Taskmaster » II, une fois révélé : vous recevez une carte Rencontre face cachée, posée devant votre identité.')
    const t = game({ scenario: 'mutagen_formula', modulars: ['goblin_gimmicks'] })
    E.defeatVillain(t, villainOn(t), L)
    expect(t.cards.filter(c => c.dealtToPlayer && !c.faceUp)).toHaveLength(2)
    expect(msgs(t).at(-1)).toContain('vous recevez 2 cartes Rencontre face cachée, posées devant votre identité')
  })

  it('Crossbones : la Mitrailleuse attachée avec ses jetons (II), la carte du dessus du deck Armes (III)', () => {
    const scenario = { hero: 'hawkeye', deckList: PRECON_DECKS.hawkeye, scenario: 'crossbones', modulars: ['hydra_assault', 'weapon_master', 'legions_of_hydra'] }
    const s = game(scenario)
    E.defeatVillain(s, villainOn(s), L)
    const [gun] = named(s, 'Mitrailleuse de Crossbones')
    expect(gun.tokens).toBe(2)
    expect(msgs(s).at(-1)).toContain('« Mitrailleuse de Crossbones » attachée au méchant (Attachement, 2 jetons Munition)')
    const t = game({ ...scenario, expert: true })
    const weapons = E.cardsInZone(t, 'scenarioDeck').length
    E.defeatVillain(t, villainOn(t), L)
    expect(E.cardsInZone(t, 'scenarioDeck')).toHaveLength(weapons - 1)
    expect(msgs(t).at(-2)).toBe('« Crossbones » III, une fois révélé : la carte du dessus du deck Armes Expérimentales est révélée.')
    expect(msgs(t).at(-1)).toMatch(/^Deck Armes Expérimentales : « .+ » révélée/)
  })

  it('L\'Homme Absorbant II : Pouvoir Super Absorbant révélé, ou une carte Rencontre s\'il est déjà en jeu', () => {
    const scenario = { scenario: 'absorbing_man', modulars: ['hydra_patrol'] }
    const s = game(scenario)
    E.defeatVillain(s, villainOn(s), L)
    expect(named(s, 'Pouvoir Super Absorbant')).toHaveLength(1)
    const t = game(scenario)
    E.moveCard(t, named(t, 'Pouvoir Super Absorbant', 'encounterDeck')[0], 'table', { x: 500, y: 30 }, true)
    E.defeatVillain(t, villainOn(t), L)
    expect(t.cards.filter(c => c.dealtToPlayer)).toHaveLength(1)
    expect(msgs(t).at(-1)).toBe('« L\'Homme Absorbant » II, une fois révélé : « Pouvoir Super Absorbant » est déjà en jeu, vous recevez une carte Rencontre face cachée, posée devant votre identité.')
  })

  it('une étape posée à la main depuis « De côté » fait aussi son « Une fois révélée » (Klaw II)', () => {
    const s = game({ scenario: 'klaw', modulars: ['masters_of_evil'] })
    const klaw2 = E.cardsInZone(s, 'setAside').find(c => E.definitionOf(c).type === 'villain')
    E.takeFromPile(s, L, klaw2, 'setAside')
    expect(named(s, 'Klaw "l\'Immortel"')).toHaveLength(1)
  })

  it('une étape retournée rappelle son « Une fois révélée » (Le Bouffon Vert)', () => {
    const osborn = game({ scenario: 'risky_business', modulars: ['goblin_gimmicks'] })
    const norman = E.cardsInZone(osborn, 'table').find(c => E.definitionOf(c).type === 'villain')
    E.flipCard(osborn, norman)
    expect(msgs(osborn).at(-1)).toBe('« Le Bouffon Vert » I, une fois révélé : infligez 3 dégâts indirects à chaque joueur sous forme de héros.')
  })

  it('Les Démolisseurs : le stade 1B rappelle la menace sur les manigances annexes et le jeton Actif', () => {
    const s = game({ scenario: 'wrecking_crew' })
    const scheme = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'main_scheme')
    E.flipCard(s, scheme)
    E.startVillainPhase(s, L)
    expect(msgs(s).at(-1)).toContain('placez 1 menace sur chaque manigance annexe')
  })

  it('T\'Challa : sa mise en place rappelée au journal', () => {
    const panther = game({ hero: 'black_panther', deckList: PRECON_DECKS.black_panther })
    expect(msgs(panther).at(-1)).toMatch(/^Mise en place de T'Challa, après le mulligan : cherchez une amélioration Black Panther/)
  })

  it('Iron Man : +1 taille de main par amélioration Tech sur la table, sous forme de héros, 7 au plus', () => {
    // a few Tech upgrades of other packs, to reach the limit
    const extra = [['bw-07', 1], ['bw-09', 1], ['wsp-09', 1], ['wsp-10', 1], ['hlk-31', 1]]
    const s = game({ hero: 'iron_man', deckList: [...PRECON_DECKS.iron_man, ...extra] })
    const id = E.identityCard(s)
    const tech = s.cards.filter(c => !c.isIdentity && E.definitionOf(c).type === 'upgrade' && E.traitsOf(c).includes('tech'))
    expect(tech.length).toBeGreaterThanOrEqual(8)
    const play = n => tech.slice(0, n).forEach(c => E.moveCard(s, c, 'table', { x: 300, y: 300 }, true))
    expect(E.handSize(s)).toBe(6) // Tony Stark
    E.setIdentityForm(s, id, 0)
    expect(E.handSize(s)).toBe(1)
    play(3)
    expect(E.handSize(s)).toBe(4)
    E.cardsInZone(s, 'hand').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    E.startVillainPhase(s, L)
    expect(E.cardsInZone(s, 'hand')).toHaveLength(4)
    expect(msgs(s).find(m => m.startsWith('Fin de la phase du héros'))).toBe('Fin de la phase du héros : +4 cartes (main de 4 en Iron Man : 1 + 3 améliorations Tech), vos cartes sont redressées.')
    // an upgrade face down or under a scheme does not count; 7 at most
    tech[0].faceUp = false
    expect(E.handSize(s)).toBe(3)
    tech[0].faceUp = true
    play(8)
    expect(E.handSize(s)).toBe(7)
    E.startHeroPhase(s, L)
    E.startVillainPhase(s, L)
    expect(msgs(s).filter(m => m.startsWith('Fin de la phase du héros')).at(-1)).toContain('(main de 7 en Iron Man : 1 + 8 améliorations Tech, 7 au plus)')
    // Tony Stark again: his own hand size
    E.setIdentityForm(s, id, 1)
    expect(E.handSize(s)).toBe(6)
  })

  it('les améliorations joueur ont leurs traits (Tech : 24 cartes)', () => {
    expect(CARD_DEFINITIONS.filter(d => d.type === 'upgrade' && d.faction !== 'encounter' && d.traits?.includes('tech')).map(d => d.name)).toHaveLength(24)
    expect(DEFINITION_BY_CODE['01008']).toMatchObject({ name: 'Lance-toile', traits: ['objet', 'tech'] })
  })
})

describe('Ténacité', () => {
  it('les cartes de la boîte de base qui ont Ténacité', () => {
    expect(CARD_DEFINITIONS.filter(d => d.pack === 'core' && d.toughness).map(d => d.name).sort()).toEqual(['Garde Blindé', 'Klaw', 'L\'Homme-Sable', 'Luke Cage', 'Rhino'])
  })

  it('L\'Homme-Sable entre en jeu Tenace (révélé, glissé du paquet puis retourné, reçu face cachée), plus dès qu\'il quitte la table', () => {
    const s = game()
    const sand = s.cards.find(c => E.cardName(c) === 'L\'Homme-Sable')
    E.moveCard(s, sand, 'deck', {}, true) // on top of the encounter deck
    expect(E.revealEncounterCard(s, L)).toBe(sand)
    expect(sand.tough).toBe(true)
    E.moveCard(s, sand, 'discard')
    expect(sand).toMatchObject({ zone: 'encounterDiscard' })
    expect(sand.tough).toBeUndefined()
    // put face down on the table from the encounter deck, then turned face up
    E.moveCard(s, sand, 'deck', {}, true)
    E.moveCard(s, sand, 'table', { x: 300, y: 200, faceDown: true })
    expect(sand.tough).toBeUndefined()
    E.flipCard(s, sand)
    expect(sand.tough).toBe(true)
    // back into the encounter deck: no status card; dealt to you, then revealed
    E.moveCard(s, sand, 'deck', {}, true)
    expect(sand.tough).toBeUndefined()
    E.dealEncounterCardToPlayer(s, L)
    E.flipCard(s, sand)
    expect(sand.tough).toBe(true)
    // a boost turned face up is only looked at
    E.moveCard(s, sand, 'deck', {}, true)
    E.dealBoostCard(s, L)
    expect(sand.isBoost).toBe(true)
    E.flipCard(s, sand)
    expect(sand.tough).toBeUndefined()
    E.moveCard(s, sand, 'discard')
    expect(sand.isBoost).toBeUndefined()
  })

  it('Rhino III (expert) entre en jeu Tenace', () => {
    const s = game({ expert: true })
    const rhino = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')
    expect(E.definitionOf(rhino).stage).toBe('II')
    expect(rhino.tough).toBeFalsy()
    const next = E.cardById(s, E.defeatVillain(s, rhino).toCardId)
    expect(E.definitionOf(next).stage).toBe('III')
    expect(next.tough).toBe(true)
  })
})

describe('placement', () => {
  it('une carte reçue devant l\'identité ne prend pas de place dans la rangée Rencontre', () => {
    const s = game()
    const before = E.nextEncounterSpot(s, L)
    E.dealEncounterCardToPlayer(s, L)
    expect(E.nextEncounterSpot(s, L)).toEqual(before)
    E.revealEncounterCard(s, L)
    expect(E.nextEncounterSpot(s, L).x).toBeGreaterThan(before.x)
  })
})

describe('partie enregistrée (savedGame.js)', () => {
  it('une partie de l\'ancien format (clés courtes) est mise au format actuel, et reste jouable', () => {
    const identityId = PRECON_DECKS.spider_man[0][0]
    const old = {
      cards: [
        { id: 'a', g: identityId, o: 'p', zone: 'table', side: 1, faceUp: true, tapped: true, x: 16, y: 400, z: 1, dmg: 0, thr: 0, tok: 0, hero: true },
        { id: 'b', g: PRECON_DECKS.spider_man[1][0], o: 'p', zone: 'deck', side: 0, faceUp: false, tapped: false, x: 0, y: 0, z: 0, dmg: 0, thr: 0, tok: 0 },
        { id: 'c', g: 'gob-06', o: 'e', zone: 'table', side: 0, faceUp: true, tapped: false, x: 200, y: 26, z: 3, dmg: 0, thr: 0, tok: 2, under: 'x', dealt: true },
        { id: 'd', kind: 'token', color: '#d9705c', zone: 'table', faceUp: true, x: 40, y: 200, z: 4, dmg: 0, thr: 0, tok: 0 }
      ],
      log: [{ t: '10:02', msg: 'Partie : Spider-Man contre Rhino.', sys: true }],
      counters: [{ l: 'SPIDER-MAN', v: 10, c: 'var(--hero)' }, { l: 'Rhino I', v: 14, c: 'var(--enc)' }, { l: 'Menace /7', v: 0, c: 'var(--threat)' }],
      opt: { hero: 'spider_man', villain: 'rhino', modular: 'bomb_scare', expert: false, label: 'précon Justice', drawn: [] },
      accel: 1, mull: true, zTop: 12, pending: { step: 4, from: 'k', x: 1, y: 2, empires: 1, left: true }
    }
    const game = migrateSavedGame(old)
    expect(game).toMatchObject({
      version: SAVED_GAME_VERSION, turn: 1, phase: 'hero', accelerationTokens: 1, mulliganTaken: true, topZIndex: 12,
      setup: { hero: 'spider_man', scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'précon Justice', randomChoices: [] },
      pendingStageChange: { step: 4, fromVillainId: 'k', empires: 1, stageLeft: true }
    })
    // sans liste de deck, la partie rejoue le précon du héros
    expect(game.setup.deckList).toBe(PRECON_DECKS.spider_man)
    expect(game.log[0]).toEqual({ time: '10:02', text: 'Partie : Spider-Man contre Rhino.', important: true })
    expect(game.counters[1]).toEqual({ label: 'Rhino I', value: 14, color: 'var(--enc)' })
    const [identity, inDeck, environment, pawn] = game.cards
    expect(identity).toMatchObject({ definitionId: identityId, owner: 'player', isIdentity: true, exhausted: true, zIndex: 1 })
    expect(inDeck.zone).toBe('playerDeck')
    expect(environment).toMatchObject({ owner: 'encounter', tokens: 2, underSchemeId: 'x', dealtToPlayer: true })
    expect(pawn).toMatchObject({ isPawn: true, color: '#d9705c' })
    expect(pawn.kind).toBeUndefined()
    // une partie à jour n'est pas touchée
    expect(migrateSavedGame(game)).toBe(game)
    // et la partie convertie se joue
    expect(E.drawCard(game, L)).toBe(true)
    expect(E.cardsInZone(game, 'hand')).toHaveLength(1)
  })
})

describe('statuts', () => {
  it('sonné et désorienté se cumulent, et restent quand l\'identité change de forme', () => {
    const s = game()
    const id = E.identityCard(s)
    E.toggleStatus(s, id, 'stunned')
    E.toggleStatus(s, id, 'confused')
    E.flipCard(s, id)
    expect(id).toMatchObject({ stunned: true, confused: true })
    E.toggleStatus(s, id, 'stunned')
    expect(id.stunned).toBe(false)
    expect(id.confused).toBe(true)
  })

  it('seulement sur un personnage face visible, retirés quand il quitte la table', () => {
    const s = game()
    const villain = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'villain')
    const scheme = E.cardsInZone(s, 'table').find(c => E.definitionOf(c).type === 'main_scheme')
    E.toggleStatus(s, villain, 'tough')
    E.toggleStatus(s, scheme, 'tough')
    expect(villain.tough).toBe(true)
    expect(scheme.tough).toBeUndefined()
    E.moveCard(s, villain, 'discard')
    expect(villain.tough).toBeUndefined()
    const minion = E.cardsInZone(s, 'encounterDeck').find(c => E.definitionOf(c).type === 'minion')
    E.moveCard(s, minion, 'table', { faceDown: true })
    E.toggleStatus(s, minion, 'stunned')
    expect(minion.stunned).toBeUndefined()
  })
})

describe('identité', () => {
  it('changer de forme change la taille de main', () => {
    const s = game()
    E.flipCard(s, E.identityCard(s))
    expect(E.identityCard(s).side).toBe(0)
    expect(E.handSize(s)).toBe(5)
  })
})

describe('import .o8d', () => {
  it('lit les quantités et repère le héros', () => {
    const [heroId] = PRECON_DECKS.she_hulk.find(([g]) => DEFINITION_BY_ID[g].type === 'hero')
    const ally = PRECON_DECKS.she_hulk.find(([g]) => DEFINITION_BY_ID[g].type === 'ally')[0]
    const xml = `<?xml version="1.0"?><deck game="055c536f"><section name="Hero"><card qty="1" id="${heroId}">She-Hulk</card></section>
      <section name="Main"><card id="${ally}" qty="2">Allié</card><card qty="3" id="00000000-0000-0000-0000-000000000000">Inconnue</card></section></deck>`
    const r = E.parseDeckFile(xml)
    expect(r.hero).toBe('she_hulk')
    expect(r.deckList).toEqual([[heroId, 1], [ally, 2]])
    expect(r.unknownCount).toBe(3)
  })
})

describe('import texte MarvelCDB', () => {
  // export "Text file" of a MarvelCDB deck, as downloaded
  const POKER = `Playing Poker with Natasha Romanoff

Black Widow
Packs: From Core Set to Hulk

Upgrades
1x Under Surveillance (Thor)
2x Attacrobatics (Black Widow)
2x Black Widow's Gauntlet (Black Widow)
2x Grappling Hook (Black Widow)
1x Synth-Suit (Black Widow)
2x Widow's Bite (Black Widow)
2x Counterintelligence (Black Widow)
3x Spycraft (Black Widow)
3x Espionage (Black Widow)

Events
2x Covert Ops (Black Widow)
2x Dance of Death (Black Widow)
3x Foiled! (Doctor Strange)

Supports
3x Beat Cop (Hulk)
1x Safe House #29 (Black Widow)

Resources
2x The Power of Justice (Core Set)
1x Energy (Core Set)
1x Genius (Core Set)
1x Strength (Core Set)


Allies
1x Daredevil (Core Set)
1x Nick Fury (Core Set)
1x Lockjaw (Ms. Marvel)
1x Winter Soldier (Black Widow)
1x Agent Coulson (Black Widow)
1x Quake (Black Widow)
`

  it('lit le héros, le titre et les 40 cartes, noms anglais et paquets', () => {
    const r = E.parseDeckFile(POKER.replace(/\n/g, '\r\n'))
    expect(r).toMatchObject({ hero: 'black_widow', title: 'Playing Poker with Natasha Romanoff', unknownCount: 0, missing: [] })
    expect(r.deckList.reduce((n, [id, q]) => n + (DEFINITION_BY_ID[id].type === 'hero' ? 0 : q), 0)).toBe(40)
    const name = n => r.deckList.find(([id]) => DEFINITION_BY_ID[id].englishName === n)
    expect(DEFINITION_BY_ID[name('Lockjaw')[0]].name).toBe("Gueule d'Or")
    expect(DEFINITION_BY_ID[name('Under Surveillance')[0]].name).toBe('Sous Surveillance')
    expect(name('Spycraft')[1]).toBe(3)
    const s = game({ hero: r.hero, deckList: r.deckList })
    expect(E.cardsInZone(s, 'playerDeck').length + E.cardsInZone(s, 'hand').length).toBe(40)
  })

  it('le paquet entre parenthèses départage les homonymes, les cartes inconnues sont listées', () => {
    const r = E.parseDeckFile(`Test\n\nDoctor Strange\nPacks: Core Set\n\nAllies\n1x Iron Man (Doctor Strange)\n1x Black Widow (Core Set)\n2x Inconnue (Ant-Man)\n`)
    expect(r.hero).toBe('doctor_strange')
    expect(r.deckList.slice(1).map(([id, q]) => [DEFINITION_BY_ID[id].name, DEFINITION_BY_ID[id].type, q])).toEqual([['Iron Man', 'ally', 1], ['Black Widow', 'ally', 1]])
    expect(r).toMatchObject({ unknownCount: 2, missing: ['Inconnue (Ant-Man)'] })
  })

  it('sans héros connu : pas d\'identité', () => {
    expect(E.parseDeckFile('Deck\n\nStar-Lord\nPacks: Star-Lord\n\n1x Energy (Core Set)').hero).toBeNull()
  })
})

describe('deck MarvelCDB (API)', () => {
  it('chaque carte a son propre code MarvelCDB : numéro de boîte, numéro de carte, face', () => {
    const local = CARD_DEFINITIONS.filter(d => d.pack !== 'marvelcdb')
    // every card is reached (no code shadows another); a reprint may answer to a second code (orig)
    expect(new Set(Object.values(DEFINITION_BY_CODE).filter(d => d.pack !== 'marvelcdb')).size).toBe(local.length)
    expect(DEFINITION_BY_CODE['01043a'].name).toBe('Wakanda Éternel !')
    expect(DEFINITION_BY_CODE['08001a']).toMatchObject({ type: 'hero', set: 'black_widow' })
    expect(DEFINITION_BY_CODE['08012'].name).toBe('Quake')
    expect(DEFINITION_BY_CODE['07014']).toMatchObject({ set: 'wrecker', quantity: 2 })
  })

  it('lit le héros, le nom et les cartes ; une réimpression passe par sa carte d\'origine ; les inconnues sont listées', () => {
    const r = E.parseMarvelCdbDeck(
      { name: 'Natasha', hero_code: '08001a', hero_name: 'Black Widow', slots: { '08002': 1, '08012': 1, 12019: 2, '01088': 1, 99001: 3, '08025': 1 } },
      { 12019: { code: '12019', name: 'Premiers Soins', duplicate_of_code: '01086' }, 99001: { code: '99001', name: 'Carte Future' } }
    )
    expect(r).toMatchObject({ hero: 'black_widow', title: 'Natasha', unknownCount: 3, missing: ['Carte Future'] })
    // the identity first, its obligation (08025) left to the setup
    expect(DEFINITION_BY_ID[r.deckList[0][0]].type).toBe('hero')
    expect(r.deckList.slice(1).map(([id, q]) => `${q}x ${DEFINITION_BY_ID[id].name}`).sort()).toEqual(['1x Le Soldat de l\'Hiver', '1x Quake', '1x Énergie', '2x Premiers Soins'])
    const s = game({ hero: r.hero, deckList: r.deckList })
    expect(E.cardsInZone(s, 'playerDeck').length + E.cardsInZone(s, 'hand').length).toBe(5)
  })

  it('héros absent de la table : pas d\'identité', () => {
    expect(E.parseMarvelCdbDeck({ name: 'A', hero_code: '17001a', slots: { '01088': 1 } }).hero).toBeNull() // Star-Lord
  })
})
