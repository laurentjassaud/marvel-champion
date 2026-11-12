// Placement des cartes sur la table : la place fixe de chaque grande carte (méchant, manigance, identité),
// et la prochaine place libre d'une carte qui arrive (rangée Rencontre en haut, rangée du héros en bas,
// cartes reçues devant l'identité).
//
// La table est vue de dessus : le méchant et ses cartes en haut, le joueur en bas. Toutes les mesures
// sont en pixels et suivent la largeur d'une carte (`layout.cardWidth`) : une carte debout mesure
// cardWidth × 1,4 cardWidth, une carte couchée (manigance) 1,4 cardWidth × cardWidth.
//
// Le bord gauche de la table est occupé par le décor du méchant : son illustration en haut
// (`layout.villainInset`, en pixels depuis le bord gauche) et ses PV en grand en bas (`layout.heroInset`).
// Les rangées du méchant et du héros commencent après eux ; sans ces mesures (tests), au bord de la table.

import { cardsInZone, definitionOf, isEncounterCard, identityCard } from './state.js'

/** Hauteur d'une carte debout, en largeurs de carte. */
const CARD_RATIO = 1.4
/** Marge à gauche de la table. */
const LEFT_MARGIN = 16
/** Marge en haut de la table (sous la barre du haut, dont le titre déborde un peu). */
const TOP_MARGIN = 34
/** Marge en bas de la table (au-dessus de la main en éventail). */
const BOTTOM_MARGIN = 34
/** Écart horizontal entre deux cartes d'une rangée. */
const CARD_GAP = 12

/** Disposition prise quand l'appelant n'en donne pas (tests, anciens appels) : une table moyenne, sans décor. */
export const DEFAULT_LAYOUT = { width: 1100, height: 600, cardWidth: 80, villainInset: 0, heroInset: 0 }

/** Bord gauche de la rangée du méchant : après l'illustration du méchant. */
const villainRowLeft = layout => LEFT_MARGIN + (layout.villainInset ?? 0)
/** Bord gauche de la rangée du héros : après les PV du méchant affichés en grand. */
const heroRowLeft = layout => LEFT_MARGIN + (layout.heroInset ?? 0)

/** Abscisse de la colonne n° `index` des Démolisseurs : une colonne par méchant, large comme une manigance couchée. */
const crewColumnX = (layout, index) => villainRowLeft(layout) + index * (layout.cardWidth * CARD_RATIO + CARD_GAP)

/** Places fixes des grandes cartes : chaque fonction rend {x, y}. */
export const SPOTS = {
  /** Le méchant, en haut à gauche (après son illustration). */
  villain: layout => ({ x: villainRowLeft(layout), y: TOP_MARGIN }),
  /** La manigance principale, à droite du méchant. */
  mainScheme: layout => ({ x: villainRowLeft(layout) + layout.cardWidth + 20, y: TOP_MARGIN }),
  /** Kang : Le Maître du Temps attend sous la manigance principale pendant le stade 3. */
  masterOfTime: layout => ({ x: villainRowLeft(layout) + layout.cardWidth + 20, y: TOP_MARGIN + layout.cardWidth + 14 }),
  /** L'identité du joueur, en bas à gauche (après les PV du méchant). */
  identity: layout => ({ x: heroRowLeft(layout), y: layout.height - layout.cardWidth * CARD_RATIO - BOTTOM_MARGIN }),
  /** Les Démolisseurs : le méchant n° index en haut de sa colonne… */
  crewVillain: (layout, index) => ({ x: crewColumnX(layout, index), y: TOP_MARGIN }),
  /** … sa manigance annexe (couchée) dessous… */
  crewSideScheme: (layout, index) => ({ x: crewColumnX(layout, index), y: TOP_MARGIN + layout.cardWidth * CARD_RATIO + 10 }),
  /** … et la manigance principale dans une cinquième colonne, à droite. */
  crewMainScheme: layout => ({ x: crewColumnX(layout, 4), y: TOP_MARGIN })
}

/** Taille d'une carte sur la table, avant toute rotation d'épuisement : {width, height}. */
export function cardSize(card, cardWidth) {
  if (card.isPawn) return { width: cardWidth * 0.4, height: cardWidth * 0.4 }
  const lyingDown = definitionOf(card).landscape && card.faceUp
  return lyingDown
    ? { width: cardWidth * CARD_RATIO, height: cardWidth }
    : { width: cardWidth, height: cardWidth * CARD_RATIO }
}

/**
 * Prochaine place libre de la rangée Rencontre : à droite du méchant et de la manigance principale (sous
 * les quatre colonnes des Démolisseurs), après les cartes Rencontre déjà posées — chacune prend sa propre
 * largeur, une manigance annexe étant couchée —, et une nouvelle rangée quand la table est pleine. La
 * carte qui arrive est comptée large comme une carte couchée, pour toujours tenir.
 * Ne comptent pas : le méchant et les manigances principales (places fixes), les manigances des
 * Démolisseurs (dans leurs colonnes), les cartes reçues devant l'identité (en bas, près du joueur).
 */
export function nextEncounterSpot(game, layout) {
  const hasFixedSpot = card => ['villain', 'main_scheme'].includes(definitionOf(card).type)
    || (game.crew && definitionOf(card).type === 'side_scheme' && game.crew.includes(definitionOf(card).set))
  const rowCards = cardsInZone(game, 'table').filter(card => isEncounterCard(card) && !hasFixedSpot(card) && !card.dealtToPlayer)
  const rowStartX = villainRowLeft(layout) + (game.crew ? 0 : layout.cardWidth + 20 + layout.cardWidth * CARD_RATIO + 24)
  const rowHeight = layout.cardWidth * CARD_RATIO + 16
  let x = rowStartX
  let y = game.crew ? TOP_MARGIN + layout.cardWidth * 2.4 + 26 : TOP_MARGIN
  // passe à la rangée suivante si une carte de cette largeur dépasse le bord droit
  const wrapIfNeeded = width => {
    if (x > rowStartX && x + width > layout.width - 10) { x = rowStartX; y += rowHeight }
  }
  for (const card of rowCards) {
    const { width } = cardSize(card, layout.cardWidth)
    wrapIfNeeded(width)
    x += width + CARD_GAP
  }
  wrapIfNeeded(layout.cardWidth * CARD_RATIO)
  return { x, y }
}

/**
 * Prochaine place libre de la rangée du héros : à droite de l'identité, de gauche à droite, puis en
 * remontant d'une rangée quand la table est pleine. Ne comptent pas l'identité, les pions et les cartes
 * glissées sous une manigance.
 */
export function nextHeroSpot(game, layout) {
  const placedCount = cardsInZone(game, 'table')
    .filter(card => !isEncounterCard(card) && !card.isIdentity && !card.isPawn && !card.underSchemeId).length
  const rowStartX = heroRowLeft(layout) + layout.cardWidth + 24
  const step = layout.cardWidth + CARD_GAP
  const cardsPerRow = Math.max(1, Math.floor((layout.width - rowStartX - 10) / step))
  const bottomRowY = layout.height - layout.cardWidth * CARD_RATIO - BOTTOM_MARGIN
  return {
    x: rowStartX + (placedCount % cardsPerRow) * step,
    y: bottomRowY - Math.floor(placedCount / cardsPerRow) * (layout.cardWidth * CARD_RATIO + 16)
  }
}

/**
 * Place d'une carte Rencontre qu'on vous attribue : devant votre identité (juste au-dessus, côté méchant),
 * où qu'elle ait été déplacée ; les suivantes, reçues avant d'avoir révélé les premières, en éventail vers
 * la droite.
 */
export function nextDealtSpot(game, layout) {
  const identity = identityCard(game)
  const anchor = identity?.zone === 'table' ? identity : SPOTS.identity(layout)
  const waitingCount = cardsInZone(game, 'table').filter(card => card.dealtToPlayer && !card.faceUp).length
  return {
    x: Math.max(0, Math.min(anchor.x + waitingCount * layout.cardWidth * 0.35, layout.width - layout.cardWidth - 4)),
    y: Math.max(0, anchor.y - layout.cardWidth * CARD_RATIO - 12)
  }
}

/** Ramène sur la table toute carte qui en dépasse, après un redimensionnement. */
export function keepCardsOnTable(game, layout) {
  for (const card of cardsInZone(game, 'table')) {
    const { width, height } = cardSize(card, layout.cardWidth)
    card.x = Math.max(0, Math.min(card.x, layout.width - width - 4))
    card.y = Math.max(0, Math.min(card.y, layout.height - height - 4))
  }
}
