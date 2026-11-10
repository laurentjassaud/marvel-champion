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
  /** Sous-titre de la barre du haut : "Spider-Man contre Rhino · expert" (une difficulté tirée au hasard n'est pas nommée). */
  const subtitle = computed(() => {
    const setup = game.value?.setup
    if (!setup) return 'Table solo'
    const scenario = SCENARIOS.find(candidate => candidate.id === setup.scenario)
    const expert = setup.expert && !setup.randomChoices?.includes('expert') ? ' · expert' : ''
    return `${heroName(setup.hero)} contre ${scenario?.villainName ?? ''}${expert}`
  })
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
  /** La disposition actuelle de la table. */
  const layout = () => ui.layout()
  /** Un méchant vaincu : son étape suivante (ou la victoire) est présentée dans une fenêtre. */
  const announceVillainResult = result => { if (result) ui.openModal('villain', { result }) }
  /**
   * Les changements de phase rendent true / false, ou ce qu'a donné un changement de stade résolu à la fin
   * de la phase (Kang) : il est alors présenté dans la fenêtre du méchant. Rend true si la phase a changé.
   */
  const afterPhaseChange = result => {
    if (result && result !== true) announceVillainResult(result)
    return !!result
  }
  /** Ajoute un message en tête du journal, à l'heure du premier message. */
  const prependLog = text => game.value.log.unshift({ time: game.value.log[0].time, text, important: true })

  /* ---------- parties ---------- */

  /** Commence une nouvelle partie (options : voir engine/setup.js newGame) et vide la sélection. */
  function newGame(options) {
    game.value = Engine.newGame(options, layout())
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

  /** La partie d'exemple du premier lancement : Spider-Man contre Rhino. */
  function startExampleGame() {
    newGame({ hero: 'spider_man', deckList: PRECON_DECKS.spider_man, scenario: 'rhino', modulars: ['bomb_scare'], expert: false, deckLabel: 'précon Justice' })
    prependLog('Bienvenue. Une partie d\'exemple est prête : Spider-Man contre Rhino. « Nouvelle partie » pour changer de héros ou de méchant.')
  }

  return {
    game, isReady, cardsIn, pileOf, cardById, hasInvocationDeck, scenarioDeck, turn, phase, subtitle, canMulligan,
    newGame, startExampleGame, restartGame,
    preconDeck: heroId => PRECON_DECKS[heroId],
    parseDeckFile: Engine.parseDeckFile,
    /** La carte fait partie des boîtes de la table (ou a déjà été lue sur MarvelCDB). */
    isKnownCard: definitionId => !!DEFINITION_BY_ID[definitionId],

    /* ---------- pioches et piles ---------- */
    drawCard: () => run(Engine.drawCard, layout()),
    drawCards: count => run(Engine.drawCards, layout(), count),
    discardTopOfDeck: () => run(Engine.discardTopOfDeck),
    /** Mélange une zone et l'écrit au journal ("Paquet Rencontre mélangé."). */
    shuffle: zone => {
      const label = run(Engine.zoneLabel, zone)
      run(Engine.shuffleZone, zone)
      run(Engine.logMessage, `${label[0].toUpperCase()}${label.slice(1)} mélangé.`)
    },
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
    revealEncounterCard: () => run(Engine.revealEncounterCard, layout()),
    revealScenarioDeckCard: () => run(Engine.revealScenarioDeckCard, layout()),
    dealBoostCard: () => { if (run(Engine.dealBoostCard, layout())) run(Engine.logMessage, 'Carte Rencontre posée face cachée (boost).') },
    /** « Attribuez-vous une carte Rencontre » : face cachée devant l'identité, à révéler pendant la phase du méchant. */
    dealEncounterCardToPlayer: () => {
      if (run(Engine.dealEncounterCardToPlayer, layout())) run(Engine.logMessage, 'Vous recevez une carte Rencontre face cachée, posée devant votre identité.')
    },

    /* ---------- phases ---------- */
    startVillainPhase: () => afterPhaseChange(run(Engine.startVillainPhase, layout())),
    startHeroPhase: () => afterPhaseChange(run(Engine.startHeroPhase, layout())),
    mulligan: cardIds => run(Engine.mulligan, layout(), cardIds),

    /* ---------- table ---------- */
    addPawn: () => run(Engine.addPawn, layout()),
    keepCardsOnTable: () => run(Engine.keepCardsOnTable, layout()),
    moveCard: (cardId, zone, options) => withCard(cardId, card => run(Engine.moveCard, card, zone, options)),
    playToTable: (cardId, faceDown) => withCard(cardId, card => run(Engine.playToTable, layout(), card, faceDown)),
    takeFromPile: (cardId, zone) => withCard(cardId, card => run(Engine.takeFromPile, layout(), card, zone)),
    reorderHand: (cardId, beforeCardId) => run(Engine.reorderHand, cardId, beforeCardId),
    toggleExhausted: cardId => withCard(cardId, card => run(Engine.toggleExhausted, card)),
    flipCard: cardId => withCard(cardId, card => run(Engine.flipCard, card)),
    setIdentityForm: (cardId, side) => withCard(cardId, card => run(Engine.setIdentityForm, card, side)),
    toggleStatus: (cardId, statusId) => withCard(cardId, card => run(Engine.toggleStatus, card, statusId)),
    /** Redresse toutes les cartes du joueur sur la table. */
    readyPlayerCards: () => { for (const card of cardsIn('table')) if (!Engine.isEncounterCard(card)) card.exhausted = false },

    /* ---------- dégâts, menace, jetons ---------- */
    addDamage: (cardId, amount) => announceVillainResult(run(Engine.addDamage, cardById(cardId), amount, layout())),
    addThreat: (cardId, amount) => run(Engine.addThreat, cardById(cardId), amount),
    addTokens: (cardId, amount) => run(Engine.addTokens, cardById(cardId), amount),
    /** Kang : le stade 3 est achevé, le stade 4 arrive à la fin de la phase (une carte Empire de Kang dessous). */
    completeKangStage3: () => announceVillainResult(run(Engine.completeKangStage3)),
    setActiveVillain: set => run(Engine.setActiveVillain, set),

    /* ---------- compteurs du haut de l'écran ---------- */
    /**
     * Change un compteur de `amount`. Le compteur du méchant (index 1) passe par les dégâts : « − » blesse,
     * « + » soigne, pour qu'une étape qui tombe à 0 soit remarquée (étape suivante, victoire).
     */
    changeCounter(index, amount) {
      if (index === 1) return announceVillainResult(run(Engine.addDamage, null, -amount, layout()))
      const counter = game.value.counters[index]
      counter.value += amount
      Engine.logMessage(game.value, `${counter.label} : ${counter.value}.`)
      return undefined
    },
    /** Renomme un compteur (clic sur son libellé). */
    renameCounter(index, label) { if (label) game.value.counters[index].label = label }
  }
})
