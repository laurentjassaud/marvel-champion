// Import de decks depuis l'API publique de MarvelCDB (https://fr.marvelcdb.com/api/) : les decklists
// publiées, et les decks dont l'auteur partage ses decks, lus par leur lien ou leur numéro. Aucun compte
// n'est nécessaire ; l'API accepte les appels de n'importe quel site (CORS).
// Une carte absente des boîtes de la table est lue dans l'API elle aussi, avec l'image du site (un scan
// anglais : MarvelCDB n'a qu'une image par carte) et son nom français.

import { parseMarvelCdbDeck } from './engine.js'
import { DEFINITION_BY_CODE, addImportedDefinitions } from './data.js'

const SITE_URL = 'https://fr.marvelcdb.com'
const API_URL = `${SITE_URL}/api/public`
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
 * Une carte de l'API MarvelCDB, en fiche de carte de la table (champs décrits dans data.js) ; un héros
 * porte son alter ego (`linked_card`) comme face B.
 */
export function marvelCdbDefinition(apiCard) {
  const type = TYPE_EQUIVALENTS[apiCard.type_code] ?? apiCard.type_code
  const definition = {
    id: `cdb-${apiCard.code}`, code: apiCard.code, name: apiCard.name, englishName: apiCard.real_name, type,
    faction: apiCard.faction_code, set: apiCard.card_set_code ?? '', quantity: apiCard.quantity ?? 1,
    landscape: LANDSCAPE_TYPES.includes(type), imageUrl: apiCard.imagesrc ? SITE_URL + apiCard.imagesrc : null
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
      backImageUrl: backCard.imagesrc ? SITE_URL + backCard.imagesrc : null
    })
  }
  return definition
}

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
 * Lit un deck MarvelCDB et reconnaît ses cartes : le résultat de parseMarvelCdbDeck, plus `heroName` (le nom
 * que MarvelCDB donne à l'identité). Les cartes lues dans l'API rejoignent les fiches de la table
 * (addImportedDefinitions) ; newGame garde avec la partie celles qu'elle utilise. En cas d'échec, lance une
 * Error dont le message, en français, est affiché tel quel par l'écran Nouvelle partie.
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

  const fetchCard = code => getJson(`card/${code}.json`, fetchFunction)
  const definitionsByCode = new Map() // code → fiche lue dans l'API
  const apiCardsOfDeck = {} // code du deck → sa carte dans l'API (nom, duplicate_of_code), pour parseMarvelCdbDeck

  // une identité d'une boîte absente de la table : sa carte, puis son obligation et son set Némésis, dans sa boîte
  if (apiDeck.hero_code && !DEFINITION_BY_CODE[apiDeck.hero_code]) {
    const heroCard = await fetchCard(apiDeck.hero_code)
    if (heroCard?.type_code === 'hero') {
      definitionsByCode.set(heroCard.code, marvelCdbDefinition(heroCard))
      const heroSet = heroCard.card_set_code
      for (const packCard of (await getJson(`cards/${heroCard.pack_code}.json`, fetchFunction)) ?? []) {
        const isHeroEncounterCard = packCard.faction_code === 'encounter'
          && (packCard.card_set_code === heroSet || packCard.card_set_code === `${heroSet}_nemesis`)
        if (isHeroEncounterCard) definitionsByCode.set(packCard.code, marvelCdbDefinition(packCard))
      }
    }
  }

  // les autres cartes absentes de la table ; une réimpression est la carte qu'elle reproduit (la nôtre,
  // sinon la première impression, qui a l'image)
  const unknownCodes = Object.keys(apiDeck.slots).filter(code => !DEFINITION_BY_CODE[code] && !definitionsByCode.has(code))
  await Promise.all(unknownCodes.map(async code => {
    const apiCard = await fetchCard(code)
    if (!apiCard) return
    apiCardsOfDeck[code] = apiCard
    const originalCode = apiCard.duplicate_of_code
    if (!originalCode) {
      definitionsByCode.set(apiCard.code, marvelCdbDefinition(apiCard))
      return
    }
    if (DEFINITION_BY_CODE[originalCode] || definitionsByCode.has(originalCode)) return
    const originalCard = await fetchCard(originalCode)
    definitionsByCode.set(originalCode, marvelCdbDefinition(originalCard?.code ? originalCard : { ...apiCard, code: originalCode }))
  }))

  addImportedDefinitions([...definitionsByCode.values()])
  return { ...parseMarvelCdbDeck(apiDeck, apiCardsOfDeck), heroName: apiDeck.hero_name ?? null }
}
