<script setup>
// Un compteur en grand (maquette « RHINO II / 21 PV ») : son nom, modifiable, au-dessus de sa valeur, avec
// − et + à côté. Sert aux PV du méchant et à la menace (VillainHud), et aux PV du héros (PlayerDock).
import { ref, computed, watch } from 'vue'
import { useGameStore } from '../stores/game.js'

const props = defineProps({
  /** Numéro du compteur : 0 PV du héros, 1 PV du méchant, 2 menace de la manigance principale. */
  index: { type: Number, required: true },
  /** Couleur de l'ombre portée : 'villain' (rouge), 'hero' (bleu), 'threat' (violet). */
  tone: { type: String, default: 'villain' },
  /** Taille : 'xl' (le méchant, comme la maquette), 'l' (le héros), 'm' (la menace). */
  size: { type: String, default: 'l' },
  /** Unité écrite après la valeur ('PV'), ou rien. */
  unit: { type: String, default: '' },
  /**
   * Le seuil écrit à la fin du nom (« Menace /7 ») passe après la valeur (« 3/7 ») ; le nom complet
   * reparaît pendant qu'on le modifie (le moteur y lit le seuil de la manigance).
   */
  splitLimit: Boolean
})

const gameStore = useGameStore()
const counter = computed(() => gameStore.game?.counters[props.index] ?? null)

/** Le seuil à la fin d'un nom : « /7 ». */
const LIMIT_PATTERN = /\s*(\/\s*\d+)\s*$/
/** On est en train de modifier le nom. */
const isEditing = ref(false)
/** Le seuil montré après la valeur (« /7 »), ou null. */
const limit = computed(() => (props.splitLimit ? counter.value?.label.match(LIMIT_PATTERN)?.[1].replace(/\s/g, '') ?? null : null))
/** Le nom montré : sans son seuil quand il est écrit après la valeur, sauf pendant qu'on le modifie. */
const shownLabel = computed(() => (limit.value && !isEditing.value ? counter.value.label.replace(LIMIT_PATTERN, '') : counter.value?.label))

// La valeur qui change fait un petit bond : un retour visible au clic sur − ou +, et aux dégâts reçus
// depuis la table. Web Animations : une nouvelle animation remplace la précédente sans à-coup.
const valueElement = ref(null)
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
watch(() => counter.value?.value, (value, previousValue) => {
  if (previousValue == null || value === previousValue || reducedMotion?.matches) return
  valueElement.value?.animate(
    [{ transform: `translateY(${value < previousValue ? 3 : -3}px) scale(1.07)` }, { transform: 'none' }],
    { duration: 260, easing: 'cubic-bezier(.23, 1, .32, 1)' }
  )
})
</script>

<template>
  <div v-if="counter" class="counter" :class="[tone, size]">
    <!-- le champ prend la largeur de son nom (une copie cachée derrière) ; size="1" : sans lui, sa largeur par
         défaut (une vingtaine de caractères) élargirait le compteur -->
    <span class="name">
      <span class="sizer" aria-hidden="true">{{ shownLabel }}</span>
      <input
        :id="`counter-${index}`"
        size="1"
        :value="shownLabel"
        aria-label="Nom du compteur"
        @focus="isEditing = true"
        @blur="isEditing = false"
        @change="gameStore.renameCounter(index, $event.target.value)"
      >
    </span>
    <div class="value-row">
      <output ref="valueElement" class="value" :for="`counter-${index}`">{{ counter.value }}<small v-if="limit" class="limit">{{ limit }}</small><small v-if="unit">{{ unit }}</small></output>
      <span class="steps">
        <button type="button" class="slant step" :aria-label="`${counter.label} : retirer 1`" @click="gameStore.changeCounter(index, -1)">−</button>
        <button type="button" class="slant step" :aria-label="`${counter.label} : ajouter 1`" @click="gameStore.changeCounter(index, 1)">+</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* tailles (en pixels de la maquette, suivant l'écran, jamais sous 20 px) et ombre portée franche, décalée */
.counter {
  --shade: var(--red); --name-size: max(28px, calc(72 * var(--u))); --value-size: max(44px, calc(96 * var(--u)));
  --shadow: max(3px, calc(6 * var(--u))) max(3px, calc(5 * var(--u))) 0 var(--shade);
  display: grid; justify-items: start; color: #fff; line-height: 1;
}
.counter.hero { --shade: var(--blue); }
.counter.threat { --shade: var(--threat); }
.counter.l { --name-size: max(24px, calc(40 * var(--u))); --value-size: max(36px, calc(64 * var(--u))); --shadow: max(3px, calc(4 * var(--u))) 3px 0 var(--shade); }
.counter.m { --name-size: max(20px, calc(28 * var(--u))); --value-size: max(30px, calc(52 * var(--u))); --shadow: 3px 3px 0 var(--shade); }
.name { display: inline-grid; max-width: 100%; }
.name > * {
  grid-area: 1 / 1; padding: 0 .12em .04em 0; white-space: pre;
  font: italic 900 var(--name-size)/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; text-shadow: var(--shadow);
}
.sizer { visibility: hidden; overflow: hidden; }
input { width: 100%; min-width: 2ch; background: transparent; border: 0; border-bottom: 2px solid transparent; border-radius: 0; color: #fff; }
input:focus-visible { outline: none; border-bottom-color: var(--yellow); }
@media (hover: hover) and (pointer: fine) {
  input:hover:not(:focus) { border-bottom-color: rgb(255 255 255 / .25); }
}
/* la valeur décalée vers la droite, en escalier sous le nom, comme sur la maquette */
.value-row { display: flex; align-items: center; gap: max(8px, calc(16 * var(--u))); margin-left: calc(var(--name-size) * .5); }
.value {
  display: inline-block; font: italic 900 var(--value-size)/.95 var(--font-display); letter-spacing: -.02em;
  text-transform: uppercase; text-shadow: var(--shadow); font-variant-numeric: tabular-nums; white-space: nowrap;
}
.value small { font-size: inherit; margin-left: .2em; }
.value .limit { margin-left: .06em; font-size: .62em; color: var(--muted); text-shadow: none; }
.steps { display: flex; }
.step { --h: 38px; --lip-h: 5px; padding-inline: 26px; font-size: 26px; }
.step + .step { margin-left: -15px; }
.counter.m .step { --h: 34px; padding-inline: 22px; font-size: 22px; }
.counter.m .step + .step { margin-left: -13px; }
@media (pointer: coarse) {
  .step, .counter.m .step { --h: 44px; padding-inline: 28px; }
  .step + .step, .counter.m .step + .step { margin-left: -17px; }
}
/* téléphones : le compteur reste lisible sans couvrir la table */
@media (max-width: 700px) {
  .counter { --name-size: 22px; --value-size: 34px; }
  .counter.l { --name-size: 20px; --value-size: 30px; }
  .counter.m { --name-size: 20px; --value-size: 26px; }
}
</style>
