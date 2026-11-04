<script setup>
import { reactive, ref, watch } from 'vue'
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

// each villain comes with its advised modular set
watch(() => form.villain, v => { form.modular = VILLAINS.find(x => x.id === v).modular })
// picking another hero drops the imported deck
watch(() => form.hero, h => { if (imported.value && h !== imported.value.hero) form.src = 'precon' })

async function importDeck(e) {
  const file = e.target.files[0]
  if (!file) return
  const { list, hero, unknown } = game.parseO8D(await file.text())
  if (!hero) {
    imported.value = null
    info.value = ''
    error.value = 'Ce deck ne contient pas d\'identité de la boîte de base. Choisis un fichier .o8d Marvel Champions avec un des 5 héros.'
    return
  }
  const label = file.name.replace(/\.[^.]+$/, '')
  imported.value = { list, hero, label }
  form.hero = hero
  form.src = 'o8d'
  error.value = ''
  const n = list.reduce((t, [id, q]) => t + (['hero', 'obligation'].includes(BY_ID[id].t) ? 0 : q), 0)
  info.value = `${label} : ${n} cartes${unknown ? `, ${unknown} hors boîte de base ignorée${unknown > 1 ? 's' : ''}` : ''}.`
}

function start() {
  const useImport = form.src === 'o8d' && imported.value
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
    <p>Mise en place automatique (boîte de base et scénarios du Bouffon Vert) : identité en alter ego, paquet préconstruit de 40 cartes, méchant et manigance sur la table, paquet Rencontre mélangé avec l'obligation du héros, set Némésis mis de côté.</p>

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
        <ChoiceOption v-if="imported" v-model="form.src" name="src" value="o8d" :label="imported.label" sub="Deck importé" />
        <label class="btn file-btn">Importer un deck OCTGN .o8d<input type="file" accept=".o8d,.xml" @change="importDeck"></label>
        <span class="note">{{ info }}</span>
      </div>
    </div>

    <div class="fieldset">
      <div class="lab">Méchant</div>
      <div class="choices">
        <ChoiceOption v-for="v in VILLAINS" :key="v.id" v-model="form.villain" name="villain" :value="v.id" :label="v.name" :sub="v.scenario ?? v.level" />
      </div>
    </div>

    <div class="fieldset">
      <div class="lab">Set modulaire</div>
      <div class="choices">
        <ChoiceOption v-for="m in MODULARS" :key="m.id" v-model="form.modular" name="modular" :value="m.id" :label="m.name" :sub="advisedFor(m.id) ? `Conseillé avec ${advisedFor(m.id)}` : ''" />
      </div>
    </div>

    <div class="fieldset">
      <div class="lab">Difficulté</div>
      <div class="choices">
        <ChoiceOption v-model="form.diff" name="diff" value="std" label="Standard" sub="Étapes I et II + set Standard" />
        <ChoiceOption v-model="form.diff" name="diff" value="exp" label="Expert" sub="Étapes II et III + set Expert" />
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
