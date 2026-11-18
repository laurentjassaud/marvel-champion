// Les portraits de la fenêtre « Préparation de la partie » : un carré découpé dans l'illustration d'une carte
// (la carte d'identité d'un héros, la première étape d'un méchant, la manigance annexe d'un set modulaire),
// montré dans les vignettes à choisir et dans les hexagones une fois le choix fait.
import { CARD_DEFINITIONS } from '../../../game/data.js'
import { imageUrlOfDefinition } from '../../../composables/useAssets.js'

/**
 * Le carré gardé de chaque illustration : [gauche, haut, côté], en fractions de la largeur de la carte (une
 * carte debout fait 394 × 560 px, une manigance couchée 560 × 394). Réglés à l'œil sur les scans de la boîte
 * de base ; un set absent d'ici prend DEFAULT_CROP.
 */
const CROPS = {
  spider_man: [0.24, 0.2, 0.42],
  captain_marvel: [0.3, 0.24, 0.38],
  she_hulk: [0.3, 0.18, 0.4],
  iron_man: [0.38, 0.17, 0.4],
  black_panther: [0.38, 0.3, 0.4],
  rhino: [0.25, 0.15, 0.45],
  klaw: [0.48, 0.15, 0.42],
  ultron: [0.28, 0.17, 0.42],
  bomb_scare: [0, 0.08, 0.32],
  masters_of_evil: [0.05, 0.06, 0.3],
  under_attack: [0, 0.12, 0.32],
  legions_of_hydra: [0, 0.08, 0.32],
  the_doomsday_chair: [0.06, 0, 0.3]
}
/** Carte debout sans réglage : le haut de l'illustration, sous le bandeau du nom. */
const DEFAULT_CROP = [0.2, 0.16, 0.6]

/** La carte dont l'illustration représente ce set : identité, méchant (étape I) ou manigance annexe. */
const PORTRAIT_TYPES = { hero: ['hero'], villain: ['villain'], modular: ['side_scheme', 'minion'] }
function portraitCard(kind, setId) {
  for (const type of PORTRAIT_TYPES[kind]) {
    const definition = CARD_DEFINITIONS.find(candidate => candidate.type === type && candidate.set === setId)
    if (definition) return definition
  }
  return null
}

/** {imageUrl, crop} du portrait d'un héros, d'un scénario ou d'un set modulaire (kind : hero, villain, modular). */
export function portraitOf(kind, setId) {
  const definition = portraitCard(kind, setId)
  return { imageUrl: definition ? imageUrlOfDefinition(definition.id) : '', crop: CROPS[setId] ?? DEFAULT_CROP }
}

/**
 * Style de l'image dans un cadre carré (overflow: hidden) pour n'en montrer que le carré `crop` : l'image
 * est agrandie et décalée, en pourcentages du cadre, qui suivent sa taille.
 */
export function cropStyle([left, top, side]) {
  return {
    width: `${100 / side}%`,
    left: `${(-100 * left) / side}%`,
    top: `${(-100 * top) / side}%`
  }
}
