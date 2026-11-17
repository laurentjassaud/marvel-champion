<script setup>
// La fenêtre « Nouvelle partie », en deux écrans : 1 le héros et son deck (préconstruit, fichier importé ou
// deck MarvelCDB), 2 le scénario (méchant, set(s) modulaire(s), difficulté). Elle s'ouvre sur les choix de
// la partie en cours.
import { reactive, ref, computed, watch, nextTick, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import ChoiceOption from './ChoiceOption.vue'
import { HEROES, SCENARIOS, MODULAR_SETS, CARD_DEFINITIONS, DEFINITION_BY_ID, heroName } from '../../game/data.js'
import { scenarioRules } from '../../game/rules.js'
import { imageUrlOfDefinition } from '../../composables/useAssets.js'
import { fetchMarvelCdbDeck } from '../../game/marvelcdb.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()

/** Écran affiché : 1 héros, 2 scénario. */
const step = ref(1)
/** La mise en place de la partie en cours, pour ouvrir la fenêtre sur les mêmes choix. */
const previousSetup = gameStore.game?.setup ?? {}
/** Les sets modulaires conseillés d'un scénario : un, ou plusieurs (Crossbones 3, Crâne Rouge 2). */
const advisedModularsOf = scenarioId => SCENARIOS.find(scenario => scenario.id === scenarioId)?.advisedModulars ?? []
const form = reactive({
  /** Un identifiant de héros (son deck préconstruit) ou 'import' (le deck personnalisé). */
  deckChoice: previousSetup.hero ?? 'spider_man',
  scenario: previousSetup.scenario ?? 'rhino',
  /** 'random', ou les sets modulaires choisis (autant que le scénario en prend). */
  modulars: previousSetup.randomChoices?.includes('modular')
    ? 'random'
    : previousSetup.modulars?.length ? [...previousSetup.modulars] : advisedModularsOf(previousSetup.scenario ?? 'rhino'),
  /** 'standard', 'expert' ou 'random'. */
  difficulty: previousSetup.randomChoices?.includes('expert') ? 'random' : previousSetup.expert ? 'expert' : 'standard'
})
/** Le deck personnalisé importé : {deckList, hero, label, cardCount, importedCount, unknownCount, missing}. */
const importedDeck = ref(null)
const errorMessage = ref('')

/** Miniature de la carte d'identité d'un héros. */
const heroImageUrl = heroId => imageUrlOfDefinition(CARD_DEFINITIONS.find(definition => definition.type === 'hero' && definition.set === heroId).id)
const heroOf = heroId => HEROES.find(hero => hero.id === heroId)
/** Les méchants qui conseillent ce set modulaire ("Rhino, Taskmaster"). */
const scenariosAdvising = modularId => SCENARIOS.filter(scenario => scenario.advisedModulars.includes(modularId)).map(scenario => scenario.villainName).join(', ')
// plusieurs méchants à la fois (Les Démolisseurs) : pas de set modulaire, la difficulté choisit la version A ou B
const isCrew = computed(() => !!scenarioRules(form.scenario).crew)
// combien de sets modulaires prend le scénario ; avec plusieurs, les tuiles deviennent des cases à cocher
const modularsNeeded = computed(() => Math.max(1, advisedModularsOf(form.scenario).length))
const pickedModulars = computed(() => (form.modulars === 'random' ? [] : form.modulars))
const modularsReady = computed(() => isCrew.value || form.modulars === 'random' || pickedModulars.value.length === modularsNeeded.value)
// un seul set : le choix le remplace ; plusieurs : un choix coche ou décoche un set, le plus ancien cède sa place au-delà du nombre
function pickModular(modularId) {
  const current = pickedModulars.value
  if (modularsNeeded.value === 1) form.modulars = [modularId]
  else if (current.includes(modularId)) form.modulars = current.filter(id => id !== modularId)
  else form.modulars = [...current, modularId].slice(-modularsNeeded.value)
}
const usesImportedDeck = computed(() => form.deckChoice === 'import' && !!importedDeck.value)
const chosenHero = computed(() => (usesImportedDeck.value ? importedDeck.value.hero : form.deckChoice))
const deckDescription = computed(() => (usesImportedDeck.value ? importedDeck.value.label : `Préconstruit ${heroOf(chosenHero.value).aspect}`))
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

// chaque méchant vient avec ses sets modulaires conseillés, sauf s'ils sont tirés au hasard
watch(() => form.scenario, scenarioId => { if (form.modulars !== 'random') form.modulars = advisedModularsOf(scenarioId) })

/**
 * Un deck lu (fichier ou MarvelCDB) devient le deck personnalisé ; un import raté garde le précédent et
 * affiche pourquoi. Rend true si le deck a été gardé.
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
  form.deckChoice = 'import'
  errorMessage.value = ''
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

/** « Mettre en place » : lance la nouvelle partie avec les choix des deux écrans. */
function startGame() {
  if (!modularsReady.value) return
  gameStore.newGame({
    hero: chosenHero.value,
    deckList: usesImportedDeck.value ? importedDeck.value.deckList : gameStore.preconDeck(chosenHero.value),
    scenario: form.scenario,
    modulars: form.modulars === 'random' ? 'random' : [...form.modulars],
    expert: form.difficulty === 'random' ? 'random' : form.difficulty === 'expert',
    deckLabel: usesImportedDeck.value ? importedDeck.value.label : `précon ${heroOf(chosenHero.value).aspect}`
  })
  ui.closeModal()
  ui.closeIntro() // ouverte depuis l'accueil (« Scénarios ») : la nouvelle partie apparaît
}

// chaque écran s'ouvre en haut, le focus sur son choix coché
const screenElement = ref(null)
const focusCheckedChoice = () => screenElement.value?.querySelector('input:checked')?.focus({ preventScroll: true })
onMounted(focusCheckedChoice)
watch(step, async () => {
  await nextTick()
  screenElement.value?.closest('.box-body')?.scrollTo({ top: 0 })
  focusCheckedChoice()
})
</script>

<template>
  <BaseModal title="Nouvelle partie" wide>
    <ol class="steps">
      <li><button type="button" :aria-current="step === 1 ? 'step' : undefined" @click="step = 1">1 · Héros</button>
      </li>
      <li><button type="button" :aria-current="step === 2 ? 'step' : undefined" @click="step = 2">2 · Scénario</button>
      </li>
    </ol>

    <div v-if="step === 1" ref="screenElement" class="screen">
      <p>Choisissez votre héros avec son paquet préconstruit officiel de 40 cartes, ou importez un deck personnalisé
        (fichier .o8d d'OCTGN, export texte de MarvelCDB, ou lien d'un deck MarvelCDB). Par lien, un héros ou des cartes
        absents de la table sont lus sur MarvelCDB, avec les images du site (en anglais).</p>
      <div class="heroes" role="radiogroup" aria-label="Héros et paquet">
        <ChoiceOption v-for="hero in HEROES" :key="hero.id" v-model="form.deckChoice" name="deck" :value="hero.id" :label="hero.name"
          :detail="`Préconstruit ${hero.aspect}`" :image-url="heroImageUrl(hero.id)" />
        <!-- deck personnalisé : un bouton d'import tant qu'aucun deck n'est importé, puis un choix comme les autres -->
        <ChoiceOption v-if="importedDeck" v-model="form.deckChoice" name="deck" value="import" :label="importedDeck.label"
          :detail="`Deck personnalisé · ${heroName(importedDeck.hero)}`" :image-url="heroImageUrl(importedDeck.hero)" />
        <label v-else class="custom">
          <input type="file" accept=".o8d,.xml,.txt" aria-label="Importer un deck personnalisé" @change="importDeckFile">
          <span class="plus" aria-hidden="true">+</span>
          <span class="txt">Deck personnalisé<small>Importer un .o8d ou un .txt MarvelCDB</small></span>
        </label>
      </div>
      <form class="cdb" :aria-busy="isImporting" @submit.prevent="importMarvelCdbDeck">
        <label class="lab" for="cdb-link">Depuis MarvelCDB</label>
        <input id="cdb-link" v-model="marvelCdbLink" type="text" inputmode="url" enterkeyhint="go" autocomplete="off"
          autocapitalize="off" spellcheck="false" placeholder="Lien du deck ou numéro de decklist">
        <button type="submit" class="btn" :disabled="isImporting || !marvelCdbLink.trim()">{{ isImporting ? 'Import…' : 'Importer'
        }}</button>
      </form>
      <div v-if="importedDeck" class="row">
        <span class="note">{{ importSummary }}</span>
        <label class="btn file-btn">Importer un autre deck…<input type="file" accept=".o8d,.xml,.txt"
            @change="importDeckFile"></label>
      </div>
      <div v-if="errorMessage" class="err" role="alert">{{ errorMessage }}</div>
    </div>

    <div v-else ref="screenElement" class="screen">
      <button type="button" class="recap" title="Changer de héros" @click="step = 1">
        <img :src="heroImageUrl(chosenHero)" alt="">
        <span class="txt">{{ heroName(chosenHero) }}<small>{{ deckDescription }}</small></span>
        <span class="change">Changer</span>
      </button>

      <div class="fieldset">
        <div class="lab">Méchant</div>
        <div class="choices">
          <ChoiceOption v-for="scenario in SCENARIOS" :key="scenario.id" v-model="form.scenario" name="villain" :value="scenario.id"
            :label="scenario.villainName" :detail="scenario.title ?? scenario.level" />
        </div>
      </div>

      <div v-if="!isCrew" class="fieldset">
        <div class="lab">{{ modularsNeeded > 1 ? `Sets modulaires · ${modularsNeeded} à choisir` : 'Set modulaire' }}</div>
        <div class="choices">
          <ChoiceOption name="modular" value="random" label="Au hasard" :checked="form.modulars === 'random'"
            :detail="modularsNeeded > 1 ? `${modularsNeeded} sets tirés à la mise en place` : 'Tiré à la mise en place'"
            @pick="form.modulars = 'random'" />
          <ChoiceOption v-for="modular in MODULAR_SETS" :key="modular.id" name="modular" :value="modular.id" :label="modular.name"
            :multiple="modularsNeeded > 1" :checked="pickedModulars.includes(modular.id)"
            :detail="scenariosAdvising(modular.id) ? `Conseillé avec ${scenariosAdvising(modular.id)}` : ''" @pick="pickModular(modular.id)" />
        </div>
        <p v-if="!modularsReady" class="note" role="status">Choisissez {{ modularsNeeded }} sets modulaires ({{ pickedModulars.length }}
          choisi{{ pickedModulars.length > 1 ? 's' : '' }}).</p>
      </div>
      <p v-else class="note">Les Démolisseurs : quatre méchants en jeu, chacun avec sa manigance annexe et son propre
        paquet Rencontre ; ni set modulaire, ni set Standard, ni obligation, ni Némésis.</p>

      <div class="fieldset">
        <div class="lab">Difficulté</div>
        <div class="choices">
          <ChoiceOption v-model="form.difficulty" name="difficulty" value="standard" label="Standard"
            :detail="isCrew ? 'Méchants version A' : 'Étapes I et II + set Standard'" />
          <ChoiceOption v-model="form.difficulty" name="difficulty" value="expert" label="Expert"
            :detail="isCrew ? 'Méchants version B' : 'Étapes II et III + set Expert'" />
          <ChoiceOption v-model="form.difficulty" name="difficulty" value="random" label="Au hasard"
            detail="Standard ou expert, tiré à la mise en place" />
        </div>
      </div>

      <p class="note">Mise en place automatique : identité en alter ego, méchant et manigance sur la table, paquet
        Rencontre mélangé avec l'obligation du héros, set Némésis mis de côté.</p>
    </div>

    <template #actions>
      <button v-if="step === 2" type="button" class="slant" @click="step = 1">← Héros</button>
      <span class="sp" />
      <button type="button" class="slant" @click="ui.closeModal()">Annuler</button>
      <button v-if="step === 1" type="button" class="slant red" @click="step = 2">Suivant</button>
      <button v-else type="button" class="slant red" :disabled="!modularsReady" @click="startGame">Mettre en place</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.steps {
  display: flex;
  gap: 18px;
  margin: -6px 0 0;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid var(--line);
}

.steps button {
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 6px 2px;
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--muted);
}

.steps [aria-current] {
  color: var(--fg);
  border-bottom-color: var(--brass);
}

.screen {
  display: grid;
  gap: 14px;
}

/* toutes les tuiles de héros ont la même largeur, quel que soit le nombre de héros */
.heroes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
  gap: 8px;
}

.heroes :deep(.tile) {
  height: 100%;
}

.custom {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px dashed color-mix(in srgb, var(--brass) 55%, var(--line));
  border-radius: 8px;
  padding: 5px 11px 5px 5px;
  cursor: pointer;
}

.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.custom:focus-within {
  outline: 2px solid var(--brass);
  outline-offset: 2px;
}

.custom .plus {
  flex: none;
  width: 40px;
  height: 56px;
  border: 1px dashed var(--line);
  border-radius: 4px;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--brass);
}

.txt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.txt small {
  color: var(--muted);
  font-size: 14px;
}

@media (hover: hover) and (pointer: fine) {
  .custom:hover {
    border-color: var(--brass);
  }
}

.cdb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cdb .lab {
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--muted);
}

.cdb input {
  flex: 1 1 240px;
  min-width: 0;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 10px;
}

.cdb input::placeholder {
  color: var(--muted);
}

.cdb input:focus-visible {
  outline: 2px solid var(--brass);
  outline-offset: 1px;
}

/* sous 16 px, iOS zoome la page quand le champ prend le focus */
@media (pointer: coarse) {
  .cdb input {
    font-size: 16px;
    min-height: 36px;
  }
}

.recap {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: start;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 5px 12px 5px 5px;
}

.recap img {
  width: 40px;
  height: 56px;
  object-fit: cover;
  object-position: 50% 20%;
  border-radius: 4px;
}

.recap .change {
  margin-left: 8px;
  color: var(--brass);
  font-size: 14px;
}
</style>
