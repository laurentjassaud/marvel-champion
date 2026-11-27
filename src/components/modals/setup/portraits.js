// Les portraits de la fenêtre « Préparation de la partie » : un carré découpé dans l'illustration d'une carte
// (la carte d'identité d'un héros, la première étape d'un méchant, la manigance annexe d'un set modulaire),
// montré dans les vignettes à choisir et dans les hexagones une fois le choix fait.
import { CARD_DEFINITIONS } from '../../../game/data.js'
import { imageUrlOfDefinition, cgbuilderImageUrl } from '../../../composables/useAssets.js'

/**
 * Le carré gardé de chaque illustration : [gauche, haut, côté], en fractions de la largeur de la carte (une
 * carte debout fait 394 × 560 px, une manigance couchée 560 × 394). Réglés à l'œil sur les scans de la boîte
 * de base et des paquets héros proposés ; un set absent d'ici prend DEFAULT_CROP.
 */
const CROPS = {
  spider_man: [0.24, 0.2, 0.42],
  captain_marvel: [0.3, 0.24, 0.38],
  she_hulk: [0.3, 0.18, 0.4],
  iron_man: [0.38, 0.17, 0.4],
  black_panther: [0.38, 0.3, 0.4],
  captain_america: [0.22, 0.16, 0.42],
  hulk: [0.25, 0.18, 0.45],
  thor: [0.42, 0.15, 0.42],
  rhino: [0.25, 0.15, 0.45],
  klaw: [0.48, 0.15, 0.42],
  ultron: [0.28, 0.17, 0.42],
  bomb_scare: [0, 0.08, 0.32],
  masters_of_evil: [0.05, 0.06, 0.3],
  under_attack: [0, 0.12, 0.32],
  legions_of_hydra: [0, 0.08, 0.32],
  the_doomsday_chair: [0.06, 0, 0.3],
  // Le Bouffon Vert : Norman Osborn, le Bouffon Vert ; le Planeur du Bouffon (Gadgets du Bouffon n'a ni
  // manigance ni sbire), Scorpion, Electro et Tombstone sur leur manigance annexe
  risky_business: [0.39, 0.13, 0.38],
  mutagen_formula: [0.43, 0.14, 0.4],
  goblin_gimmicks: [0.25, 0, 0.45],
  a_mess_of_things: [0.14, 0.1, 0.28],
  power_drain: [0.05, 0.03, 0.3],
  running_interference: [0.08, 0, 0.3],
  // fan-made : Kraven le Chasseur (I) ; le Vautour et King Cobra sur la manigance Les Savage Six
  kraven: [0.4, 0.13, 0.42],
  savage_six: [0, 0.13, 0.42],
  // héros lus sur MarvelCDB (decks importés), réglés sur le scan français de cgbuilder : Tornade
  storm: [0.5, 0.15, 0.36]
}
/** Carte debout sans réglage : le haut de l'illustration, sous le bandeau du nom. */
const DEFAULT_CROP = [0.2, 0.16, 0.6]

/**
 * La carte dont l'illustration représente ce set : identité, méchant (étape I), ou pour un set modulaire sa
 * manigance annexe, sinon son sbire, sinon son attachement ou sa traîtrise (Gadgets du Bouffon).
 */
const PORTRAIT_TYPES = { hero: ['hero'], villain: ['villain'], modular: ['side_scheme', 'minion', 'attachment', 'treachery'] }
function portraitCard(kind, setId) {
  for (const type of PORTRAIT_TYPES[kind]) {
    // la première des fiches ; pour un héros, la première par code : la version 1 d'Ironheart, dont les trois
    // identités ont le même set
    const candidates = CARD_DEFINITIONS.filter(candidate => candidate.type === type && candidate.set === setId)
    if (kind === 'hero') candidates.sort((first, second) => String(first.code).localeCompare(String(second.code)))
    const [definition] = candidates
    if (definition) return definition
  }
  return null
}

/**
 * {imageUrl, crop} du portrait d'un héros, d'un scénario ou d'un set modulaire (kind : hero, villain, modular).
 * Un héros dont la table n'a pas encore la carte (un précon à lire en ligne, game/precons.js) : `code`, celui de
 * son identité sur MarvelCDB, donne son scan français chez cgbuilder, sinon le scan anglais de MarvelCDB.
 */
export function portraitOf(kind, setId, code = null) {
  const definition = portraitCard(kind, setId)
  let imageUrl = definition ? imageUrlOfDefinition(definition.id) : ''
  if (!imageUrl && code) imageUrl = cgbuilderImageUrl(code) ?? `https://marvelcdb.com/bundles/cards/${code}.png`
  return { imageUrl, crop: CROPS[setId] ?? DEFAULT_CROP }
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
