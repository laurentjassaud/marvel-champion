import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import * as E from './engine.js'
import { DEFS, PRECONS, HEROES, BY_ID, BY_CODE, MODULARS, VICTORY } from './data.js'

const L = { w: 1100, h: 580, cw: 80 }

// small seeded PRNG so shuffles are reproducible
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const game = (over = {}) =>
  E.newGame({ hero: 'spider_man', list: PRECONS.spider_man, villain: 'rhino', modular: 'bomb_scare', expert: false, label: 'test', ...over }, L)
const qty = pred => DEFS.filter(pred).reduce((n, d) => n + d.q, 0)
// puts the first card of type `t` from a pile face up on the table
const onTable = (s, t, zone = 'edeck') => {
  const c = E.cardsIn(s, zone).find(x => E.def(x).t === t)
  E.moveCard(s, c, 'table', {}, true)
  return c
}

beforeEach(() => E.setRandom(seeded(42)))

describe('données', () => {
  it('chaque précon fait 40 cartes hors identité et obligation', () => {
    for (const h of HEROES) {
      const n = PRECONS[h.id].reduce((t, [g, q]) => t + (['hero', 'obligation'].includes(BY_ID[g].t) ? 0 : q), 0)
      expect(n, h.id).toBe(40)
    }
  })

  it('chaque carte a son image, et son verso si elle en a un', () => {
    const cards = new URL('../../public/cards/', import.meta.url)
    const files = DEFS.flatMap(d => [`${d.dir}/${d.id}.jpg`, ...(d.bn ? [`${d.dir}/${d.id}.b.jpg`] : [])])
    expect(files.filter(f => !existsSync(new URL(f, cards)))).toEqual([])
  })

  it('les sets du Bouffon Vert ont le nombre de cartes imprimé', () => {
    const sizes = { risky_business: 24, mutagen_formula: 31, goblin_gimmicks: 8, a_mess_of_things: 5, power_drain: 5, running_interference: 5 }
    for (const [set, n] of Object.entries(sizes)) expect(qty(d => d.s === set), set).toBe(n)
  })

  it('les sets des Démolisseurs ont le nombre de cartes imprimé', () => {
    const sizes = { wrecking_crew: 1, wrecker: 18, thunderball: 18, piledriver: 18, bulldozer: 18 }
    for (const [set, n] of Object.entries(sizes)) expect(qty(d => d.s === set), set).toBe(n)
  })
})

describe('mise en place', () => {
  it('Spider-Man contre Rhino standard', () => {
    const s = game()
    expect(E.cardsIn(s, 'hand')).toHaveLength(6)
    expect(E.cardsIn(s, 'deck').length + 6).toBe(40)
    const id = E.identity(s)
    expect(id.zone).toBe('table')
    expect(id.side).toBe(1) // alter ego
    expect(E.handSize(s)).toBe(6)
    const table = E.cardsIn(s, 'table').map(c => E.def(c).t)
    expect(table.sort()).toEqual(['hero', 'main_scheme', 'villain'])
    expect(E.def(E.cardsIn(s, 'table').find(c => E.def(c).t === 'villain')).st).toBe('I')
    const enc = qty(d => d.f === 'encounter' && ['rhino', 'bomb_scare', 'standard'].includes(d.s) && !['villain', 'main_scheme'].includes(d.t)) + 1
    expect(E.cardsIn(s, 'edeck')).toHaveLength(enc)
    expect(E.cardsIn(s, 'edeck').some(c => E.def(c).t === 'obligation')).toBe(true)
    expect(E.cardsIn(s, 'aside')).toHaveLength(1 + qty(d => d.s === 'spider_man_nemesis'))
    expect(s.counters.map(k => k.v)).toEqual([10, 14, 0])
    expect(s.counters[2].l).toBe('Menace /7')
  })

  it('expert : étapes II et III et set Expert', () => {
    const s = game({ villain: 'ultron', modular: 'under_attack', expert: true })
    const v = E.cardsIn(s, 'table').find(c => E.def(c).t === 'villain')
    expect(E.def(v).st).toBe('II')
    expect(E.cardsIn(s, 'aside').some(c => E.def(c).t === 'villain' && E.def(c).st === 'III')).toBe(true)
    expect(E.cardsIn(s, 'aside').filter(c => E.def(c).t === 'main_scheme')).toHaveLength(2)
    expect(E.cardsIn(s, 'edeck').some(c => E.def(c).s === 'expert')).toBe(true)
  })

  it('Black Widow : précon Justice, obligation dans la Rencontre, Némésis de côté', () => {
    const s = game({ hero: 'black_widow', list: PRECONS.black_widow })
    expect(E.nameOf(E.identity(s))).toBe('Natasha Romanoff')
    expect(E.cardsIn(s, 'hand')).toHaveLength(6)
    expect(E.cardsIn(s, 'deck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ l: 'BLACK WIDOW', v: 9 })
    expect(E.cardsIn(s, 'edeck').some(c => E.nameOf(c) === 'Désaveu Officiel')).toBe(true)
    expect(E.cardsIn(s, 'aside').filter(c => E.def(c).s === 'black_widow_nemesis')).toHaveLength(5)
    // the core cards reprinted in the pack are in the deck
    expect([...E.cardsIn(s, 'deck'), ...E.cardsIn(s, 'hand')].filter(c => E.nameOf(c) === 'Nick Fury')).toHaveLength(1)
  })

  it('Docteur Strange : deck Invocation à part, face visible, remélangé sans pénalité', () => {
    const s = game({ hero: 'doctor_strange', list: PRECONS.doctor_strange })
    expect(E.nameOf(E.identity(s))).toBe('Stephen Strange')
    expect(E.cardsIn(s, 'deck').length + 6).toBe(40)
    expect(E.cardsIn(s, 'ideck')).toHaveLength(5)
    expect(E.cardsIn(s, 'ideck').every(c => c.faceUp)).toBe(true)
    expect(E.cardsIn(s, 'edeck').some(c => E.nameOf(c) === 'Séquelle Physique')).toBe(true)
    expect(E.cardsIn(s, 'aside')).toHaveLength(1 + 5) // étape II de Rhino + Némésis
    const edeck = E.cardsIn(s, 'edeck').length
    const first = E.invoke(s)
    expect(first.zone).toBe('idiscard')
    E.invokeKeep(s)
    expect(E.cardsIn(s, 'ideck')).toHaveLength(4)
    // a cast card sent "to the deck" goes back on top of the Invocation deck, face up
    E.moveCard(s, first, 'deck')
    expect(E.cardsIn(s, 'ideck').at(-1)).toBe(first)
    expect(first.faceUp).toBe(true)
    for (let i = 0; i < 5; i++) E.invoke(s, i % 2 === 0)
    expect(E.cardsIn(s, 'ideck')).toHaveLength(5)
    expect(E.cardsIn(s, 'idiscard')).toHaveLength(0)
    expect(s.accel).toBe(0)
    expect(E.cardsIn(s, 'edeck')).toHaveLength(edeck)
  })

  it('Captain America : le Bouclier est ajouté à la main de départ (mise en place de Steve Rogers)', () => {
    const s = game({ hero: 'captain_america', list: PRECONS.captain_america })
    expect(E.nameOf(E.identity(s))).toBe('Steve Rogers')
    expect(s.counters[0]).toMatchObject({ l: 'CAPTAIN AMERICA', v: 11 })
    const shield = c => E.nameOf(c) === 'Bouclier de Captain America'
    expect(E.cardsIn(s, 'hand').filter(shield)).toHaveLength(1)
    expect(E.cardsIn(s, 'deck').length + E.cardsIn(s, 'hand').length).toBe(40)
    expect(E.cardsIn(s, 'edeck').some(c => E.nameOf(c) === "Homme d'une Autre Époque")).toBe(true)
    expect(E.cardsIn(s, 'aside').filter(c => E.def(c).s === 'captain_america_nemesis')).toHaveLength(5)
  })

  it('Captain America : le Bouclier ne compte pas dans la main du mulligan, et revient s\'il est défaussé', () => {
    const s = game({ hero: 'captain_america', list: PRECONS.captain_america })
    const isShield = c => E.nameOf(c) === 'Bouclier de Captain America'
    const hand = E.cardsIn(s, 'hand')
    expect(hand).toHaveLength(hand.some(c => c.id === s.setupCard) ? 7 : 6)
    // keep the shield, discard 2 others: back to 6 + the shield
    E.mulligan(s, L, hand.filter(c => !isShield(c)).slice(0, 2).map(c => c.id))
    expect(E.cardsIn(s, 'hand')).toHaveLength(7)
    // discard the shield too: it comes back from the discard pile
    const s2 = game({ hero: 'captain_america', list: PRECONS.captain_america })
    E.mulligan(s2, L, E.cardsIn(s2, 'hand').filter(isShield).map(c => c.id))
    expect(E.cardsIn(s2, 'hand').filter(isShield)).toHaveLength(1)
    expect(E.cardsIn(s2, 'hand')).toHaveLength(7)
  })

  it('Hulk : sous forme de héros, il défausse sa main à la fin de son tour (Enragé)', () => {
    const s = game({ hero: 'hulk', list: PRECONS.hulk })
    expect(E.nameOf(E.identity(s))).toBe('Bruce Banner')
    expect(s.counters[0]).toMatchObject({ l: 'HULK', v: 18 })
    expect(E.cardsIn(s, 'hand')).toHaveLength(5)
    expect(E.cardsIn(s, 'aside').filter(c => E.def(c).s === 'hulk_nemesis')).toHaveLength(5)
    // alter ego: the hand stays
    E.toVillainPhase(s, L)
    expect(E.cardsIn(s, 'hand')).toHaveLength(5)
    E.toHeroPhase(s)
    // hero form: the hand is discarded, then drawn up to 4 at the end of the hero phase
    E.flipCard(s, E.identity(s))
    const hand = E.cardsIn(s, 'hand')
    E.toVillainPhase(s, L)
    expect(hand.every(c => c.zone === 'discard')).toBe(true)
    expect(E.cardsIn(s, 'hand')).toHaveLength(4)
  })

  it('Miss Marvel : précon Protection, obligation dans la Rencontre, Némésis de côté', () => {
    const s = game({ hero: 'ms_marvel', list: PRECONS.ms_marvel })
    expect(E.nameOf(E.identity(s))).toBe('Kamala Khan')
    expect(E.cardsIn(s, 'hand')).toHaveLength(6)
    expect(E.cardsIn(s, 'deck').length + 6).toBe(40)
    expect(s.counters[0]).toMatchObject({ l: 'MISS MARVEL', v: 10 })
    expect(E.cardsIn(s, 'edeck').some(c => E.nameOf(c) === "Rentrer Avant l'Aube")).toBe(true)
    expect(E.cardsIn(s, 'aside').filter(c => E.def(c).s === 'ms_marvel_nemesis')).toHaveLength(5)
  })

  it('Thor : précon Agressivité, Némésis de côté, le Géant de Glace entre en jeu Tenace', () => {
    const s = game({ hero: 'thor', list: PRECONS.thor })
    expect(E.nameOf(E.identity(s))).toBe('Odinson')
    expect(E.cardsIn(s, 'hand')).toHaveLength(5)
    expect(E.cardsIn(s, 'deck').length + 5).toBe(40)
    expect(s.counters[0]).toMatchObject({ l: 'THOR', v: 14 })
    expect(E.cardsIn(s, 'edeck').some(c => E.nameOf(c) === "Colère d'Odin")).toBe(true)
    const nemesis = E.cardsIn(s, 'aside').filter(c => E.def(c).s === 'thor_nemesis')
    expect(nemesis).toHaveLength(5)
    const giant = nemesis.find(c => E.nameOf(c) === 'Géant de Glace')
    E.takeFromPile(s, L, giant, 'aside')
    expect(giant.tough).toBe(true)
    // a boost (face down) is not a character entering play
    const other = nemesis.find(c => c !== giant && E.nameOf(c) === 'Géant de Glace')
    E.moveCard(s, other, 'table', { faceDown: true }, true)
    expect(other.tough).toBeFalsy()
  })

  it('set modulaire et difficulté au hasard : tirés à la mise en place, jamais nommés', () => {
    const s = game({ modular: 'random', expert: 'random' })
    expect(MODULARS.map(m => m.id)).toContain(s.opt.modular)
    expect(typeof s.opt.expert).toBe('boolean')
    expect(s.opt.drawn).toEqual(['modular', 'expert'])
    expect(E.cardsIn(s, 'edeck').some(c => E.def(c).s === s.opt.modular)).toBe(true)
    const text = s.log.map(e => e.msg).join(' ')
    expect(text).toContain('module tiré au hasard, difficulté tirée au hasard')
    expect(text).not.toMatch(new RegExp(`${MODULARS.find(m => m.id === s.opt.modular).name}|expert|standard`, 'i'))
    // a choice made by hand is named
    expect(E.setupText({ modular: 'bomb_scare', expert: true, drawn: ['modular'] })).toBe(', module tiré au hasard, expert')
    expect(E.setupText({ modular: 'bomb_scare', expert: false, drawn: [] })).toBe(', module Alerte à la Bombe, standard')
    // several draws do not always give the same set
    const sets = new Set(Array.from({ length: 12 }, () => game({ modular: 'random' }).opt.modular))
    expect(sets.size).toBeGreaterThan(1)
    // Les Démolisseurs have no modular set: nothing to draw
    const crew = game({ villain: 'wrecking_crew', modular: 'random' })
    expect(crew.opt).toMatchObject({ modular: null, drawn: [] })
  })

  it('refuse un héros inconnu', () => {
    expect(() => game({ hero: 'heros_inconnu' })).toThrow()
  })
})

describe('paquets', () => {
  it('paquet vide : remélange la défausse et donne une Rencontre face cachée', () => {
    const s = game()
    E.cardsIn(s, 'deck').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    const enc = E.cardsIn(s, 'edeck').length
    expect(E.drawCard(s, L)).toBe(true)
    expect(E.cardsIn(s, 'discard')).toHaveLength(0)
    expect(E.cardsIn(s, 'edeck')).toHaveLength(enc - 1)
    expect(E.cardsIn(s, 'table').some(c => E.isEnc(c) && !c.faceUp)).toBe(true)
  })

  it('Rencontre vide : remélange et ajoute un jeton d\'accélération', () => {
    const s = game()
    E.cardsIn(s, 'edeck').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    expect(E.cardsIn(s, 'ediscard').length).toBeGreaterThan(0)
    const c = E.revealEncounter(s, L)
    expect(c.zone).toBe('table')
    expect(s.accel).toBe(1)
  })

  it('une carte Rencontre défaussée va dans la défausse Rencontre', () => {
    const s = game()
    const c = E.revealEncounter(s, L)
    E.moveCard(s, c, 'discard')
    expect(c.zone).toBe('ediscard')
  })

  it('phase du méchant : aucun automatisme côté méchant, seul un rappel au journal', () => {
    const s = game()
    s.accel = 1
    const edeck = E.cardsIn(s, 'edeck').length
    const table = E.cardsIn(s, 'table').length
    E.toVillainPhase(s, L)
    expect(s.counters[2].v).toBe(0)
    expect(E.cardsIn(s, 'edeck')).toHaveLength(edeck)
    expect(E.cardsIn(s, 'table')).toHaveLength(table)
    expect(s.log.at(-1).msg).toBe("Phase du méchant : à jouer à la main (menace sur la manigance principale (+1 d'accélération), activations, cartes Rencontre).")
  })

  it('passage à la phase du méchant : redresse et complète la main selon la forme', () => {
    const s = game()
    const [a, b, c] = E.cardsIn(s, 'hand')
    E.playToTable(s, L, a)
    E.toggleTap(s, a)
    E.toggleTap(s, E.identity(s))
    E.moveCard(s, b, 'discard')
    E.moveCard(s, c, 'discard')
    E.toVillainPhase(s, L)
    expect(a.tapped).toBe(false)
    expect(E.identity(s).tapped).toBe(false)
    expect(E.cardsIn(s, 'hand')).toHaveLength(6) // Peter Parker, alter ego
    // in hero form (Spider-Man, hand size 5) a hand of 3 is drawn up to 5 only
    E.toHeroPhase(s)
    E.flipCard(s, E.identity(s))
    E.cardsIn(s, 'hand').slice(0, 3).forEach(x => E.moveCard(s, x, 'discard', {}, true))
    E.toVillainPhase(s, L)
    expect(E.cardsIn(s, 'hand')).toHaveLength(5)
  })

  it('tours et phases : on commence au tour 1 en phase du héros, le tour avance au retour du héros', () => {
    const s = game()
    expect(s).toMatchObject({ turn: 1, phase: 'hero' })
    expect(E.toHeroPhase(s)).toBe(false) // already in the hero phase
    expect(s.turn).toBe(1)
    const edeck = E.cardsIn(s, 'edeck').length
    expect(E.toVillainPhase(s, L)).toBe(true)
    expect(s).toMatchObject({ turn: 1, phase: 'villain' })
    // a second click on the phase in play does nothing: no second refill
    const hand = E.cardsIn(s, 'hand').length
    E.moveCard(s, E.cardsIn(s, 'hand')[0], 'discard', {}, true)
    expect(E.toVillainPhase(s, L)).toBe(false)
    expect(E.cardsIn(s, 'hand')).toHaveLength(hand - 1)
    expect(E.cardsIn(s, 'edeck')).toHaveLength(edeck)
    expect(E.toHeroPhase(s)).toBe(true)
    expect(s).toMatchObject({ turn: 2, phase: 'hero' })
    // a game saved before turns existed starts from round 1, hero phase
    delete s.turn
    delete s.phase
    expect(E.phaseOf(s)).toBe('hero')
    E.toVillainPhase(s, L)
    E.toHeroPhase(s)
    expect(s.turn).toBe(2)
  })
})

describe('mulligan', () => {
  it('défausse la sélection et repioche jusqu\'à la taille de main', () => {
    const s = game()
    const ids = E.cardsIn(s, 'hand').slice(0, 3).map(c => c.id)
    expect(E.mulligan(s, L, ids)).toBe(3)
    expect(E.cardsIn(s, 'hand')).toHaveLength(6)
    expect(E.cardsIn(s, 'discard')).toHaveLength(3)
    expect(E.cardsIn(s, 'deck')).toHaveLength(31)
    expect(s.mull).toBe(true)
  })

  it('sans sélection, garde la main : la décision est prise, le mulligan est passé', () => {
    const s = game()
    const hand = E.cardsIn(s, 'hand').map(c => c.id)
    expect(E.mulligan(s, L, [])).toBe(0)
    expect(E.cardsIn(s, 'hand').map(c => c.id)).toEqual(hand)
    expect(s.mull).toBe(true)
  })
})

describe('main et partie', () => {
  it('carte de la main au hasard : une carte de la main, annoncée au journal', () => {
    const s = game()
    const picks = new Set()
    for (let i = 0; i < 20; i++) {
      const c = E.randomHandCard(s)
      expect(c.zone).toBe('hand')
      expect(s.log.at(-1).msg).toBe(`Carte de la main au hasard : « ${E.nameOf(c)} ».`)
      picks.add(c.id)
    }
    expect(picks.size).toBeGreaterThan(1)
    E.cardsIn(s, 'hand').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    expect(E.randomHandCard(s)).toBeNull()
  })

  it('la mise en place jouée est mémorisée : la rejouer (Recommencer) redonne la même', () => {
    const list = PRECONS.black_widow.slice(0, -2)
    const s = game({ hero: 'black_widow', list, modular: 'random', expert: 'random', label: 'mon deck' })
    E.mulligan(s, L, [])
    E.toVillainPhase(s, L)
    E.toHeroPhase(s)
    const o = s.opt
    expect(o.list).toBe(list)
    const again = E.newGame({ hero: o.hero, list: o.list, villain: o.villain, modular: o.modular, expert: o.expert, label: o.label, drawn: o.drawn }, L)
    expect(again.opt).toEqual(o)
    expect(again).toMatchObject({ turn: 1, phase: 'hero', mull: false })
    // replayed, what was drawn at random is still not named
    expect(again.log[0].msg).toMatch(/module tiré au hasard, difficulté tirée au hasard\.$/)
    expect(E.cardsIn(again, 'deck').length + E.cardsIn(again, 'hand').length).toBe(E.cardsIn(s, 'deck').length + E.cardsIn(s, 'hand').length + E.cardsIn(s, 'discard').length)
  })
})

describe('dégâts et menace', () => {
  it('dégâts : compteurs pour le méchant et l\'identité, jeton sur les sbires, rien sur les manigances', () => {
    const s = game()
    const villain = E.cardsIn(s, 'table').find(c => E.def(c).t === 'villain')
    E.addDamage(s, villain, 3)
    expect(s.counters[1].v).toBe(11)
    E.addDamage(s, null, 1)
    expect(s.counters[1].v).toBe(10)
    E.addDamage(s, E.identity(s), 2)
    expect(s.counters[0].v).toBe(8)
    const minion = onTable(s, 'minion')
    E.addDamage(s, minion, 2)
    E.addDamage(s, minion, -1)
    expect(minion.dmg).toBe(1)
    E.addDamage(s, minion, -5)
    expect(minion.dmg).toBe(0)
    const side = onTable(s, 'side_scheme')
    E.addDamage(s, side, 2)
    expect(side.dmg).toBe(0)
    expect(s.counters[1].v).toBe(10)
  })

  it('menace : compteur pour la manigance principale, jeton sur les annexes, rien sur les personnages', () => {
    const s = game()
    E.addThreat(s, null, 2)
    const scheme = E.cardsIn(s, 'table').find(c => E.def(c).t === 'main_scheme')
    E.addThreat(s, scheme, 1)
    expect(s.counters[2].v).toBe(3)
    const side = onTable(s, 'side_scheme')
    E.addThreat(s, side, 2)
    expect(side.thr).toBe(2)
    expect(s.counters[2].v).toBe(3)
    const minion = onTable(s, 'minion')
    E.addThreat(s, minion, 1)
    expect(minion.thr).toBe(0)
  })

  it('jetons : sur les autres cartes seulement, retirés quand la carte quitte la table', () => {
    const s = game()
    const support = onTable(s, 'support', 'deck')
    E.addTokens(s, support, 3)
    E.addTokens(s, support, -1)
    expect(support.tok).toBe(2)
    E.addDamage(s, support, 1)
    E.addThreat(s, support, 1)
    expect(support).toMatchObject({ dmg: 0, thr: 0 })
    const minion = onTable(s, 'minion')
    E.addTokens(s, minion, 1)
    expect(minion.tok).toBe(0)
    E.moveCard(s, support, 'discard')
    expect(support.tok).toBe(0)
  })

  it('nouvelle étape du méchant depuis « De côté » met à jour les PV', () => {
    const s = game()
    const next = E.cardsIn(s, 'aside').find(c => E.def(c).t === 'villain')
    E.takeFromPile(s, L, next, 'aside')
    expect(s.counters[1]).toMatchObject({ v: 15, l: 'Rhino II' })
  })

  it('méchant vaincu : l\'étape suivante le remplace, au même endroit, avec ses cartes d\'état', () => {
    const s = game()
    const rhino = E.cardsIn(s, 'table').find(c => E.def(c).t === 'villain')
    const { x, y } = rhino
    E.toggleStatus(s, rhino, 'stunned')
    E.addDamage(s, null, 10)
    expect(E.addDamage(s, null, 3)).toBeUndefined() // 1 PV left
    const r = E.addDamage(s, rhino, 5)
    expect(r.kind).toBe('stage')
    const next = E.byId(s, r.to)
    expect(next).toMatchObject({ zone: 'table', x, y, stunned: true, dmg: 0 })
    expect(E.def(next).st).toBe('II')
    expect(rhino.zone).toBe('removed')
    expect(E.cardsIn(s, 'aside').some(c => E.def(c).t === 'villain')).toBe(false)
    expect(s.counters[1]).toMatchObject({ v: 15, l: 'Rhino II' })
  })

  it('dernière étape vaincue : victoire, avec la manigance en jeu ; pas de second déclenchement', () => {
    const s = game()
    E.addDamage(s, null, 14)
    const r = E.addDamage(s, null, 15)
    const scheme = E.cardsIn(s, 'table').find(c => E.def(c).t === 'main_scheme')
    expect(r).toMatchObject({ kind: 'victory', scheme: scheme.id })
    expect(VICTORY[scheme.g]).toMatch(/Rhino/)
    expect(s.log.at(-1).msg).toBe('Victoire : « Rhino » est vaincu en 1 tour !')
    expect(E.addDamage(s, null, 1)).toBeUndefined() // already at 0
    // every main scheme has its victory text
    expect(DEFS.filter(d => d.t === 'main_scheme').filter(d => !VICTORY[d.id]).map(d => d.n)).toEqual([])
  })
})

describe('scénarios du Bouffon Vert', () => {
  const onTableNamed = (s, name) => E.cardsIn(s, 'table').filter(c => E.nameOf(c) === name)

  it('Entreprise à Risques : Norman Osborn, Entreprise Criminelle en jeu avec 2 jetons', () => {
    const s = game({ villain: 'risky_business', modular: 'goblin_gimmicks' })
    const villain = E.cardsIn(s, 'table').find(c => E.def(c).t === 'villain')
    expect(E.nameOf(villain)).toBe('Norman Osborn')
    const [env] = onTableNamed(s, 'Entreprise Criminelle')
    expect(env.tok).toBe(2)
    // the environment starts in play, the rest of the set goes into the deck with the obligation
    const enc = qty(d => d.f === 'encounter' && ['risky_business', 'goblin_gimmicks', 'standard'].includes(d.s) && !['villain', 'main_scheme', 'environment'].includes(d.t)) + 1
    expect(E.cardsIn(s, 'edeck')).toHaveLength(enc)
    expect(s.counters.map(k => k.v)).toEqual([10, 14, 2])
    expect(s.counters[2].l).toBe('Menace /7')
  })

  it('Entreprise à Risques : Norman Osborn retourné devient Le Bouffon Vert (compteur et traits)', () => {
    const s = game({ villain: 'risky_business', modular: 'goblin_gimmicks' })
    const villain = E.cardsIn(s, 'table').find(c => E.def(c).t === 'villain')
    E.flipCard(s, villain)
    expect(s.counters[1].l).toBe('Le Bouffon Vert I')
    expect(E.traitsOf(villain)).toContain('bouffon')
    const [env] = onTableNamed(s, 'Entreprise Criminelle')
    E.flipCard(s, env)
    expect(E.nameOf(env)).toBe('Accès de Folie')
  })

  it('Formule Mutagène : un Esclave Bouffon en jeu, Le Bouffon Vert à 16 PV', () => {
    const s = game({ villain: 'mutagen_formula', modular: 'goblin_gimmicks' })
    expect(onTableNamed(s, 'Esclave Bouffon')).toHaveLength(1)
    expect(E.cardsIn(s, 'edeck').filter(c => E.nameOf(c) === 'Esclave Bouffon')).toHaveLength(5)
    expect(s.counters.map(k => k.v)).toEqual([10, 16, 2])
  })

  it('Nuage Mutagène posé depuis « De côté » : menace de départ et seuil de la manigance', () => {
    const s = game({ villain: 'mutagen_formula', modular: 'goblin_gimmicks' })
    const cloud = E.cardsIn(s, 'aside').find(c => E.def(c).t === 'main_scheme')
    E.takeFromPile(s, L, cloud, 'aside')
    expect(s.counters[2]).toMatchObject({ v: 4, l: 'Menace /11' })
  })
})

describe('Les Démolisseurs', () => {
  const crewGame = (over = {}) => game({ villain: 'wrecking_crew', modular: null, ...over })
  const villains = s => E.cardsIn(s, 'table').filter(c => E.def(c).t === 'villain')
  const villainOf = (s, set) => villains(s).find(c => E.def(c).s === set)
  const sideOf = (s, set) => E.cardsIn(s, 'table').find(c => E.def(c).t === 'side_scheme' && E.def(c).s === set)

  it('mise en place : 4 méchants A, leurs manigances annexes, un paquet de 15 cartes chacun', () => {
    const s = crewGame()
    expect(villains(s).map(c => `${E.nameOf(c)} ${E.def(c).st}`)).toEqual(['Le Démolisseur A', 'Le Boulet A', 'Le Compresseur A', 'Le Bulldozer A'])
    expect(['wrecker', 'thunderball', 'piledriver', 'bulldozer'].map(set => sideOf(s, set).thr)).toEqual([6, 5, 3, 4])
    expect(E.cardsIn(s, 'edeck')).toHaveLength(60)
    expect(E.encounterPile(s, 'edeck')).toHaveLength(15)
    expect(E.cardsIn(s, 'edeck').some(c => E.def(c).t === 'obligation')).toBe(false)
    expect(E.cardsIn(s, 'aside')).toHaveLength(0) // ni Némésis
    expect(s.active).toBe('wrecker')
    expect(s.counters.map(k => k.v)).toEqual([10, 14, 0])
    expect(s.counters.map(k => k.l).slice(1)).toEqual(['Le Démolisseur A', 'Menace /6'])
  })

  it('expert : les versions B', () => {
    const s = crewGame({ expert: true })
    expect(villains(s).map(c => E.def(c).st)).toEqual(['B', 'B', 'B', 'B'])
    expect(s.counters[1].v).toBe(18)
  })

  it('phase des méchants : ni menace ni jeton Actif déplacé, tout se joue à la main', () => {
    const s = crewGame()
    sideOf(s, 'thunderball').thr = 9
    const edeck = E.cardsIn(s, 'edeck').length
    E.toVillainPhase(s, L)
    expect(sideOf(s, 'thunderball').thr).toBe(9)
    expect(sideOf(s, 'wrecker').thr).toBe(6)
    expect(s.active).toBe('wrecker')
    expect(s.counters[2].v).toBe(0)
    expect(E.cardsIn(s, 'edeck')).toHaveLength(edeck)
    expect(s.log.at(-1).msg).toMatch(/^Phase des méchants : à jouer à la main/)
  })

  it('dégâts : chaque méchant garde les siens, le compteur suit le méchant actif', () => {
    const s = crewGame()
    E.addDamage(s, villainOf(s, 'piledriver'), 2)
    expect(villainOf(s, 'piledriver').dmg).toBe(2)
    expect(s.counters[1].v).toBe(14)
    E.addDamage(s, null, 3)
    expect(villainOf(s, 'wrecker').dmg).toBe(3)
    expect(s.counters[1].v).toBe(11)
    E.setActive(s, 'piledriver')
    expect(s.counters[1]).toMatchObject({ l: 'Le Compresseur A', v: 9 })
  })

  it('méchant vaincu : il part avec sa manigance, le jeton Actif passe, victoire après les quatre', () => {
    const s = crewGame()
    sideOf(s, 'bulldozer').thr = 8
    E.moveCard(s, villainOf(s, 'wrecker'), 'discard')
    expect(sideOf(s, 'wrecker')).toBeUndefined()
    expect(s.active).toBe('bulldozer')
    for (const c of villains(s)) E.moveCard(s, c, 'discard')
    expect(s.log.at(-1).msg).toContain('vous gagnez la partie')
  })

  it('méchant à 0 PV : il quitte la partie seul, sa manigance hors jeu ; victoire au dernier', () => {
    const s = crewGame()
    sideOf(s, 'piledriver').thr = 9
    const wrecker = villainOf(s, 'wrecker')
    const side = sideOf(s, 'wrecker')
    const r = E.addDamage(s, null, 14) // the active villain, Le Démolisseur A
    expect(r).toMatchObject({ kind: 'crew', from: wrecker.id, side: side.id, active: villainOf(s, 'piledriver').id })
    expect([wrecker.zone, side.zone]).toEqual(['removed', 'removed'])
    expect(s.counters[1]).toMatchObject({ l: 'Le Compresseur A', v: 11 })
    let last
    for (const v of villains(s)) last = E.addDamage(s, v, E.def(v).hp)
    expect(last).toMatchObject({ kind: 'victory', scheme: E.cardsIn(s, 'table').find(c => E.def(c).t === 'main_scheme').id })
    expect(villains(s)).toHaveLength(0)
    // the defeated villains are not shuffled back into an encounter deck
    expect(E.cardsIn(s, 'ediscard').some(c => E.def(c).t === 'villain')).toBe(false)
  })

  it('paquet du méchant actif vide : seule sa défausse est remélangée, +1 accélération', () => {
    const s = crewGame()
    E.encounterPile(s, 'edeck').forEach(c => E.moveCard(s, c, 'discard', {}, true))
    expect(E.cardsIn(s, 'edeck')).toHaveLength(45)
    E.revealEncounter(s, L)
    expect(s.accel).toBe(1)
    expect(E.encounterPile(s, 'edeck')).toHaveLength(14)
    expect(E.cardsIn(s, 'edeck')).toHaveLength(59)
  })
})

describe('statuts', () => {
  it('sonné et désorienté se cumulent, et restent quand l\'identité change de forme', () => {
    const s = game()
    const id = E.identity(s)
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
    const villain = E.cardsIn(s, 'table').find(c => E.def(c).t === 'villain')
    const scheme = E.cardsIn(s, 'table').find(c => E.def(c).t === 'main_scheme')
    E.toggleStatus(s, villain, 'tough')
    E.toggleStatus(s, scheme, 'tough')
    expect(villain.tough).toBe(true)
    expect(scheme.tough).toBeUndefined()
    E.moveCard(s, villain, 'discard')
    expect(villain.tough).toBeUndefined()
    const minion = E.cardsIn(s, 'edeck').find(c => E.def(c).t === 'minion')
    E.moveCard(s, minion, 'table', { faceDown: true })
    E.toggleStatus(s, minion, 'stunned')
    expect(minion.stunned).toBeUndefined()
  })
})

describe('identité', () => {
  it('changer de forme change la taille de main', () => {
    const s = game()
    E.flipCard(s, E.identity(s))
    expect(E.identity(s).side).toBe(0)
    expect(E.handSize(s)).toBe(5)
  })
})

describe('import .o8d', () => {
  it('lit les quantités et repère le héros', () => {
    const [heroId] = PRECONS.she_hulk.find(([g]) => BY_ID[g].t === 'hero')
    const ally = PRECONS.she_hulk.find(([g]) => BY_ID[g].t === 'ally')[0]
    const xml = `<?xml version="1.0"?><deck game="055c536f"><section name="Hero"><card qty="1" id="${heroId}">She-Hulk</card></section>
      <section name="Main"><card id="${ally}" qty="2">Allié</card><card qty="3" id="00000000-0000-0000-0000-000000000000">Inconnue</card></section></deck>`
    const r = E.parseDeck(xml)
    expect(r.hero).toBe('she_hulk')
    expect(r.list).toEqual([[heroId, 1], [ally, 2]])
    expect(r.unknown).toBe(3)
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
    const r = E.parseDeck(POKER.replace(/\n/g, '\r\n'))
    expect(r).toMatchObject({ hero: 'black_widow', title: 'Playing Poker with Natasha Romanoff', unknown: 0, missing: [] })
    expect(r.list.reduce((n, [id, q]) => n + (BY_ID[id].t === 'hero' ? 0 : q), 0)).toBe(40)
    const name = n => r.list.find(([id]) => BY_ID[id].en === n)
    expect(BY_ID[name('Lockjaw')[0]].n).toBe("Gueule d'Or")
    expect(BY_ID[name('Under Surveillance')[0]].n).toBe('Sous Surveillance')
    expect(name('Spycraft')[1]).toBe(3)
    const s = game({ hero: r.hero, list: r.list })
    expect(E.cardsIn(s, 'deck').length + E.cardsIn(s, 'hand').length).toBe(40)
  })

  it('le paquet entre parenthèses départage les homonymes, les cartes inconnues sont listées', () => {
    const r = E.parseDeck(`Test\n\nDoctor Strange\nPacks: Core Set\n\nAllies\n1x Iron Man (Doctor Strange)\n1x Black Widow (Core Set)\n2x Inconnue (Ant-Man)\n`)
    expect(r.hero).toBe('doctor_strange')
    expect(r.list.slice(1).map(([id, q]) => [BY_ID[id].n, BY_ID[id].t, q])).toEqual([['Iron Man', 'ally', 1], ['Black Widow', 'ally', 1]])
    expect(r).toMatchObject({ unknown: 2, missing: ['Inconnue (Ant-Man)'] })
  })

  it('sans héros connu : pas d\'identité', () => {
    expect(E.parseDeck('Deck\n\nAnt-Man\nPacks: Ant-Man\n\n1x Energy (Core Set)').hero).toBeNull()
  })
})

describe('deck MarvelCDB (API)', () => {
  it('chaque carte a son propre code MarvelCDB : numéro de boîte, numéro de carte, face', () => {
    const local = DEFS.filter(d => d.pack !== 'marvelcdb')
    expect(Object.values(BY_CODE).filter(d => d.pack !== 'marvelcdb')).toHaveLength(local.length)
    expect(BY_CODE['01043a'].n).toBe('Wakanda Éternel !')
    expect(BY_CODE['08001a']).toMatchObject({ t: 'hero', s: 'black_widow' })
    expect(BY_CODE['08012'].n).toBe('Quake')
    expect(BY_CODE['07014']).toMatchObject({ s: 'wrecker', q: 2 })
  })

  it('lit le héros, le nom et les cartes ; une réimpression passe par sa carte d\'origine ; les inconnues sont listées', () => {
    const r = E.parseCdbDeck(
      { name: 'Natasha', hero_code: '08001a', hero_name: 'Black Widow', slots: { '08002': 1, '08012': 1, 12019: 2, '01088': 1, 99001: 3, '08025': 1 } },
      { 12019: { code: '12019', name: 'Premiers Soins', duplicate_of_code: '01086' }, 99001: { code: '99001', name: 'Carte Future' } }
    )
    expect(r).toMatchObject({ hero: 'black_widow', title: 'Natasha', unknown: 3, missing: ['Carte Future'] })
    // the identity first, its obligation (08025) left to the setup
    expect(BY_ID[r.list[0][0]].t).toBe('hero')
    expect(r.list.slice(1).map(([id, q]) => `${q}x ${BY_ID[id].n}`).sort()).toEqual(['1x Le Soldat de l\'Hiver', '1x Quake', '1x Énergie', '2x Premiers Soins'])
    const s = game({ hero: r.hero, list: r.list })
    expect(E.cardsIn(s, 'deck').length + E.cardsIn(s, 'hand').length).toBe(5)
  })

  it('héros absent de la table : pas d\'identité', () => {
    expect(E.parseCdbDeck({ name: 'Q', hero_code: '14001a', slots: { '01088': 1 } }).hero).toBeNull()
  })
})
