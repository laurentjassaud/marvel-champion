// Store de la partie : l'état de la partie en cours (réactif, enregistré dans le navigateur) et les actions
// des écrans. Chaque action est une mince enveloppe autour d'une fonction du moteur de règles
// (src/game/engine.js), à qui elle passe l'état et la disposition actuelle de la table.

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import * as Engine from '../game/engine.js'
import { PRECON_DECKS, SCENARIOS, DEFINITION_BY_ID, addImportedDefinitions, heroName } from '../game/data.js'
import { migrateSavedGame } from '../game/savedGame.js'
import { useUiStore } from './ui.js'

/** Clé de la partie enregistrée dans le navigateur (gardée telle quelle pour retrouver les anciennes parties). */
const SAVED_GAME_KEY = 'mc-table-vue-v1'

/** Relit la partie enregistrée, mise au format actuel ; null s'il n'y en a pas ou si elle est illisible. */
function loadSavedGame() {
  try {
    const saved = migrateSavedGame(JSON.parse(localStorage.getItem(SAVED_GAME_KEY)))
    if (!(saved?.cards?.length && saved.counters?.length === 3)) return null
    addImportedDefinitions(saved.setup?.importedDefinitions) // cartes lues sur MarvelCDB avec un deck importé
    return saved
  } catch {
    return null
  }
}

export const useGameStore = defineStore('game', () => {
  const ui = useUiStore()
  /** L'état de la partie en cours (voir engine/state.js), ou null avant la première partie. */
  const game = ref(loadSavedGame())

  // enregistrement dans le navigateur, un quart de seconde après le dernier changement
  let saveTimer
  watch(game, () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(game.value)) } catch { /* stockage plein ou navigation privée */ }
    }, 250)
  }, { deep: true })

  /* ---------- lecture de l'état ---------- */

  /** Une partie est en cours. */
  const isReady = computed(() => !!game.value?.cards?.length)
  /** Les cartes d'une zone. */
  const cardsIn = zone => (game.value ? Engine.cardsInZone(game.value, zone) : [])
  /** Une pile telle qu'elle est montrée : avec les Démolisseurs, les piles Rencontre sont celles du méchant actif. */
  const pileOf = zone => (game.value && ['encounterDeck', 'encounterDiscard'].includes(zone) ? Engine.encounterPile(game.value, zone) : cardsIn(zone))
  /** La carte qui porte cet identifiant, ou null. */
  const cardById = cardId => (game.value && cardId ? Engine.cardById(game.value, cardId) : null)
  /** Docteur Strange : le deck Invocation et sa défausse s'affichent à côté des piles du joueur. */
  const hasInvocationDeck = computed(() => !!game.value?.cards.some(Engine.isInvocationCard))
  /** Le deck propre au scénario (Armes Expérimentales, Manigance Annexe), à côté des piles Rencontre, ou null. */
  const scenarioDeck = computed(() => (game.value ? Engine.scenarioDeckOf(game.value) : null))
  const turn = computed(() => game.value?.turn ?? 1)
  const phase = computed(() => game.value?.phase ?? 'hero')
  /**
   * L'affiche de la partie, pour la barre du haut : {hero, villain, expert} ("Spider-Man", "Rhino II", true).
   * Le méchant est celui en cours, avec son étape (le nom de son compteur) ; Les Démolisseurs, à quatre,
   * gardent le nom du scénario. Une difficulté tirée au hasard n'est pas dévoilée. null sans partie.
   */
  const matchup = computed(() => {
    const setup = game.value?.setup
    if (!setup) return null
    const scenario = SCENARIOS.find(candidate => candidate.id === setup.scenario)
    const currentVillain = game.value.crew ? null : game.value.counters?.[1]?.label
    return { hero: heroName(setup.hero), villain: currentVillain || scenario?.villainName || '', expert: !!setup.expert && !setup.randomChoices?.includes('expert') }
  })
  /** La même affiche en une phrase : "Spider-Man contre Rhino · expert". */
  const subtitle = computed(() => {
    if (!matchup.value) return 'Table solo'
    const { hero, villain, expert } = matchup.value
    return `${hero} contre ${villain}${expert ? ' · expert' : ''}`
  })
  /** La manigance principale qui porte le compteur de menace (son pion de menace en montre la valeur), ou null. */
  const threatSchemeId = computed(() => (game.value ? Engine.threatCounterScheme(game.value)?.id ?? null : null))
  /** Le mulligan se fait une seule fois, pendant la phase du héros du round 1. */
  const canMulligan = computed(() => !!game.value && !game.value.mulliganTaken && turn.value === 1 && phase.value === 'hero')

  /* ---------- outils ---------- */

  /** Appelle une fonction du moteur avec l'état de la partie, puis les autres arguments ; rien sans partie. */
  const run = (engineFunction, ...args) => (game.value ? engineFunction(game.value, ...args) : undefined)
  /** Appelle `action` avec la carte de cet identifiant, si elle existe. */
  const withCard = (cardId, action) => {
    const card = cardById(cardId)
    if (card) action(card)
  }
  /** La disposition actuelle de la table (le décor du méchant dépend du scénario en cours). */
  const layout = () => ui.layout(game.value?.setup?.scenario)

  /**
   * L'état de la partie juste avant le changement présenté par la fenêtre ouverte (étape du méchant,
   * manigance, victoire, défaite, héros battu), en texte JSON : le bouton « Annuler » de la fenêtre le remet en place.
   * Gardé hors de l'état réactif : ce n'est pas une partie, et il n'est pas enregistré.
   */
  let stateBeforeChange = null
  /**
   * Lance une action du moteur qui peut changer d'étape (dégâts au méchant, menace sur la manigance, fin de
   * phase) ; si elle a rendu un changement, il est présenté dans sa fenêtre, avec la possibilité de
   * l'annuler. Rend ce qu'a rendu l'action.
   */
  function runAndPresentChange(action) {
    const before = game.value ? JSON.stringify(game.value) : null
    const result = action()
    if (result && result !== true) {
      stateBeforeChange = before
      // la manigance principale achevée et le héros battu ont leur propre fenêtre ; le reste (étapes, Kang,
      // victoire) celle du méchant
      let modalType = 'villain'
      if (String(result.kind).startsWith('scheme')) modalType = 'scheme'
      else if (result.kind === 'heroDefeat') modalType = 'defeat'
      ui.openModal(modalType, { result })
    }
    return result
  }
  /** « Annuler » d'une fenêtre de changement : la partie revient à l'état d'avant l'action qui l'a ouverte. */
  function cancelPresentedChange() {
    if (stateBeforeChange) {
      game.value = JSON.parse(stateBeforeChange)
      Engine.logMessage(game.value, 'Changement annulé : la partie revient à l\'état d\'avant.', true)
    }
    stateBeforeChange = null
    ui.closeModal()
  }
  /** Ajoute un message en tête du journal, à l'heure du premier message. */
  const prependLog = text => game.value.log.unshift({ time: game.value.log[0].time, text, important: true })

  /* ---------- parties ---------- */

  /** Commence une nouvelle partie (options : voir engine/setup.js newGame) et vide la sélection. */
  function newGame(options) {
    // le décor du méchant de la nouvelle partie, pas celui de la partie qu'elle remplace
    game.value = Engine.newGame(options, ui.layout(options.scenario))
    ui.selectCard(null)
    ui.preview = null
    ui.randomlyPickedCardId = null
  }

  /**
   * Recommence avec la même mise en place : même héros et même deck, même scénario (un set modulaire ou une
   * difficulté tirés au hasard restent ceux qui ont été tirés), paquets mélangés à nouveau.
   */
  function restartGame() {
    const setup = game.value.setup
    newGame({
      hero: setup.hero, deckList: setup.deckList, scenario: setup.scenario, modulars: setup.modulars, expert: setup.expert,
      deckLabel: setup.deckLabel, randomChoices: setup.randomChoices, importedDefinitions: setup.importedDefinitions
    })
    prependLog('Partie recommencée avec la même mise en place.')
  }

  /**
   * Paquet vide au moment de piocher ou de révéler : il ne se reconstitue pas tout seul, la fenêtre
   * « Remélanger » s'ouvre (avec la pénalité du paquet vide) si la défausse a des cartes et qu'aucune autre
   * fenêtre n'est ouverte. Après le remélange, elle fait ce qui avait été demandé : `thenDraw` cartes à
   * piocher, ou `thenEncounter`, l'action Rencontre à refaire (nom d'une action du store).
   */
  function offerReshuffle(discardZone, { thenDraw = 0, thenEncounter = null } = {}) {
    if (!pileOf(discardZone).length || ui.modal) return
    ui.openModal('reshuffle', { zone: discardZone, thenDraw, thenEncounter })
  }

  /** La partie d'exemple du premier lancement : Spider-Man contre Rhino. */
  function startExampleGame() {
    newGame({ hero: 'spider_man', deckList: PRECON_DECKS.spider_man, scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'précon Justice' })
    prependLog('Bienvenue. Une partie d\'exemple est prête : Spider-Man contre Rhino. « Nouvelle partie » pour changer de héros ou de méchant.')
  }

  return {
    game, isReady, cardsIn, pileOf, cardById, hasInvocationDeck, scenarioDeck, turn, phase, matchup, subtitle, canMulligan, threatSchemeId,
    newGame, startExampleGame, restartGame,
    preconDeck: heroId => PRECON_DECKS[heroId],
    parseDeckFile: Engine.parseDeckFile,
    /** La carte fait partie des boîtes de la table (ou a déjà été lue sur MarvelCDB). */
    isKnownCard: definitionId => !!DEFINITION_BY_ID[definitionId],

    /* ---------- pioches et piles ---------- */
    // paquet vide : la fenêtre « Remélanger » s'ouvre, puis la pioche se fait
    drawCard: () => {
      const drawn = run(Engine.drawCard, layout())
      if (drawn === false) offerReshuffle('playerDiscard', { thenDraw: 1 })
      return drawn
    },
    drawCards: count => {
      const drawnCount = run(Engine.drawCards, layout(), count)
      if (drawnCount < count) offerReshuffle('playerDiscard', { thenDraw: count - drawnCount })
      return drawnCount
    },
    discardTopOfDeck: () => run(Engine.discardTopOfDeck),
    /** Mélange une zone et l'écrit au journal ("Paquet Rencontre mélangé."). */
    shuffle: zone => {
      const label = run(Engine.zoneLabel, zone)
      run(Engine.shuffleZone, zone)
      run(Engine.logMessage, `${label[0].toUpperCase()}${label.slice(1)} mélangé.`)
    },
    /**
     * « Remélanger dans le paquet », confirmé dans sa fenêtre : la défausse du joueur ou Rencontre rejoint son
     * paquet, mélangé ; un paquet qui était vide applique sa pénalité (carte Rencontre, pion Accélération).
     */
    shuffleDiscardIntoDeck: discardZone => run(Engine.shuffleDiscardIntoDeck, discardZone, layout()),
    /** Après avoir cherché dans une pioche : elle est mélangée, comme le demandent les règles. */
    shuffleAfterSearch: zone => {
      run(Engine.shuffleZone, zone)
      run(Engine.logMessage, `Vous cherchez dans le ${run(Engine.zoneLabel, zone)}, puis le mélangez.`)
    },
    /** Une carte de la main au hasard, entourée de rouge jusqu'à ce qu'on la touche (usePointer). */
    pickRandomHandCard: () => { ui.randomlyPickedCardId = run(Engine.pickRandomHandCard)?.id ?? null },
    castInvocation: () => run(Engine.castInvocation),
    castInvocationAndKeep: () => run(Engine.castInvocationAndKeep),
    discardInvocation: () => run(Engine.castInvocation, false),
    // paquet Rencontre vide : la fenêtre « Remélanger » s'ouvre, puis l'action se fait
    revealEncounterCard: () => {
      const card = run(Engine.revealEncounterCard, layout())
      if (card === null) offerReshuffle('encounterDiscard', { thenEncounter: 'revealEncounterCard' })
      return card
    },
    revealScenarioDeckCard: () => run(Engine.revealScenarioDeckCard, layout()),
    dealBoostCard: () => {
      if (run(Engine.dealBoostCard, layout())) run(Engine.logMessage, 'Carte Rencontre posée face cachée (boost).')
      else offerReshuffle('encounterDiscard', { thenEncounter: 'dealBoostCard' })
    },
    /** « Attribuez-vous une carte Rencontre » : face cachée devant l'identité, à révéler pendant la phase du méchant. */
    dealEncounterCardToPlayer: () => {
      if (run(Engine.dealEncounterCardToPlayer, layout())) run(Engine.logMessage, 'Vous recevez une carte Rencontre face cachée, posée devant votre identité.')
      else offerReshuffle('encounterDiscard', { thenEncounter: 'dealEncounterCardToPlayer' })
    },

    /* ---------- phases ---------- */
    // rendent true si la phase a changé ; un changement de stade résolu à la fin de la phase (Kang) est présenté
    // la main complétée en fin de phase bute sur un paquet vide : la fenêtre « Remélanger » s'ouvre, puis les
    // cartes qui manquent se piochent (sauf si un changement de stade de Kang occupe déjà l'écran)
    startVillainPhase: () => {
      const changed = !!runAndPresentChange(() => run(Engine.startVillainPhase, layout()))
      const missing = changed ? Engine.handSize(game.value) - cardsIn('hand').length : 0
      if (missing > 0 && !cardsIn('playerDeck').length) offerReshuffle('playerDiscard', { thenDraw: missing })
      return changed
    },
    startHeroPhase: () => !!runAndPresentChange(() => run(Engine.startHeroPhase, layout())),
    mulligan: cardIds => run(Engine.mulligan, layout(), cardIds),

    /* ---------- table ---------- */
    addPawn: () => run(Engine.addPawn, layout()),
    keepCardsOnTable: () => run(Engine.keepCardsOnTable, layout()),
    // une manigance qui sort du jeu peut reprendre au méchant des PV qui le gardaient en vie (Klaw
    // « l'Immortel ») : sa défaite est présentée
    moveCard: (cardId, zone, options) => withCard(cardId, card => runAndPresentChange(() => run(Engine.moveCard, card, zone, { ...options, layout: layout() }))),
    playToTable: (cardId, faceDown) => withCard(cardId, card => run(Engine.playToTable, layout(), card, faceDown)),
    takeFromPile: (cardId, zone) => withCard(cardId, card => run(Engine.takeFromPile, layout(), card, zone)),
    reorderHand: (cardId, beforeCardId) => run(Engine.reorderHand, cardId, beforeCardId),
    // épuisée, une carte pivote ; retournée, une manigance se couche : elle reste entière sur la table
    toggleExhausted: cardId => withCard(cardId, card => {
      run(Engine.toggleExhausted, card)
      Engine.keepCardOnTable(card, layout())
    }),
    flipCard: cardId => withCard(cardId, card => {
      runAndPresentChange(() => run(Engine.flipCard, card, layout()))
      Engine.keepCardOnTable(card, layout())
    }),
    /** L'Ombre du Passé : le sbire et la manigance Némésis entrent en jeu, le reste du set rejoint le paquet Rencontre. */
    putNemesisIntoPlay: cardId => withCard(cardId, card => run(Engine.putNemesisIntoPlay, layout(), card)),
    setIdentityForm: (cardId, side) => withCard(cardId, card => run(Engine.setIdentityForm, card, side)),
    toggleStatus: (cardId, statusId) => withCard(cardId, card => run(Engine.toggleStatus, card, statusId)),
    /** Redresse toutes les cartes du joueur sur la table. */
    readyPlayerCards: () => { for (const card of cardsIn('table')) if (!Engine.isEncounterCard(card)) card.exhausted = false },

    /* ---------- dégâts, menace, jetons ---------- */
    // un méchant vaincu (étape suivante, victoire), une manigance principale achevée ou le héros tombé à 0 PV
    // est présenté dans sa fenêtre
    addDamage: (cardId, amount) => runAndPresentChange(() => run(Engine.addDamage, cardById(cardId), amount, layout())),
    addThreat: (cardId, amount) => runAndPresentChange(() => run(Engine.addThreat, cardById(cardId), amount)),
    addTokens: (cardId, amount) => run(Engine.addTokens, cardById(cardId), amount),
    /** Kang : le stade 3 est achevé, le stade 4 arrive à la fin de la phase (une carte Empire de Kang dessous). */
    completeKangStage3: () => runAndPresentChange(() => run(Engine.completeKangStage3)),
    /** « Annuler » des fenêtres du méchant et de la manigance : revient à l'état d'avant le changement. */
    cancelPresentedChange,
    setActiveVillain: set => run(Engine.setActiveVillain, set),

    /* ---------- compteurs du haut de l'écran ---------- */
    /**
     * Change un compteur de `amount`. Les PV du héros (index 0) et du méchant (index 1) passent par les
     * dégâts : « − » blesse, « + » soigne, pour qu'un personnage qui tombe à 0 soit remarqué (héros battu,
     * étape suivante, victoire). Celui de la menace (index 2) passe par la menace, pour qu'une manigance
     * qui atteint son seuil soit achevée.
     */
    changeCounter(index, amount) {
      const identity = index === 0 ? run(Engine.identityCard) : null
      if (identity && Engine.counterKindOf(identity) === 'damage') return runAndPresentChange(() => run(Engine.addDamage, identity, -amount, layout()))
      if (index === 1) return runAndPresentChange(() => run(Engine.addDamage, null, -amount, layout()))
      if (index === 2) return runAndPresentChange(() => run(Engine.addThreat, null, amount))
      const counter = game.value.counters[index]
      counter.value += amount
      Engine.logMessage(game.value, `${counter.label} : ${counter.value}.`)
      return undefined
    },
    /** Renomme un compteur (clic sur son libellé). */
    renameCounter(index, label) { if (label) game.value.counters[index].label = label }
  }
})
