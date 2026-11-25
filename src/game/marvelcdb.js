// Import de decks depuis l'API publique de MarvelCDB (https://fr.marvelcdb.com/api/) : les decklists
// publiées, et les decks dont l'auteur partage ses decks, lus par leur lien ou leur numéro. Aucun compte
// n'est nécessaire ; l'API accepte les appels de n'importe quel site (CORS).
// Une carte absente des boîtes de la table est lue dans l'API elle aussi, avec l'image du site (un scan
// anglais : MarvelCDB n'a qu'une image par carte) et son nom français.
// La reconnaissance des cartes d'un deck (readOnlineDeck) sert aussi aux decks de MC4DB (mc4db.js), qui ont le
// même format : seule change la façon de lire une carte (cardOf) et la provenance de sa fiche (origin).

import { parseMarvelCdbDeck } from './engine.js'
import { CARD_DEFINITIONS, DEFINITION_BY_CODE, addImportedDefinitions } from './data.js'
import { heroPileCodes, unavailableHeroOf, heroRules } from './rules.js'

const SITE_URL = 'https://fr.marvelcdb.com'
const API_URL = `${SITE_URL}/api/public`
/**
 * Version des fiches que marvelCdbDefinition écrit (champ `revision`) : on l'augmente quand une fiche gagne une
 * information (2 : le verso des cartes recto verso sous un seul code, Intangible / Dense). Une fiche plus
 * ancienne, gardée avec un deck ou une partie, est relue sur l'API au prochain import du deck, et remplacée
 * (addImportedDefinitions, data.js). Sans `revision` : la version 1.
 */
export const IMPORT_REVISION = 3

/** La table connaît cette carte, à jour : une carte de ses boîtes, ou lue sur MarvelCDB par cette version de l'import. */
function isKnownCode(code) {
  const definition = DEFINITION_BY_CODE[code]
  return !!definition && (definition.pack !== 'marvelcdb' || (definition.revision ?? 1) >= IMPORT_REVISION)
}
/** Types de cartes posées à l'horizontale. */
const LANDSCAPE_TYPES = ['main_scheme', 'side_scheme']
/** Types de MarvelCDB que la table traite comme un des siens. */
const TYPE_EQUIVALENTS = { player_side_scheme: 'side_scheme' }

/**
 * Ce que le joueur a collé : "https://marvelcdb.com/decklist/view/40213/…" → {kind: 'decklist', id: '40213'},
 * ".../deck/view/123" → {kind: 'deck', id: '123'}, un numéro seul → {kind: null, id} (decklist, sinon
 * deck), autre chose → null.
 */
export function parseMarvelCdbLink(input) {
  const text = String(input ?? '').trim()
  const match = /marvelcdb\.com\/(decklist|deck)\/(?:view|edit)\/(\d+)/i.exec(text)
  if (match) return { kind: match[1].toLowerCase(), id: match[2] }
  return /^\d+$/.test(text) ? { kind: null, id: text } : null
}

// Les jetons avec lesquels une carte entre en jeu, lus dans son texte français (« Utilisations (3 jetons
// Toile) », « entre en jeu avec 4 jetons Flèche »), sinon anglais (« Uses (3 web counters) », « enters play
// with 2 mystic counters »). En solo, « 2[per_hero] » vaut 2, « 1 jeton Fureur, plus 1[per_hero] jeton Fureur
// supplémentaire » aussi.
const FRENCH_ENTRY_TOKENS = [
  /Utilisations? \((\d+)(?:\[per_hero\])? jetons? ([^).,]+?)\s*(?:, plus (\d+)\[per_hero\][^)]*)?\)/i,
  /entre en jeu avec (\d+|une?)(?:\[per_hero\])? jetons? ([^\s.,<]+)/i
]
const ENGLISH_ENTRY_TOKENS = /(?:\bUses \(|enters? play with )(\d+)(?:\[per_hero\])? [^.()]*?counters?/i
// La menace qu'une manigance annexe reçoit en plus par héros quand elle est révélée, lue dans le texte
// anglais : « When Revealed: Place an additional 1[per_hero] threat here » (pas un « When Revealed (Norman
// Osborn) », qui pose une condition), ou le mot-clé « Hinder 2[per_hero] » (Entrave).
const ENGLISH_EXTRA_THREAT = /<b>When Revealed<\/b>: Place an additional (\d+)\s*\[per_hero\] threat here|\bHinder (\d+)\s*\[per_hero\]/i
/** "3" → 3, "un" / "une" → 1. */
const countFromWord = word => (/^une?$/i.test(word) ? 1 : Number(word))

/**
 * Jetons d'entrée en jeu d'une carte de l'API, au format des fiches (data.js) : {entryTokens, entryTokenName},
 * {entryTokens} si seul le texte anglais les donne, {} si la carte entre en jeu sans jetons.
 */
export function entryTokensFromCardText(apiCard) {
  for (const pattern of FRENCH_ENTRY_TOKENS) {
    const match = pattern.exec(apiCard.text ?? '')
    if (match) return { entryTokens: countFromWord(match[1]) + Number(match[3] ?? 0), entryTokenName: match[2] }
  }
  const match = ENGLISH_ENTRY_TOKENS.exec(apiCard.real_text ?? '')
  return match ? { entryTokens: Number(match[1]) } : {}
}

/** Liste de traits "Objet. Tech." → ['objet', 'tech']. */
const traitList = traitsText => traitsText.split('.').map(trait => trait.trim().toLowerCase()).filter(Boolean)

/**
 * D'où vient une carte lue en ligne : le préfixe de son identifiant (« cdb- » pour une carte officielle, quel que
 * soit le site qui l'a donnée), l'adresse de ses images (son chemin `imagesrc` au bout du site), et `source` :
 * absent pour une carte officielle (elle prend les scans français de cgbuilder), 'mc4db' pour une carte créée
 * par des fans sur MC4DB (mc4db.js).
 */
export const MARVELCDB_ORIGIN = { idPrefix: 'cdb-', imageUrl: path => SITE_URL + path }

/**
 * Une carte de l'API MarvelCDB (ou de MC4DB, même format : `origin`), en fiche de carte de la table (champs
 * décrits dans data.js). Une carte recto verso a sa face B : la carte liée (`linked_card` : l'alter ego d'un
 * héros, l'autre face d'une amélioration…), ou, pour une carte à deux faces sous un seul code (`double_sided`),
 * le nom et l'image de son verso.
 */
export function marvelCdbDefinition(apiCard, origin = MARVELCDB_ORIGIN) {
  const imageOf = path => (path ? origin.imageUrl(path) : null)
  const type = TYPE_EQUIVALENTS[apiCard.type_code] ?? apiCard.type_code
  const definition = {
    id: `${origin.idPrefix}${apiCard.code}`, code: apiCard.code, name: apiCard.name, englishName: apiCard.real_name, type,
    faction: apiCard.faction_code, set: apiCard.card_set_code ?? '', quantity: apiCard.quantity ?? 1,
    landscape: LANDSCAPE_TYPES.includes(type), imageUrl: imageOf(apiCard.imagesrc), revision: IMPORT_REVISION,
    ...(origin.source ? { source: origin.source } : {})
  }
  if (apiCard.health != null) definition.hitPoints = apiCard.health
  if (apiCard.hand_size != null) definition.handSize = apiCard.hand_size
  // coût des alliés propres au héros : Prison d'Hydra (Zola)
  if (type === 'ally' && apiCard.faction_code === 'hero' && apiCard.cost != null) definition.cost = apiCard.cost
  if (type === 'side_scheme' && apiCard.base_threat != null) definition.startingThreat = apiCard.base_threat
  const extraThreat = type === 'side_scheme' && ENGLISH_EXTRA_THREAT.exec(apiCard.real_text ?? '')
  if (extraThreat) definition.extraThreatPerHero = Number(extraThreat[1] ?? extraThreat[2])
  // traits : méchants et sbires, et améliorations du joueur (rules.js en compte certaines : Tech d'Iron Man)
  const isPlayerUpgrade = type === 'upgrade' && apiCard.faction_code !== 'encounter'
  if (apiCard.traits && (['villain', 'minion'].includes(type) || isPlayerUpgrade)) definition.traits = traitList(apiCard.traits)
  // mot-clé Ténacité (« Ténacité. » ou « Ténacité [star] », parfois écrit Tenacité) : entre en jeu Tenace
  const frenchToughness = /(^|[\s.>])T[ée]nacit[ée](?=[\s.,<[]|$)/.test(apiCard.text ?? '')
  const englishToughness = /(^|[\s.>])Toughness(?=[\s.,<[]|$)/.test(apiCard.real_text ?? '')
  if (frenchToughness || englishToughness) definition.toughness = true
  Object.assign(definition, entryTokensFromCardText(apiCard))
  const backCard = apiCard.linked_card
  if (backCard) {
    Object.assign(definition, {
      backName: backCard.name, backType: backCard.type_code, backHandSize: backCard.hand_size ?? undefined,
      backImageUrl: imageOf(backCard.imagesrc)
    })
  } else if (apiCard.double_sided && apiCard.back_name) {
    // une carte recto verso sous un seul code (Intangible / Dense de Vision, 26002) : sa face B est décrite dans
    // la même fiche de l'API, et non dans une carte liée
    Object.assign(definition, {
      backName: apiCard.back_name, backType: type,
      backImageUrl: imageOf(apiCard.backimagesrc)
    })
  }
  return definition
}

/**
 * L'identité d'un héros lu sur MarvelCDB, assemblée avec d'autres cartes de sa boîte (rules.js identity) : sa
 * troisième face (Archangel d'Angel), son alter ego pris sur une autre carte (Peni Parker de SP//dr) ; et la carte
 * qui l'accompagne, recto verso pris sur deux cartes (la combinaison de SP//dr). `heroDefinition` est complétée sur
 * place ; apiCardOf(code) rend la carte de l'API, ou null. Les faces gardent leur code (thirdCode, backCode) pour
 * leur scan français. Rend les fiches en plus : la carte compagnon, s'il y en a une.
 */
export function assembleIdentity(heroDefinition, identityRule, apiCardOf, origin = MARVELCDB_ORIGIN) {
  if (!identityRule) return []
  const imageOf = path => (path ? origin.imageUrl(path) : null)
  const third = identityRule.thirdFace && apiCardOf(identityRule.thirdFace)
  if (third) {
    Object.assign(heroDefinition, {
      thirdName: third.name, thirdHandSize: third.hand_size ?? undefined, thirdImageUrl: imageOf(third.imagesrc), thirdCode: third.code,
      forms: identityRule.forms
    })
  }
  const alterEgo = identityRule.alterEgo && apiCardOf(identityRule.alterEgo)
  if (alterEgo) {
    Object.assign(heroDefinition, {
      backName: alterEgo.name, backType: 'alter_ego', backHandSize: alterEgo.hand_size ?? undefined,
      backImageUrl: imageOf(alterEgo.imagesrc), backCode: alterEgo.code
    })
  }
  const { code, backCode } = identityRule.companion ?? {}
  const front = code && apiCardOf(code)
  if (!front) return []
  const companion = marvelCdbDefinition(front, origin)
  const back = backCode && apiCardOf(backCode)
  if (back) Object.assign(companion, { backName: back.name, backType: back.type_code, backImageUrl: imageOf(back.imagesrc), backCode: back.code })
  return [companion]
}

/** L'identité a déjà ce que rules.js identity lui ajoute (une fiche gardée avant ne l'a pas). */
const isIdentityAssembled = (heroDefinition, identityRule) => (!identityRule.thirdFace || heroDefinition.thirdCode === identityRule.thirdFace)
  && (!identityRule.alterEgo || heroDefinition.backCode === identityRule.alterEgo)
  && (!identityRule.companion || !!DEFINITION_BY_CODE[identityRule.companion.code])

/**
 * Lit une adresse de l'API ; null quand l'API n'a rien à donner : une decklist inconnue répond un corps
 * vide, un deck non partagé redirige vers la page de connexion (illisible depuis un autre site), le réseau
 * peut être coupé.
 */
async function getJson(path, fetchFunction) {
  try {
    const response = await fetchFunction(`${API_URL}/${path}`)
    if (!response.ok) return null
    const text = await response.text()
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

/**
 * Les cartes officielles, lues sur MarvelCDB : {cardOf, packCardsOf} pour readOnlineDeck. cardOf(code) rend
 * {apiCard, origin}, ou null si MarvelCDB ne connaît pas ce code (il répond alors une erreur 500 : une carte de
 * fans, par exemple) ; packCardsOf(boîte) les cartes d'une boîte.
 */
export function marvelCdbCards(fetchFunction = url => fetch(url)) {
  return {
    cardOf: async code => {
      const apiCard = await getJson(`card/${code}.json`, fetchFunction)
      return apiCard?.code ? { apiCard, origin: MARVELCDB_ORIGIN } : null
    },
    packCardsOf: async packCode => (await getJson(`cards/${packCode}.json`, fetchFunction)) ?? []
  }
}

/**
 * Reconnaît les cartes d'un deck lu en ligne (le format de MarvelCDB, que MC4DB reprend) : le résultat de
 * parseMarvelCdbDeck, plus `heroName` (le nom que le site donne à l'identité). Les cartes absentes de la table
 * sont demandées une à une (`cards.cardOf(code)` : {apiCard, origin} ou null) ; pour un héros absent, sa boîte
 * donne aussi son obligation et son set Némésis (`cards.packCardsOf(boîte, origin)`). Elles rejoignent les
 * fiches de la table (addImportedDefinitions) ; newGame garde avec la partie celles qu'elle utilise.
 */
export async function readOnlineDeck(apiDeck, cards) {
  // un héros que la table refuse pour l'instant (rules.js UNAVAILABLE_HEROES) : rien n'est lu
  const refusedHero = unavailableHeroOf({ code: apiDeck.hero_code })
  if (refusedHero) throw new Error(`${refusedHero.name} : héros non disponible sur cette plateforme.`)
  const definitionsByCode = new Map() // code → fiche lue en ligne
  const apiCardsOfDeck = {} // code du deck → sa carte en ligne (nom, duplicate_of_code), pour parseMarvelCdbDeck

  // une identité d'une boîte absente de la table : sa carte, puis son obligation et son set Némésis, dans sa boîte,
  // et les cartes de ses piles qui ne sont pas dans le deck (rules.js heroPiles : les Pris Dans la Glace
  // d'Iceberg, les decks Climat de Tornade, Travaux et Dons d'Hercule, Sens de Daredevil)
  if (apiDeck.hero_code && !isKnownCode(apiDeck.hero_code)) {
    const hero = await cards.cardOf(apiDeck.hero_code)
    if (hero?.apiCard.type_code === 'hero') {
      const { apiCard: heroCard, origin } = hero
      const heroSet = heroCard.card_set_code
      const packCards = await cards.packCardsOf(heroCard.pack_code, origin)
      // son identité assemblée avec d'autres cartes de la boîte (rules.js identity : Angel, SP//dr)
      const heroDefinition = marvelCdbDefinition(heroCard, origin)
      const apiCardOf = code => packCards.find(packCard => packCard.code === code) ?? null
      for (const extra of assembleIdentity(heroDefinition, heroRules(heroSet).identity, apiCardOf, origin)) definitionsByCode.set(extra.code, extra)
      definitionsByCode.set(heroCard.code, heroDefinition)
      const setAsideCodes = heroPileCodes(heroSet)
      for (const packCard of packCards) {
        const isHeroEncounterCard = packCard.faction_code === 'encounter'
          && (packCard.card_set_code === heroSet || packCard.card_set_code === `${heroSet}_nemesis`)
        const isSetAsideCard = setAsideCodes.includes(packCard.code) && !isKnownCode(packCard.code)
        if (isHeroEncounterCard || isSetAsideCard) definitionsByCode.set(packCard.code, marvelCdbDefinition(packCard, origin))
      }
    }
  }

  // les autres cartes absentes de la table ; une réimpression est la carte qu'elle reproduit (la nôtre,
  // sinon la première impression, qui a l'image)
  const unknownCodes = Object.keys(apiDeck.slots).filter(code => !isKnownCode(code) && !definitionsByCode.has(code))
  await Promise.all(unknownCodes.map(async code => {
    const found = await cards.cardOf(code)
    if (!found) return
    const { apiCard, origin } = found
    apiCardsOfDeck[code] = apiCard
    const originalCode = apiCard.duplicate_of_code
    if (!originalCode) {
      definitionsByCode.set(apiCard.code, marvelCdbDefinition(apiCard, origin))
      return
    }
    if (isKnownCode(originalCode) || definitionsByCode.has(originalCode)) return
    const original = await cards.cardOf(originalCode)
    definitionsByCode.set(originalCode, original
      ? marvelCdbDefinition(original.apiCard, original.origin)
      : marvelCdbDefinition({ ...apiCard, code: originalCode }, origin))
  }))

  addImportedDefinitions([...definitionsByCode.values()])
  return { ...parseMarvelCdbDeck(apiDeck, apiCardsOfDeck), heroName: apiDeck.hero_name ?? null }
}

/**
 * Les cartes des piles d'un héros lu sur MarvelCDB qui ne sont pas dans son deck (rules.js heroPiles, entrées avec
 * `copies` : le deck Climat de Tornade, les Pris Dans la Glace d'Iceberg, les decks d'Hercule et de Daredevil), lues
 * sur MarvelCDB quand la table ne les connaît pas encore : un deck sauvegardé, ou une partie, d'avant que l'import
 * ne les lise avec le deck.
 * Elles rejoignent les fiches de la table (addImportedDefinitions). Rend les fiches lues ([] sans réseau).
 *   fetchFunction  la fonction d'appel réseau (les tests en donnent une fausse)
 */
export async function readMissingSetAsideCards(hero, fetchFunction = url => fetch(url)) {
  const cards = marvelCdbCards(fetchFunction)
  const codes = heroPileCodes(hero, { outsideDeck: true }).filter(code => !DEFINITION_BY_CODE[code])
  const found = (await Promise.all(codes.map(code => cards.cardOf(code)))).filter(Boolean)
  const definitions = found.map(({ apiCard, origin }) => marvelCdbDefinition(apiCard, origin))
  addImportedDefinitions(definitions)
  // l'identité assemblée (rules.js identity) qui manque à une fiche gardée avant : complétée sur place
  const identityRule = heroRules(hero).identity
  const heroDefinition = CARD_DEFINITIONS.find(definition => definition.pack === 'marvelcdb' && definition.type === 'hero' && definition.set === hero)
  if (identityRule && heroDefinition && !isIdentityAssembled(heroDefinition, identityRule)) {
    const { companion } = identityRule
    const identityCodes = [identityRule.thirdFace, identityRule.alterEgo, companion?.code, companion?.backCode].filter(Boolean)
    const apiCards = new Map((await Promise.all(identityCodes.map(code => cards.cardOf(code)))).filter(Boolean).map(({ apiCard }) => [apiCard.code, apiCard]))
    const extras = assembleIdentity(heroDefinition, identityRule, code => apiCards.get(code) ?? null)
    addImportedDefinitions(extras)
    definitions.push(heroDefinition, ...extras)
  }
  return definitions
}

/**
 * Lit un deck MarvelCDB et reconnaît ses cartes (readOnlineDeck). En cas d'échec, lance une Error dont le
 * message, en français, est affiché tel quel par l'écran Nouvelle partie.
 *   fetchFunction  la fonction d'appel réseau (les tests en donnent une fausse)
 */
export async function fetchMarvelCdbDeck(input, fetchFunction = url => fetch(url)) {
  const link = parseMarvelCdbLink(input)
  if (!link) throw new Error('Collez le lien d\'un deck MarvelCDB (…/decklist/view/12345 ou …/deck/view/12345) ou le numéro d\'une decklist publiée.')
  let apiDeck = null
  // un numéro seul : d'abord une decklist publiée, sinon un deck partagé
  for (const kind of link.kind ? [link.kind] : ['decklist', 'deck']) {
    apiDeck = await getJson(`${kind}/${link.id}.json`, fetchFunction)
    if (apiDeck?.slots) break
  }
  if (!apiDeck?.slots) {
    if (globalThis.navigator?.onLine === false) throw new Error('Pas de connexion : MarvelCDB est injoignable.')
    throw new Error('Deck introuvable sur MarvelCDB. Un deck non publié ne se lit que si son auteur partage ses decks (option de son profil MarvelCDB).')
  }
  return readOnlineDeck(apiDeck, marvelCdbCards(fetchFunction))
}
