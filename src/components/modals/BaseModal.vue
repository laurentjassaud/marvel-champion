<script setup>
// Le cadre commun des fenêtres : le fond sombre (un appui dessus ferme la fenêtre), la boîte et son titre.
import { ref, onMounted } from 'vue'
import { useUiStore } from '../../stores/ui.js'
import { swallowNextClick } from '../../composables/usePointer.js'

defineProps({
  /** Titre de la fenêtre, aussi annoncé aux lecteurs d'écran. */
  title: { type: String, required: true }
})
const ui = useUiStore()
const dialogElement = ref(null)
// focus sans défilement : le premier bouton peut être « Fermer », en bas d'une longue pile
onMounted(() => dialogElement.value?.querySelector('button, input:checked, input')?.focus({ preventScroll: true }))

// l'appui sur le fond ne doit pas ensuite cliquer la pile que la fenêtre découvre en se fermant
function closeFromBackdrop() {
  swallowNextClick()
  ui.closeModal()
}
</script>

<template>
  <div class="modal" @pointerdown.self="closeFromBackdrop">
    <div ref="dialogElement" class="box" role="dialog" aria-modal="true" :aria-label="title">
      <h2>{{ title }}</h2>
      <slot />
    </div>
  </div>
</template>
