// Rules engine — pure functions over a plain game state object.
// No Vue here: the Pinia store passes its reactive state in, tests pass plain objects.
//
// State shape:
// {
//   cards: Card[]            // array order = pile order; the top of a pile is its last card
//   log: {t, msg, sys}[]
//   counters: [{l, v, c}]    // 0: hero HP, 1: villain HP, 2: main scheme threat ("Menace /7")
//   opt: {hero, villain, modular, expert, label, pback}
//   accel: number            // acceleration tokens
//   mull: boolean            // mulligan already taken
//   zTop: number             // highest z-index on the table
//   crew?: string[]          // several villains at once (Les Démolisseurs): their encounter sets
//   active?: string          // set of the villain with the Active token; edeck/ediscard are shared
//                            // zones, the piles in use are the cards of that set (encounterPile)
// }
// Card: {id, g (OCTGN GUID), o ('p' player | 'e' encounter), zone, side (0 A / 1 B),
//        faceUp, tapped, x, y, z, dmg, thr, tok, hero?, kind? ('token'), color?,
//        stunned?, confused?, tough?}
//
// Layout `L` = {w, h, cw}: table size and table card width in px, used to place cards.

import { DEFS, BY_ID, VILLAINS, MODULARS, TYPE_LABELS, ZONE_LABELS, TOKEN_COLORS, STATUSES, CHARACTER_TYPES, SCHEME_TYPES } from './data.js'

let random = Math.random
/** Replace the random source (tests use a seeded generator). */
export function setRandom(fn) { random = fn }

let seq = 0
const uid = () => `${(++seq).toString(36)}${Math.floor(random() * 1e9).toString(36)}`
const pad = n => String(n).padStart(2, '0')
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`

/* ---------- lookups ---------- */
export const def = c => BY_ID[c.g] ?? {}
export const isEnc = c => c.o === 'e'
export const nameOf = c => (c.kind === 'token' ? 'Pion' : c.side && def(c).bn ? def(c).bn : def(c).n)
export const label = c => (c.faceUp || c.zone === 'hand' ? `« ${nameOf(c)} »` : 'Carte face cachée')
export const cardsIn = (s, zone) => s.cards.filter(c => c.zone === zone)
export const byId = (s, id) => s.cards.find(c => c.id === id)
export const identity = s => s.cards.find(c => c.hero)
/** Identity, ally, villain or minion: the cards that can carry status cards. */
export const isCharacter = c => !!c.hero || CHARACTER_TYPES.includes(def(c).t)
/** Traits of the side in play (lower case; only known for the villains and minions of the scenario packs). */
export const traitsOf = c => (c.side && def(c).bn ? def(c).btr : def(c).tr) ?? []

/**
 * The one counter a table card takes: 'dmg' on characters, 'thr' on schemes,
 * 'tok' (generic tokens) on any other card or a face-down card. null off the table.
 */
export function counterOf(c) {
  if (c.zone !== 'table' || c.kind === 'token') return null
  if (!c.faceUp) return 'tok'
  return isCharacter(c) ? 'dmg' : SCHEME_TYPES.includes(def(c).t) ? 'thr' : 'tok'
}
const deckOf = c => (isEnc(c) ? 'edeck' : 'deck')
const discardOf = c => (isEnc(c) ? 'ediscard' : 'discard')

/* ---------- several villains (Les Démolisseurs) ---------- */
/** Encounter deck or discard in use: with several villains, only the active villain's cards. */
export const encounterPile = (s, zone) => cardsIn(s, zone).filter(c => !s.active || def(c).s === s.active)
export const activeVillain = s => cardsIn(s, 'table').find(c => def(c).t === 'villain' && def(c).s === s.active)
const activeName = s => { const v = activeVillain(s); return v ? nameOf(v) : 'aucun méchant' }
const sideSchemeOf = (s, set) => cardsIn(s, 'table').find(c => def(c).t === 'side_scheme' && def(c).s === set)

/** Villain whose side scheme has the most threat; a tie keeps the active one if it is among them. */
function mostThreatened(s) {
  const alive = s.crew.filter(set => cardsIn(s, 'table').some(c => def(c).t === 'villain' && def(c).s === set))
  const threat = set => sideSchemeOf(s, set)?.thr ?? 0
  const max = Math.max(...alive.map(threat))
  const top = alive.filter(set => threat(set) === max)
  return { set: top.includes(s.active) ? s.active : top[0], tie: top.length > 1 }
}

/** The villain counter follows the active villain (its damage stays on its card). */
function syncCrewCounter(s) {
  const v = activeVillain(s)
  if (v) Object.assign(s.counters[1], { l: `${def(v).n} ${def(v).st}`, v: Math.max(0, def(v).hp - v.dmg) })
}

const TIE = ' (égalité : le premier joueur choisit, clic droit sur un autre méchant → Rendre actif)'

/** Give the Active token to the villain of encounter set `set`. */
export function setActive(s, set) {
  if (!s.crew?.includes(set) || set === s.active) return
  s.active = set
  syncCrewCounter(s)
  log(s, `Jeton Actif sur « ${activeName(s)} » : les piles Rencontre affichées sont les siennes.`, true)
}

/** A defeated villain leaves with its side scheme; the Active token moves on if it was on it. */
function crewVillainGone(s, c) {
  const set = def(c).s
  const side = sideSchemeOf(s, set)
  if (side) moveCard(s, side, 'aside', {}, true)
  log(s, `« ${def(c).n} » quitte la partie${side ? ` avec sa manigance « ${def(side).n} » (mise de côté)` : ''}.`, true)
  const next = mostThreatened(s)
  if (!next.set) { log(s, 'Les quatre Démolisseurs sont vaincus : vous gagnez la partie !', true); return }
  if (s.active !== set) return
  s.active = next.set
  syncCrewCounter(s)
  log(s, `Jeton Actif sur « ${activeName(s)} », dont la manigance annexe a le plus de menaces${next.tie ? TIE : ''}.`, true)
}

/** Current hand size of the identity (hero side or alter-ego side). */
export function handSize(s) {
  const id = identity(s)
  if (!id) return 6
  const d = def(id)
  return (id.side ? d.bhs : d.hs) ?? 6
}

/** Pixel box of a card on the table, before any tap rotation. */
export function cardBox(c, cw) {
  if (c.kind === 'token') return { w: cw * 0.4, h: cw * 0.4 }
  return def(c).l && c.faceUp ? { w: cw * 1.4, h: cw } : { w: cw, h: cw * 1.4 }
}

export function log(s, msg, sys = false) {
  const t = new Date()
  s.log.push({ t: `${pad(t.getHours())}:${pad(t.getMinutes())}`, msg, sys })
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300)
}

/* ---------- pile helpers ---------- */
function makeCard(g, o, zone, extra = {}) {
  return { id: uid(), g, o, zone, side: 0, faceUp: zone !== 'deck' && zone !== 'edeck', tapped: false, x: 0, y: 0, z: 0, dmg: 0, thr: 0, tok: 0, ...extra }
}
function toTop(s, c) { s.cards.splice(s.cards.indexOf(c), 1); s.cards.push(c) }
function toBottom(s, c) { s.cards.splice(s.cards.indexOf(c), 1); s.cards.unshift(c) }

export function shuffleZone(s, zone) {
  const pile = cardsIn(s, zone)
  const rest = s.cards.filter(c => c.zone !== zone)
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pile[i], pile[j]] = [pile[j], pile[i]]
  }
  s.cards = [...rest, ...pile]
}

/* ---------- table placement ---------- */
const crewColumn = (L, i) => 16 + i * (L.cw * 1.4 + 12)
export const slots = {
  villain: () => ({ x: 16, y: 26 }),
  scheme: L => ({ x: 16 + L.cw + 20, y: 26 }),
  identity: L => ({ x: 16, y: L.h - L.cw * 1.4 - 26 }),
  // several villains: one column each, its side scheme (landscape) below it, the main scheme on the right
  crew: (L, i) => ({ x: crewColumn(L, i), y: 26 }),
  crewScheme: (L, i) => ({ x: crewColumn(L, i), y: 26 + L.cw * 1.4 + 10 }),
  crewMain: L => ({ x: crewColumn(L, 4), y: 26 })
}

/** Next free spot in the villain row, right of the villain and main scheme (below the crew when several villains). */
export function encounterSlot(s, L) {
  const fixed = c => ['villain', 'main_scheme'].includes(def(c).t) || (s.crew && def(c).t === 'side_scheme' && s.crew.includes(def(c).s))
  const n = cardsIn(s, 'table').filter(c => isEnc(c) && !fixed(c)).length
  const start = s.crew ? 16 : 16 + L.cw + 20 + L.cw * 1.4 + 24
  const top = s.crew ? 26 + L.cw * 2.4 + 26 : 26
  const step = L.cw + 12
  const perRow = Math.max(1, Math.floor((L.w - start - 10) / step))
  return { x: start + (n % perRow) * step, y: top + Math.floor(n / perRow) * (L.cw * 1.4 + 16) }
}

/** Next free spot in the hero row, right of the identity, growing upwards. */
export function heroSlot(s, L) {
  const n = cardsIn(s, 'table').filter(c => !isEnc(c) && !c.hero && c.kind !== 'token').length
  const start = 16 + L.cw + 24
  const step = L.cw + 12
  const perRow = Math.max(1, Math.floor((L.w - start - 10) / step))
  return { x: start + (n % perRow) * step, y: L.h - L.cw * 1.4 - 26 - Math.floor(n / perRow) * (L.cw * 1.4 + 16) }
}

/** Keep every table card inside the table after a resize. */
export function clampAll(s, L) {
  for (const c of cardsIn(s, 'table')) {
    const b = cardBox(c, L.cw)
    c.x = Math.max(0, Math.min(c.x, L.w - b.w - 4))
    c.y = Math.max(0, Math.min(c.y, L.h - b.h - 4))
  }
}

/* ---------- setup ---------- */
const byStage = (a, b) => a.st.length - b.st.length || a.st.localeCompare(b.st)

/**
 * Build a new game.
 * @param {{hero, list: [gid, qty][], villain, modular, expert, label, pback}} opt
 * @param {{w, h, cw}} L
 */
export function newGame(opt, L) {
  const heroDef = DEFS.find(d => d.t === 'hero' && d.s === opt.hero)
  const villain = VILLAINS.find(v => v.id === opt.villain)
  if (!heroDef) throw new Error(`Héros inconnu : ${opt.hero}`)
  if (!villain) throw new Error(`Méchant inconnu : ${opt.villain}`)

  const s = {
    cards: [], log: [], counters: [], accel: 0, mull: false, zTop: 10,
    opt: { hero: opt.hero, villain: opt.villain, modular: opt.modular, expert: !!opt.expert, label: opt.label, pback: opt.pback || 'blue' }
  }
  const add = (g, o, zone, extra) => s.cards.push(makeCard(g, o, zone, extra))

  // identity starts in alter-ego form (side B)
  add(heroDef.id, 'p', 'table', { side: 1, hero: true, z: 1, ...slots.identity(L) })

  // player deck (identity and obligation are handled separately)
  for (const [g, q] of opt.list) {
    const d = BY_ID[g]
    if (!d || d.t === 'hero' || d.t === 'obligation') continue
    for (let i = 0; i < q; i++) add(g, 'p', 'deck')
  }

  const schemes = DEFS.filter(d => d.t === 'main_scheme' && d.s === opt.villain).sort((a, b) => a.st.localeCompare(b.st))
  let first // villain whose HP the counter shows
  const inPlay = []
  if (villain.crew) {
    // Les Démolisseurs: every villain at once (version A, B in expert) with its side scheme in play
    // and its own encounter deck; the first one holds the Active token. No obligation, no nemesis.
    s.crew = villain.crew
    s.active = villain.crew[0]
    villain.crew.forEach((set, i) => {
      const [a, b] = DEFS.filter(d => d.t === 'villain' && d.s === set).sort(byStage)
      add((opt.expert ? b : a).id, 'e', 'table', { z: 2, ...slots.crew(L, i) })
      const side = DEFS.find(d => d.t === 'side_scheme' && d.s === set)
      add(side.id, 'e', 'table', { z: 2, thr: side.bth ?? 0, ...slots.crewScheme(L, i) })
      for (const d of DEFS) {
        if (d.s !== set || d.t === 'villain' || d.t === 'side_scheme') continue
        for (let k = 0; k < d.q; k++) add(d.id, 'e', 'edeck')
      }
    })
    first = def(activeVillain(s))
    add(schemes[0].id, 'e', 'table', { z: 3, ...slots.crewMain(L) })
  } else {
    // villain: stages I+II in standard, II+III in expert
    const stages = DEFS.filter(d => d.t === 'villain' && d.s === opt.villain).sort(byStage)
    const used = opt.expert ? stages.slice(1, 3) : stages.slice(0, 2)
    first = used[0]
    add(used[0].id, 'e', 'table', { z: 2, ...slots.villain() })
    add(used[1].id, 'e', 'aside')

    // main scheme stages: first one on the table (side A), the others set aside
    add(schemes[0].id, 'e', 'table', { z: 3, ...slots.scheme(L) })
    schemes.slice(1).forEach(d => add(d.id, 'e', 'aside'))

    // encounter deck: villain set + modular + standard (+ expert) + hero obligation
    const sets = [opt.villain, opt.modular, 'standard', ...(opt.expert ? ['expert'] : [])]
    for (const d of DEFS) {
      if (d.f !== 'encounter' || !sets.includes(d.s) || d.t === 'villain' || d.t === 'main_scheme') continue
      for (let i = 0; i < d.q; i++) add(d.id, 'e', 'edeck')
    }
    const obligation = DEFS.find(d => d.t === 'obligation' && d.s === opt.hero)
    if (obligation) add(obligation.id, 'e', 'edeck')

    // setup printed on the 1A side of the main scheme: these cards start in play, not in the deck
    for (const { g, tok = 0 } of villain.setup ?? []) {
      const c = cardsIn(s, 'edeck').find(x => x.g === g)
      if (!c) continue
      moveCard(s, c, 'table', encounterSlot(s, L), true)
      c.tok = tok
      inPlay.push(c)
    }

    // nemesis set aside
    for (const d of DEFS) if (d.s === `${opt.hero}_nemesis`) for (let i = 0; i < d.q; i++) add(d.id, 'e', 'aside')
  }

  s.counters = [
    { l: heroDef.n.toUpperCase(), v: heroDef.hp, c: 'var(--hero)' },
    { l: `${first.n} ${first.st}`, v: first.hp, c: 'var(--enc)' },
    { l: `Menace /${schemes[0].th ?? '?'}`, v: schemes[0].bth ?? 0, c: 'var(--threat)' }
  ]

  shuffleZone(s, 'deck')
  shuffleZone(s, 'edeck')
  const hs = heroDef.bhs ?? 6
  for (let i = 0; i < hs; i++) drawCard(s, L, true)

  const modular = MODULARS.find(m => m.id === opt.modular)?.name
  const scenario = villain.scenario ? ` (${villain.scenario})` : ''
  log(s, `Partie : ${heroDef.n} (${opt.label}) contre ${villain.name}${scenario}${modular ? `, module ${modular}` : ''}, ${opt.expert ? 'expert' : 'standard'}.`, true)
  const start = `Vous commencez en alter ego (${heroDef.bn}) avec ${hs} cartes.`
  if (s.crew) {
    log(s, `Paquet : ${cardsIn(s, 'deck').length + hs} cartes · un paquet Rencontre de 15 cartes par méchant, ni obligation ni Némésis.`)
    log(s, `${start} Les quatre méchants et leurs manigances annexes sont en jeu, jeton Actif sur « ${first.n} » : les piles Rencontre affichées sont les siennes. Retournez la manigance (F) pour passer au stade 1B.`, true)
    return s
  }
  log(s, `Paquet : ${cardsIn(s, 'deck').length + hs} cartes · Rencontre : ${cardsIn(s, 'edeck').length} cartes · Némésis mis de côté.`)
  if (inPlay.length) {
    const cards = inPlay.map(c => `« ${nameOf(c)} »${c.tok ? ` avec ${plural(c.tok, 'jeton')}` : ''}`).join(', ')
    log(s, `${start} Mise en place de la manigance faite (${cards} en jeu) : retournez-la (F) pour passer au stade 1B.`, true)
  } else {
    log(s, `${start} Lisez la face A de la manigance, appliquez sa mise en place puis retournez-la (F).`, true)
  }
  return s
}

/** Parse an OCTGN .o8d deck. Returns {list, hero, unknown}; hero is null if no core-set identity. */
export function parseO8D(xml) {
  const list = []
  let hero = null
  let unknown = 0
  for (const [, attrs] of xml.matchAll(/<card\b([^>]*)>/gi)) {
    const id = /\bid="([^"]+)"/i.exec(attrs)?.[1]
    const qty = Number(/\bqty="(\d+)"/i.exec(attrs)?.[1] ?? 1)
    const d = id && BY_ID[id]
    if (!d) { unknown += qty; continue }
    if (d.t === 'hero') hero = d.s
    list.push([id, qty])
  }
  return { list, hero, unknown }
}

/* ---------- player deck ---------- */
export function drawCard(s, L, quiet = false) {
  let deck = cardsIn(s, 'deck')
  if (!deck.length) {
    // Marvel Champions: shuffle the discard back in and take an encounter card face down
    const discard = cardsIn(s, 'discard')
    if (!discard.length) {
      if (!quiet) log(s, 'Paquet et défausse vides.')
      return false
    }
    discard.forEach(c => { c.zone = 'deck'; c.faceUp = false })
    shuffleZone(s, 'deck')
    log(s, 'Paquet épuisé : défausse remélangée. Recevez 1 carte Rencontre face cachée.', true)
    dealFaceDown(s, L)
    deck = cardsIn(s, 'deck')
  }
  const c = deck[deck.length - 1]
  c.zone = 'hand'
  c.faceUp = true
  c.tapped = false
  toTop(s, c)
  if (!quiet) log(s, 'Vous piochez une carte.')
  return true
}

export function drawMany(s, L, n) {
  let k = 0
  for (let i = 0; i < n; i++) if (drawCard(s, L, true)) k++
  log(s, `Vous piochez ${plural(k, 'carte')}.`)
  return k
}

/* ---------- encounter deck ---------- */
// with several villains, only the active villain's deck and discard (encounterPile)
function refillEncounter(s) {
  const discard = encounterPile(s, 'ediscard')
  if (!discard.length) return false
  discard.forEach(c => { c.zone = 'edeck'; c.faceUp = false; c.dmg = 0; c.thr = 0; c.tok = 0 })
  shuffleZone(s, 'edeck')
  s.accel += 1
  const whose = s.active ? ` de « ${activeName(s)} »` : ''
  log(s, `Paquet Rencontre${whose} épuisé : défausse remélangée. Jeton d'accélération : ${s.accel} (+1 menace par phase du méchant).`, true)
  return true
}

function topEncounter(s) {
  if (!encounterPile(s, 'edeck').length && !refillEncounter(s)) return null
  return encounterPile(s, 'edeck').at(-1)
}

export function revealEncounter(s, L) {
  const c = topEncounter(s)
  if (!c) { log(s, 'Plus aucune carte Rencontre.'); return null }
  moveCard(s, c, 'table', encounterSlot(s, L), true)
  c.faceUp = true
  log(s, `Carte Rencontre révélée : « ${nameOf(c)} » (${TYPE_LABELS[def(c).t] ?? def(c).t}).`)
  return c
}

/** Encounter card face down on the table (boost, or the penalty for an empty player deck). */
export function dealFaceDown(s, L) {
  const c = topEncounter(s)
  if (!c) return null
  moveCard(s, c, 'table', { ...encounterSlot(s, L), faceDown: true }, true)
  return c
}

/* ---------- turn structure ---------- */
/** Number of BOUFFON enemies in play, the villain included (the "X" of Nuage Mutagène). */
function goblinEnemies(s) {
  return cardsIn(s, 'table').filter(c => c.faceUp && ['villain', 'minion'].includes(def(c).t) && traitsOf(c).includes('bouffon')).length
}

export function villainPhase(s, L) {
  // the stage placed last, in case the previous one is still on the table
  const scheme = cardsIn(s, 'table').filter(c => def(c).t === 'main_scheme').at(-1)
  const esc = scheme && def(scheme).esc
  const x = esc === 'X' ? goblinEnemies(s) : null
  const add = (x ?? (esc || 1)) + s.accel
  const k = s.counters[2]
  k.v += add
  const why = x === null ? '' : `, dont X = ${x} ennemi${x > 1 ? 's' : ''} Bouffon`
  let crew = ''
  const full = []
  if (s.crew) {
    // Évasion, forced response after step one: 1 threat on each side scheme,
    // then the Active token goes to the villain whose side scheme has the most threat
    const sides = cardsIn(s, 'table').filter(c => def(c).t === 'side_scheme')
    sides.forEach(c => { c.thr += 1 })
    const next = mostThreatened(s)
    if (next.set) { s.active = next.set; syncCrewCounter(s) }
    crew = ` +1 menace sur chaque manigance annexe, jeton Actif sur « ${activeName(s)} »${next.tie ? TIE : ''}.`
    full.push(...sides.filter(c => c.thr >= 10))
  }
  const who = s.crew ? `« ${activeName(s)} »` : 'Le méchant'
  log(s, `Phase du méchant : +${add} menace sur la manigance principale (${k.v}${why}).${crew} ${who} active (en alter ego, il manigance).`, true)
  for (const c of full) log(s, `« ${nameOf(c)} » a ${c.thr} menaces : appliquez sa Réponse forcée, puis retirez toutes ses menaces sauf 3.`, true)
  warnThreshold(s)
  revealEncounter(s, L)
}

export function newTurn(s, L) {
  cardsIn(s, 'table').filter(c => !isEnc(c)).forEach(c => { c.tapped = false })
  const hs = handSize(s)
  let n = 0
  while (cardsIn(s, 'hand').length < hs && drawCard(s, L, true)) n++
  log(s, `Nouveau tour : vos cartes sont redressées, +${plural(n, 'carte')} (main de ${hs}).`, true)
}

/** Official mulligan: discard the chosen cards, then draw back up to hand size. */
export function mulligan(s, L, ids) {
  const picked = cardsIn(s, 'hand').filter(c => ids.includes(c.id))
  if (!picked.length) { log(s, 'Main de départ conservée.'); return 0 }
  picked.forEach(c => moveCard(s, c, 'discard', {}, true))
  const hs = handSize(s)
  let k = 0
  while (cardsIn(s, 'hand').length < hs && drawCard(s, L, true)) k++
  log(s, `Mulligan : ${plural(picked.length, 'carte')} défaussée${picked.length > 1 ? 's' : ''}, ${k} piochée${k > 1 ? 's' : ''}.`, true)
  s.mull = true
  return picked.length
}

/* ---------- moving cards ---------- */
/**
 * Move a card to a zone. "deck"/"discard" are routed to the card's own deck/discard
 * (player or encounter). opts: {x, y, faceDown, bottom}
 */
export function moveCard(s, c, zone, opts = {}, quiet = false) {
  if (c.kind === 'token') {
    if (zone !== 'table') { s.cards.splice(s.cards.indexOf(c), 1); log(s, 'Pion retiré.') }
    else { c.x = opts.x ?? c.x; c.y = opts.y ?? c.y; c.z = ++s.zTop }
    return
  }
  if (zone === 'deck' || zone === 'edeck') zone = deckOf(c)
  if (zone === 'discard' || zone === 'ediscard') zone = discardOf(c)
  const from = c.zone
  c.zone = zone
  if (zone !== 'table') { c.tapped = false; c.dmg = 0; c.thr = 0; c.tok = 0; STATUSES.forEach(st => delete c[st.id]) }
  if (zone === 'deck' || zone === 'edeck') {
    c.faceUp = false
    c.side = c.hero ? 1 : 0
    opts.bottom ? toBottom(s, c) : toTop(s, c)
  } else {
    if (from !== 'table') c.faceUp = !opts.faceDown
    toTop(s, c)
  }
  if (zone === 'table') { c.x = opts.x ?? c.x; c.y = opts.y ?? c.y; c.z = ++s.zTop }

  // a new villain stage or main scheme entering play updates the counters
  if (zone === 'table' && from === 'aside') {
    const d = def(c)
    if (d.t === 'villain' && !s.crew) {
      Object.assign(s.counters[1], { v: d.hp, l: `${d.n} ${d.st}` })
      log(s, `Nouvelle étape du méchant : ${d.n} ${d.st}, ${d.hp} PV.`, true)
    }
    if (d.t === 'main_scheme') {
      Object.assign(s.counters[2], { v: d.bth ?? 0, l: `Menace /${d.th ?? '?'}` })
      log(s, `Nouvelle manigance : « ${d.n} » (${d.st}). Lisez la face A puis retournez-la.`, true)
    }
  }
  if (!quiet && from !== zone) {
    const name = c.faceUp || from === 'hand' ? `« ${nameOf(c)} »` : 'Une carte face cachée'
    const where = zone === 'deck' || zone === 'edeck' ? `${opts.bottom ? 'sous le' : 'sur le'} ${ZONE_LABELS[zone]}` : `→ ${ZONE_LABELS[zone]}`
    log(s, `${name} : ${ZONE_LABELS[from]} ${where}.`)
  }
  if (s.crew && from === 'table' && zone !== 'table' && def(c).t === 'villain') crewVillainGone(s, c)
}

export function playToTable(s, L, c, faceDown = false) {
  const spot = isEnc(c) ? encounterSlot(s, L) : heroSlot(s, L)
  moveCard(s, c, 'table', { ...spot, faceDown })
}

/** Click on a card inside a pile viewer. */
export function takeFromPile(s, L, c, zone) {
  if (zone === 'deck' || zone === 'discard') moveCard(s, c, 'hand')
  else {
    const t = def(c).t
    const spot = !isEnc(c) ? heroSlot(s, L) : t === 'villain' ? slots.villain() : t === 'main_scheme' ? slots.scheme(L) : encounterSlot(s, L)
    moveCard(s, c, 'table', spot)
  }
  c.faceUp = true
}

/** Reorder a card inside the hand, before `beforeId` (or at the end). */
export function reorderHand(s, id, beforeId) {
  const c = byId(s, id)
  if (!c) return
  s.cards.splice(s.cards.indexOf(c), 1)
  const before = beforeId && byId(s, beforeId)
  s.cards.splice(before ? s.cards.indexOf(before) : s.cards.length, 0, c)
}

export function discardTop(s) {
  const deck = cardsIn(s, 'deck')
  if (deck.length) moveCard(s, deck[deck.length - 1], 'discard')
}

export function addToken(s, L) {
  const n = s.cards.filter(c => c.kind === 'token').length
  s.cards.push({ id: uid(), kind: 'token', color: TOKEN_COLORS[n % TOKEN_COLORS.length], zone: 'table', faceUp: true, x: 40 + (n % 6) * 40, y: L.h / 2 - 20, z: ++s.zTop, dmg: 0, thr: 0, tok: 0 })
  log(s, 'Pion ajouté.')
}

/* ---------- card state ---------- */
export function toggleTap(s, c) {
  if (c.zone !== 'table' || c.kind === 'token') return
  c.tapped = !c.tapped
  log(s, `${c.tapped ? 'Épuisée' : 'Redressée'} : ${label(c)}.`)
}

/** Put or remove a status card (stunned, confused, tough) on a character. Several can stack. */
export function toggleStatus(s, c, id) {
  const st = STATUSES.find(x => x.id === id)
  if (!st || c.zone !== 'table' || !c.faceUp || !isCharacter(c)) return
  c[id] = !c[id]
  log(s, `${label(c)} : statut ${st.label}${c[id] ? '' : ' retiré'}.`)
}

export function flipCard(s, c) {
  if (c.kind === 'token') return
  const d = def(c)
  if (c.faceUp && d.bn) {
    c.side = c.side ? 0 : 1
    if (c.hero) log(s, `Changement de forme : ${c.side ? `${d.bn} (alter ego)` : `${d.n} (héros)`}.`, true)
    else log(s, `« ${d.n} » retournée sur la face ${c.side ? 'B' : 'A'}.`)
    // two-sided villain (Norman Osborn / Le Bouffon Vert): the HP counter follows the side in play
    if (d.t === 'villain' && c.zone === 'table') s.counters[1].l = `${nameOf(c)} ${d.st}`
  } else {
    c.faceUp = !c.faceUp
    log(s, c.faceUp ? `Retournée : « ${nameOf(c)} ».` : 'Carte retournée face cachée.')
  }
}

/**
 * Damage (+n) or heal (−n), characters only. The villain and the identity use the HP counters,
 * allies and minions get a damage token. No card = the villain.
 */
export function addDamage(s, c, n) {
  if (c && counterOf(c) !== 'dmg') return
  if (s.crew && (!c || def(c).t === 'villain')) {
    // several villains: each keeps its damage on its card, the counter shows the active one
    const v = c ?? activeVillain(s)
    if (!v) return
    v.dmg = Math.max(0, v.dmg + n)
    const left = Math.max(0, def(v).hp - v.dmg)
    log(s, `${n > 0 ? 'Dégât' : 'Soin'} sur ${nameOf(v)} : ${left} PV.`)
    if (n > 0 && left === 0) log(s, `« ${nameOf(v)} » est vaincu : défaussez-le, sa manigance annexe quitte la partie avec lui.`, true)
    syncCrewCounter(s)
  } else if (!c || def(c).t === 'villain') {
    const k = s.counters[1]
    k.v = Math.max(0, k.v - n)
    log(s, `${n > 0 ? 'Dégât' : 'Soin'} sur ${k.l} : ${k.v} PV.`)
    if (n > 0 && k.v === 0) log(s, 'Étape du méchant vaincue : posez la suivante depuis « De côté » (victoire s\'il n\'y en a plus).', true)
  } else if (c.hero) {
    const k = s.counters[0]
    k.v = Math.max(0, k.v - n)
    log(s, `${n > 0 ? 'Dégât' : 'Soin'} sur ${nameOf(c)} : ${k.v} PV.`)
    if (n > 0 && k.v === 0) log(s, 'Votre identité tombe à 0 PV : défaite.', true)
  } else {
    c.dmg = Math.max(0, c.dmg + n)
    log(s, `${label(c)} : ${plural(c.dmg, 'dégât')}.`)
  }
}

/**
 * Threat (+n) or thwart (−n), schemes only. The main scheme uses the threat counter,
 * side schemes get a threat token. No card = the main scheme.
 */
export function addThreat(s, c, n) {
  if (c && counterOf(c) !== 'thr') return
  if (!c || def(c).t === 'main_scheme') {
    const k = s.counters[2]
    k.v = Math.max(0, k.v + n)
    log(s, `Menace sur la manigance principale : ${k.v}.`)
    if (n > 0) warnThreshold(s)
  } else {
    c.thr = Math.max(0, c.thr + n)
    log(s, `${label(c)} : ${plural(c.thr, 'menace')}.`)
  }
}

/**
 * Generic tokens (+n / −n) on a card that is neither a character nor a scheme
 * (uses, counters…). Not to be confused with addToken, which puts a loose pawn on the table.
 */
export function addTokens(s, c, n) {
  if (!c || counterOf(c) !== 'tok') return
  c.tok = Math.max(0, (c.tok || 0) + n)
  log(s, `${label(c)} : ${plural(c.tok, 'jeton')}.`)
}

export function threatTarget(s) {
  return Number((s.counters[2].l.match(/\/(\d+)/) || [])[1]) || null
}

function warnThreshold(s) {
  const t = threatTarget(s)
  if (t && s.counters[2].v >= t) log(s, 'La menace atteint le seuil : passez à l\'étape suivante de la manigance (ou défaite à la dernière).', true)
}
