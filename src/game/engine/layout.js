// Placement des cartes sur la table : la place fixe de chaque grande carte (méchant, manigance, identité),
// la prochaine place libre d'une carte qui arrive (rangée Rencontre en haut, rangée du héros en bas,
// cartes reçues devant l'identité), et une carte toujours entière sur la table.
//
// La table est vue de dessus : le méchant et ses cartes en haut, le joueur en bas. Toutes les mesures
// sont en pixels et suivent la largeur d'une carte (`layout.cardWidth`) : une carte debout mesure
// cardWidth × 1,4 cardWidth, une carte couchée (manigance) 1,4 cardWidth × cardWidth.
//
// Le bord gauche de la table est occupé par le décor du méchant : son illustration en haut
// (`layout.villainInset`, en pixels depuis le bord gauche) et ses PV en grand en bas (`layout.heroInset` ;
// `layout.villainHud` : {right, top}, le bloc mesuré, posé par-dessus la table). La rangée du méchant
// commence après l'illustration ; l'identité est en bas à droite, au-dessus de vos PV, et la rangée du
// héros va vers la gauche jusqu'aux PV du méchant. Sans ces mesures (tests), au bord de la table.

import { cardsInZone, definitionOf, isEncounterCard, identityCard } from './state.js'

/** Hauteur d'une carte debout, en largeurs de carte. */
const CARD_RATIO = 1.4
/** Marge à gauche de la table. */
const LEFT_MARGIN = 16
/** Marge à droite de la table (l'identité y est posée). */
const RIGHT_MARGIN = 16
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
/** Hauteur de la rangée du héros : celle de l'identité, au bas de la table. */
const heroRowY = layout => layout.height - layout.cardWidth * CARD_RATIO - BOTTOM_MARGIN

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
  /** L'identité du joueur, en bas à droite, au-dessus de vos PV (jamais sur les PV du méchant). */
  identity: layout => ({ x: Math.max(heroRowLeft(layout), layout.width - layout.cardWidth - RIGHT_MARGIN), y: heroRowY(layout) }),
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
 * Prochaine place libre de la rangée du héros : à gauche de l'identité (posée en bas à droite), de droite
 * à gauche jusqu'aux PV du méchant, puis en remontant d'une rangée quand elle est pleine. Ne comptent pas
 * l'identité, les pions et les cartes glissées sous une manigance.
 */
export function nextHeroSpot(game, layout) {
  const placedCount = cardsInZone(game, 'table')
    .filter(card => !isEncounterCard(card) && !card.isIdentity && !card.isPawn && !card.underSchemeId).length
  const rowStartX = SPOTS.identity(layout).x - 24 - layout.cardWidth
  const step = layout.cardWidth + CARD_GAP
  const cardsPerRow = Math.max(1, Math.floor((rowStartX - heroRowLeft(layout)) / step) + 1)
  return {
    x: Math.max(0, rowStartX - (placedCount % cardsPerRow) * step),
    y: heroRowY(layout) - Math.floor(placedCount / cardsPerRow) * (layout.cardWidth * CARD_RATIO + 16)
  }
}

/**
 * Place d'une carte Rencontre qu'on vous attribue : devant votre identité (juste au-dessus, côté méchant),
 * où qu'elle ait été déplacée ; les suivantes, reçues avant d'avoir révélé les premières, en éventail vers
 * la gauche (l'identité est au bord droit de la table).
 */
export function nextDealtSpot(game, layout) {
  const identity = identityCard(game)
  const anchor = identity?.zone === 'table' ? identity : SPOTS.identity(layout)
  const waitingCount = cardsInZone(game, 'table').filter(card => card.dealtToPlayer && !card.faceUp).length
  return {
    x: Math.max(0, Math.min(anchor.x - waitingCount * layout.cardWidth * 0.35, layout.width - layout.cardWidth - 4)),
    y: Math.max(0, anchor.y - layout.cardWidth * CARD_RATIO - 12)
  }
}

/** Écart minimal entre une carte et le bord de la table (ou les PV du méchant). */
const EDGE_GAP = 4

/**
 * Ce qu'une carte de la table occupe à l'écran : la taille de sa boîte, et (dx, dy), de son coin (x, y) au
 * coin de cette boîte. Une carte épuisée pivote d'un quart de tour sur son centre : sa boîte a sa hauteur
 * pour largeur, et inversement.
 */
function visibleBox(card, cardWidth) {
  const { width, height } = cardSize(card, cardWidth)
  if (!card.exhausted || card.isPawn) return { width, height, dx: 0, dy: 0 }
  return { width: height, height: width, dx: (width - height) / 2, dy: (height - width) / 2 }
}

/**
 * Garde une carte de la table entière à l'écran (glissée, épuisée, retournée, ou la table redimensionnée) :
 * ramenée dans la table si elle en dépasse, et remontée au-dessus des PV du méchant, posés par-dessus la
 * table en bas à gauche (`layout.villainHud`), si elle passe dessous.
 */
export function keepCardOnTable(card, layout) {
  if (card.zone !== 'table') return
  const box = visibleBox(card, layout.cardWidth)
  const left = Math.max(0, Math.min(card.x + box.dx, layout.width - box.width - EDGE_GAP))
  let top = Math.max(0, Math.min(card.y + box.dy, layout.height - box.height - EDGE_GAP))
  const hud = layout.villainHud
  if (hud && left < hud.right && top + box.height > hud.top) top = Math.max(0, hud.top - box.height - EDGE_GAP)
  card.x = left - box.dx
  card.y = top - box.dy
}

/** Ramène sur la table toute carte qui en dépasse, après un redimensionnement. */
export function keepCardsOnTable(game, layout) {
  for (const card of cardsInZone(game, 'table')) keepCardOnTable(card, layout)
}
