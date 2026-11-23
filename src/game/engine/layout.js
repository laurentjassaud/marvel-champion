// Placement des cartes sur la table : la place fixe de chaque grande carte (méchant, manigance, identité),
// la prochaine place libre d'une carte qui arrive (zone Rencontre au milieu, rangée du héros en bas, cartes
// reçues devant l'identité), et une carte toujours entière sur la table.
//
// La table est vue de dessus : le méchant et ses cartes en haut, le joueur en bas. Toutes les mesures
// sont en pixels et suivent la largeur d'une carte (`layout.cardWidth`) : une carte debout mesure
// cardWidth × 1,4 cardWidth, une carte couchée (manigance) 1,4 cardWidth × cardWidth.
//
// Le bord gauche de la table est occupé par le décor du méchant : son illustration en haut
// (`layout.villainInset`, en pixels depuis le bord gauche) et ses PV en grand en bas (`layout.heroInset` ;
// `layout.villainHud` : {right, top}, le bloc mesuré, posé par-dessus la table). Le méchant et sa manigance
// principale sont en haut, après l'illustration. L'identité est en bas, au milieu de la partie libre de la
// table (entre les PV du méchant et le bord droit : au-dessus de la main) ; la rangée du héros va d'abord vers
// la gauche jusqu'aux PV du méchant, puis à droite de l'identité. Les cartes Rencontre que la table pose
// (révélées, boosts) arrivent dans la zone Rencontre, sous la rangée du méchant, dans la colonne de
// l'identité. Sans ces mesures (tests), au bord de la table.

import { cardsInZone, definitionOf, isEncounterCard, identityCard } from './state.js'
import { pawnSize } from '../data.js'

/** Hauteur d'une carte debout, en largeurs de carte. */
const CARD_RATIO = 1.4
/** Marge à gauche de la table. */
const LEFT_MARGIN = 16
/** Marge à droite de la table. */
const RIGHT_MARGIN = 16
/** Écart entre l'identité et les cartes du héros posées à côté d'elle. */
const IDENTITY_GAP = 24
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
/** Le milieu de la partie libre de la table, entre les PV du méchant et le bord droit (au-dessus de la main). */
const freeCenterX = layout => (heroRowLeft(layout) + layout.width - RIGHT_MARGIN) / 2

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
  /** L'identité du joueur, en bas, au milieu de la partie libre de la table (jamais sur les PV du méchant). */
  identity: layout => ({ x: Math.max(heroRowLeft(layout), Math.round(freeCenterX(layout) - layout.cardWidth / 2)), y: heroRowY(layout) }),
  /** Les Démolisseurs : le méchant n° index en haut de sa colonne… */
  crewVillain: (layout, index) => ({ x: crewColumnX(layout, index), y: TOP_MARGIN }),
  /** … sa manigance annexe (couchée) dessous… */
  crewSideScheme: (layout, index) => ({ x: crewColumnX(layout, index), y: TOP_MARGIN + layout.cardWidth * CARD_RATIO + 10 }),
  /** … et la manigance principale dans une cinquième colonne, à droite. */
  crewMainScheme: layout => ({ x: crewColumnX(layout, 4), y: TOP_MARGIN })
}

/** Taille d'une carte sur la table, avant toute rotation d'inclinaison : {width, height}. */
export function cardSize(card, cardWidth) {
  if (card.isPawn) {
    const [width, height] = pawnSize(card)
    return { width: cardWidth * width, height: cardWidth * height }
  }
  const lyingDown = definitionOf(card).landscape && card.faceUp
  return lyingDown
    ? { width: cardWidth * CARD_RATIO, height: cardWidth }
    : { width: cardWidth, height: cardWidth * CARD_RATIO }
}

/**
 * Les rangées de la zone Rencontre, dans l'ordre où elles se remplissent : {y, startX, leftLimit} (à partir de
 * startX vers la droite, puis vers la gauche tant que leftLimit le permet).
 *   - Sous la rangée du méchant, à partir de la colonne de l'identité, vers la gauche jusqu'à l'illustration
 *     du méchant : une demi-carte plus bas que la rangée du méchant, moins si la table est basse ; une rangée
 *     de plus tant qu'elle reste au-dessus des cartes reçues devant l'identité.
 *   - Puis la rangée du méchant, à droite de la manigance principale (une table trop basse ou trop pleine).
 *   - Puis de nouvelles rangées sous la zone, quoi qu'il arrive.
 * Avec les Démolisseurs : sous leurs colonnes, à partir de la gauche, vers la droite seulement.
 */
function* encounterRows(game, layout) {
  const cardHeight = layout.cardWidth * CARD_RATIO
  const rowHeight = cardHeight + 16
  if (game.crew) {
    for (let y = TOP_MARGIN + layout.cardWidth * 2.4 + 26; ; y += rowHeight) yield { y, startX: villainRowLeft(layout), leftLimit: Infinity }
  }
  const identity = SPOTS.identity(layout)
  const startX = identity.x
  const leftLimit = villainRowLeft(layout)
  // le bas de la zone : 8 px au-dessus des cartes reçues devant l'identité (nextDealtSpot)
  const bottomLimit = identity.y - cardHeight - 12 - 8
  const villainRowBottom = TOP_MARGIN + cardHeight
  const gap = Math.max(8, Math.min(layout.cardWidth * 0.5, bottomLimit - villainRowBottom - cardHeight))
  let y = villainRowBottom + gap
  yield { y, startX, leftLimit }
  for (y += rowHeight; y + cardHeight <= bottomLimit; y += rowHeight) yield { y, startX, leftLimit }
  yield { y: TOP_MARGIN, startX: villainRowLeft(layout) + layout.cardWidth + 20 + cardHeight + 24, leftLimit: Infinity }
  for (; ; y += rowHeight) yield { y, startX, leftLimit }
}

/**
 * Prochaine place libre de la zone Rencontre (encounterRows) : sous la rangée du méchant, à partir de la
 * colonne de l'identité, d'abord vers la droite jusqu'au bord de la table, puis vers la gauche jusqu'à
 * l'illustration du méchant, puis la rangée suivante. Les cartes déjà posées sont comptées dans leur ordre : à
 * droite, chacune prend sa propre largeur (une manigance annexe est couchée) ; à gauche, chaque place est
 * large comme une carte couchée (la carte qui y arrive n'est pas encore connue). La carte qui arrive est
 * comptée large comme une carte couchée, pour toujours tenir.
 * Ne comptent pas : le méchant et les manigances principales (places fixes), les manigances des
 * Démolisseurs (dans leurs colonnes), les cartes reçues devant l'identité (en bas, près du joueur).
 */
export function nextEncounterSpot(game, layout) {
  const hasFixedSpot = card => ['villain', 'main_scheme'].includes(definitionOf(card).type)
    || (game.crew && definitionOf(card).type === 'side_scheme' && game.crew.includes(definitionOf(card).set))
  const rowCards = cardsInZone(game, 'table').filter(card => isEncounterCard(card) && !hasFixedSpot(card) && !card.dealtToPlayer)
  const wideWidth = layout.cardWidth * CARD_RATIO
  const rows = encounterRows(game, layout)
  let row = rows.next().value
  // le bord gauche de la prochaine carte à droite, le bord gauche de la dernière carte à gauche
  let rightX = row.startX
  let leftX = row.startX
  /**
   * Place une carte de cette largeur dans la rangée en cours (ou la suivante) et rend sa place. Qu'elle tienne
   * à droite se décide toujours pour une carte couchée, comme au moment où elle a été posée : une carte
   * debout recomptée ne doit pas trouver à droite une place qu'elle n'avait pas eue (deux cartes au même endroit)
   */
  const place = width => {
    for (;;) {
      if (rightX === row.startX || rightX + wideWidth <= layout.width - 10) {
        const spot = { x: rightX, y: row.y }
        rightX += width + CARD_GAP
        return spot
      }
      if (leftX - CARD_GAP - wideWidth >= row.leftLimit) {
        leftX -= CARD_GAP + wideWidth
        return { x: leftX, y: row.y }
      }
      row = rows.next().value
      rightX = row.startX
      leftX = row.startX
    }
  }
  for (const card of rowCards) place(cardSize(card, layout.cardWidth).width)
  return place(wideWidth)
}

/**
 * Prochaine place libre de la rangée du héros, de part et d'autre de l'identité (posée en bas, au milieu) :
 * d'abord à sa gauche, de droite à gauche jusqu'aux PV du méchant, puis à sa droite, de gauche à droite
 * jusqu'au bord de la table ; puis on remonte d'une rangée, dans le même ordre. Ne comptent pas l'identité,
 * les pions et les cartes glissées sous une manigance.
 */
export function nextHeroSpot(game, layout) {
  const placedCount = cardsInZone(game, 'table')
    .filter(card => !isEncounterCard(card) && !card.isIdentity && !card.isPawn && !card.underSchemeId).length
  const identityX = SPOTS.identity(layout).x
  const step = layout.cardWidth + CARD_GAP
  const leftStartX = identityX - IDENTITY_GAP - layout.cardWidth
  const rightStartX = identityX + layout.cardWidth + IDENTITY_GAP
  const leftCount = Math.max(0, Math.floor((leftStartX - heroRowLeft(layout)) / step) + 1)
  const rightCount = Math.max(0, Math.floor((layout.width - RIGHT_MARGIN - layout.cardWidth - rightStartX) / step) + 1)
  // une table trop étroite pour l'une et l'autre : une carte à gauche de l'identité quand même
  const cardsPerRow = Math.max(1, leftCount + rightCount)
  const index = placedCount % cardsPerRow
  const x = index < leftCount || !rightCount ? leftStartX - index * step : rightStartX + (index - leftCount) * step
  return {
    x: Math.max(0, x),
    y: heroRowY(layout) - Math.floor(placedCount / cardsPerRow) * (layout.cardWidth * CARD_RATIO + 16)
  }
}

/**
 * Place d'une carte Rencontre qu'on vous attribue : devant votre identité (juste au-dessus, côté méchant),
 * où qu'elle ait été déplacée ; les suivantes, reçues avant d'avoir révélé les premières, en éventail vers
 * la gauche.
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
 * coin de cette boîte. Une carte inclinée pivote d'un quart de tour sur son centre : sa boîte a sa hauteur
 * pour largeur, et inversement.
 */
function visibleBox(card, cardWidth) {
  const { width, height } = cardSize(card, cardWidth)
  if (!card.exhausted || card.isPawn) return { width, height, dx: 0, dy: 0 }
  return { width: height, height: width, dx: (width - height) / 2, dy: (height - width) / 2 }
}

/**
 * Garde une carte de la table entière à l'écran (glissée, inclinée, retournée, ou la table redimensionnée) :
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
