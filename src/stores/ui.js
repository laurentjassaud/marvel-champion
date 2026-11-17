// État de l'interface (et non de la partie) : taille des cartes, carte sélectionnée, survolée ou agrandie,
// menu contextuel, fenêtre ouverte, onglet et largeur de la colonne de droite, place prise par le décor du
// méchant sur la table.

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { villainArtUrl } from '../composables/useAssets.js'

// Réglages gardés dans ce navigateur seulement (localStorage) ; le stockage peut manquer (navigation
// privée) ou être plein : la lecture et l'écriture ne doivent jamais faire échouer l'application.
const CARD_WIDTH_KEY = 'mc-table-card-size'
const SIDE_TAB_KEY = 'mc-table-side-tab'
const SIDE_WIDTH_KEY = 'mc-table-side-width'
const readSetting = key => { try { return localStorage.getItem(key) } catch { return null } }
const writeSetting = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, String(value))
  } catch { /* stockage indisponible */ }
}

/** Échelle de la maquette (1920 × 1080 px) à l'écran : la même que --u dans main.css. */
const screenScale = () => Math.min((globalThis.innerWidth ?? 1920) / 1920, (globalThis.innerHeight ?? 1080) / 1080)
/** Largeur des cartes de la table à la première visite : 110 px sur la maquette, entre les bornes du réglage « Taille » (56 à 130 px). */
const defaultCardWidth = () => Math.round(Math.min(130, Math.max(56, 110 * screenScale())))
/**
 * Largeur occupée en haut de la table par l'illustration du méchant de ce scénario (VillainBackdrop :
 * 694 px sur la maquette, posée 13 px à gauche du bord, dont le poing de Rhino atteint 97 %) ; 0 s'il n'en
 * a pas, ou sur téléphone, où le décor est caché (main.css).
 */
function villainArtInset(scenarioId) {
  if (!villainArtUrl(scenarioId) || (globalThis.innerWidth ?? 1920) <= 700) return 0
  return (694 * 0.97 - 13) * screenScale()
}

export const useUiStore = defineStore('ui', () => {
  /** Largeur d'une carte sur la table, en pixels (curseur « Taille »). */
  const cardWidth = ref(Number(readSetting(CARD_WIDTH_KEY)) || defaultCardWidth())
  /** Onglet de la colonne de droite : 'card' (la carte agrandie) ou 'log' (le journal). */
  const sideTab = ref(readSetting(SIDE_TAB_KEY) === 'log' ? 'log' : 'card')
  /** Largeur de la colonne de droite choisie en glissant son bord, en pixels ; null : la largeur par défaut. */
  const sideColumnWidth = ref(Number(readSetting(SIDE_WIDTH_KEY)) || null)
  /** Taille mesurée de la table, en pixels. */
  const tableWidth = ref(0)
  const tableHeight = ref(0)
  /** Largeur, depuis le bord gauche de la table, des PV du méchant affichés en grand en bas (mesurée par VillainHud). */
  const heroInset = ref(0)
  /** Bord haut de ce bloc, depuis le haut de la table ; null s'il n'est pas posé par-dessus la table (téléphone, tablette en portrait). */
  const villainHudTop = ref(null)
  /** Carte sélectionnée (clic) : cible des raccourcis clavier quand la souris n'est sur aucune carte. */
  const selectedCardId = ref(null)
  /** Carte de la main tirée au hasard, entourée de rouge jusqu'à ce qu'on la touche. */
  const randomlyPickedCardId = ref(null)
  /** Carte sous le pointeur. */
  const hoveredCardId = ref(null)
  /** Carte montrée en grand : {cardId, showFace} ; showFace : montrer sa face même si elle est cachée (sa propre main…). */
  const preview = ref(null)
  /** Menu contextuel ouvert : {x, y, title, items: [{label, key, run, checked?} | null (séparateur)], cardId?}. */
  const contextMenu = ref(null)
  /**
   * Fenêtre ouverte : {type: 'setup' | 'pile' | 'mulligan' | 'help' | 'restart' | 'villain' | 'scheme' | 'defeat'
   * | 'reshuffle', zone?, result?, fromPile?}.
   */
  const modal = ref(null)
  /** La page d'accueil est affichée, par-dessus la table : au lancement, puis par le titre de la barre. */
  const introOpen = ref(true)
  /** Nombre de mises en place depuis le lancement : chacune fait distribuer les cartes (useDealAnimation). */
  const setupCount = ref(0)
  /** Les cartes de la mise en place sont en route depuis leur paquet : la table les laisse déborder. */
  const isDealing = ref(false)

  watch(cardWidth, width => writeSetting(CARD_WIDTH_KEY, width))
  watch(sideTab, tab => writeSetting(SIDE_TAB_KEY, tab))
  // la largeur change à chaque mouvement d'un glisser : elle n'est écrite qu'une fois stabilisée
  let sideWidthTimer
  watch(sideColumnWidth, width => {
    clearTimeout(sideWidthTimer)
    sideWidthTimer = setTimeout(() => writeSetting(SIDE_WIDTH_KEY, width), 300)
  })

  /**
   * Disposition de la table pour le moteur, dans une partie contre le méchant de ce scénario : {width,
   * height, cardWidth, villainInset, heroInset, villainHud} (villainHud : {right, top}, les PV du méchant
   * posés par-dessus la table, qu'une carte ne doit pas passer dessous ; null sinon). Les minimums ne servent qu'à l'instant où la table n'est
   * pas encore mesurée : plus grands que la vraie taille, ils poseraient des cartes hors de la table. Le
   * décor du méchant laisse toujours la place de quatre cartes en haut (méchant, manigance couchée, une
   * carte Rencontre) et de trois en bas.
   */
  const layout = scenarioId => {
    const width = Math.max(tableWidth.value, 400)
    const card = cardWidth.value
    return {
      width,
      height: Math.max(tableHeight.value, 300),
      cardWidth: card,
      villainInset: Math.round(Math.min(villainArtInset(scenarioId), Math.max(0, width - card * 3.8 - 80))),
      heroInset: Math.round(Math.min(heroInset.value, Math.max(0, width - card * 3.4 - 80))),
      villainHud: heroInset.value && villainHudTop.value != null ? { right: heroInset.value, top: villainHudTop.value } : null
    }
  }
  const setTableSize = (width, height) => { tableWidth.value = width; tableHeight.value = height }
  /** Place prise sur la table par les PV du méchant affichés en grand (mesurée par VillainHud) : son bord droit et son bord haut (null : pas sur la table). */
  const setHeroInset = (width, top = null) => {
    heroInset.value = Math.max(0, width)
    villainHudTop.value = top
  }
  const selectCard = cardId => { selectedCardId.value = cardId }
  const showPreview = (cardId, showFace = false) => { preview.value = { cardId, showFace } }
  const openContextMenu = menu => { contextMenu.value = menu }
  const closeContextMenu = () => { contextMenu.value = null }
  /** Ouvre une fenêtre (et ferme le menu contextuel) ; `extra` : ses paramètres (zone de la pile, résultat…). */
  const openModal = (type, extra = {}) => { contextMenu.value = null; modal.value = { type, ...extra } }
  const closeModal = () => { modal.value = null }
  /** Revient à la page d'accueil (le menu ou la fenêtre ouverts se ferment) ; la partie reste où elle en est. */
  const openIntro = () => { contextMenu.value = null; modal.value = null; introOpen.value = true }
  /** Quitte la page d'accueil : la table apparaît. */
  const closeIntro = () => { introOpen.value = false }

  return {
    cardWidth, sideTab, sideColumnWidth, tableWidth, tableHeight, heroInset, selectedCardId, randomlyPickedCardId, hoveredCardId,
    preview, contextMenu, modal, introOpen, setupCount, isDealing, layout, setTableSize, setHeroInset, selectCard, showPreview, openContextMenu, closeContextMenu,
    openModal, closeModal, openIntro, closeIntro
  }
})
