// Moteur de règles de la table : des fonctions pures qui lisent et modifient l'état d'une partie (un objet
// JavaScript ordinaire). Aucune dépendance à Vue : le store Pinia passe son état réactif, les tests un
// objet simple. La description de l'état d'une partie et d'une carte est en tête de engine/state.js.
//
// Le moteur est rangé par thème dans src/game/engine/ ; ce fichier les réunit, pour qu'on importe tout
// d'un seul endroit (import * as Engine from './engine.js') :
//   state.js       hasard, journal, lecture des cartes, zones et piles
//   layout.js      places des cartes sur la table
//   moves.js       déplacer, jouer, retourner une carte ; entrée en jeu, cartes d'état, formes de l'identité
//   piles.js       pioche, paquet Rencontre, deck du scénario, deck Invocation
//   turns.js       taille de main, phases du héros et du méchant
//   villains.js    dégâts, menace, jetons ; défaite et étapes du méchant ; Démolisseurs ; Kang
//   setup.js       nouvelle partie, mise en place, mulligan
//   deckImport.js  lecture des decks importés (OCTGN, texte et API MarvelCDB)

export * from './engine/state.js'
export * from './engine/layout.js'
export * from './engine/moves.js'
export * from './engine/piles.js'
export * from './engine/turns.js'
export * from './engine/villains.js'
export * from './engine/setup.js'
export * from './engine/deckImport.js'
