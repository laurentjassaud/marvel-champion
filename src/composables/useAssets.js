// Adresses des images : la face d'une carte (et ses faces B et C), le dos des cartes, les cartes d'état.

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

/** Image d'une carte d'état posée sur un personnage (stunned, confused, tough). */
export const statusImageUrl = statusId => `${BASE_URL}status/${statusId}.png`

/** Image de la face A d'une carte, par l'identifiant de sa fiche (miniatures de l'écran Nouvelle partie). */
export function imageUrlOfDefinition(definitionId) {
  const definition = DEFINITION_BY_ID[definitionId]
  return isImportedDefinition(definition) ? definition.imageUrl ?? '' : `${imageFolderUrl(definition)}/${definitionId}.jpg`
}
