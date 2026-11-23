// Les decks sauvegardés (« Mes decks ») : ce qui est gardé avec un deck, l'ordre de la liste, son stockage dans
// le navigateur (un faux localStorage ici : les tests tournent sous Node).
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { addImportedDefinitions, PRECON_DECKS, DEFINITION_BY_ID } from '../game/data.js'
import { useDecksStore, importedDefinitionsOf } from './decks.js'

/** Un faux localStorage, vide à chaque test. */
function fakeStorage() {
  const items = new Map()
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)), removeItem: key => items.delete(key) }
}

// un héros d'une boîte absente de la table, lu sur MarvelCDB : son identité, son obligation, son set Némésis,
// et une carte de son deck
addImportedDefinitions([
  { id: 'cdb-98001a', code: '98001a', name: 'Héros Test', type: 'hero', faction: 'hero', set: 'heros_test', quantity: 1 },
  { id: 'cdb-98002', code: '98002', name: 'Obligation Test', type: 'obligation', faction: 'encounter', set: 'heros_test', quantity: 1 },
  { id: 'cdb-98003', code: '98003', name: 'Némésis Test', type: 'minion', faction: 'encounter', set: 'heros_test_nemesis', quantity: 1 },
  { id: 'cdb-98004', code: '98004', name: 'Allié Test', type: 'ally', faction: 'basic', set: '', quantity: 1 },
  { id: 'cdb-98005', code: '98005', name: 'Hors du deck', type: 'event', faction: 'basic', set: '', quantity: 1 }
])

describe('decks sauvegardés', () => {
  beforeEach(() => {
    globalThis.localStorage = fakeStorage()
    setActivePinia(createPinia())
  })

  it('garde les fiches lues sur MarvelCDB dont le deck a besoin : ses cartes, le set et le Némésis de son héros', () => {
    const deckList = [['cdb-98001a', 1], ['cdb-98004', 2], [PRECON_DECKS.spider_man[1][0], 1]]
    const kept = importedDefinitionsOf('heros_test', deckList).map(definition => definition.id).sort()
    expect(kept).toEqual(['cdb-98001a', 'cdb-98002', 'cdb-98003', 'cdb-98004'])
    // sans ce que la table leur ajoute : comme setup.importedDefinitions d'une partie
    expect(importedDefinitionsOf('heros_test', deckList).every(definition => !('pack' in definition) && !('imageFolder' in definition))).toBe(true)
    // un deck des boîtes de la table n'en garde aucune
    expect(importedDefinitionsOf('spider_man', PRECON_DECKS.spider_man)).toEqual([])
  })

  it('un deck sauvegardé passe en tête ; rechargé (même clé), il remplace l\'ancien ; la croix le retire', () => {
    const decks = useDecksStore()
    expect(decks.decks).toEqual([])
    decks.saveDeck({ key: 'fichier:A:spider_man', label: 'A', hero: 'spider_man', deckList: PRECON_DECKS.spider_man, importedDefinitions: [] })
    decks.saveDeck({ key: 'marvelcdb:deck:1:hulk', label: 'B', hero: 'hulk', deckList: PRECON_DECKS.hulk, importedDefinitions: [] })
    expect(decks.decks.map(deck => deck.label)).toEqual(['B', 'A'])
    decks.saveDeck({ key: 'fichier:A:spider_man', label: 'A bis', hero: 'spider_man', deckList: PRECON_DECKS.spider_man, importedDefinitions: [] })
    expect(decks.decks.map(deck => deck.label)).toEqual(['A bis', 'B'])
    expect(decks.decks[0].savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    decks.removeDeck('marvelcdb:deck:1:hulk')
    expect(decks.decks.map(deck => deck.label)).toEqual(['A bis'])
  })

  it('la liste survit au rechargement de la page, avec les cartes lues sur MarvelCDB ; un stockage abîmé ne casse rien', () => {
    useDecksStore().saveDeck({
      key: 'marvelcdb:deck:7:heros_test', label: 'Test', hero: 'heros_test', deckList: [['cdb-98001a', 1], ['cdb-98004', 2]],
      importedDefinitions: importedDefinitionsOf('heros_test', [['cdb-98001a', 1], ['cdb-98004', 2]])
    })
    // une nouvelle page : un nouveau store, qui relit le stockage
    setActivePinia(createPinia())
    const reloaded = useDecksStore()
    expect(reloaded.decks.map(deck => deck.label)).toEqual(['Test'])
    expect(DEFINITION_BY_ID['cdb-98004'].pack).toBe('marvelcdb')
    // un contenu illisible : une liste vide, sans erreur
    globalThis.localStorage.setItem('mc-table-decks', '{pas du JSON')
    setActivePinia(createPinia())
    expect(useDecksStore().decks).toEqual([])
  })
})
