// Les images des cartes lues sur MarvelCDB : le scan français de cgbuilder quand il l'a (src/data/cgbuilder.json),
// sinon le scan anglais de MarvelCDB.
import { describe, it, expect } from 'vitest'
import { addImportedDefinitions } from '../game/data.js'
import { cardImageUrl, cgbuilderImageUrl, imageUrlOfDefinition, CGBUILDER_IMAGES_URL } from './useAssets.js'

const MARVELCDB = 'https://fr.marvelcdb.com/bundles/cards'

describe('scans français de cgbuilder', () => {
  it('trouve le dossier de cgbuilder, qui ne suit pas toujours le préfixe MarvelCDB', () => {
    expect(cgbuilderImageUrl('06001a')).toBe(`${CGBUILDER_IMAGES_URL}/6/1A.jpg`)
    // Captain America : 03 sur MarvelCDB, dossier 2 sur cgbuilder ; Le Faucon : 53, dossier 54
    expect(cgbuilderImageUrl('03001a')).toBe(`${CGBUILDER_IMAGES_URL}/2/1A.jpg`)
    expect(cgbuilderImageUrl('53020')).toBe(`${CGBUILDER_IMAGES_URL}/54/20.jpg`)
    // une carte à une face que cgbuilder range comme une face A
    expect(cgbuilderImageUrl('26002')).toBe(`${CGBUILDER_IMAGES_URL}/26/2A.jpg`)
  })

  it('la face B d\'un héros est son alter ego, de même numéro ; un code sans lettre n\'a pas d\'autre face', () => {
    expect(cgbuilderImageUrl('06001a', 'b')).toBe(`${CGBUILDER_IMAGES_URL}/6/1B.jpg`)
    expect(cgbuilderImageUrl('54010', 'b')).toBeNull()
  })

  it('rien pour une carte que cgbuilder n\'a pas (une boîte pas encore traduite) ni pour un code inconnu', () => {
    expect(cgbuilderImageUrl('63001a')).toBeNull()
    expect(cgbuilderImageUrl('sans-code')).toBeNull()
    expect(cgbuilderImageUrl(undefined)).toBeNull()
  })

  it('une carte importée prend le scan de cgbuilder, sinon celui de MarvelCDB', () => {
    addImportedDefinitions([
      { id: 'cdb-54010', code: '54010', name: 'Masque de l\'Hiver', type: 'upgrade', faction: 'hero', set: 'winter_soldier', quantity: 1, imageUrl: `${MARVELCDB}/54010.png` },
      {
        id: 'cdb-63001a', code: '63001a', name: 'Elektra', type: 'hero', faction: 'hero', set: 'elektra', quantity: 1, backName: 'Elektra Natchios',
        backType: 'alter_ego', imageUrl: `${MARVELCDB}/63001a.png`, backImageUrl: `${MARVELCDB}/63001b.png`
      }
    ])
    expect(cardImageUrl({ definitionId: 'cdb-54010', side: 0 })).toBe(`${CGBUILDER_IMAGES_URL}/53/10.jpg`)
    expect(imageUrlOfDefinition('cdb-54010')).toBe(`${CGBUILDER_IMAGES_URL}/53/10.jpg`)
    expect(cardImageUrl({ definitionId: 'cdb-63001a', side: 0 })).toBe(`${MARVELCDB}/63001a.png`)
    expect(cardImageUrl({ definitionId: 'cdb-63001a', side: 1 })).toBe(`${MARVELCDB}/63001b.png`)
  })
})
