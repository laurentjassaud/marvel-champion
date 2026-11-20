<script setup>
// La fenêtre « Nouvelle partie » (maquette Figma « Préparation de la partie », 2e version). Dans l'en-tête,
// les trois étapes (le héros, le méchant, le set modulaire), vides à l'ouverture, et la difficulté à droite.
// Dessous, les onglets des étapes et la grille de leurs choix. Choisir une case remplit son étape du portrait
// et passe à l'étape suivante encore vide ; un appui sur une étape ou un onglet y revient. Au pied, à gauche,
// l'affiche des choix faits (« Spider-Man vs Rhino + Alerte à la bombe »), ou le nom de la case survolée ;
// « Lancer la partie » s'allume quand les trois étapes sont remplies.
// Chaque étape a sa case « Au hasard » : le héros (avec son deck préconstruit) et le méchant sont tirés au
// lancement (engine/setup.js), le set modulaire à la mise en place, gardé secret. L'import d'un deck
// personnalisé (fichier .o8d ou .txt, lien MarvelCDB) est retiré de la fenêtre en attendant sa version 2 ; le
// moteur sait toujours le lire (engine/deckImport.js, game/marvelcdb.js).
// Seuls les héros, scénarios et sets modulaires des boîtes proposées (AVAILABLE_PACKS, data.js) y figurent.
import { reactive, ref, computed, watch, nextTick, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import SetupHex from './setup/SetupHex.vue'
import PortraitChoice from './setup/PortraitChoice.vue'
import { portraitOf } from './setup/portraits.js'
import heroIconUrl from '../../assets/setup/icon-hero.svg'
import villainIconUrl from '../../assets/setup/icon-villain.svg'
import modularIconUrl from '../../assets/setup/icon-modular.svg'
import {
  HEROES, SCENARIOS, MODULAR_SETS, AVAILABLE_HEROES, AVAILABLE_SCENARIOS, AVAILABLE_MODULAR_SETS, heroName
} from '../../game/data.js'
import { scenarioRules } from '../../game/rules.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()

/**
 * Les trois étapes, dans l'ordre ; l'icône de leur onglet (maquette : 25,8 × 28,9, 26 × 28 et 30,4 × 33,6 px),
 * dessinée en masque pour prendre la couleur de l'onglet.
 */
const STEPS = [
  { id: 'hero', name: 'Héros', icon: { mask: `url("${heroIconUrl}")`, width: 25.791, height: 28.891 } },
  { id: 'villain', name: 'Méchant', icon: { mask: `url("${villainIconUrl}")`, width: 25.982, height: 28 } },
  { id: 'modular', name: 'Set modulaire', icon: { mask: `url("${modularIconUrl}")`, width: 30.441, height: 33.609 } }
]
const DIFFICULTIES = [
  { id: 'standard', label: 'Normal', title: 'Mode standard : étapes I et II du méchant, set Standard' },
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
  /** Identifiant du héros (il joue son deck préconstruit), 'random' (tiré au lancement), ou null : à choisir. */
  hero: null,
  /** Identifiant du scénario, 'random' (tiré au lancement), ou null. */
  scenario: null,
  /** null : à choisir ; 'random' ; ou les sets modulaires choisis (autant que le scénario en prend). */
  modulars: null,
  /** 'standard', 'expert' ou 'random'. */
  difficulty: previousSetup.randomChoices?.includes('expert') ? 'random' : previousSetup.expert ? 'expert' : 'standard'
})

/* ---------- héros, scénario et sets modulaires ---------- */

const heroOf = heroId => HEROES.find(hero => hero.id === heroId)
/** Le détail d'une case « Au hasard », au pied quand on la survole. */
const DRAWN_AT_LAUNCH = 'tiré au lancement'

/**
 * Les sets modulaires conseillés d'un scénario : un, ou plusieurs (Crossbones 3, Crâne Rouge 2). Un méchant
 * tiré au hasard n'en conseille aucun, et prend un set.
 */
const advisedModularsOf = scenarioId => SCENARIOS.find(scenario => scenario.id === scenarioId)?.advisedModulars ?? []
const modularsNeededBy = scenarioId => Math.max(1, advisedModularsOf(scenarioId).length)
const chosenScenario = computed(() => SCENARIOS.find(scenario => scenario.id === form.scenario) ?? null)
// plusieurs méchants à la fois (Les Démolisseurs) : pas de set modulaire
const isCrew = computed(() => !!chosenScenario.value && !!scenarioRules(chosenScenario.value.id).crew)
const modularsNeeded = computed(() => modularsNeededBy(form.scenario))
const pickedModulars = computed(() => (Array.isArray(form.modulars) ? form.modulars : []))
const modularName = modularId => MODULAR_SETS.find(modular => modular.id === modularId)?.name ?? ''

/* ---------- les étapes ---------- */

/** Chaque étape est-elle faite (son hexagone rempli) ? */
const doneSteps = computed(() => [
  !!form.hero,
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

function pickHero(heroId) {
  form.hero = heroId
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

/** Ce que montre chaque étape ; un choix « au hasard » y montre « Hasard » à la place du portrait. */
const hexes = computed(() => {
  const heroRandom = form.hero === 'random'
  const villainRandom = form.scenario === 'random'
  const heroValue = heroRandom ? 'au hasard' : form.hero ? heroName(form.hero) : ''
  const villainValue = villainRandom ? 'au hasard' : chosenScenario.value?.villainName ?? ''
  const modularValue = isCrew.value ? 'aucun' : form.modulars === 'random' ? 'au hasard' : pickedModulars.value.map(modularName).join(', ')
  return [
    { value: heroValue, random: heroRandom, ...(form.hero && !heroRandom ? portraitOf('hero', form.hero) : {}) },
    { value: villainValue, random: villainRandom, ...(chosenScenario.value ? portraitOf('villain', form.scenario) : {}) },
    {
      value: doneSteps.value[2] ? modularValue : '',
      random: form.modulars === 'random',
      ...(pickedModulars.value.length && !isCrew.value ? portraitOf('modular', pickedModulars.value[0]) : {})
    }
  ].map((hex, index) => ({ ...hex, ...STEPS[index], done: doneSteps.value[index] }))
})

/**
 * L'affiche du pied, comme celle de la barre du haut : « Spider-Man vs Rhino + Alerte à la Bombe », au fil des
 * choix. Des morceaux : {text, link} (link : le mot de liaison, plus discret).
 */
const matchup = computed(() => {
  const [hero, villain, modular] = hexes.value
  const parts = []
  if (hero.value) parts.push({ text: hero.random ? 'héros au hasard' : hero.value })
  if (villain.value) parts.push({ text: 'vs', link: true }, { text: villain.random ? 'méchant au hasard' : villain.value })
  if (modular.value && !isCrew.value) parts.push({ text: '+', link: true }, { text: form.modulars === 'random' ? 'set au hasard' : modular.value })
  if (parts[0]?.link) parts.shift() // « vs Rhino » sans héros : le méchant seul
  return parts
})

/* ---------- la grille et le pied ---------- */

/** Dix cases par rangée, deux rangées au moins (maquette) : des cases vides complètent la dernière. */
const COLUMNS = 10
/** Nombre de cases de l'étape affichée : ses choix et sa case « Au hasard ». */
const cellCount = computed(() => {
  if (step.value === 0) return AVAILABLE_HEROES.length + 1
  if (step.value === 1) return AVAILABLE_SCENARIOS.length + 1
  return isCrew.value ? 0 : AVAILABLE_MODULAR_SETS.length + 1
})
const fillerCount = computed(() => Math.max(2 * COLUMNS, Math.ceil(cellCount.value / COLUMNS) * COLUMNS) - cellCount.value)

/**
 * La case survolée, ou qui a le focus au clavier : son nom et son détail ({label, detail}), montrés au pied à la
 * place de l'affiche (les cases n'ont pas de légende). Un focus donné par le script, après un choix à la souris,
 * ne compte pas : seul celui qui se voit (:focus-visible).
 */
const pointedChoice = ref(null)
const pointing = (label, detail = '') => ({
  pointerenter: () => { pointedChoice.value = { label, detail } },
  pointerleave: () => { pointedChoice.value = null },
  focus: event => { if (event.target.matches(':focus-visible')) pointedChoice.value = { label, detail } },
  blur: () => { pointedChoice.value = null }
})
watch(step, () => { pointedChoice.value = null })

/** Les onglets au clavier (rôle tablist) : les flèches passent à l'étape voisine, Début et Fin aux extrémités. */
let focusTabAfterStep = false
function onTabKey(event) {
  const target = { ArrowRight: step.value + 1, ArrowLeft: step.value - 1, Home: 0, End: STEPS.length - 1 }[event.key]
  if (target === undefined) return
  event.preventDefault()
  const next = (target + STEPS.length) % STEPS.length
  if (next === step.value) return
  focusTabAfterStep = true
  goTo(next)
}

/* ---------- lancement ---------- */

/**
 * « Lancer la partie » : la nouvelle partie, avec les trois choix et la difficulté. Un héros ou un méchant
 * « au hasard » est passé tel quel : le moteur le tire (engine/setup.js, drawRandomHeroAndScenario).
 * La fenêtre et l'accueil (ou la partie en cours) s'en vont d'abord ; la partie est mise en place sur l'écran
 * vide, puis la table entre (ui.launchGame).
 */
function startGame() {
  if (!isReady.value) return
  const randomHero = form.hero === 'random'
  const options = {
    hero: form.hero,
    deckList: randomHero ? null : gameStore.preconDeck(form.hero),
    scenario: form.scenario,
    modulars: isCrew.value ? [] : form.modulars === 'random' ? 'random' : [...form.modulars],
    expert: form.difficulty === 'random' ? 'random' : form.difficulty === 'expert',
    deckLabel: randomHero ? null : `précon ${heroOf(form.hero).aspect}`
  }
  ui.launchGame(() => gameStore.newGame(options))
}

/* ---------- focus ---------- */

// à l'ouverture et à chaque étape, le focus va au choix fait de l'étape, sinon à sa première case : au
// clavier, on enchaîne les trois choix sans chercher où l'on est ; après une flèche sur les onglets, il reste
// sur l'onglet (l'étape qui arrive : celle qui part est encore là le temps de son fondu, avec une classe « …-leave-… »)
const stageElement = ref(null)
function focusChoice() {
  const panel = stageElement.value?.querySelector('.panel:not([class*="-leave-"])')
  const choice = panel?.querySelector('button.choice[aria-pressed="true"]') ?? panel?.querySelector('button.choice')
  choice?.focus({ preventScroll: true })
}
onMounted(focusChoice)
watch(step, async () => {
  await nextTick()
  if (focusTabAfterStep) document.getElementById(`setup-tab-${step.value}`)?.focus()
  else focusChoice()
  focusTabAfterStep = false
})
</script>

<template>
  <BaseModal title="Préparation de la partie" wide>
    <!-- l'en-tête : les trois étapes au milieu, la difficulté à droite -->
    <template #header>
      <div class="setup-head">
        <ol class="hexes" aria-label="Étapes de la mise en place">
          <li v-for="(hex, index) in hexes" :key="hex.id">
            <SetupHex :name="hex.name" :value="hex.value" :done="hex.done" :active="step === index" :image-url="hex.imageUrl"
              :crop="hex.crop" :random="hex.random" @select="goTo(index)" />
          </li>
        </ol>
        <div class="difficulty" role="radiogroup" aria-label="Difficulté">
          <label v-for="option in DIFFICULTIES" :key="option.id" :title="option.title">
            <input v-model="form.difficulty" type="radio" name="difficulty" :value="option.id">
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>
    </template>

    <div class="setup">
      <!-- les onglets des étapes ; sous celui de l'étape en cours, un trait et une flèche -->
      <div class="tabs" role="tablist" aria-label="Étapes" @keydown="onTabKey">
        <button v-for="(item, index) in STEPS" :id="`setup-tab-${index}`" :key="item.id" type="button" role="tab" class="tab"
          :class="{ active: step === index }" :aria-selected="step === index" aria-controls="setup-panel"
          :tabindex="step === index ? 0 : -1" @click="goTo(index)">
          <span class="tab-icon" :style="{ '--mask': item.icon.mask, '--w': item.icon.width, '--h': item.icon.height }" aria-hidden="true" />
          {{ item.name }}
        </button>
      </div>

      <!-- le contenu de l'étape : il glisse dans le sens du changement d'étape, les cases arrivent l'une après l'autre -->
      <div ref="stageElement" class="stage">
        <Transition :name="direction > 0 ? 'step-forward' : 'step-back'" :duration="{ enter: 460, leave: 150 }">
          <section id="setup-panel" :key="step" class="panel" role="tabpanel" :aria-labelledby="`setup-tab-${step}`">
            <div v-if="step === 0" class="choices">
              <PortraitChoice v-for="(hero, index) in AVAILABLE_HEROES" :key="hero.id" :style="{ '--i': index }" :label="hero.name"
                :detail="hero.aspect" v-bind="portraitOf('hero', hero.id)" :selected="form.hero === hero.id"
                v-on="pointing(hero.name, hero.aspect)" @pick="pickHero(hero.id)" />
              <PortraitChoice :style="{ '--i': AVAILABLE_HEROES.length }" label="Au hasard" :detail="DRAWN_AT_LAUNCH" special
                :selected="form.hero === 'random'" v-on="pointing('Héros au hasard', DRAWN_AT_LAUNCH)" @pick="pickHero('random')" />
              <PortraitChoice v-for="n in fillerCount" :key="`filler-${n}`" filler />
            </div>

            <div v-else-if="step === 1" class="choices">
              <PortraitChoice v-for="(scenario, index) in AVAILABLE_SCENARIOS" :key="scenario.id" :style="{ '--i': index }"
                :label="scenario.villainName" :detail="scenario.title ?? scenario.level" v-bind="portraitOf('villain', scenario.id)"
                :selected="form.scenario === scenario.id" v-on="pointing(scenario.villainName, scenario.title ?? scenario.level)"
                @pick="pickScenario(scenario.id)" />
              <PortraitChoice :style="{ '--i': AVAILABLE_SCENARIOS.length }" label="Au hasard" :detail="DRAWN_AT_LAUNCH" special
                :selected="form.scenario === 'random'" v-on="pointing('Méchant au hasard', DRAWN_AT_LAUNCH)" @pick="pickScenario('random')" />
              <PortraitChoice v-for="n in fillerCount" :key="`filler-${n}`" filler />
            </div>

            <template v-else>
              <p v-if="isCrew" class="note">Les Démolisseurs : quatre méchants en jeu, chacun avec sa manigance annexe et son
                propre paquet Rencontre ; ni set modulaire, ni set Standard, ni obligation, ni Némésis.</p>
              <template v-else>
                <div class="choices">
                  <PortraitChoice v-for="(modular, index) in AVAILABLE_MODULAR_SETS" :key="modular.id" :style="{ '--i': index }"
                    :label="modular.name" v-bind="portraitOf('modular', modular.id)" :selected="pickedModulars.includes(modular.id)"
                    :advised="advisedModularsOf(form.scenario).includes(modular.id)"
                    v-on="pointing(modular.name, advisedModularsOf(form.scenario).includes(modular.id) ? 'conseillé' : '')"
                    @pick="pickModular(modular.id)" />
                  <PortraitChoice :style="{ '--i': AVAILABLE_MODULAR_SETS.length }" label="Au hasard" special
                    :detail="modularsNeeded > 1 ? `${modularsNeeded} sets tirés` : 'tiré en secret'" :selected="form.modulars === 'random'"
                    v-on="pointing('Au hasard', modularsNeeded > 1 ? `${modularsNeeded} sets tirés` : 'tiré en secret')"
                    @pick="pickModular('random')" />
                  <PortraitChoice v-for="n in fillerCount" :key="`filler-${n}`" filler />
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

    <!-- le pied : l'affiche des choix faits (ou le nom de la case survolée), puis les boutons -->
    <template #actions>
      <div class="footer-info">
        <p class="matchup" :class="{ covered: pointedChoice }" aria-live="polite">
          <span v-for="(part, index) in matchup" :key="index" :class="{ link: part.link }">{{ part.text }}</span>
        </p>
        <p v-if="pointedChoice" class="pointed" aria-hidden="true">
          <span>{{ pointedChoice.label }}</span><span v-if="pointedChoice.detail" class="link">· {{ pointedChoice.detail }}</span>
        </p>
      </div>
      <button type="button" class="modal-btn" @click="ui.closeModal()">Annuler</button>
      <button type="button" class="modal-btn primary" :disabled="!isReady" @click="startGame">Lancer la partie</button>
    </template>
  </BaseModal>
</template>

<style scoped>
/* ---------- l'en-tête ----------
   les étapes à 17 px sous le titre, centrées ; la difficulté à droite, à 25 px du bord du panneau (la ligne
   déborde dans la marge de l'en-tête), alignée sur le bas des étapes. Si la place manque, les étapes se
   décalent un peu à gauche plutôt que de passer sous la difficulté */
.setup-head {
  justify-self: stretch; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end;
  margin: calc(17 * var(--su)) calc(25 * var(--su) - var(--pad)) 0;
}
.hexes { grid-column: 2; display: flex; margin: 0; padding: 0; list-style: none; }
.difficulty { grid-column: 3; justify-self: end; display: flex; margin-bottom: calc(1 * var(--su)); }

/* la difficulté : un sélecteur en trois parts (maquette : « Normal | Expert »), filet fin, texte en capitales ;
   le choix fait est plein */
.difficulty label { position: relative; cursor: pointer; }
.difficulty input { position: absolute; opacity: 0; pointer-events: none; }
.difficulty span {
  display: block; padding: 10px 20px; border: 1px solid #303365;
  font: 500 12px/1.2 var(--font-text); text-transform: uppercase; color: #c2c3fd;
  transition: background-color 150ms ease, color 150ms ease;
}
.difficulty label + label span { border-left: 0; }
.difficulty label:first-child span { border-radius: 4px 0 0 4px; }
.difficulty label:last-child span { border-radius: 0 4px 4px 0; }
.difficulty input:checked + span { background: rgb(48 51 101 / .85); color: #fff; }
.difficulty input:focus-visible + span { position: relative; z-index: 1; outline: 2px solid var(--yellow); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .difficulty label:hover input:not(:checked) + span { background: rgb(48 51 101 / .4); color: #fff; }
}
@media (pointer: coarse) {
  .difficulty span { padding-block: 13px; }
}

/* ---------- le contenu : les onglets, puis la grille (916 px de large au plus : dix cases) ---------- */
.setup { display: grid; justify-items: center; }
.tabs, .stage { width: min(100%, calc(916 * var(--su))); }

/* les onglets : trois parts égales, 64 px de haut, sur un filet ; l'onglet en cours est lavande, sur un dégradé
   qui monte du filet, souligné de 3 px, une flèche dessous ; les autres en violet */
.tabs { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.tabs::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: #353970; }
.tab {
  position: relative; display: flex; align-items: center; justify-content: center; gap: calc(12 * var(--su));
  height: calc(64 * var(--su)); min-width: 0; padding: 0 8px; border: 0; background: none;
  font: italic 700 max(18px, calc(28 * var(--su)))/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
  white-space: nowrap; color: #6567c6;
  transition: color 150ms ease, background-color 150ms ease;
}
.tab.active { color: #c2c3fd; background: linear-gradient(rgb(55 59 115 / 0) 8.654%, rgb(55 59 115 / .4) 69.231%, #373b73); }
.tab::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #c2c3fd;
  transform: scaleX(0); transition: transform 220ms var(--ease-out);
}
.tab.active::after { transform: none; }
/* la flèche : un triangle de 30 × 16,5 px, 7 px sous le trait */
.tab.active::before {
  content: ''; position: absolute; left: 50%; top: calc(100% + 7 * var(--su)); translate: -50% 0;
  width: calc(30 * var(--su)); height: calc(16.5 * var(--su)); background: #c2c3fd;
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.tab-icon {
  flex: none; width: calc(var(--w) * var(--su)); height: calc(var(--h) * var(--su)); background: currentColor;
  -webkit-mask: var(--mask) center / contain no-repeat; mask: var(--mask) center / contain no-repeat;
}
.tab:focus-visible { outline: 2px solid var(--yellow); outline-offset: -2px; }
@media (hover: hover) and (pointer: fine) {
  .tab:not(.active):hover { color: #8f91ea; }
}

/* la grille, 51 px sous les onglets : des cases de 88 px, 4 px entre elles, autant par rangée que la place le
   permet (dix à la taille de la maquette) ; les deux étapes se superposent le temps du fondu */
.stage { display: grid; margin-top: calc(51 * var(--su)); }
.panel { grid-area: 1 / 1; display: grid; gap: calc(20 * var(--su)); align-content: start; min-width: 0; }
.choices {
  display: grid; grid-template-columns: repeat(auto-fill, calc(88 * var(--su))); gap: calc(4 * var(--su));
  justify-content: center;
}
.legend .star { color: var(--yellow); }

/* ---------- le pied : l'affiche des choix faits, ou le nom de la case survolée, à la même place ---------- */
.footer-info { flex: 1 1 auto; min-width: 0; display: grid; }
.footer-info > * { grid-area: 1 / 1; }
.matchup, .pointed {
  display: flex; flex-wrap: wrap; gap: 0 .35em; align-self: center; max-width: none; margin: 0;
  font: italic 700 max(16px, calc(22 * var(--su)))/1.2 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
  color: #c9cbf2;
}
.matchup .link, .pointed .link { color: #6567c6; }
.matchup.covered { visibility: hidden; }
.pointed { color: #c2c3fd; }

/* changement d'étape : le contenu glisse dans le sens de la marche (en avant : vers la gauche), en fondu ; les
   cases arrivent l'une après l'autre (25 ms d'écart), sans jamais bloquer un appui. L'étape qui part
   s'efface vite et ne prend plus les appuis */
.step-forward-enter-active, .step-back-enter-active { transition: opacity 220ms var(--ease-out), transform 300ms var(--ease-out); }
.step-forward-leave-active, .step-back-leave-active { transition: opacity 130ms ease, transform 150ms ease; pointer-events: none; }
.step-forward-enter-from { opacity: 0; transform: translateX(calc(20 * var(--su))); }
.step-forward-leave-to { opacity: 0; transform: translateX(calc(-12 * var(--su))); }
.step-back-enter-from { opacity: 0; transform: translateX(calc(-20 * var(--su))); }
.step-back-leave-to { opacity: 0; transform: translateX(calc(12 * var(--su))); }
.step-forward-enter-active .choice:not(.filler), .step-back-enter-active .choice:not(.filler) {
  transition: opacity 200ms var(--ease-out), transform 260ms var(--ease-out);
  transition-delay: calc(40ms + var(--i, 0) * 25ms);
}
.step-forward-enter-from .choice:not(.filler), .step-back-enter-from .choice:not(.filler) { opacity: 0; transform: translateY(calc(8 * var(--su))); }

/* téléphones : les étapes, puis la difficulté dessous, centrées ; les onglets sans icône, leur nom sur deux
   lignes s'il le faut (« Set modulaire ») */
@media (max-width: 700px) {
  .setup-head { grid-template-columns: minmax(0, 1fr); justify-items: center; row-gap: 12px; margin-inline: 0; }
  .hexes, .difficulty { grid-column: 1; }
  .difficulty { justify-self: center; }
  .tab { white-space: normal; text-align: center; font-size: 17px; }
  .tab-icon { display: none; }
  /* au pied, l'affiche sur sa ligne, les deux boutons ensemble dessous */
  .footer-info:has(span) { flex-basis: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .step-forward-enter-from, .step-forward-leave-to, .step-back-enter-from, .step-back-leave-to,
  .step-forward-enter-from .choice, .step-back-enter-from .choice { transform: none; }
  .step-forward-enter-active .choice, .step-back-enter-active .choice { transition-delay: 0ms; }
  .tab::after { transition: none; }
}
</style>
