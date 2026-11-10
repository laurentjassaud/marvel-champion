// Partie enregistrée dans le navigateur : sa version, et la mise à jour d'une partie enregistrée par une
// ancienne version de la table (clés courtes : g, o, dmg, opt…) vers le format actuel (noms lisibles).
// Pure, sans Vue ni stockage : le store lit et écrit, ce module ne fait que convertir.

import { PRECON_DECKS } from './data.js'

/** Version du format d'une partie enregistrée ; une partie sans version vient de l'ancien format. */
export const SAVED_GAME_VERSION = 2

/** Anciennes zones → zones actuelles. */
const OLD_ZONES = {
  deck: 'playerDeck', discard: 'playerDiscard', hand: 'hand', table: 'table',
  edeck: 'encounterDeck', ediscard: 'encounterDiscard', aside: 'setAside',
  ideck: 'invocationDeck', idiscard: 'invocationDiscard', xdeck: 'scenarioDeck', removed: 'outOfGame'
}

/** Ancien champ d'une carte → champ actuel (les autres champs gardent leur nom : id, zone, side, faceUp, x, y…). */
const OLD_CARD_FIELDS = {
  g: 'definitionId', o: 'owner', tapped: 'exhausted', z: 'zIndex', dmg: 'damage', thr: 'threat', tok: 'tokens',
  hero: 'isIdentity', under: 'underSchemeId', dealt: 'dealtToPlayer', boost: 'isBoost'
}

/** Une carte (ou un pion) de l'ancien format, au format actuel. */
function migrateCard(oldCard) {
  const card = {}
  for (const [key, value] of Object.entries(oldCard)) {
    if (key === 'kind') continue // kind: 'token' devient isPawn, plus bas
    card[OLD_CARD_FIELDS[key] ?? key] = value
  }
  if (oldCard.kind === 'token') card.isPawn = true
  if (card.owner === 'p') card.owner = 'player'
  if (card.owner === 'e') card.owner = 'encounter'
  card.zone = OLD_ZONES[card.zone] ?? card.zone
  return card
}

/** Une partie de l'ancien format, au format actuel ; une partie déjà à jour est rendue telle quelle. */
export function migrateSavedGame(saved) {
  if (!saved || saved.version >= SAVED_GAME_VERSION) return saved
  const oldSetup = saved.opt ?? {}
  const game = {
    version: SAVED_GAME_VERSION,
    cards: (saved.cards ?? []).map(migrateCard),
    log: (saved.log ?? []).map(entry => ({ time: entry.t, text: entry.msg, important: !!entry.sys })),
    counters: (saved.counters ?? []).map(counter => ({ label: counter.l, value: counter.v, color: counter.c })),
    setup: {
      hero: oldSetup.hero,
      // une partie enregistrée avant que la liste du deck soit gardée rejoue le précon du héros
      deckList: oldSetup.list ?? PRECON_DECKS[oldSetup.hero] ?? [],
      scenario: oldSetup.villain,
      modulars: [].concat(oldSetup.modular ?? []),
      expert: !!oldSetup.expert,
      deckLabel: oldSetup.label,
      randomChoices: oldSetup.drawn ?? [],
      ...(oldSetup.defs ? { importedDefinitions: oldSetup.defs } : {})
    },
    // les parties enregistrées avant les rounds et les phases sont au round 1, en phase du héros
    turn: saved.turn ?? 1,
    phase: saved.phase ?? 'hero',
    accelerationTokens: saved.accel ?? 0,
    mulliganTaken: !!saved.mull,
    topZIndex: saved.zTop ?? 10
  }
  if (saved.setupCard) game.setupCardId = saved.setupCard
  if (saved.crew) game.crew = saved.crew
  if (saved.active) game.activeVillainSet = saved.active
  if (saved.pending) {
    const { from, left, ...rest } = saved.pending
    game.pendingStageChange = { ...rest, fromVillainId: from, ...(left ? { stageLeft: left } : {}) }
  }
  return game
}
