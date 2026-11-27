// Fondations du moteur : hasard, identifiants, journal, et toutes les fonctions qui lisent l'état d'une
// partie (quelle carte est où, de quel type, à qui, sous quel nom).
//
// ─── L'état d'une partie (« game ») ────────────────────────────────────────────────────────────────────
// Un simple objet JavaScript, sans Vue : le store Pinia passe son état réactif, les tests un objet ordinaire.
// Il est enregistré tel quel dans le navigateur (savedGame.js le met à jour s'il vient d'une ancienne version).
// {
//   cards: Card[]                 toutes les cartes de la partie ; l'ordre du tableau est l'ordre des piles :
//                                 le dessus d'une pile est sa dernière carte
//   log: {time, text, important}[]  journal ; `important` : message de règle, mis en valeur
//   counters: [{label, value, color}, …]  les trois compteurs du haut de l'écran :
//                                 0 PV du héros, 1 PV du méchant, 2 menace de la manigance principale
//                                 (libellé "Menace /7" : le seuil est après la barre)
//   setup: {hero, deckList, scenario, modulars, expert, deckLabel, randomChoices, importedDefinitions?}
//                                 la mise en place jouée (choix au hasard résolus) : « Recommencer » la rejoue.
//                                 deckList : [identifiant de carte, exemplaires][] ; modulars : identifiants
//                                 des sets modulaires ; randomChoices : ce qui a été tiré au hasard
//                                 ('modular', 'expert'), à ne jamais nommer ; importedDefinitions : fiches
//                                 lues sur MarvelCDB avec un deck importé
//   turn: number                  numéro du round, à partir de 1
//   phase: 'hero' | 'villain'     phase du round ; la partie commence en phase du héros
//   accelerationTokens: number    pions Accélération (un de plus à chaque paquet Rencontre épuisé)
//   mulliganTaken: boolean        le mulligan n'est plus possible : il a été fait (ou la main gardée), ou
//                                 une carte de la main ou du paquet du joueur a été mise en jeu ou
//                                 défaussée depuis la mise en place
//   topZIndex: number             plus grand ordre d'empilement sur la table (la dernière carte posée dessus)
//   setupCardId?: string          carte mise en main par la mise en place de l'identité, après le mulligan
//                                 (Bouclier de Captain America)
//   identitySetupChoice?: true    cette mise en place attend le choix du joueur, après le mulligan (T'Challa :
//                                 laquelle de ses améliorations Black Panther ; setup.js)
//   crew?: string[]               plusieurs méchants à la fois (Les Démolisseurs) : leurs sets Rencontre
//   activeVillainSet?: string     set du méchant qui a le jeton Actif ; les zones encounterDeck et
//                                 encounterDiscard sont partagées, les piles en service sont ses cartes
//   pendingStageChange?: {…}      Kang : changement de stade qui attend la fin de la phase (villains.js)
// }
//
// ─── Une carte en jeu (« card ») ──────────────────────────────────────────────────────────────────────
// {
//   id                 identifiant unique dans la partie
//   definitionId       identifiant de sa fiche (data.js : DEFINITION_BY_ID)
//   owner              'player' (cartes du joueur) ou 'encounter' (cartes Rencontre)
//   zone               où elle se trouve (data.js : ZONE_LABELS)
//   side               face en jeu : 0 face A, 1 face B (alter ego, verso), 2 face C (deuxième face héros)
//   faceUp             face visible ou cachée
//   exhausted          inclinée (« épuisée » dans les règles)
//   x, y, zIndex       position sur la table, en pixels, et ordre d'empilement
//   damage, threat, tokens  dégâts, menace et jetons génériques posés dessus
//   isIdentity?        la carte d'identité du joueur (héros / alter ego)
//   isPawn?            un pion libre (bouton « Pions » de la barre) : `pawn`, sa sorte (PAWN_KINDS de data.js) ;
//                      les pions des anciennes parties n'ont que leur couleur, `color`
//   stunned?, confused?, tough?  cartes d'état Sonné, Désorienté, Tenace
//   underSchemeId?     posée face cachée sous cette manigance (allié Captif, allié de Prison d'Hydra)
//   dealtToPlayer?     carte Rencontre reçue face cachée, posée devant l'identité
//   isBoost?           carte posée face cachée comme boost : retournée, elle n'entre pas en jeu
// }
//
// ─── La disposition de la table (« layout ») ──────────────────────────────────────────────────────────
// {width, height, cardWidth} : taille de la table et largeur d'une carte, en pixels, pour placer les cartes ;
// et, mesurés à l'écran, la place du décor du méchant : villainInset, heroInset, villainHud (layout.js).

import { DEFINITION_BY_ID, DEFINITION_BY_CODE, ZONE_LABELS, CHARACTER_TYPES, SCHEME_TYPES, PAWN_KIND_BY_ID } from '../data.js'
import { heroRules, scenarioRules, SHADOW_OF_THE_PAST_ID } from '../rules.js'

/* ---------------------------------------------------------------------------------------------------- */
/* Hasard et identifiants                                                                                */
/* ---------------------------------------------------------------------------------------------------- */

let randomSource = Math.random

/** Remplace la source de hasard (les tests utilisent un générateur prévisible). */
export function setRandomSource(newSource) { randomSource = newSource }

/** Nombre au hasard dans [0, 1[, tiré de la source en service. */
export const random = () => randomSource()

/** Entier au hasard dans [0, count[. */
export const randomIndex = count => Math.floor(random() * count)

let createdCount = 0
/** Identifiant unique d'une carte ou d'un pion : un compteur, plus du hasard pour ne pas répéter ceux d'une ancienne partie. */
export const uniqueId = () => `${(++createdCount).toString(36)}${Math.floor(random() * 1e9).toString(36)}`

/* ---------------------------------------------------------------------------------------------------- */
/* Textes en français                                                                                    */
/* ---------------------------------------------------------------------------------------------------- */

/** "1 carte", "3 cartes" : le nombre et le mot, au pluriel au-delà de 1. */
export const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`

/**
 * « de Spider-Man », « d'Iceberg », « d'Anna Marie » : le complément d'un nom, élidé devant une voyelle, et devant
 * le h muet d'Hercule (pas devant le h aspiré de Hulk ou de Hawkeye).
 */
export const ofName = name => (/^([aeiouyàâäéèêëîïôöûüœ]|hercule)/iu.test(name) ? `d'${name}` : `de ${name}`)

/** "A, B et C" : une liste en français. */
export const listInFrench = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} et ${items.at(-1)}` : items[0] ?? '')

/** Nombre sur deux chiffres ("07"), pour l'heure du journal. */
const twoDigits = number => String(number).padStart(2, '0')

/** Nombre de messages gardés au journal : au-delà, les plus anciens s'effacent. */
const LOG_LIMIT = 300

/**
 * Ajoute un message au journal, avec l'heure. `important` : un message de règle (mise en place, phases,
 * changements d'étape…), mis en valeur dans le journal.
 */
export function logMessage(game, text, important = false) {
  const now = new Date()
  game.log.push({ time: `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`, text, important })
  if (game.log.length > LOG_LIMIT) game.log.splice(0, game.log.length - LOG_LIMIT)
}

/* ---------------------------------------------------------------------------------------------------- */
/* Lire une carte                                                                                        */
/* ---------------------------------------------------------------------------------------------------- */

/** Fiche (data.js) d'une carte en jeu ; {} pour un pion, qui n'en a pas. */
export const definitionOf = card => DEFINITION_BY_ID[card.definitionId] ?? {}

/** Carte Rencontre (et non carte du joueur). */
export const isEncounterCard = card => card.owner === 'encounter'

/** Nom de la face en jeu : face C (deuxième face héros), face B (alter ego, verso), sinon face A ; pour un pion, celui de sa sorte. */
export function cardName(card) {
  if (card.isPawn) return PAWN_KIND_BY_ID[card.pawn]?.label ?? 'Pion'
  const definition = definitionOf(card)
  if (card.side === 2 && definition.thirdName) return definition.thirdName
  if (card.side === 1 && definition.backName) return definition.backName
  return definition.name
}

/** Nom entre guillemets pour le journal, ou « Carte face cachée » si on ne doit pas le connaître. */
export const cardLabel = card => (card.faceUp || card.zone === 'hand' ? `« ${cardName(card)} »` : 'Carte face cachée')

/** Les cartes d'une zone, dans l'ordre de la pile (le dessus en dernier). */
export const cardsInZone = (game, zone) => game.cards.filter(card => card.zone === zone)

/** La carte qui porte cet identifiant. */
export const cardById = (game, cardId) => game.cards.find(card => card.id === cardId)

/** La carte d'identité du joueur. */
export const identityCard = game => game.cards.find(card => card.isIdentity)

/** L'identité est sous forme d'alter ego (face B) ; les faces A et C sont des formes héros. */
export const isAlterEgo = card => card.side === 1

/** Identité, allié, méchant ou sbire : les cartes qui peuvent porter des cartes d'état. */
export const isCharacter = card => !!card.isIdentity || CHARACTER_TYPES.includes(definitionOf(card).type)

/** Traits de la face en jeu, en minuscules ([] si la fiche n'en donne pas). */
export const traitsOf = card => (card.side === 1 && definitionOf(card).backName ? definitionOf(card).backTraits : definitionOf(card).traits) ?? []

/**
 * La carte du dessus de cette pioche se montre face visible (rules.js showsTopCard) : Magik sous forme de héros
 * (son paquet), Faucon sous forme de héros pendant la phase du joueur (le paquet Rencontre). Seul l'affichage la
 * montre (CardPile, l'aperçu) : l'état de la carte ne change pas.
 */
export function showsTopCardOf(game, zone) {
  const identity = identityCard(game)
  if (!identity || isAlterEgo(identity)) return false
  return (heroRules(game.setup?.hero).showsTopCard ?? []).some(entry => entry.zone === zone && (!entry.phase || entry.phase === game.phase))
}

/**
 * Les cartes qui accompagnent l'identité sur la table (rules.js identity.companion : la combinaison de SP//dr) :
 * elles se retournent avec elle. [] pour un héros sans compagnon.
 */
export function companionCards(game) {
  const companionId = DEFINITION_BY_CODE[heroRules(game.setup?.hero).identity?.companion?.code]?.id
  return companionId ? game.cards.filter(card => card.definitionId === companionId && card.zone === 'table') : []
}

/** Les zones des piles de l'identité, dans l'ordre de rules.js heroPiles (le bandeau du joueur en montre deux au plus). */
export const HERO_PILE_ZONES = ['heroSetAside', 'heroSetAside2']
/**
 * Les piles de l'identité (rules.js heroPiles : cartes mises de côté, decks à part), sous une seule forme :
 * {zone, label, entries: [{code, copies}], faceDown, shuffled, playsTop, returnsUnder, isDeck} ; copies vaut 0 quand
 * le deck fournit ses exemplaires ; isDeck : un deck (« deck Sens »), ou une pile (« pile Versions »). [] pour un
 * héros sans pile.
 */
export const heroPilesOf = game => (heroRules(game.setup?.hero).heroPiles ?? []).slice(0, HERO_PILE_ZONES.length).map((pile, index) => ({
  zone: HERO_PILE_ZONES[index],
  label: pile.label ?? 'De côté',
  entries: (pile.cards ?? []).map(entry => (typeof entry === 'string' ? { code: entry, copies: 0 } : { code: entry.code, copies: entry.copies ?? 0 })),
  faceDown: !!pile.faceDown, shuffled: !!pile.shuffled, playsTop: !!pile.playsTop, returnsUnder: !!pile.returnsUnder,
  isDeck: pile.deck !== false
}))
/** La pile de l'identité de cette zone, ou null. */
export const heroPileOfZone = (game, zone) => heroPilesOf(game).find(pile => pile.zone === zone) ?? null
/** La pile de l'identité d'où vient cette carte (Aura de la Mort de Valkyrie, Sens de Daredevil…), ou null. */
export const heroPileOfCard = (game, card) => heroPilesOf(game)
  .find(pile => pile.entries.some(entry => DEFINITION_BY_CODE[entry.code]?.id === card.definitionId)) ?? null

/** Carte du deck Invocation à part de Docteur Strange : son set s'appelle "<héros>_invocation". */
export const isInvocationCard = card => !!definitionOf(card).set?.endsWith('_invocation')

/**
 * Le seul compteur que prend une carte sur la table : 'damage' sur un personnage, 'threat' sur une
 * manigance, 'tokens' (jetons génériques) sur toute autre carte ou sur une carte face cachée ;
 * null hors de la table ou pour un pion.
 */
export function counterKindOf(card) {
  if (card.zone !== 'table' || card.isPawn) return null
  if (!card.faceUp) return 'tokens'
  if (isCharacter(card)) return 'damage'
  return SCHEME_TYPES.includes(definitionOf(card).type) ? 'threat' : 'tokens'
}

/**
 * Menace avec laquelle une manigance annexe entre en jeu : sa menace de départ (imprimée pour un joueur),
 * plus celle que son « Une fois révélée » ajoute par héros (Réseau de Défense : « placez 1 menace
 * supplémentaire par héros ») ; en solo, « par héros » vaut 1.
 */
export const startingThreatOf = card => (definitionOf(card).startingThreat ?? 0) + (definitionOf(card).extraThreatPerHero ?? 0)

/** Ce que le journal ajoute quand une carte est révélée et que son action est dans son menu (L'Ombre du Passé) ; '' sinon. */
export const revealHint = card => (card.definitionId === SHADOW_OF_THE_PAST_ID ? ' Clic droit sur la carte → Mettre en jeu la Némésis.' : '')

/* ---------------------------------------------------------------------------------------------------- */
/* Zones et piles                                                                                        */
/* ---------------------------------------------------------------------------------------------------- */

/** Les zones-pioches (cartes empilées face cachée, sauf le deck Invocation, face visible). */
export const DECK_ZONES = ['playerDeck', 'encounterDeck', 'invocationDeck', 'scenarioDeck']

/** Les zones-défausses. */
export const DISCARD_ZONES = ['playerDiscard', 'encounterDiscard', 'invocationDiscard', 'scenarioDiscard']

/** Règles spéciales (rules.js) du scénario de la partie. */
export const scenarioRulesOf = game => scenarioRules(game.setup?.scenario)

/**
 * Le deck propre au scénario, à côté du paquet Rencontre ({set, type?, name, shortName, dealsToPlayer?,
 * discard?}), ou null : Armes Expérimentales (Crossbones), Manigance Annexe (Crâne Rouge), Piège (Kraven). Ses
 * cartes se révèlent une à une ; une fois défaussées, elles vont dans la défausse Rencontre, ou dans sa propre
 * défausse (zone scenarioDiscard) s'il en a une (discard : le deck Piège).
 */
export const scenarioDeckOf = game => scenarioRulesOf(game).scenarioDeck ?? null

/** Cette fiche fait partie du deck du scénario décrit par `scenarioDeck` (son set, et son type s'il est précisé). */
export const isInScenarioDeck = (scenarioDeck, definition) =>
  !!scenarioDeck && definition.set === scenarioDeck.set && (!scenarioDeck.type || definition.type === scenarioDeck.type)

/** La pioche propre à une carte : deck Invocation, paquet du joueur, deck du scénario ou paquet Rencontre. */
export function deckZoneOf(game, card) {
  if (isInvocationCard(card)) return 'invocationDeck'
  if (!isEncounterCard(card)) return 'playerDeck'
  return isInScenarioDeck(scenarioDeckOf(game), definitionOf(card)) ? 'scenarioDeck' : 'encounterDeck'
}

/**
 * La défausse propre à une carte : défausse Invocation, défausse du joueur, défausse du deck du scénario quand
 * il en a une (deck Piège), ou défausse Rencontre.
 */
export function discardZoneOf(game, card) {
  if (isInvocationCard(card)) return 'invocationDiscard'
  if (!isEncounterCard(card)) return 'playerDiscard'
  const scenarioDeck = scenarioDeckOf(game)
  return scenarioDeck?.discard && isInScenarioDeck(scenarioDeck, definitionOf(card)) ? 'scenarioDiscard' : 'encounterDiscard'
}

/** Nom d'une zone pour le journal ; le deck du scénario et sa défausse prennent son nom ("deck Armes Expérimentales"). */
export function zoneLabel(game, zone) {
  const scenarioDeck = scenarioDeckOf(game)
  if (zone === 'scenarioDeck' && scenarioDeck) return `deck ${scenarioDeck.name}`
  if (zone === 'scenarioDiscard' && scenarioDeck) return `défausse ${scenarioDeck.name}`
  // une pile de l'identité : « de côté (héros) », ou le nom de son deck (« deck Travaux », « pile Versions »)
  const heroPile = HERO_PILE_ZONES.includes(zone) ? heroPileOfZone(game, zone) : null
  if (heroPile && heroPile.label !== 'De côté') return `${heroPile.isDeck ? 'deck' : 'pile'} ${heroPile.label}`
  return ZONE_LABELS[zone]
}

/** Met la carte sur le dessus de sa pile (fin du tableau). */
export function moveToTop(game, card) {
  game.cards.splice(game.cards.indexOf(card), 1)
  game.cards.push(card)
}

/** Met la carte sous sa pile (début du tableau). */
export function moveToBottom(game, card) {
  game.cards.splice(game.cards.indexOf(card), 1)
  game.cards.unshift(card)
}

/** Mélange les cartes d'une zone (mélange de Fisher-Yates) ; les autres cartes gardent leur ordre. */
export function shuffleZone(game, zone) {
  const pile = cardsInZone(game, zone)
  const otherCards = game.cards.filter(card => card.zone !== zone)
  for (let last = pile.length - 1; last > 0; last--) {
    const picked = randomIndex(last + 1)
    ;[pile[last], pile[picked]] = [pile[picked], pile[last]]
  }
  game.cards = [...otherCards, ...pile]
}

/* ---------------------------------------------------------------------------------------------------- */
/* Méchants et manigances en jeu                                                                         */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * Le paquet ou la défausse Rencontre en service : avec plusieurs méchants (Les Démolisseurs), seulement
 * les cartes du méchant actif ; sinon toute la zone.
 */
export const encounterPile = (game, zone) =>
  cardsInZone(game, zone).filter(card => !game.activeVillainSet || definitionOf(card).set === game.activeVillainSet)

/** Le méchant qui a le jeton Actif (Les Démolisseurs). */
export const activeVillainCard = game =>
  cardsInZone(game, 'table').find(card => definitionOf(card).type === 'villain' && definitionOf(card).set === game.activeVillainSet)

/** Nom du méchant actif, pour le journal. */
export function activeVillainName(game) {
  const villain = activeVillainCard(game)
  return villain ? cardName(villain) : 'aucun méchant'
}

/** La manigance annexe en jeu d'un set (celle d'un des Démolisseurs). */
export const sideSchemeOfSet = (game, set) =>
  cardsInZone(game, 'table').find(card => definitionOf(card).type === 'side_scheme' && definitionOf(card).set === set)

/** Les manigances principales sur la table (deux pendant le stade 3 de Kang : le stade et Le Maître du Temps). */
export const mainSchemesInPlay = game => cardsInZone(game, 'table').filter(card => definitionOf(card).type === 'main_scheme')
