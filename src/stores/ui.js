// État de l'interface (et non de la partie) : taille des cartes, carte sélectionnée, survolée ou agrandie,
// menu contextuel, fenêtre ouverte, onglet et largeur de la colonne de droite, sous-onglet du choix du héros
// (Nouvelle partie), place prise par le décor du méchant sur la table, changement de scène quand une partie
// est lancée.

import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, watch } from 'vue'
import { villainArtUrl } from '../composables/useAssets.js'

// Réglages gardés dans ce navigateur seulement (localStorage) ; le stockage peut manquer (navigation
// privée) ou être plein : la lecture et l'écriture ne doivent jamais faire échouer l'application.
const CARD_WIDTH_KEY = 'mc-table-card-size'
const SIDE_TAB_KEY = 'mc-table-side-tab'
const DECK_TAB_KEY = 'mc-table-deck-tab'
/** Les sous-onglets du choix du héros (« Nouvelle partie », DeckTabs), dans leur ordre. */
const DECK_TABS = ['precon', 'mine', 'load']
const SIDE_WIDTH_KEY = 'mc-table-side-width'
const readSetting = key => { try { return localStorage.getItem(key) } catch { return null } }
const writeSetting = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, String(value))
  } catch { /* stockage indisponible */ }
}

/**
 * Changement de scène à « Lancer la partie » (launchGame), en ms : la sortie (la fenêtre, et l'accueil ou la
 * partie en cours), puis, sur l'écran vide, l'entrée de la table (la barre, le bandeau, la colonne de droite) ;
 * la distribution des cartes suit. Les mêmes durées sont dans main.css et IntroScreen.vue (« changement de
 * scène ») ; « réduire les animations » : de simples fondus, plus courts.
 */
const SCENE_TIMES = { out: 800, in: 450 }
const SCENE_TIMES_REDUCED = { out: 300, in: 250 }
/** Durée du filet bleu électrique d'une carte ajoutée à la main (flashCard), en ms : la même que card-flash dans main.css. */
const CARD_FLASH_TIME = 1200

/** Échelle de la maquette (1920 × 1080 px) à l'écran : la même que --u dans main.css. */
const screenScale = () => Math.min((globalThis.innerWidth ?? 1920) / 1920, (globalThis.innerHeight ?? 1080) / 1080)
/** Largeur des cartes de la table à la première visite : 110 px sur la maquette, entre les bornes de la tirette « Taille » (56 à 130 px). */
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
  /** Largeur d'une carte sur la table, en pixels (tirette « Taille », en bas à droite). */
  const cardWidth = ref(Number(readSetting(CARD_WIDTH_KEY)) || defaultCardWidth())
  /** Onglet de la colonne de droite : 'card' (la carte agrandie) ou 'log' (le journal). */
  const sideTab = ref(readSetting(SIDE_TAB_KEY) === 'log' ? 'log' : 'card')
  /**
   * Le sous-onglet du choix du héros de « Nouvelle partie » : 0 Préconstruits, 1 Mes decks, 2 Charger un deck.
   * Le dernier choisi est gardé : la fenêtre s'ouvre dessus.
   */
  const deckTab = ref(Math.max(0, DECK_TABS.indexOf(readSetting(DECK_TAB_KEY))))
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
  /**
   * Cartes que la mise en place de l'identité vient de mettre en jeu (Griffes de Wolverine…, une fois
   * distribuées) ou en main (Bouclier de Captain America, après le mulligan) : un filet bleu électrique les
   * entoure 0,6 s puis s'efface en 0,6 s (main.css, card-flash).
   */
  const flashedCardIds = ref([])
  /** Cartes à allumer à la fin de la distribution de la mise en place (flashAfterDeal), hors de l'état réactif. */
  let cardIdsToFlashAfterDeal = []
  /** Carte sous le pointeur. */
  const hoveredCardId = ref(null)
  /** Carte montrée en grand : {cardId, showFace} ; showFace : montrer sa face même si elle est cachée (sa propre main…). */
  const preview = ref(null)
  /** Menu contextuel ouvert : {x, y, title, items: [{label, key, run, checked?} | null (séparateur)], cardId?}. */
  const contextMenu = ref(null)
  /** La liste des pions (PawnTray), ouverte par l'onglet « Pions » de la barre. */
  const pawnTrayOpen = ref(false)
  /**
   * Fenêtre ouverte : {type: 'setup' | 'pile' | 'mulligan' | 'help' | 'signup' | 'legal' | 'about' | 'thanks' | 'bug' | 'restart' | 'villain'
   * | 'scheme' | 'defeat' | 'reshuffle', zone?, result?, fromPile?, required?}. required : elle attend une
   * réponse, ni le fond ni Échap ne la ferment (le mulligan du début de partie).
   */
  const modal = ref(null)
  /** La page d'accueil est affichée, par-dessus la table : au lancement, puis par le titre de la barre. */
  const introOpen = ref(true)
  /** Nombre de mises en place depuis le lancement : chacune fait distribuer les cartes (useDealAnimation). */
  const setupCount = ref(0)
  /** Les cartes de la mise en place sont en route depuis leur paquet : la table les laisse déborder. */
  const isDealing = ref(false)
  /** Changement de scène en cours (launchGame) : 'out' (la sortie), 'in' (l'entrée de la table), sinon null. */
  const scene = ref(null)
  /** Nombre d'entrées de la table depuis le lancement : le décor du méchant refait la sienne à chacune (App.vue). */
  const sceneCount = ref(0)

  watch(cardWidth, width => writeSetting(CARD_WIDTH_KEY, width))
  watch(sideTab, tab => writeSetting(SIDE_TAB_KEY, tab))
  watch(deckTab, tab => writeSetting(DECK_TAB_KEY, DECK_TABS[tab] ?? DECK_TABS[0]))
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
  /** La tirette « Taille » revient à la largeur de la première visite (double-clic sur son libellé). */
  const resetCardWidth = () => { cardWidth.value = defaultCardWidth() }
  const setTableSize = (width, height) => { tableWidth.value = width; tableHeight.value = height }
  /** Place prise sur la table par les PV du méchant affichés en grand (mesurée par VillainHud) : son bord droit et son bord haut (null : pas sur la table). */
  const setHeroInset = (width, top = null) => {
    heroInset.value = Math.max(0, width)
    villainHudTop.value = top
  }
  const selectCard = cardId => { selectedCardId.value = cardId }
  /** Allume ces cartes (flashedCardIds) le temps de l'animation card-flash de main.css : 0,6 s, puis 0,6 s pour s'effacer. */
  let flashTimer
  const flashCards = cardIds => {
    clearTimeout(flashTimer)
    flashedCardIds.value = cardIds
    if (cardIds.length) flashTimer = setTimeout(() => { flashedCardIds.value = [] }, CARD_FLASH_TIME)
  }
  const flashCard = cardId => flashCards([cardId])
  /**
   * Ces cartes s'allumeront à la fin de la distribution de la mise en place (useDealAnimation, flushFlashAfterDeal) :
   * avant, elles sont encore en route depuis le paquet. Une nouvelle mise en place remplace les précédentes.
   */
  const flashAfterDeal = cardIds => { cardIdsToFlashAfterDeal = cardIds }
  const flushFlashAfterDeal = () => {
    if (cardIdsToFlashAfterDeal.length) flashCards(cardIdsToFlashAfterDeal)
    cardIdsToFlashAfterDeal = []
  }
  const showPreview = (cardId, showFace = false) => { preview.value = { cardId, showFace } }
  const openContextMenu = menu => { contextMenu.value = menu }
  const closeContextMenu = () => { contextMenu.value = null }
  /** Ouvre une fenêtre (et ferme le menu contextuel et la liste des pions) ; `extra` : ses paramètres (zone de la pile, résultat…). */
  const openModal = (type, extra = {}) => { contextMenu.value = null; pawnTrayOpen.value = false; modal.value = { type, ...extra } }
  const closeModal = () => { modal.value = null }
  /** Revient à la page d'accueil (le menu, la liste des pions ou la fenêtre ouverts se ferment) ; la partie reste où elle en est. */
  const openIntro = () => { contextMenu.value = null; pawnTrayOpen.value = false; modal.value = null; introOpen.value = true }
  /** Ouvre ou ferme la liste des pions. */
  const togglePawnTray = () => { contextMenu.value = null; pawnTrayOpen.value = !pawnTrayOpen.value }
  const closePawnTray = () => { pawnTrayOpen.value = false }
  /** Quitte la page d'accueil : la table apparaît. */
  const closeIntro = () => { introOpen.value = false }
  /**
   * « Lancer la partie » : la fenêtre et l'accueil (ou la partie en cours) s'en vont (800 ms) ; sur l'écran
   * vide, `setUp` met la nouvelle partie en place, l'accueil et la fenêtre se ferment, et la table entre ; ses
   * cartes sont distribuées ensuite (useDealAnimation). Un second appui pendant le changement ne fait rien.
   */
  function launchGame(setUp) {
    if (scene.value) return
    const times = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? SCENE_TIMES_REDUCED : SCENE_TIMES
    contextMenu.value = null
    pawnTrayOpen.value = false
    scene.value = 'out'
    setTimeout(() => {
      // même si la mise en place échoue, la table revient : l'écran ne reste pas vide
      try { setUp() } finally {
        modal.value = null
        introOpen.value = false
        sceneCount.value++
        scene.value = 'in'
        setTimeout(() => { scene.value = null }, times.in)
      }
    }, times.out)
  }

  return {
    cardWidth, resetCardWidth, sideTab, deckTab, sideColumnWidth, tableWidth, tableHeight, heroInset, selectedCardId, randomlyPickedCardId, flashedCardIds, hoveredCardId,
    preview, contextMenu, pawnTrayOpen, modal, introOpen, setupCount, isDealing, scene, sceneCount, layout, setTableSize, setHeroInset, selectCard,
    flashCard, flashCards, flashAfterDeal, flushFlashAfterDeal, showPreview, openContextMenu, closeContextMenu,
    openModal, closeModal, openIntro, closeIntro, launchGame, togglePawnTray, closePawnTray
  }
})

// En développement, une modification de ce store met à jour celui de la page ouverte (Pinia, acceptHMRUpdate) :
// sans cela, Vite relit le module mais Pinia garde le store déjà créé, et une action ajoutée y manque jusqu'au
// rechargement de la page (« gameStore.nextIdentityVersion is not a function »). Sans effet en production.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
