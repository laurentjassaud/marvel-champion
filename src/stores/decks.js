// Les decks sauvegardés : « Mes decks » de la fenêtre « Préparation de la partie ». Un deck chargé par un lien
// MarvelCDB, avec la case « Ajouter ce deck à ma sélection », y est gardé : {key, label, hero, deckList,
// importedDefinitions, savedAt}.
//   key                  ce qui le reconnaît : « marvelcdb:deck:123 », « marvelcdb:decklist:456 » (ou
//                        « fichier:<nom>:<héros> », chargé d'un fichier avant que ce chargement soit retiré) ;
//                        un deck rechargé remplace l'ancien, en tête de la liste
//   deckList             [identifiant de carte, exemplaires][], identité comprise (comme les decks préconstruits)
//   importedDefinitions  les fiches des cartes lues sur MarvelCDB qu'il utilise (ses cartes, et pour un héros
//                        absent de la table son obligation, son set Némésis et les cartes qu'il met de côté hors
//                        du deck), comme setup.importedDefinitions
//                        d'une partie : remises dans les fiches de la table à l'ouverture, pour les portraits et
//                        la partie
// Gardés dans ce navigateur seulement (localStorage, clé mc-table-decks) ; le stockage peut manquer
// (navigation privée) ou être plein : la lecture et l'écriture ne font jamais échouer l'application.

import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'
import { CARD_DEFINITIONS, addImportedDefinitions } from '../game/data.js'
import { heroPileCodes, unavailableHeroOf } from '../game/rules.js'
import { STORAGE_PREFIX } from './storagePrefix.js'

// préfixée dans la copie de test (storagePrefix.js)
const DECKS_KEY = `${STORAGE_PREFIX}mc-table-decks`
const readDecks = () => {
  try {
    const decks = JSON.parse(localStorage.getItem(DECKS_KEY))
    return Array.isArray(decks) ? decks.filter(deck => deck?.key && deck.hero && Array.isArray(deck.deckList)) : []
  } catch {
    return []
  }
}
const writeDecks = decks => {
  try { localStorage.setItem(DECKS_KEY, JSON.stringify(decks)) } catch { /* stockage indisponible ou plein */ }
}

/**
 * Les fiches lues sur MarvelCDB dont un deck a besoin : ses cartes, et pour un héros absent de la table les
 * cartes de son set et de son set Némésis (l'obligation, les cartes mises de côté), et celles qu'il met de côté
 * hors du deck (rules.js heroPiles : les Pris Dans la Glace d'Iceberg, le deck Climat de Tornade…) ; sans ce que la table leur ajoute
 * (pack, imageFolder), comme newGame les garde avec une partie.
 */
export function importedDefinitionsOf(hero, deckList) {
  const ids = new Set(deckList.map(([definitionId]) => definitionId))
  const setAsideCodes = heroPileCodes(hero)
  return CARD_DEFINITIONS
    .filter(definition => definition.pack === 'marvelcdb'
      && (ids.has(definition.id) || definition.set === hero || definition.set === `${hero}_nemesis` || setAsideCodes.includes(definition.code)))
    .map(({ pack, imageFolder, ...definition }) => definition)
}

export const useDecksStore = defineStore('decks', () => {
  /** Les decks sauvegardés, le plus récent en tête. */
  const decks = ref(readDecks())
  /**
   * Ceux que « Mes decks » propose : sans les héros que la table refuse pour l'instant (rules.js
   * UNAVAILABLE_HEROES : Elektra, Iron Fist), gardés quand même, pour le jour où ils seront jouables.
   */
  const playableDecks = computed(() => decks.value.filter(deck => !unavailableHeroOf({ set: deck.hero })))
  for (const deck of decks.value) addImportedDefinitions(deck.importedDefinitions)

  /** Garde un deck ({key, label, hero, deckList, importedDefinitions}) en tête de la liste ; rend le deck gardé. */
  function saveDeck(deck) {
    const saved = { ...deck, savedAt: new Date().toISOString() }
    decks.value = [saved, ...decks.value.filter(other => other.key !== deck.key)]
    writeDecks(decks.value)
    return saved
  }
  /**
   * Les decks sauvegardés de ce héros reprennent leurs fiches (importedDefinitionsOf) : après la lecture des
   * cartes qui leur manquaient (stores/game.js, ensureHeroSetAsideCards), elles sont gardées avec eux.
   */
  function refreshImportedDefinitions(hero) {
    if (!decks.value.some(deck => deck.hero === hero)) return
    decks.value = decks.value.map(deck => (deck.hero === hero ? { ...deck, importedDefinitions: importedDefinitionsOf(hero, deck.deckList) } : deck))
    writeDecks(decks.value)
  }
  /** Retire un deck de la liste. */
  function removeDeck(key) {
    decks.value = decks.value.filter(deck => deck.key !== key)
    writeDecks(decks.value)
  }

  return { decks, playableDecks, saveDeck, removeDeck, refreshImportedDefinitions }
})

// En développement, une modification de ce store met à jour celui de la page ouverte (Pinia, acceptHMRUpdate) :
// sans cela, Vite relit le module mais Pinia garde le store déjà créé, et une action ajoutée y manque jusqu'au
// rechargement de la page (« gameStore.nextIdentityVersion is not a function »). Sans effet en production.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useDecksStore, import.meta.hot))
