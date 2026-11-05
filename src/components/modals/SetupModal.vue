<script setup>
import { reactive, ref, computed, watch, nextTick, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import ChoiceOption from './ChoiceOption.vue'
import { HEROES, VILLAINS, MODULARS, DEFS, BY_ID, heroName } from '../../game/data.js'
import { imageById } from '../../composables/useAssets.js'
import { fetchCdbDeck } from '../../game/marvelcdb.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()

// two screens: 1 the hero and their deck, 2 the scenario
const step = ref(1)
const prev = game.s?.opt ?? {}
const form = reactive({
  deck: prev.hero ?? 'spider_man', // a hero id (their precon deck) or 'import' (the custom deck)
  villain: prev.villain ?? 'rhino',
  modular: prev.drawn?.includes('modular') ? 'random' : prev.modular ?? 'bomb_scare',
  diff: prev.drawn?.includes('expert') ? 'random' : prev.expert ? 'exp' : 'std'
})
const imported = ref(null) // {list, hero, label, n, online, unknown, missing}
const error = ref('')

const heroImage = id => imageById(DEFS.find(d => d.t === 'hero' && d.s === id).id)
const heroOf = id => HEROES.find(h => h.id === id)
const advisedFor = mod => VILLAINS.filter(v => v.modular === mod).map(v => v.name).join(', ')
// several villains at once (Les Démolisseurs): no modular set, difficulty picks version A or B
const crew = computed(() => !!VILLAINS.find(v => v.id === form.villain)?.crew)
const custom = computed(() => form.deck === 'import' && !!imported.value)
const hero = computed(() => (custom.value ? imported.value.hero : form.deck))
const deckName = computed(() => (custom.value ? imported.value.label : `Préconstruit ${heroOf(hero.value).aspect}`))
const importNote = computed(() => {
  const d = imported.value
  const parts = [`${d.n} cartes`]
  if (d.online) parts.push(`dont ${d.online} lue${d.online > 1 ? 's' : ''} sur MarvelCDB (images du site, en anglais)`)
  if (d.unknown) {
    const names = d.missing.slice(0, 4).join(', ') + (d.missing.length > 4 ? '…' : '')
    parts.push(`${d.unknown} inconnue${d.unknown > 1 ? 's' : ''} ignorée${d.unknown > 1 ? 's' : ''}${names ? ` : ${names}` : ''}`)
  }
  return `${d.label} : ${parts.join(', ')}.`
})

// each villain comes with its advised modular set, unless the set is drawn at random
watch(() => form.villain, v => { if (form.modular !== 'random') form.modular = VILLAINS.find(x => x.id === v).modular })

// a parsed deck becomes the custom deck; a failed import keeps the previous one
function keep({ list, hero: id, unknown, missing, title, heroName }, name) {
  if (!id) {
    error.value = heroName
      ? `Deck de ${heroName} : ce héros n'est pas encore disponible sur la table.`
      : 'Aucune identité reconnue dans ce deck. Choisis un fichier .o8d OCTGN (héros de la boîte de base) ou un export texte MarvelCDB (.txt) d\'un des héros disponibles.'
    return false
  }
  const count = keep => list.reduce((t, [g, q]) => t + (!['hero', 'obligation'].includes(BY_ID[g].t) && keep(BY_ID[g]) ? q : 0), 0)
  const n = count(() => true)
  const online = count(d => d.pack === 'marvelcdb') // cards read from MarvelCDB, with the site's images
  imported.value = { list, hero: id, label: title || name, n, online, unknown, missing }
  form.deck = 'import'
  error.value = ''
  return true
}

// OCTGN .o8d or MarvelCDB text export (.txt)
async function importDeck(e) {
  const file = e.target.files[0]
  e.target.value = '' // the same file can be picked again after a fix
  if (file) keep(game.parseDeck(await file.text()), file.name.replace(/\.[^.]+$/, ''))
}

// a MarvelCDB deck by its link or number, read from the site's public API
const cdbLink = ref('')
const loading = ref(false)
async function importCdb() {
  if (loading.value || !cdbLink.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    if (keep(await fetchCdbDeck(cdbLink.value), 'Deck MarvelCDB')) cdbLink.value = ''
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function start() {
  game.newGame({
    hero: hero.value,
    list: custom.value ? imported.value.list : game.precon(hero.value),
    villain: form.villain,
    modular: form.modular,
    expert: form.diff === 'random' ? 'random' : form.diff === 'exp',
    label: custom.value ? imported.value.label : `précon ${heroOf(hero.value).aspect}`
  })
  ui.closeModal()
}

// each screen opens at its top, focus on its selected choice
const screen = ref(null)
const focusChoice = () => screen.value?.querySelector('input:checked')?.focus({ preventScroll: true })
onMounted(focusChoice)
watch(step, async () => {
  await nextTick()
  screen.value?.closest('.box')?.scrollTo({ top: 0 })
  focusChoice()
})
</script>

<template>
  <BaseModal title="Nouvelle partie">
    <ol class="steps">
      <li><button type="button" :aria-current="step === 1 ? 'step' : undefined" @click="step = 1">1 · Héros</button>
      </li>
      <li><button type="button" :aria-current="step === 2 ? 'step' : undefined" @click="step = 2">2 · Scénario</button>
      </li>
    </ol>

    <div v-if="step === 1" ref="screen" class="screen">
      <p>Choisissez votre héros avec son paquet préconstruit officiel de 40 cartes, ou importez un deck personnalisé
        (fichier .o8d d'OCTGN, export texte de MarvelCDB, ou lien d'un deck MarvelCDB). Par lien, un héros ou des cartes
        absents de la table sont lus sur MarvelCDB, avec les images du site (en anglais).</p>
      <div class="heroes" role="radiogroup" aria-label="Héros et paquet">
        <ChoiceOption v-for="h in HEROES" :key="h.id" v-model="form.deck" name="deck" :value="h.id" :label="h.name"
          :sub="`Préconstruit ${h.aspect}`" :image="heroImage(h.id)" />
        <!-- custom deck: an import button until a deck is imported, then a choice like the others -->
        <ChoiceOption v-if="imported" v-model="form.deck" name="deck" value="import" :label="imported.label"
          :sub="`Deck personnalisé · ${heroName(imported.hero)}`" :image="heroImage(imported.hero)" />
        <label v-else class="custom">
          <input type="file" accept=".o8d,.xml,.txt" aria-label="Importer un deck personnalisé" @change="importDeck">
          <span class="plus" aria-hidden="true">+</span>
          <span class="txt">Deck personnalisé<small>Importer un .o8d ou un .txt MarvelCDB</small></span>
        </label>
      </div>
      <form class="cdb" :aria-busy="loading" @submit.prevent="importCdb">
        <label class="lab" for="cdb-link">Depuis MarvelCDB</label>
        <input id="cdb-link" v-model="cdbLink" type="text" inputmode="url" enterkeyhint="go" autocomplete="off"
          autocapitalize="off" spellcheck="false" placeholder="Lien du deck ou numéro de decklist">
        <button type="submit" class="btn" :disabled="loading || !cdbLink.trim()">{{ loading ? 'Import…' : 'Importer'
        }}</button>
      </form>
      <div v-if="imported" class="row">
        <span class="note">{{ importNote }}</span>
        <label class="btn file-btn">Importer un autre deck…<input type="file" accept=".o8d,.xml,.txt"
            @change="importDeck"></label>
      </div>
      <div v-if="error" class="err" role="alert">{{ error }}</div>
    </div>

    <div v-else ref="screen" class="screen">
      <button type="button" class="recap" title="Changer de héros" @click="step = 1">
        <img :src="heroImage(hero)" alt="">
        <span class="txt">{{ heroName(hero) }}<small>{{ deckName }}</small></span>
        <span class="change">Changer</span>
      </button>

      <div class="fieldset">
        <div class="lab">Méchant</div>
        <div class="choices">
          <ChoiceOption v-for="v in VILLAINS" :key="v.id" v-model="form.villain" name="villain" :value="v.id"
            :label="v.name" :sub="v.scenario ?? v.level" />
        </div>
      </div>

      <div v-if="!crew" class="fieldset">
        <div class="lab">Set modulaire</div>
        <div class="choices">
          <ChoiceOption v-model="form.modular" name="modular" value="random" label="Au hasard"
            sub="Tiré à la mise en place" />
          <ChoiceOption v-for="m in MODULARS" :key="m.id" v-model="form.modular" name="modular" :value="m.id"
            :label="m.name" :sub="advisedFor(m.id) ? `Conseillé avec ${advisedFor(m.id)}` : ''" />
        </div>
      </div>
      <p v-else class="note">Les Démolisseurs : quatre méchants en jeu, chacun avec sa manigance annexe et son propre
        paquet Rencontre ; ni set modulaire, ni set Standard, ni obligation, ni Némésis.</p>

      <div class="fieldset">
        <div class="lab">Difficulté</div>
        <div class="choices">
          <ChoiceOption v-model="form.diff" name="diff" value="std" label="Standard"
            :sub="crew ? 'Méchants version A' : 'Étapes I et II + set Standard'" />
          <ChoiceOption v-model="form.diff" name="diff" value="exp" label="Expert"
            :sub="crew ? 'Méchants version B' : 'Étapes II et III + set Expert'" />
          <ChoiceOption v-model="form.diff" name="diff" value="random" label="Au hasard"
            sub="Standard ou expert, tiré à la mise en place" />
        </div>
      </div>

      <p class="note">Mise en place automatique : identité en alter ego, méchant et manigance sur la table, paquet
        Rencontre mélangé avec l'obligation du héros, set Némésis mis de côté.</p>
    </div>

    <div class="row foot">
      <button v-if="step === 2" type="button" class="btn" @click="step = 1">← Héros</button>
      <button v-if="step === 1" type="button" class="btn primary" @click="step = 2">Suivant : scénario →</button>
      <button v-else type="button" class="btn primary" @click="start">Mettre en place</button>
      <span class="sp" />
      <button type="button" class="btn" @click="ui.closeModal()">Annuler</button>
    </div>
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
  font-family: var(--f-display);
  font-size: 14px;
  letter-spacing: .08em;
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

/* every hero tile has the same width, however many heroes there are */
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
  font-size: 24px;
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
  font-size: 11.5px;
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
  font-family: var(--f-display);
  font-size: 13px;
  letter-spacing: .1em;
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

/* under 16px, iOS zooms the page when the field gets the focus */
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
  font-size: 12.5px;
}

/* the buttons stay in view while the choices scroll */
.foot {
  position: sticky;
  bottom: 0;
  z-index: 1;
  padding: 12px 0 0;
  background: var(--panel);
  border-top: 1px solid var(--line);
}
</style>
