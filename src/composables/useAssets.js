// Adresses des images : la face d'une carte (et ses faces B et C), le dos des cartes, les cartes d'état,
// le décor de la table (la ville de nuit, l'illustration du méchant). Les cartes de nos boîtes ont leurs scans
// dans public/cards/ ; celles lues sur MarvelCDB, les scans français de cgbuilder quand il les a (liste
// src/data/cgbuilder.json), sinon les scans anglais de MarvelCDB ; les cartes de fans lues sur MC4DB, ses scans
// anglais.

import { definitionOf, isEncounterCard } from '../game/engine.js'
import { DEFINITION_BY_ID, PAWN_KIND_BY_ID } from '../game/data.js'
import { mc4dbDisplayUrl } from '../game/mc4db.js'
import cgbuilderData from '../data/cgbuilder.json'

/** Racine du site : './' par défaut (version installable et version artefact), ou le chemin de déploiement. */
const BASE_URL = import.meta.env.BASE_URL

/** Dossier des images d'une boîte, sous cards/ (encodé : « bouffon vert » contient une espace). */
const imageFolderUrl = definition => `${BASE_URL}cards/${encodeURIComponent(definition?.imageFolder ?? 'base')}`

/** Carte lue en ligne (une boîte absente de la table) : son image vient de cgbuilder, sinon du site qui l'a donnée. */
const isImportedDefinition = definition => definition?.pack === 'marvelcdb'
/**
 * L'image d'une carte lue en ligne, pour sa face A ('') ou B ('b') : le scan français de cgbuilder, sinon celui du
 * site qui l'a donnée. Une carte de fans lue sur MC4DB (source 'mc4db', game/mc4db.js) n'est jamais cherchée chez
 * cgbuilder (il ne l'a pas, et son code pourrait y désigner une carte officielle) : son image anglaise, par le
 * relais du site (mc4dbDisplayUrl).
 */
function onlineImageUrl(definition, side = '') {
  const siteUrl = { b: definition.backImageUrl, c: definition.thirdImageUrl }[side] ?? definition.imageUrl
  if (definition.source === 'mc4db') return mc4dbDisplayUrl(siteUrl) ?? null
  // une face prise sur une autre carte (rules.js identity : Archangel d'Angel, Peni Parker de SP//dr) a son code
  const faceCode = { b: definition.backCode, c: definition.thirdCode }[side]
  return (faceCode ? cgbuilderImageUrl(faceCode) : cgbuilderImageUrl(definition.code, side)) ?? siteUrl ?? null
}

/** Les scans français de cgbuilder (CardGame Builder) : images/carte/<dossier>/<numéro><face>.jpg. */
export const CGBUILDER_IMAGES_URL = 'https://mc-src.cgbuilder.fr/images/carte'

/**
 * Les cartes que cgbuilder a, par code MarvelCDB : "06001a" → "6/1A", "60017" → "60/17". Le numéro et la face
 * sont ceux du code, pas toujours le dossier (MarvelCDB 02, Le Bouffon Vert, est le dossier 3 de cgbuilder).
 * Lues dans src/data/cgbuilder.json, que scripts/cgbuilder-images.py tient à jour et vérifie carte par carte :
 * cgbuilder ne répond pas « introuvable » pour une image qu'il n'a pas, il renvoie vers une carte voisine.
 */
const CGBUILDER_PATHS = new Map()
for (const [prefix, { folder, cards }] of Object.entries(cgbuilderData.packs)) {
  for (const entry of cards.split(' ').filter(Boolean)) {
    const [stem, file = stem] = entry.split('=') // « 17=17A » : la carte 17 est le fichier 17A
    const [, number, face] = /^(\d+)([A-Z]?)$/.exec(stem)
    CGBUILDER_PATHS.set(`${prefix}${number.padStart(3, '0')}${face.toLowerCase()}`, `${folder}/${file}`)
  }
}

/**
 * Le scan français d'une carte sur cgbuilder, d'après son code MarvelCDB ; null si cgbuilder ne l'a pas.
 *   side  '' (face A, ou la seule), 'b' ou 'c' : l'autre face, de même numéro ("06001a", face 'b' → 6/1B.jpg ;
 *         "26002", recto verso sous un seul code, face 'b' → 26/2B.jpg, rangée sous "26002b")
 */
export function cgbuilderImageUrl(code, side = '') {
  const path = CGBUILDER_PATHS.get(side ? (code ?? '').replace(/[a-z]?$/, side) : code)
  return path ? `${CGBUILDER_IMAGES_URL}/${path}.jpg` : null
}

/**
 * Image de la face en jeu d'une carte : "<id>.jpg" pour la face A, "<id>.b.jpg" pour la face B (verso
 * d'une carte double), "<id>.c.jpg" pour la troisième face d'une identité (La Guêpe Géant) ; null s'il
 * n'y en a pas. Une face que la carte n'a pas donne l'image de sa face A.
 * Une carte lue sur MarvelCDB prend le scan français de cgbuilder (cgbuilderImageUrl), trouvé depuis son code
 * (les decks et parties déjà sauvegardés en profitent aussi) ; si cgbuilder ne l'a pas, le scan anglais de
 * MarvelCDB. Une carte de fans lue sur MC4DB a directement le scan anglais de MC4DB.
 */
export function cardImageUrl(card) {
  const definition = definitionOf(card)
  let sideSuffix = ''
  if (card.side === 2 && definition.thirdName) sideSuffix = 'c'
  else if (card.side && definition.backName) sideSuffix = 'b'
  if (isImportedDefinition(definition)) return onlineImageUrl(definition, sideSuffix)
  return `${imageFolderUrl(definition)}/${card.definitionId}${sideSuffix ? `.${sideSuffix}` : ''}.jpg`
}

/** Dos de carte : bleu pour les cartes du héros, violet pour les méchants, jaune orangé pour les autres cartes Rencontre. */
export function cardBackUrl(card) {
  let color = 'orange'
  if (!isEncounterCard(card)) color = 'blue'
  else if (definitionOf(card).type === 'villain') color = 'purple'
  return `${BASE_URL}backs/${color}.jpg`
}

/**
 * Illustrations des méchants, en décor à gauche de la table, par scénario (setup.scenario). Chaque image fait
 * 694 × 923 px, détourée en biais sur sa droite (maquette) ; les autres scénarios n'en ont pas encore.
 */
const VILLAIN_ART_FILES = {
  rhino: 'villains/rhino.webp', klaw: 'villains/klaw.webp', ultron: 'villains/ultron.webp',
  risky_business: 'villains/norman-osborn.webp', mutagen_formula: 'villains/bouffon-vert.webp'
}

/** Le fond de la table (maquette) : une ville de nuit vue d'en bas, 1672 × 941 px. */
export const CITY_BACKGROUND_URL = `${BASE_URL}backgrounds/ville-nuit.webp`

/**
 * La page d'accueil (maquette « accueil ») : le ciel étoilé en vidéo, la ville vue d'en bas (1672 × 941 px :
 * au fond, puis ses immeubles au premier plan, le ciel transparent) et les héros autour du menu.
 */
export const INTRO_SKY_URL = `${BASE_URL}intro/ciel-etoile-fast.mp4`
export const INTRO_CITY_URL = `${BASE_URL}intro/ville.webp`
export const INTRO_FOREGROUND_URL = `${BASE_URL}intro/premier-plan.webp`
/** Un héros de la page d'accueil, par son nom de fichier ('spider-man'). */
export const introHeroUrl = heroId => `${BASE_URL}intro/${heroId}.webp`

/** Illustration du méchant de ce scénario, ou null s'il n'en a pas. */
export const villainArtUrl = scenarioId => (VILLAIN_ART_FILES[scenarioId] ? `${BASE_URL}${VILLAIN_ART_FILES[scenarioId]}` : null)

/** Nom de fichier de l'image de chaque pion (rond pour les dégâts, triangle pour la menace, carré pour les jetons). */
const TOKEN_FILES = { damage: 'degats', threat: 'menace', tokens: 'jetons' }

/**
 * Image d'un pion posé sur une carte (fond transparent ; son nombre s'écrit par-dessus, GameCard), dans la
 * version préparée pour sa taille (scripts/resize-tokens.py) : 'table' pour les cartes de la table et de la
 * main, 'zoom' pour la carte agrandie. Le navigateur rendrait flou un pion très détaillé qu'il réduirait
 * lui-même de dix fois.
 */
export const tokenImageUrl = (kind, usage) => `${BASE_URL}tokens/${TOKEN_FILES[kind]}-${usage}.png`

/** Image d'une carte d'état posée sur un personnage (stunned, confused, tough). */
export const statusImageUrl = statusId => `${BASE_URL}status/${statusId}.png`

/** Image d'un pion libre de la table, par sa sorte (PAWN_KINDS ; scripts/resize-tokens.py la prépare). */
export const pawnImageUrl = pawnId => `${BASE_URL}pawns/${PAWN_KIND_BY_ID[pawnId]?.file}`

/** Image de la face A d'une carte, par l'identifiant de sa fiche (miniatures de l'écran Nouvelle partie). */
export function imageUrlOfDefinition(definitionId) {
  const definition = DEFINITION_BY_ID[definitionId]
  if (isImportedDefinition(definition)) return onlineImageUrl(definition) ?? ''
  return `${imageFolderUrl(definition)}/${definitionId}.jpg`
}
