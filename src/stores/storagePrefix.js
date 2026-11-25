// Le préfixe des clés que l'appli garde dans le navigateur (localStorage : la partie, « Mes decks », les réglages).
// Vide en production ; « test- » pour la copie de test (npm run build:test, vite.config.js __STORAGE_PREFIX__),
// servie sur le même site, dans un autre dossier : sans lui, les deux copies partageraient la partie en cours, les
// decks sauvegardés et les réglages. La mémoire de « Rester informé » (gbh-signup) n'en a pas : les deux copies
// inscrivent dans la même liste.

export const STORAGE_PREFIX = typeof __STORAGE_PREFIX__ === 'string' ? __STORAGE_PREFIX__ : ''
