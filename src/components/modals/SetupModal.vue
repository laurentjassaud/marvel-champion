<script setup>
import { reactive, ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import ChoiceOption from './ChoiceOption.vue'
import { HEROES, VILLAINS, MODULARS, DEFS, BY_ID } from '../../game/data.js'
import { imageById, backById } from '../../composables/useAssets.js'
import { useGameStore } from '../../stores/game.js'
import { useUiStore } from '../../stores/ui.js'

const game = useGameStore()
const ui = useUiStore()

const prev = game.s?.opt ?? {}
const form = reactive({
  hero: prev.hero ?? 'spider_man',
  src: 'precon',
  villain: prev.villain ?? 'rhino',
  modular: prev.modular ?? 'bomb_scare',
  diff: prev.expert ? 'exp' : 'std',
  pback: prev.pback ?? 'blue'
})
const imported = ref(null)
const info = ref('')
const error = ref('')

const heroImage = id => imageById(DEFS.find(d => d.t === 'hero' && d.s === id).id)
const advisedFor = mod => VILLAINS.filter(v => v.modular === mod).map(v => v.name).join(', ')
// several villains at once (Les Démolisseurs): no modular set, difficulty picks version A or B
const crew = computed(() => !!VILLAINS.find(v => v.id === form.villain)?.crew)

// each villain comes with its advised modular set
watch(() => form.villain, v => { form.modular = VILLAINS.find(x => x.id === v).modular })
// picking another hero drops the imported deck
watch(() => form.hero, h => { if (imported.value && h !== imported.value.hero) form.src = 'precon' })

// OCTGN .o8d or MarvelCDB text export (.txt)
async function importDeck(e) {
  const file = e.target.files[0]
  e.target.value = '' // the same file can be picked again after a fix
  if (!file) return
  const { list, hero, unknown, missing, title } = game.parseDeck(await file.text())
  if (!hero) {
    imported.value = null
    info.value = ''
    error.value = 'Aucune identité reconnue dans ce deck. Choisis un fichier .o8d OCTGN (héros de la boîte de base) ou un export texte MarvelCDB (.txt) d\'un des héros disponibles.'
    return
  }
  const label = title || file.name.replace(/\.[^.]+$/, '')
  imported.value = { list, hero, label }
  form.hero = hero
  form.src = 'import'
  error.value = ''
  const n = list.reduce((t, [id, q]) => t + (['hero', 'obligation'].includes(BY_ID[id].t) ? 0 : q), 0)
  const skipped = missing.length ? ` : ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}` : ''
  info.value = `${label} : ${n} cartes${unknown ? `, ${unknown} inconnue${unknown > 1 ? 's' : ''} ignorée${unknown > 1 ? 's' : ''}${skipped}` : ''}.`
}

function start() {
  const useImport = form.src === 'import' && imported.value
  game.newGame({
    hero: form.hero,
    list: useImport ? imported.value.list : game.precon(form.hero),
    villain: form.villain,
    modular: form.modular,
    expert: form.diff === 'exp',
    label: useImport ? imported.value.label : `précon ${HEROES.find(h => h.id === form.hero).aspect}`,
    pback: form.pback
  })
  ui.closeModal()
}
</script>

<template>
  <BaseModal title="Nouvelle partie">
    <p>Mise en place automatique : identité en alter ego, paquet préconstruit de 40 cartes, méchant et manigance sur la table, paquet Rencontre mélangé avec l'obligation du héros, set Némésis mis de côté.</p>

    <div class="fieldset">
      <div class="lab">Héros</div>
      <div class="choices">
        <ChoiceOption v-for="h in HEROES" :key="h.id" v-model="form.hero" name="hero" :value="h.id" :label="h.name" :sub="`Précon ${h.aspect}`" :image="heroImage(h.id)" />
      </div>
    </div>

    <div class="fieldset">
      <div class="lab">Paquet</div>
      <div class="row">
        <ChoiceOption v-model="form.src" name="src" value="precon" label="Préconstruit officiel" sub="Héros + aspect + basiques" />
        <ChoiceOption v-if="imported" v-model="form.src" name="src" value="import" :label="imported.label" sub="Deck importé" />
        <label class="btn file-btn">Importer un deck (.o8d OCTGN ou .txt MarvelCDB)<input type="file" accept=".o8d,.xml,.txt" @change="importDeck"></label>
        <span class="note">{{ info }}</span>
      </div>
    </div>

    <div class="fieldset">
      <div class="lab">Méchant</div>
      <div class="choices">
        <ChoiceOption v-for="v in VILLAINS" :key="v.id" v-model="form.villain" name="villain" :value="v.id" :label="v.name" :sub="v.scenario ?? v.level" />
      </div>
    </div>

    <div v-if="!crew" class="fieldset">
      <div class="lab">Set modulaire</div>
      <div class="choices">
        <ChoiceOption v-for="m in MODULARS" :key="m.id" v-model="form.modular" name="modular" :value="m.id" :label="m.name" :sub="advisedFor(m.id) ? `Conseillé avec ${advisedFor(m.id)}` : ''" />
      </div>
    </div>
    <p v-else class="note">Les Démolisseurs : quatre méchants en jeu, chacun avec sa manigance annexe et son propre paquet Rencontre ; ni set modulaire, ni set Standard, ni obligation, ni Némésis.</p>

    <div class="fieldset">
      <div class="lab">Difficulté</div>
      <div class="choices">
        <ChoiceOption v-model="form.diff" name="diff" value="std" label="Standard" :sub="crew ? 'Méchants version A' : 'Étapes I et II + set Standard'" />
        <ChoiceOption v-model="form.diff" name="diff" value="exp" label="Expert" :sub="crew ? 'Méchants version B' : 'Étapes II et III + set Expert'" />
      </div>
    </div>

    <div class="fieldset">
      <div class="lab">Dos de vos cartes</div>
      <div class="choices">
        <ChoiceOption v-model="form.pback" name="pback" value="blue" label="Bleu" :image="backById('blue')" />
        <ChoiceOption v-model="form.pback" name="pback" value="purple" label="Violet" :image="backById('purple')" />
      </div>
      <p class="note">Les cartes Rencontre gardent le dos orange.</p>
    </div>

    <div v-if="error" class="err" role="alert">{{ error }}</div>
    <div class="row">
      <button type="button" class="btn primary" @click="start">Mettre en place</button>
      <span class="sp" />
      <button type="button" class="btn" @click="ui.closeModal()">Annuler</button>
    </div>
  </BaseModal>
</template>
