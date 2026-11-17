// Adresses des images : la face d'une carte (et ses faces B et C), le dos des cartes, les cartes d'état,
// le décor de la table (la ville de nuit, l'illustration du méchant).

import { definitionOf, isEncounterCard } from '../game/engine.js'
import { DEFINITION_BY_ID } from '../game/data.js'

/** Racine du site : './' par défaut (version installable et version artefact), ou le chemin de déploiement. */
const BASE_URL = import.meta.env.BASE_URL

/** Dossier des images d'une boîte, sous cards/ (encodé : « bouffon vert » contient une espace). */
const imageFolderUrl = definition => `${BASE_URL}cards/${encodeURIComponent(definition?.imageFolder ?? 'base')}`

/** Carte lue sur MarvelCDB : elle a l'image du site (null si le site n'en a pas). */
const isImportedDefinition = definition => definition?.pack === 'marvelcdb'

/**
 * Image de la face en jeu d'une carte : "<id>.jpg" pour la face A, "<id>.b.jpg" pour la face B (verso
 * d'une carte double), "<id>.c.jpg" pour la troisième face d'une identité (La Guêpe Géant) ; null s'il
 * n'y en a pas. Une face que la carte n'a pas donne l'image de sa face A.
 */
export function cardImageUrl(card) {
  const definition = definitionOf(card)
  let sideSuffix = ''
  if (card.side === 2 && definition.thirdName) sideSuffix = 'c'
  else if (card.side && definition.backName) sideSuffix = 'b'
  if (isImportedDefinition(definition)) return (sideSuffix === 'b' ? definition.backImageUrl : definition.imageUrl) ?? null
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
 * 694 × 923 px, détourée en biais sur sa droite (maquette) ; les autres méchants n'en ont pas encore.
 */
const VILLAIN_ART_FILES = { rhino: 'villains/rhino.png', klaw: 'villains/klaw.png', ultron: 'villains/ultron.png' }

/** Le fond de la table (maquette) : une ville de nuit vue d'en bas, 1672 × 941 px. */
export const CITY_BACKGROUND_URL = `${BASE_URL}backgrounds/ville-nuit.png`

/**
 * La page d'accueil (maquette « accueil ») : le ciel étoilé en vidéo, la ville vue d'en bas (1672 × 941 px :
 * au fond, puis ses immeubles au premier plan, le ciel transparent) et les héros autour du menu.
 */
export const INTRO_SKY_URL = `${BASE_URL}intro/ciel-etoile.mp4`
export const INTRO_CITY_URL = `${BASE_URL}intro/ville.png`
export const INTRO_FOREGROUND_URL = `${BASE_URL}intro/premier-plan.png`
/** Un héros de la page d'accueil, par son nom de fichier ('spider-man'). */
export const introHeroUrl = heroId => `${BASE_URL}intro/${heroId}.png`

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

/** Image de la face A d'une carte, par l'identifiant de sa fiche (miniatures de l'écran Nouvelle partie). */
export function imageUrlOfDefinition(definitionId) {
  const definition = DEFINITION_BY_ID[definitionId]
  return isImportedDefinition(definition) ? definition.imageUrl ?? '' : `${imageFolderUrl(definition)}/${definitionId}.jpg`
}
