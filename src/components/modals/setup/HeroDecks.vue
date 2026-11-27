<script setup>
// Les trois volets du choix du héros, sous ses sous-onglets (DeckTabs), côte à côte sur un rail qui défile à
// l'horizontale : le volet choisi glisse à sa place, les autres sortent du cadre (et ne prennent ni le
// clavier ni les lecteurs d'écran : inert).
//   Préconstruits    les héros de la table, chacun avec son deck préconstruit (hors ligne), puis « Au hasard »,
//                    qui tire l'un d'eux ; dessous, sous leur intitulé, les héros dont le précon se lit sur
//                    MarvelCDB (game/precons.js : tous les autres, sauf Elektra et Iron Fist), lu au choix du héros
//                    (son portrait tourne le temps de la lecture), sans rejoindre Mes decks. La grille défile :
//                    deux rangées en vue, comme les autres étapes
//   Mes decks        les decks sauvegardés (stores/decks.js), en vignettes du héros, comme les préconstruits ;
//                    leur croix les retire
//   Charger un deck  un lien MarvelCDB (deck publié, ou deck personnel si son auteur partage ses decks), ou le
//                    lien d'une decklist MC4DB (héros de fans compris, par le relais du site : game/mc4db.js) ;
//                    dessous, la case « Ajouter ce deck à ma sélection », cochée d'avance, le garde dans Mes
//                    decks. Le chargement d'un fichier (.txt de MarvelCDB, .o8d d'OCTGN) n'est plus proposé : il
//                    ne marchait pas (la lecture reste dans le moteur, engine/deckImport.js)
// Un choix est rendu à la fenêtre (pick) : {hero, deck}, deck null pour un préconstruit. Les cases n'ont pas
// de légende : `pointing` (de la fenêtre) montre leur nom au pied quand on les survole.
import { ref, computed } from 'vue'
import PortraitChoice from './PortraitChoice.vue'
import { portraitOf } from './portraits.js'
import { useGridColumns } from './useGridColumns.js'
import { AVAILABLE_HEROES, DEFINITION_BY_ID, heroName } from '../../../game/data.js'
import { fetchMarvelCdbDeck, parseMarvelCdbLink } from '../../../game/marvelcdb.js'
import { ONLINE_PRECONS, fetchOnlinePrecon } from '../../../game/precons.js'
import { fetchMc4dbDeck, parseMc4dbLink, HAS_MC4DB_RELAY } from '../../../game/mc4db.js'
import { cgbuilderImageUrl } from '../../../composables/useAssets.js'
import { useDecksStore, importedDefinitionsOf } from '../../../stores/decks.js'

const props = defineProps({
  /** Le volet affiché : 0 Préconstruits, 1 Mes decks, 2 Charger un deck. */
  tab: { type: Number, required: true },
  /** Le héros choisi (identifiant, 'random' ou null) et son deck (null : le préconstruit). */
  hero: { type: String, default: null },
  deck: { type: Object, default: null },
  /** Les écouteurs qui montrent le nom d'une case au pied de la fenêtre (SetupModal). */
  pointing: { type: Function, required: true }
})
const emit = defineEmits(['pick', 'forget', 'update:tab'])

const decksStore = useDecksStore()

/**
 * Deux rangées au moins (maquette), de dix cases à sa taille, moins sur un écran plus étroit (mesuré) : le
 * nombre de cases vides qui complètent la grille.
 */
const viewportElement = ref(null)
const columns = useGridColumns(viewportElement)
const fillersAfter = count => Math.max(2 * columns.value, Math.ceil(count / columns.value) * columns.value) - count
/** Les cases vides qui finissent la rangée commencée (sans compléter deux rangées). */
const rowFillersAfter = count => (columns.value - (count % columns.value)) % columns.value
/** Le décalage d'arrivée d'une case (SetupModal, --i) : les deux premières rangées l'une après l'autre, la suite ensemble. */
const arrival = index => ({ '--i': Math.min(index, 2 * columns.value) })
const DRAWN_AT_LAUNCH = 'tiré au lancement'

/* ---------- Préconstruits ---------- */

/** Le précon en ligne en cours de lecture (son id), et l'erreur de la dernière lecture. */
const loadingPreconId = ref(null)
const preconError = ref('')
/** Le deck d'un précon lu en ligne : il ne rejoint pas Mes decks ; sa clé le reconnaît comme le choix fait. */
const onlinePreconKey = heroId => `precon:${heroId}`
const onlinePreconDetail = precon => `précon ${precon.aspect} · lu sur MarvelCDB`

/**
 * Le précon d'un héros que la table n'a pas : lu sur MarvelCDB (game/precons.js), il devient le choix du héros ;
 * une lecture ratée (pas de connexion) laisse le choix fait et dit pourquoi. Un second appui pendant la lecture
 * ne fait rien.
 */
async function pickOnlinePrecon(precon) {
  if (loadingPreconId.value) return
  loadingPreconId.value = precon.id
  preconError.value = ''
  try {
    const { hero, deckList } = await fetchOnlinePrecon(precon)
    const deck = { key: onlinePreconKey(hero), label: `précon ${precon.aspect}`, hero, deckList, importedDefinitions: importedDefinitionsOf(hero, deckList) }
    emit('pick', { hero, deck })
  } catch (error) {
    preconError.value = error.message
  } finally {
    loadingPreconId.value = null
  }
}

/* ---------- Mes decks ---------- */

const savedDecks = computed(() => decksStore.playableDecks)
/** Retire un deck sauvegardé ; s'il était le choix fait, le héros est à choisir de nouveau. */
function removeSavedDeck(deck) {
  decksStore.removeDeck(deck.key)
  if (props.deck?.key === deck.key) emit('forget')
}

/* ---------- Charger un deck ---------- */

/** « Ajouter ce deck à ma sélection » : le deck chargé est gardé dans Mes decks. */
const keepDeck = ref(true)
const marvelCdbLink = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
/** Le dernier deck chargé : "Mon deck (Spider-Man) : 40 cartes, dont 3 lues sur MarvelCDB…". */
const loadedSummary = ref('')

/**
 * Un deck lu en ligne (MarvelCDB ou MC4DB) devient le choix du héros, gardé dans Mes decks si la case est
 * cochée ; un chargement raté laisse le choix fait et dit pourquoi. Rend true si le deck a été pris.
 *   key           ce qui reconnaît le deck dans Mes decks (stores/decks.js)
 *   fallbackName  son nom s'il n'a pas de titre (« Deck MarvelCDB », « Deck MC4DB »)
 */
function takeDeck({ deckList, hero, unknownCount, missing, title, heroName: marvelCdbHeroName }, key, fallbackName) {
  if (!hero) {
    errorMessage.value = marvelCdbHeroName
      ? `Deck de ${marvelCdbHeroName} : ce héros n'est pas encore disponible sur la table.`
      : 'Aucune identité reconnue dans ce deck.'
    return false
  }
  // nombre d'exemplaires du deck (hors identité et obligation) qui remplissent la condition
  const countCopies = condition => deckList.reduce((total, [definitionId, copies]) => {
    const definition = DEFINITION_BY_ID[definitionId]
    return total + (definition && !['hero', 'obligation'].includes(definition.type) && condition(definition) ? copies : 0)
  }, 0)
  const label = title || fallbackName
  const deck = { key: `${key}:${hero}`, label, hero, deckList, importedDefinitions: importedDefinitionsOf(hero, deckList) }
  const chosen = keepDeck.value ? decksStore.saveDeck(deck) : deck

  const parts = [`${countCopies(() => true)} cartes`]
  const isOfficialImport = definition => definition.pack === 'marvelcdb' && definition.source !== 'mc4db'
  const importedCount = countCopies(isOfficialImport)
  if (importedCount) {
    // leurs images : les scans français de cgbuilder, sinon ceux, anglais, de MarvelCDB (useAssets.js)
    const englishCount = countCopies(definition => isOfficialImport(definition) && !cgbuilderImageUrl(definition.code))
    let images = 'images françaises de cgbuilder'
    if (englishCount === importedCount) images = 'images en anglais'
    else if (englishCount) images = `${englishCount} image${englishCount > 1 ? 's' : ''} en anglais`
    parts.push(`dont ${importedCount} lue${importedCount > 1 ? 's' : ''} sur MarvelCDB (${images})`)
  }
  // les cartes créées par des fans, lues sur MC4DB (game/mc4db.js) : images anglaises
  const fanCount = countCopies(definition => definition.source === 'mc4db')
  if (fanCount) parts.push(`${fanCount} carte${fanCount > 1 ? 's' : ''} de fans lue${fanCount > 1 ? 's' : ''} sur MC4DB (images en anglais)`)
  if (unknownCount) {
    const plural = unknownCount > 1 ? 's' : ''
    const names = missing.slice(0, 4).join(', ') + (missing.length > 4 ? '…' : '')
    parts.push(`${unknownCount} inconnue${plural} ignorée${plural}${names ? ` : ${names}` : ''}`)
  }
  loadedSummary.value = `« ${label} » (${heroName(hero)}) : ${parts.join(', ')}${keepDeck.value ? ' ; ajouté à Mes decks' : ''}.`
  errorMessage.value = ''
  emit('pick', { hero, deck: chosen })
  return true
}

// un deck par son lien : une decklist de MC4DB (game/mc4db.js, par le relais du site), sinon un deck MarvelCDB, par
// son lien ou son numéro, lu dans l'API publique du site
async function loadOnlineDeck() {
  const input = marvelCdbLink.value
  if (isLoading.value || !input.trim()) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const mc4dbId = parseMc4dbLink(input)
    let taken
    if (mc4dbId) {
      // le relais de MC4DB est un script du site : la version artefact, sans serveur, ne l'a pas
      if (!HAS_MC4DB_RELAY) throw new Error('Les decks MC4DB ne se chargent pas dans cette version de l\'appli.')
      taken = takeDeck(await fetchMc4dbDeck(input), `mc4db:decklist:${mc4dbId}`, 'Deck MC4DB')
    } else {
      const link = parseMarvelCdbLink(input)
      const key = link ? `marvelcdb:${link.kind ?? 'numero'}:${link.id}` : 'marvelcdb'
      taken = takeDeck(await fetchMarvelCdbDeck(input), key, 'Deck MarvelCDB')
    }
    if (taken) marvelCdbLink.value = ''
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div ref="viewportElement" class="deck-viewport">
    <div class="deck-track" :style="{ '--index': tab }">
      <!-- Préconstruits -->
      <section id="deck-panel-precon" class="deck-panel" :class="{ active: tab === 0 }" role="tabpanel"
        aria-labelledby="deck-tab-precon" :inert="tab !== 0">
        <!-- la grille défile : deux rangées en vue (scroll-y : l'ascenseur des fenêtres, main.css) -->
        <div class="choices precons scroll-y">
          <PortraitChoice v-for="(hero, index) in AVAILABLE_HEROES" :key="hero.id" :style="arrival(index)" :label="hero.name"
            :detail="`précon ${hero.aspect}`" v-bind="portraitOf('hero', hero.id)" :selected="props.hero === hero.id && !deck"
            v-on="pointing(hero.name, `précon ${hero.aspect}`)" @pick="emit('pick', { hero: hero.id, deck: null })" />
          <PortraitChoice :style="arrival(AVAILABLE_HEROES.length)" label="Au hasard" :detail="DRAWN_AT_LAUNCH" special
            :selected="props.hero === 'random'" v-on="pointing('Héros au hasard', DRAWN_AT_LAUNCH)"
            @pick="emit('pick', { hero: 'random', deck: null })" />
          <PortraitChoice v-for="n in rowFillersAfter(AVAILABLE_HEROES.length + 1)" :key="`filler-${n}`" filler />
          <!-- les précons lus sur MarvelCDB, au choix du héros -->
          <p class="online-title">Précons lus sur MarvelCDB, au choix du héros (connexion nécessaire)</p>
          <PortraitChoice v-for="(precon, index) in ONLINE_PRECONS" :key="precon.id" :style="arrival(AVAILABLE_HEROES.length + 1 + index)"
            :label="precon.name" :detail="onlinePreconDetail(precon)" v-bind="portraitOf('hero', precon.id, precon.heroCode)"
            :selected="deck?.key === onlinePreconKey(precon.id)" :busy="loadingPreconId === precon.id"
            v-on="pointing(precon.name, onlinePreconDetail(precon))" @pick="pickOnlinePrecon(precon)" />
          <PortraitChoice v-for="n in rowFillersAfter(ONLINE_PRECONS.length)" :key="`online-filler-${n}`" filler />
        </div>
        <p v-if="preconError" class="err precon-error" role="alert">{{ preconError }}</p>
      </section>

      <!-- Mes decks -->
      <section id="deck-panel-mine" class="deck-panel" :class="{ active: tab === 1 }" role="tabpanel"
        aria-labelledby="deck-tab-mine" :inert="tab !== 1">
        <div class="choices" :class="{ empty: !savedDecks.length }">
          <div v-for="(saved, index) in savedDecks" :key="saved.key" class="saved" :style="{ '--i': index }">
            <PortraitChoice :label="saved.label" :detail="heroName(saved.hero)" v-bind="portraitOf('hero', saved.hero)"
              :selected="deck?.key === saved.key" v-on="pointing(saved.label, heroName(saved.hero))"
              @pick="emit('pick', { hero: saved.hero, deck: saved })" />
            <button type="button" class="forget" :aria-label="`Retirer « ${saved.label} » de ma sélection`"
              :title="`Retirer « ${saved.label} » de ma sélection`" @click="removeSavedDeck(saved)">×</button>
          </div>
          <PortraitChoice v-for="n in fillersAfter(savedDecks.length)" :key="`filler-${n}`" filler />
          <!-- aucun deck : une invitation, par-dessus la grille vide -->
          <div v-if="!savedDecks.length" class="empty-note">
            <p>Aucun deck dans votre sélection pour l'instant.</p>
            <button type="button" class="btn" @click="emit('update:tab', 2)">Charger un deck</button>
          </div>
        </div>
      </section>

      <!-- Charger un deck -->
      <section id="deck-panel-load" class="deck-panel" :class="{ active: tab === 2 }" role="tabpanel"
        aria-labelledby="deck-tab-load" :inert="tab !== 2">
        <div class="load">
          <div class="load-row">
            <form class="cdb" :aria-busy="isLoading" @submit.prevent="loadOnlineDeck">
              <input v-model="marvelCdbLink" class="input" type="text" inputmode="url" enterkeyhint="go" autocomplete="off"
                autocapitalize="off" spellcheck="false" aria-label="Lien d'un deck MarvelCDB ou MC4DB" placeholder="Lien MarvelCDB ou MC4DB, ou numéro MarvelCDB">
              <button type="submit" class="btn primary" :disabled="isLoading || !marvelCdbLink.trim()">{{ isLoading ? 'Chargement…' : 'Charger' }}</button>
            </form>
          </div>
          <p class="note">Un deck MarvelCDB publié (ou personnel, si son auteur partage ses decks), ou une decklist MC4DB,
            héros de fans compris ; les cartes absentes de la table sont lues en ligne (images françaises de cgbuilder,
            ou anglaises à défaut).</p>
          <div class="check">
            <input id="keep-deck" v-model="keepDeck" class="checkbox" type="checkbox">
            <label for="keep-deck" class="check-label">Ajouter ce deck à ma sélection</label>
          </div>
          <p v-if="loadedSummary" class="note loaded">{{ loadedSummary }}</p>
          <p v-if="errorMessage" class="err" role="alert">{{ errorMessage }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* le cadre et le rail : trois volets de la largeur du cadre, 48 px entre eux (qu'un voisin ne déborde jamais
   dans le cadre) ; le rail glisse d'un volet à l'autre. Le cadre coupe à gauche et à droite seulement, en
   laissant la place du contour de focus et de la pastille d'un choix */
.deck-viewport { overflow: clip; overflow-clip-margin: 10px; }
.deck-track {
  --gap: 48px;
  display: flex; gap: var(--gap);
  transform: translateX(calc(var(--index) * -1 * (100% + var(--gap))));
  transition: transform 420ms var(--ease-in-out);
}
.deck-panel { flex: 0 0 100%; min-width: 0; transition: opacity 300ms ease; }
.deck-panel:not(.active) { opacity: .35; }

/* les grilles, comme celles des autres étapes : des cases de 88 px, 4 px entre elles */
.choices {
  position: relative; display: grid; grid-template-columns: repeat(auto-fill, calc(88 * var(--su))); gap: calc(4 * var(--su));
  justify-content: center;
}

/* les précons : la grille défile, deux rangées en vue (88 px, 4 px entre elles). Elle déborde de 14 px de chaque
   côté (24 à droite, la place de l'ascenseur) et de 10 px en haut et en bas, rendus en marge intérieure : la même
   largeur utile que les autres grilles (dix cases), et la place du contour de focus d'une case */
.precons {
  --peek: 10px;
  max-height: calc(2 * 88 * var(--su) + 4 * var(--su) + 2 * var(--peek));
  margin: calc(-1 * var(--peek)) -24px calc(-1 * var(--peek)) -14px; padding: var(--peek) 14px;
  overflow-y: auto; overscroll-behavior: contain; align-content: start;
}
/* l'intitulé des précons lus sur MarvelCDB, sur toute la largeur de la grille */
.online-title {
  grid-column: 1 / -1; margin: calc(10 * var(--su)) 0 calc(4 * var(--su)); padding-top: calc(10 * var(--su));
  border-top: 1px solid #34426c; text-align: center; font-size: 13px; color: #c2c3fd;
}
.precon-error { margin-top: 12px; text-align: center; }

/* un deck sauvegardé : sa vignette, et sa croix à cheval sur le coin haut droit (toujours là au doigt, au
   survol à la souris) */
.saved { position: relative; }
.forget {
  position: absolute; z-index: 1; right: calc(-7 * var(--su)); top: calc(-7 * var(--su));
  display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 1px solid #34426c; border-radius: 50%;
  background: #202651; color: #c2c3fd; font: 600 15px/1 var(--font-text); cursor: pointer;
  box-shadow: 0 0 0 2px rgb(0 0 0 / .45);
  transition: opacity 150ms ease, background-color 150ms ease;
}
.forget:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .forget { opacity: 0; }
  .saved:hover .forget, .forget:focus-visible { opacity: 1; }
  .forget:hover { background: #3f4079; }
}
@media (pointer: coarse) {
  .forget { width: 28px; height: 28px; }
}

/* aucun deck : la grille vide, estompée, et l'invitation au milieu */
.choices.empty > .choice { opacity: .5; }
.empty-note {
  position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 12px; text-align: center;
}
.empty-note p { color: #c2c3fd; }

/* le chargement : le fichier, « ou », le lien et son bouton, sur une ligne si la place le permet ; dessous
   l'explication, la case à cocher, puis ce qui a été chargé ou l'erreur */
/* le tout tient dans la hauteur de deux rangées de cases : le volet ne grandit pas le rail */
.load { display: grid; gap: 10px; align-content: start; max-width: calc(760 * var(--su)); margin: 0 auto; padding-top: 4px; }
.load .note { font-size: 13px; line-height: 1.4; }
.load-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.cdb { flex: 1 1 320px; display: flex; gap: 8px; min-width: 0; }
.cdb .input { flex: 1; min-width: 0; }
.input {
  min-height: 40px; padding: 8px 12px;
  background: rgb(17 23 50 / .6); border: 1px solid #34426c; border-radius: 6px; color: var(--fg);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.input::placeholder { color: #6567c6; }
.input:focus-visible { outline: none; border-color: var(--yellow); box-shadow: 0 0 0 1px var(--yellow); }
.loaded { color: #c2c3fd; }

/* la case à cocher du site (formulaire « Rester informé ») : un carré sombre, filet bleu ; cochée, filet
   lavande sur fond violet, la coche qui apparaît en grandissant */
.check { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; }
.checkbox {
  appearance: none; -webkit-appearance: none; display: grid; place-content: center; flex: none;
  width: 20px; height: 20px; margin: 0; cursor: pointer;
  border: 1px solid #34426c; border-radius: 4px; background: rgb(13 16 37 / .5);
  box-shadow: 0 0 0 2px rgb(0 0 0 / .25);
  transition: background-color 150ms ease, border-color 150ms ease;
}
.checkbox::before {
  content: ''; width: 12px; height: 12px; background: #c2c3fd;
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0, 43% 62%);
  transform: scale(0); transition: transform 160ms var(--ease-out);
}
.checkbox:checked { border-color: #c2c3fd; background: rgb(48 51 101 / .85); }
.checkbox:checked::before { transform: none; }
.checkbox:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
.check-label { color: #c2c3fd; cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  .checkbox:not(:checked):hover, .check:has(.check-label:hover) .checkbox:not(:checked) { border-color: #6567c6; }
}
@media (pointer: coarse) {
  .input { font-size: 16px; min-height: 44px; } /* sous 16 px, iOS zoome la page quand le champ prend le focus */
  .checkbox { width: 24px; height: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .deck-track { transition: none; }
  .checkbox::before { transition: none; }
}
</style>
