// Les decks sauvegardés : « Mes decks » de la fenêtre « Préparation de la partie ». Un deck chargé depuis un
// fichier (.txt de MarvelCDB, .o8d d'OCTGN) ou un lien MarvelCDB, avec la case « Ajouter ce deck à ma
// sélection », y est gardé : {key, label, hero, deckList, importedDefinitions, savedAt}.
//   key                  ce qui le reconnaît : « marvelcdb:deck:123 », « marvelcdb:decklist:456 », ou
//                        « fichier:<nom>:<héros> » ; un deck rechargé remplace l'ancien, en tête de la liste
//   deckList             [identifiant de carte, exemplaires][], identité comprise (comme les decks préconstruits)
//   importedDefinitions  les fiches des cartes lues sur MarvelCDB qu'il utilise (ses cartes, et pour un héros
//                        absent de la table son obligation et son set Némésis), comme setup.importedDefinitions
//                        d'une partie : remises dans les fiches de la table à l'ouverture, pour les portraits et
//                        la partie
// Gardés dans ce navigateur seulement (localStorage, clé mc-table-decks) ; le stockage peut manquer
// (navigation privée) ou être plein : la lecture et l'écriture ne font jamais échouer l'application.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CARD_DEFINITIONS, addImportedDefinitions } from '../game/data.js'

const DECKS_KEY = 'mc-table-decks'
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
 * cartes de son set et de son set Némésis (l'obligation, les cartes mises de côté) ; sans ce que la table leur
 * ajoute (pack, imageFolder), comme newGame les garde avec une partie.
 */
export function importedDefinitionsOf(hero, deckList) {
  const ids = new Set(deckList.map(([definitionId]) => definitionId))
  return CARD_DEFINITIONS
    .filter(definition => definition.pack === 'marvelcdb'
      && (ids.has(definition.id) || definition.set === hero || definition.set === `${hero}_nemesis`))
    .map(({ pack, imageFolder, ...definition }) => definition)
}

export const useDecksStore = defineStore('decks', () => {
  /** Les decks sauvegardés, le plus récent en tête. */
  const decks = ref(readDecks())
  for (const deck of decks.value) addImportedDefinitions(deck.importedDefinitions)

  /** Garde un deck ({key, label, hero, deckList, importedDefinitions}) en tête de la liste ; rend le deck gardé. */
  function saveDeck(deck) {
    const saved = { ...deck, savedAt: new Date().toISOString() }
    decks.value = [saved, ...decks.value.filter(other => other.key !== deck.key)]
    writeDecks(decks.value)
    return saved
  }
  /** Retire un deck de la liste. */
  function removeDeck(key) {
    decks.value = decks.value.filter(deck => deck.key !== key)
    writeDecks(decks.value)
  }

  return { decks, saveDeck, removeDeck }
})
