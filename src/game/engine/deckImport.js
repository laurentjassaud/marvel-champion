// Lecture des decks importés : un fichier OCTGN (.o8d), une liste texte exportée de MarvelCDB, ou un deck
// lu par l'API de MarvelCDB (marvelcdb.js fait l'appel réseau, la correspondance des cartes est ici).
// Chaque lecture rend {deckList, hero, unknownCount, missing, title} :
//   deckList      [identifiant de carte, exemplaires][] des cartes reconnues (identité comprise)
//   hero          identifiant du héros reconnu (son set), ou null
//   unknownCount  nombre d'exemplaires de cartes non reconnues
//   missing       noms (ou codes) des cartes non reconnues, pour le message d'erreur
//   title         nom du deck, s'il en a un

import { CARD_DEFINITIONS, DEFINITION_BY_ID, DEFINITION_BY_CODE, PACKS } from '../data.js'

/** Lit un deck OCTGN .o8d (XML) : chaque <card id="GUID" qty="2">. Le héros est celui de la carte d'identité, s'il est connu. */
export function parseOctgnDeck(xml) {
  const deckList = []
  let hero = null
  let unknownCount = 0
  for (const [, attributes] of xml.matchAll(/<card\b([^>]*)>/gi)) {
    const cardId = /\bid="([^"]+)"/i.exec(attributes)?.[1]
    const copies = Number(/\bqty="(\d+)"/i.exec(attributes)?.[1] ?? 1)
    const definition = cardId && DEFINITION_BY_ID[cardId]
    if (!definition) { unknownCount += copies; continue }
    if (definition.type === 'hero') hero = definition.set
    deckList.push([cardId, copies])
  }
  return { deckList, hero, unknownCount, missing: [], title: null }
}

/** Nom simplifié pour comparer deux noms : sans accents, majuscules, apostrophes ni ponctuation ("Widow's Bite" = "Widow’s Bite"). */
const simplifiedName = name => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Lit une liste texte de MarvelCDB : un titre, le nom du héros au-dessus d'une ligne « Packs: », puis des
 * lignes « 2x Nom de la carte (Nom de la boîte) » sous des titres de section. Les cartes sont reconnues
 * par leur nom anglais, dans la boîte nommée entre parenthèses (les réimpressions y sont notées « Core
 * Set »), sinon dans n'importe quelle boîte.
 */
export function parseMarvelCdbText(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const heroDefinitions = CARD_DEFINITIONS.filter(definition => definition.type === 'hero' && definition.englishName)
  const heroNamedBy = line => heroDefinitions.find(definition => simplifiedName(definition.englishName) === simplifiedName(line))
  const packsLineIndex = lines.findIndex(line => /^packs\s*:/i.test(line))
  // le héros : la ligne au-dessus de « Packs: », sinon la première ligne qui nomme un héros
  const heroDefinition = (packsLineIndex > 0 && heroNamedBy(lines[packsLineIndex - 1])) || lines.map(heroNamedBy).find(Boolean)

  const playableDefinitions = CARD_DEFINITIONS.filter(definition => definition.englishName && definition.faction !== 'encounter' && definition.type !== 'hero')
  const deckList = heroDefinition ? [[heroDefinition.id, 1]] : []
  const missing = []
  let unknownCount = 0
  for (const line of lines) {
    const match = /^(\d+)\s*x\s+(.+?)(?:\s*\(([^()]*)\))?$/i.exec(line)
    if (!match) continue
    const [, copiesText, cardName, packName] = match
    const copies = Number(copiesText)
    // une boîte fan-made n'a pas de nom MarvelCDB
    const namedPack = PACKS.find(pack => packName && pack.marvelCdbName && simplifiedName(pack.marvelCdbName) === simplifiedName(packName))
    const sameName = playableDefinitions.filter(definition => simplifiedName(definition.englishName) === simplifiedName(cardName))
    const definition = sameName.find(candidate => candidate.pack === namedPack?.id) ?? sameName[0]
    if (!definition) {
      unknownCount += copies
      missing.push(packName ? `${cardName} (${packName})` : cardName)
      continue
    }
    deckList.push([definition.id, copies])
  }
  const title = lines[0] !== heroDefinition?.englishName ? lines[0] : null
  return { deckList, hero: heroDefinition?.set ?? null, unknownCount, missing, title }
}

/**
 * Lit un deck rendu par l'API de MarvelCDB : {name, hero_code, slots: {code de carte: exemplaires}}. Les
 * codes sont cherchés dans nos boîtes (DEFINITION_BY_CODE) ; une réimpression codée dans une autre boîte est
 * reconnue par la carte qu'elle reproduit. `apiCards` donne ce que l'API a dit des codes introuvables :
 * {code: {name, duplicate_of_code}}. L'obligation et le set Némésis du héros viennent avec lui à la mise en
 * place : ils ne sont pas repris dans la liste.
 */
export function parseMarvelCdbDeck(apiDeck, apiCards = {}) {
  const definitionOfCode = code => DEFINITION_BY_CODE[code] ?? DEFINITION_BY_CODE[apiCards[code]?.duplicate_of_code]
  const identityDefinition = definitionOfCode(apiDeck?.hero_code)
  const heroDefinition = identityDefinition?.type === 'hero' ? identityDefinition : null
  const deckList = heroDefinition ? [[heroDefinition.id, 1]] : []
  const missing = []
  let unknownCount = 0
  for (const [code, copiesText] of Object.entries(apiDeck?.slots ?? {})) {
    const copies = Number(copiesText)
    const definition = definitionOfCode(code)
    if (!definition) {
      unknownCount += copies
      missing.push(apiCards[code]?.name ?? code)
      continue
    }
    if (definition.type === 'hero' || definition.faction === 'encounter') continue // identité déjà listée ; obligation et Némésis viennent avec elle
    deckList.push([definition.id, copies])
  }
  return { deckList, hero: heroDefinition?.set ?? null, unknownCount, missing, title: apiDeck?.name || null }
}

/** Lit un fichier de deck de l'un ou l'autre format : OCTGN .o8d (XML) ou liste texte MarvelCDB. */
export const parseDeckFile = text => (/<deck\b/i.test(text) ? parseOctgnDeck(text) : parseMarvelCdbText(text))
