<script setup>
// La fenêtre « Nouvelle partie » (maquette Figma « Préparation de la partie ») : trois hexagones, le héros puis,
// après le VS, le méchant et le set modulaire. Ils sont vides (« ? ») à l'ouverture ; celui de l'étape en cours
// porte deux anneaux. Choisir une vignette remplit son hexagone du portrait et passe à l'étape suivante encore
// vide ; un appui sur un hexagone revient à son étape. La difficulté se règle au pied, à gauche ; « Lancer la
// partie » s'allume quand les trois hexagones sont remplis.
// Seuls les héros, scénarios et sets modulaires des boîtes proposées (AVAILABLE_PACKS, data.js) y figurent.
import { reactive, ref, computed, watch, nextTick, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import SetupHex from './setup/SetupHex.vue'
import PortraitChoice from './setup/PortraitChoice.vue'
import DiceIcon from './setup/DiceIcon.vue'
import { portraitOf } from './setup/portraits.js'
import vsUrl from '../../assets/setup/vs-dim.svg'
import {
  HEROES, SCENARIOS, MODULAR_SETS, AVAILABLE_HEROES, AVAILABLE_SCENARIOS, AVAILABLE_MODULAR_SETS, DEFINITION_BY_ID, heroName
} from '../../game/data.js'
import { scenarioRules } from '../../game/rules.js'
import { fetchMarvelCdbDeck } from '../../game/marvelcdb.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()

/** Les trois étapes, dans l'ordre des hexagones. */
const STEPS = [
  { id: 'hero', name: 'Héros', title: 'Choix du héros' },
  { id: 'villain', name: 'Méchant', title: 'Choix du méchant' },
  { id: 'modular', name: 'Set modulaire', title: 'Choix du set modulaire' }
]
const DIFFICULTIES = [
  { id: 'standard', label: 'Standard', title: 'Étapes I et II du méchant, set Standard' },
  { id: 'expert', label: 'Expert', title: 'Étapes II et III du méchant, set Expert' },
  { id: 'random', label: 'Hasard', title: 'Standard ou expert, tiré à la mise en place' }
]

/** Étape affichée (0 héros, 1 méchant, 2 set modulaire). */
const step = ref(0)
/** Sens du dernier changement d'étape : 1 en avant, -1 en arrière ; le contenu glisse dans ce sens. */
const direction = ref(1)

/** La partie en cours : seule sa difficulté est reprise, les hexagones s'ouvrent vides. */
const previousSetup = gameStore.game?.setup ?? {}
const form = reactive({
  /** Identifiant du héros (son deck préconstruit), 'import' (le deck personnalisé), ou null : à choisir. */
  deckChoice: null,
  /** Identifiant du scénario, ou null. */
  scenario: null,
  /** null : à choisir ; 'random' ; ou les sets modulaires choisis (autant que le scénario en prend). */
  modulars: null,
  /** 'standard', 'expert' ou 'random'. */
  difficulty: previousSetup.randomChoices?.includes('expert') ? 'random' : previousSetup.expert ? 'expert' : 'standard'
})

/* ---------- héros et deck personnalisé ---------- */

/** Le deck personnalisé importé : {deckList, hero, label, cardCount, importedCount, unknownCount, missing}. */
const importedDeck = ref(null)
const errorMessage = ref('')
/** Le panneau d'import (fichier, lien MarvelCDB), ouvert par la vignette « + ». */
const showImport = ref(false)
const heroOf = heroId => HEROES.find(hero => hero.id === heroId)
const usesImportedDeck = computed(() => form.deckChoice === 'import' && !!importedDeck.value)
const chosenHero = computed(() => (usesImportedDeck.value ? importedDeck.value.hero : form.deckChoice))
/** "Mon deck : 40 cartes, dont 3 lues sur MarvelCDB…, 2 inconnues ignorées : …" */
const importSummary = computed(() => {
  const deck = importedDeck.value
  const parts = [`${deck.cardCount} cartes`]
  if (deck.importedCount) parts.push(`dont ${deck.importedCount} lue${deck.importedCount > 1 ? 's' : ''} sur MarvelCDB (images du site, en anglais)`)
  if (deck.unknownCount) {
    const names = deck.missing.slice(0, 4).join(', ') + (deck.missing.length > 4 ? '…' : '')
    const plural = deck.unknownCount > 1 ? 's' : ''
    parts.push(`${deck.unknownCount} inconnue${plural} ignorée${plural}${names ? ` : ${names}` : ''}`)
  }
  return `${deck.label} : ${parts.join(', ')}.`
})

/* ---------- scénario et sets modulaires ---------- */

/** Les sets modulaires conseillés d'un scénario : un, ou plusieurs (Crossbones 3, Crâne Rouge 2). */
const advisedModularsOf = scenarioId => SCENARIOS.find(scenario => scenario.id === scenarioId)?.advisedModulars ?? []
const modularsNeededBy = scenarioId => Math.max(1, advisedModularsOf(scenarioId).length)
const chosenScenario = computed(() => SCENARIOS.find(scenario => scenario.id === form.scenario) ?? null)
// plusieurs méchants à la fois (Les Démolisseurs) : pas de set modulaire
const isCrew = computed(() => !!form.scenario && !!scenarioRules(form.scenario).crew)
const modularsNeeded = computed(() => modularsNeededBy(form.scenario))
const pickedModulars = computed(() => (Array.isArray(form.modulars) ? form.modulars : []))
const modularName = modularId => MODULAR_SETS.find(modular => modular.id === modularId)?.name ?? ''

/* ---------- les étapes ---------- */

/** Chaque étape est-elle faite (son hexagone rempli) ? */
const doneSteps = computed(() => [
  !!form.deckChoice,
  !!form.scenario,
  isCrew.value || form.modulars === 'random' || (pickedModulars.value.length > 0 && pickedModulars.value.length === modularsNeeded.value)
])
const isReady = computed(() => doneSteps.value.every(Boolean))

function goTo(index) {
  if (index === step.value) return
  direction.value = index > step.value ? 1 : -1
  step.value = index
}
/** Après un choix : l'étape suivante encore vide (en repartant du début s'il le faut), sinon on reste. */
function goToNextOpenStep() {
  const open = [1, 2].map(offset => (step.value + offset) % STEPS.length).find(index => !doneSteps.value[index])
  if (open !== undefined) goTo(open)
}

function pickHero(deckChoice) {
  form.deckChoice = deckChoice
  showImport.value = false
  goToNextOpenStep()
}
function pickScenario(scenarioId) {
  // un autre méchant qui ne prend pas le même nombre de sets : les sets choisis ne conviennent plus
  if (pickedModulars.value.length && modularsNeededBy(scenarioId) !== modularsNeeded.value) form.modulars = null
  form.scenario = scenarioId
  goToNextOpenStep()
}
// un seul set : le choix le remplace ; plusieurs : un choix coche ou décoche un set, le plus ancien cède sa place au-delà du nombre
function pickModular(modularId) {
  const current = pickedModulars.value
  if (modularId === 'random') form.modulars = 'random'
  else if (modularsNeeded.value === 1) form.modulars = [modularId]
  else if (current.includes(modularId)) form.modulars = current.length > 1 ? current.filter(id => id !== modularId) : null
  else form.modulars = [...current, modularId].slice(-modularsNeeded.value)
  if (doneSteps.value[2]) goToNextOpenStep()
}

/** Ce que montre chaque hexagone. */
const hexes = computed(() => {
  const heroValue = form.deckChoice ? heroName(chosenHero.value) : ''
  const modularValue = isCrew.value ? 'aucun' : form.modulars === 'random' ? 'au hasard' : pickedModulars.value.map(modularName).join(', ')
  return [
    { value: heroValue, ...(form.deckChoice ? portraitOf('hero', chosenHero.value) : {}) },
    { value: chosenScenario.value?.villainName ?? '', ...(form.scenario ? portraitOf('villain', form.scenario) : {}) },
    {
      value: doneSteps.value[2] ? modularValue : '',
      random: form.modulars === 'random',
      ...(pickedModulars.value.length && !isCrew.value ? portraitOf('modular', pickedModulars.value[0]) : {})
    }
  ].map((hex, index) => ({ ...hex, ...STEPS[index], done: doneSteps.value[index] }))
})

/**
 * L'affiche sous les hexagones, comme celle de la barre du haut : « Spider-Man vs Rhino + Alerte à la Bombe »,
 * au fil des choix. Des morceaux : {text, link} (link : le mot de liaison, plus discret).
 */
const matchup = computed(() => {
  const [hero, villain, modular] = hexes.value
  const parts = []
  if (hero.value) parts.push({ text: hero.value })
  if (villain.value) parts.push({ text: 'vs', link: true }, { text: villain.value })
  if (modular.value && !isCrew.value) parts.push({ text: '+', link: true }, { text: form.modulars === 'random' ? 'set au hasard' : modular.value })
  if (parts[0]?.link) parts.shift() // « vs Rhino » sans héros : le méchant seul
  return parts
})

/* ---------- import d'un deck ---------- */

/**
 * Un deck lu (fichier ou MarvelCDB) devient le deck personnalisé et remplit l'hexagone du héros ; un import
 * raté garde le précédent et affiche pourquoi. Rend true si le deck a été gardé.
 *   fallbackName  nom du deck s'il n'a pas de titre (nom du fichier, « Deck MarvelCDB »)
 */
function keepImportedDeck({ deckList, hero, unknownCount, missing, title, heroName: marvelCdbHeroName }, fallbackName) {
  if (!hero) {
    errorMessage.value = marvelCdbHeroName
      ? `Deck de ${marvelCdbHeroName} : ce héros n'est pas encore disponible sur la table.`
      : 'Aucune identité reconnue dans ce deck. Choisis un fichier .o8d OCTGN (héros de la boîte de base) ou un export texte MarvelCDB (.txt) d\'un des héros disponibles.'
    return false
  }
  // nombre d'exemplaires du deck (hors identité et obligation) qui remplissent la condition
  const countCopies = condition => deckList.reduce((total, [definitionId, copies]) => {
    const definition = DEFINITION_BY_ID[definitionId]
    return total + (!['hero', 'obligation'].includes(definition.type) && condition(definition) ? copies : 0)
  }, 0)
  importedDeck.value = {
    deckList, hero, label: title || fallbackName, unknownCount, missing,
    cardCount: countCopies(() => true),
    importedCount: countCopies(definition => definition.pack === 'marvelcdb') // cartes lues sur MarvelCDB, avec les images du site
  }
  errorMessage.value = ''
  pickHero('import')
  return true
}

// fichier .o8d d'OCTGN ou export texte de MarvelCDB (.txt)
async function importDeckFile(event) {
  const file = event.target.files[0]
  event.target.value = '' // le même fichier peut être choisi à nouveau après une correction
  if (file) keepImportedDeck(gameStore.parseDeckFile(await file.text()), file.name.replace(/\.[^.]+$/, ''))
}

// un deck MarvelCDB par son lien ou son numéro, lu dans l'API publique du site
const marvelCdbLink = ref('')
const isImporting = ref(false)
async function importMarvelCdbDeck() {
  if (isImporting.value || !marvelCdbLink.value.trim()) return
  isImporting.value = true
  errorMessage.value = ''
  try {
    if (keepImportedDeck(await fetchMarvelCdbDeck(marvelCdbLink.value), 'Deck MarvelCDB')) marvelCdbLink.value = ''
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    isImporting.value = false
  }
}

/* ---------- lancement ---------- */

/** « Lancer la partie » : la nouvelle partie, avec les trois choix et la difficulté. */
function startGame() {
  if (!isReady.value) return
  gameStore.newGame({
    hero: chosenHero.value,
    deckList: usesImportedDeck.value ? importedDeck.value.deckList : gameStore.preconDeck(chosenHero.value),
    scenario: form.scenario,
    modulars: isCrew.value ? [] : form.modulars === 'random' ? 'random' : [...form.modulars],
    expert: form.difficulty === 'random' ? 'random' : form.difficulty === 'expert',
    deckLabel: usesImportedDeck.value ? importedDeck.value.label : `précon ${heroOf(chosenHero.value).aspect}`
  })
  ui.closeModal()
  ui.closeIntro() // ouverte depuis l'accueil (« Scénarios ») : la nouvelle partie apparaît
}

/* ---------- focus ---------- */

// à l'ouverture et à chaque étape, le focus va au choix fait de l'étape, sinon à sa première vignette :
// au clavier, on enchaîne les trois choix sans chercher où l'on est
// (l'étape qui arrive : celle qui part est encore là le temps de son fondu, avec une classe « …-leave-… »)
const stageElement = ref(null)
function focusChoice() {
  const panel = stageElement.value?.querySelector('.panel:not([class*="-leave-"])')
  const choice = panel?.querySelector('.choice[aria-pressed="true"]') ?? panel?.querySelector('.choice')
  choice?.focus({ preventScroll: true })
}
onMounted(focusChoice)
watch(step, async () => {
  await nextTick()
  focusChoice()
})
</script>

<template>
  <BaseModal title="Préparation de la partie" wide>
    <div class="setup">
      <!-- les trois hexagones : héros, VS, méchant, set modulaire -->
      <ol class="hexes" aria-label="Étapes de la mise en place">
        <li v-for="(hex, index) in hexes" :key="hex.id">
          <SetupHex :name="hex.name" :value="hex.value" :done="hex.done" :active="step === index" :image-url="hex.imageUrl"
            :crop="hex.crop" :random="hex.random" @select="goTo(index)" />
          <img v-if="index === 0" class="vs" :src="vsUrl" width="42.9686" height="36.0131" alt="" draggable="false">
        </li>
      </ol>
      <p class="matchup" aria-live="polite">
        <span v-for="(part, index) in matchup" :key="index" :class="{ link: part.link }">{{ part.text }}</span>
      </p>

      <!-- le contenu de l'étape : il glisse dans le sens du changement d'étape, les vignettes arrivent l'une après l'autre -->
      <div ref="stageElement" class="stage">
        <Transition :name="direction > 0 ? 'step-forward' : 'step-back'" :duration="{ enter: 460, leave: 150 }">
          <section :key="step" class="panel" :aria-labelledby="`setup-step-${step}`">
            <h3 :id="`setup-step-${step}`" class="step-title">{{ STEPS[step].title }}</h3>

            <template v-if="step === 0">
              <div class="choices">
                <PortraitChoice v-for="(hero, index) in AVAILABLE_HEROES" :key="hero.id" :style="{ '--i': index }" :label="hero.name"
                  :detail="hero.aspect" v-bind="portraitOf('hero', hero.id)" :selected="form.deckChoice === hero.id"
                  @pick="pickHero(hero.id)" />
                <PortraitChoice v-if="importedDeck" :style="{ '--i': AVAILABLE_HEROES.length }" :label="importedDeck.label"
                  detail="Deck importé" v-bind="portraitOf('hero', importedDeck.hero)" :selected="form.deckChoice === 'import'"
                  @pick="pickHero('import')" />
                <PortraitChoice :style="{ '--i': AVAILABLE_HEROES.length + 1 }" label="Deck personnalisé" dashed
                  :selected="showImport" :aria-expanded="showImport" aria-controls="setup-import" @pick="showImport = !showImport">
                  <span class="plus" aria-hidden="true">+</span>
                </PortraitChoice>
              </div>
              <Transition name="reveal">
                <div v-if="showImport" id="setup-import" class="import">
                  <label class="btn file-btn">Fichier .o8d ou .txt<input type="file" accept=".o8d,.xml,.txt"
                      aria-label="Importer un fichier de deck" @change="importDeckFile"></label>
                  <form class="cdb" :aria-busy="isImporting" @submit.prevent="importMarvelCdbDeck">
                    <input v-model="marvelCdbLink" type="text" inputmode="url" enterkeyhint="go" autocomplete="off" autocapitalize="off"
                      spellcheck="false" aria-label="Lien d'un deck MarvelCDB" placeholder="Lien MarvelCDB ou numéro de decklist">
                    <button type="submit" class="btn" :disabled="isImporting || !marvelCdbLink.trim()">{{ isImporting ? 'Import…' : 'Importer' }}</button>
                  </form>
                  <p class="note">Par lien, un héros ou des cartes absents de la table sont lus sur MarvelCDB, avec les images du site (en anglais).</p>
                </div>
              </Transition>
              <p v-if="importedDeck" class="note">{{ importSummary }}</p>
              <p v-if="errorMessage" class="err" role="alert">{{ errorMessage }}</p>
            </template>

            <div v-else-if="step === 1" class="choices">
              <PortraitChoice v-for="(scenario, index) in AVAILABLE_SCENARIOS" :key="scenario.id" :style="{ '--i': index }"
                :label="scenario.villainName" :detail="scenario.title ?? scenario.level" v-bind="portraitOf('villain', scenario.id)"
                :selected="form.scenario === scenario.id" @pick="pickScenario(scenario.id)" />
            </div>

            <template v-else>
              <p v-if="isCrew" class="note">Les Démolisseurs : quatre méchants en jeu, chacun avec sa manigance annexe et son
                propre paquet Rencontre ; ni set modulaire, ni set Standard, ni obligation, ni Némésis.</p>
              <template v-else>
                <div class="choices">
                  <PortraitChoice v-for="(modular, index) in AVAILABLE_MODULAR_SETS" :key="modular.id" :style="{ '--i': index }"
                    :label="modular.name" v-bind="portraitOf('modular', modular.id)" :selected="pickedModulars.includes(modular.id)"
                    :advised="advisedModularsOf(form.scenario).includes(modular.id)" @pick="pickModular(modular.id)" />
                  <PortraitChoice :style="{ '--i': AVAILABLE_MODULAR_SETS.length }" label="Au hasard"
                    :detail="modularsNeeded > 1 ? `${modularsNeeded} sets tirés` : 'Tiré en secret'" :selected="form.modulars === 'random'"
                    @pick="pickModular('random')">
                    <DiceIcon class="dice" />
                  </PortraitChoice>
                </div>
                <p v-if="chosenScenario" class="note legend"><span class="star" aria-hidden="true">★</span> Conseillé avec
                  {{ chosenScenario.villainName }}<template v-if="modularsNeeded > 1"> · {{ modularsNeeded }} sets à choisir
                    ({{ pickedModulars.length }} choisi{{ pickedModulars.length > 1 ? 's' : '' }})</template></p>
              </template>
            </template>
          </section>
        </Transition>
      </div>
    </div>

    <template #actions>
      <div class="difficulty" role="radiogroup" aria-label="Difficulté">
        <label v-for="option in DIFFICULTIES" :key="option.id" :title="option.title">
          <input v-model="form.difficulty" type="radio" name="difficulty" :value="option.id">
          <span>{{ option.label }}</span>
        </label>
      </div>
      <span class="sp" />
      <button type="button" class="slant" @click="ui.closeModal()">Annuler</button>
      <button type="button" class="slant red" :disabled="!isReady" @click="startGame">Lancer la partie</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.setup { display: grid; justify-items: center; }

/* les hexagones, aux écarts de la maquette : 5 px de part et d'autre du VS, 11 px entre méchant et set */
.hexes { display: flex; align-items: flex-start; margin: calc(26 * var(--su)) 0 0; padding: 0; list-style: none; }
.hexes li { display: flex; align-items: flex-start; }
.hexes li:last-child { margin-left: calc(11.22 * var(--su)); }
/* le VS sombre, descendu au pied des hexagones */
.vs { width: calc(42.9686 * var(--su)); height: calc(36.0131 * var(--su)); margin: calc(71 * var(--su)) calc(5.1 * var(--su)) 0; }

/* l'affiche des choix faits, sous les hexagones ; sa ligne reste réservée, vide, pour que rien ne bouge */
.matchup {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 0 .35em; min-height: 1.2em; max-width: none;
  margin: calc(28 * var(--su)) 0 0; text-align: center;
  font: italic 700 max(18px, calc(22 * var(--su)))/1.2 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
  color: #c9cbf2;
}
.matchup .link { color: var(--steel); }

/* le contenu de l'étape : les deux étapes se superposent le temps du fondu */
.stage { display: grid; justify-self: stretch; margin-top: calc(40 * var(--su)); }
.panel { grid-area: 1 / 1; display: grid; gap: calc(30 * var(--su)); align-content: start; min-width: 0; }
.step-title {
  margin: 0; font: italic 700 max(20px, calc(28 * var(--su)))/1.1 var(--font-display); letter-spacing: -.02em;
  text-transform: uppercase; color: var(--fg);
}
.choices { display: flex; flex-wrap: wrap; gap: calc(28 * var(--su)) calc(14 * var(--su)); padding: 8px 8px 0; margin: -8px -8px 0; }

.plus { font: italic 700 calc(44 * var(--su))/1 var(--font-display); color: var(--yellow); }
.choices .dice { width: calc(40 * var(--su)); height: calc(40 * var(--su)); }
.legend .star { color: var(--yellow); }

/* le panneau d'import, sous les vignettes */
.import { display: grid; gap: 10px; justify-items: start; }
.cdb { display: flex; flex-wrap: wrap; gap: 8px; width: min(100%, 520px); }
.cdb input {
  flex: 1 1 240px; min-width: 0; background: rgb(17 23 50 / .6); border: 1px solid #34426c; border-radius: 6px; padding: 6px 10px;
  transition: border-color 150ms ease;
}
.cdb input::placeholder { color: var(--muted); }
.cdb input:focus-visible { outline: none; border-color: var(--yellow); }
/* sous 16 px, iOS zoome la page quand le champ prend le focus */
@media (pointer: coarse) {
  .cdb input { font-size: 16px; min-height: 36px; }
}

/* changement d'étape : le contenu glisse dans le sens de la marche (en avant : vers la gauche), en fondu ; les
   vignettes arrivent l'une après l'autre (25 ms d'écart), sans jamais bloquer un appui. L'étape qui part
   s'efface vite et ne prend plus les appuis */
.step-forward-enter-active, .step-back-enter-active { transition: opacity 220ms var(--ease-out), transform 300ms var(--ease-out); }
.step-forward-leave-active, .step-back-leave-active { transition: opacity 130ms ease, transform 150ms ease; pointer-events: none; }
.step-forward-enter-from { opacity: 0; transform: translateX(calc(20 * var(--su))); }
.step-forward-leave-to { opacity: 0; transform: translateX(calc(-12 * var(--su))); }
.step-back-enter-from { opacity: 0; transform: translateX(calc(-20 * var(--su))); }
.step-back-leave-to { opacity: 0; transform: translateX(calc(12 * var(--su))); }
.step-forward-enter-active .choice, .step-back-enter-active .choice {
  transition: opacity 200ms var(--ease-out), transform 260ms var(--ease-out);
  transition-delay: calc(40ms + var(--i, 0) * 25ms);
}
.step-forward-enter-from .choice, .step-back-enter-from .choice { opacity: 0; transform: translateY(calc(8 * var(--su))); }

/* le panneau d'import se déplie sous les vignettes */
.reveal-enter-active { transition: opacity 200ms var(--ease-out), transform 220ms var(--ease-out); }
.reveal-leave-active { transition: opacity 120ms ease; }
.reveal-enter-from { opacity: 0; transform: translateY(-6px); }
.reveal-leave-to { opacity: 0; }

/* la difficulté, au pied à gauche : trois onglets en biais bord à bord, comme les boutons, en violet (le badge
   « Expert » de la barre du haut) ; le choix fait est plein. Le contour de focus serait coupé par le biais :
   le pied de l'onglet passe au jaune */
.difficulty { display: flex; align-self: center; margin-top: calc(7 * var(--su)); }
.difficulty label { --h: calc(32 * var(--su)); --cut: calc(var(--h) * .441); position: relative; cursor: pointer; }
.difficulty label + label { margin-left: calc(2px - var(--cut)); }
.difficulty input { position: absolute; opacity: 0; pointer-events: none; }
.difficulty span {
  display: flex; align-items: center; height: var(--h); padding: 0 calc(var(--cut) + 10px);
  font: italic 600 max(16px, calc(20 * var(--su)))/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
  color: #a3a5ee; background: rgb(101 103 198 / .14);
  clip-path: polygon(var(--cut) 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
  transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease;
}
.difficulty input:checked + span { background: #6567c6; color: var(--fg); }
.difficulty input:focus-visible + span { box-shadow: inset 0 -3px 0 var(--yellow); }
@media (hover: hover) and (pointer: fine) {
  .difficulty label:hover input:not(:checked) + span { background: rgb(101 103 198 / .26); color: var(--fg); }
}

@media (prefers-reduced-motion: reduce) {
  .step-forward-enter-from, .step-forward-leave-to, .step-back-enter-from, .step-back-leave-to,
  .step-forward-enter-from .choice, .step-back-enter-from .choice, .reveal-enter-from { transform: none; }
  .step-forward-enter-active .choice, .step-back-enter-active .choice { transition-delay: 0ms; }
}
</style>
