#!/usr/bin/env node
// Régénère src/data/precons-marvelcdb.json : le deck préconstruit de chaque héros de MarvelCDB, au format des
// decklists du site ({hero, slots : {code : exemplaires}}), que la table lit en ligne comme un deck chargé par son
// lien (game/marvelcdb.js, readOnlineDeck). L'écran « Nouvelle partie » les propose dans « Préconstruits » pour les
// héros dont la table n'a pas les cartes (les autres gardent leur précon de data.js, hors ligne).
//
// Deux sources :
//  - le module OCTGN de Marvel Champions (scripts/constants.py), qui liste les précons officiels jusqu'à Sinister
//    Motives : pris tels quels (il cite la carte d'origine d'une réimpression ; la table fait de même) ;
//  - sinon, les cartes de la boîte du héros sur MarvelCDB : la suite des cartes joueur qui commence à son identité.
//    MarvelCDB range chaque héros d'une grosse boîte d'un bloc (son identité, ses cartes, puis les cartes
//    d'affinité et basiques de son précon), suivi de ses cartes Rencontre (obligation, Némésis) ; un paquet héros
//    n'a que lui, et ses cartes bonus des autres affinités (Captain America : 03031–03034) viennent après ses
//    cartes Rencontre. La suite s'arrête donc à la première carte Rencontre ou de campagne, ou au héros suivant.
//    N'en font pas partie : l'identité (et ses autres versions : Ironheart), et les cartes d'un autre set que le
//    héros (les Pris Dans la Glace d'Iceberg). Vérifié sur les 26 précons du module OCTGN hors boîte de base : 24
//    identiques ; War Machine et Valkyrie ont dans leur paquet un exemplaire de plus que leur précon (Make the
//    Call, Audacity). Les héros plus récents font de 39 à 42 cartes (cartes permanentes, de mise en place, ou en
//    trois versions comme celles de Jubilé), non vérifiées faute de liste officielle.
// Les cartes que le héros garde hors de son deck (Climat de Tornade…) sont retirées par la table au chargement
// (rules.js heroPileCodes). La boîte de base n'y est pas : ses précons sont dans precons.json (build-data.py).
//
// Utilisation (Node 20+, sans dépendance) : node scripts/marvelcdb-precons.mjs
// À relancer quand MarvelCDB ajoute une boîte.

import { writeFileSync } from 'node:fs'

const API = 'https://marvelcdb.com/api/public'
const FRENCH_API = 'https://fr.marvelcdb.com/api/public'
const OCTGN_CONSTANTS = 'https://raw.githubusercontent.com/twistedsistem/OCTGN-Marvel-Champions/master/055c536f-adba-4bc2-acbf-9aefb9756046/scripts/constants.py'
const OUTPUT = new URL('../src/data/precons-marvelcdb.json', import.meta.url)
/** Affinités de MarvelCDB → noms français. */
const ASPECTS = { justice: 'Justice', leadership: 'Commandement', aggression: 'Agressivité', protection: 'Protection', pool: 'Pool' }
/** Noms des héros à distinguer d'un autre du même nom, ou plus courts que leur carte. */
const NAMES = { spider_man_morales: 'Spider-Man (Miles Morales)', black_panther_shuri: 'Black Panther (Shuri)', spdr: 'SP//dr' }
/** Un précon fait 40 cartes, hors cartes permanentes : un autre nombre est signalé. */
const PRECON_SIZE = 40

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function get(url, parse = response => response.json()) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (response.ok) return parse(response)
      if (attempt >= 5) throw new Error(`${url} : ${response.status}`)
    } catch (error) {
      if (attempt >= 5) throw error
    }
    // MarvelCDB refuse les rafales, et coupe parfois une connexion : on attend, puis on réessaie
    await sleep(3000 * attempt)
  }
}
/** Ordre des cartes dans leur boîte : position, puis code (« 32001a » avant « 32001b »). */
const byPosition = (first, second) => (first.position - second.position) || first.code.localeCompare(second.code)

/** Les précons du module OCTGN : {code de l'identité → {code : exemplaires}}, identité comprise ; {} s'il est injoignable. */
async function octgnPrecons() {
  try {
    const text = await get(OCTGN_CONSTANTS, response => response.text())
    const block = text.slice(text.indexOf('# Core Set Hero Out of Box Decks'), text.indexOf('# Special Decks'))
    const lists = []
    for (const match of block.matchAll(/^\w+\s*=\s*\{([^}]*)\}/gm)) {
      lists.push(Object.fromEntries([...match[1].matchAll(/['"]([0-9a-z]+)['"]\s*:\s*(\d+)/g)].map(([, code, copies]) => [code, Number(copies)])))
    }
    return lists
  } catch (error) {
    console.warn(`Module OCTGN injoignable (${error.message}) : tous les précons viennent des boîtes de MarvelCDB.`)
    return []
  }
}

/**
 * L'affinité affichée du précon (« précon Commandement ») : celles de ses cartes d'affinité, hors cartes du
 * héros, qui pèsent au moins 40 % de la principale (Spider-Woman : Agressivité et Justice ; Cyclope, qui a un
 * allié de chaque affinité : Commandement) ; les quatre : « toutes affinités » (Adam Warlock).
 */
function aspectLabel(copiesByAspect) {
  const ranked = Object.entries(copiesByAspect).sort((first, second) => second[1] - first[1])
  const kept = ranked.filter(([, copies]) => copies >= ranked[0][1] * 0.4).map(([aspect]) => ASPECTS[aspect])
  if (kept.length >= 4) return 'toutes affinités'
  return kept.length > 1 ? `${kept.slice(0, -1).join(', ')} et ${kept.at(-1)}` : kept[0] ?? ''
}

const octgnLists = await octgnPrecons()
const packs = (await get(`${API}/packs/`)).sort((first, second) => first.position - second.position)
const precons = {}
const warnings = []
for (const pack of packs) {
  if (pack.code === 'core') continue
  const cards = (await get(`${API}/cards/${pack.code}.json`)).sort(byPosition)
  await sleep(400)
  const heroSets = new Set(cards.filter(card => card.type_code === 'hero').map(card => card.card_set_code))
  if (!heroSets.size) continue
  const frenchCards = await get(`${FRENCH_API}/cards/${pack.code}.json`)
  await sleep(400)
  for (const set of heroSets) {
    const start = cards.findIndex(card => card.type_code === 'hero' && card.card_set_code === set)
    const identity = cards[start]
    // la suite des cartes joueur de la boîte, depuis l'identité
    const packSlots = {}
    const copiesByAspect = {}
    let permanentCopies = 0
    for (const card of cards.slice(start + 1)) {
      if (['encounter', 'campaign'].includes(card.faction_code)) break
      if (card.type_code === 'hero' && card.card_set_code !== set) break
      if (['hero', 'alter_ego'].includes(card.type_code)) continue
      if (card.card_set_code && card.card_set_code !== set) continue
      packSlots[card.code] = (packSlots[card.code] ?? 0) + card.quantity
      if (card.permanent) permanentCopies += card.quantity
      if (ASPECTS[card.faction_code] && !card.card_set_code) copiesByAspect[card.faction_code] = (copiesByAspect[card.faction_code] ?? 0) + card.quantity
    }
    // le précon du module OCTGN, s'il le connaît : sans l'identité ni l'alter ego
    const octgnList = octgnLists.find(list => list[identity.code])
    const slots = octgnList
      ? Object.fromEntries(Object.entries(octgnList).filter(([code]) => code.replace(/[a-z]$/, '') !== identity.code.replace(/[a-z]$/, '')))
      : packSlots
    const frenchName = NAMES[set] ?? frenchCards.find(frenchCard => frenchCard.code === identity.code)?.name ?? identity.name
    const aspect = aspectLabel(copiesByAspect)
    precons[set] = { hero: identity.code, name: frenchName, aspect, pack: pack.code, slots }
    const count = Object.values(slots).reduce((total, copies) => total + copies, 0) - (octgnList ? 0 : permanentCopies)
    if (count !== PRECON_SIZE) warnings.push(`${set} : ${count}`)
    console.log(`${pack.code.padEnd(11)} ${set.padEnd(22)} ${String(count).padStart(3)} cartes  ${octgnList ? 'OCTGN  ' : 'boîte  '} ${frenchName} (${aspect})`)
  }
}
if (warnings.length) console.log(`Pas ${PRECON_SIZE} cartes (hors permanentes) : ${warnings.join(' ; ')}`)
const lines = Object.entries(precons).map(([set, precon]) => `  ${JSON.stringify(set)}: ${JSON.stringify(precon)}`)
writeFileSync(OUTPUT, `{\n${lines.join(',\n')}\n}\n`)
console.log(`${lines.length} précons écrits dans src/data/precons-marvelcdb.json`)
