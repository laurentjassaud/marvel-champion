<script setup>
import { ref, onMounted } from 'vue'
import { useUiStore } from '../../stores/ui.js'
import { swallowNextClick } from '../../composables/usePointer.js'

defineProps({ title: { type: String, required: true } })
const ui = useUiStore()
const box = ref(null)
// focus without scrolling: the first button can be "Close" at the bottom of a long pile
onMounted(() => box.value?.querySelector('button, input:checked, input')?.focus({ preventScroll: true }))

// the tap on the backdrop must not go on to click the pile that the closing modal uncovers
function close() {
  swallowNextClick()
  ui.closeModal()
}
</script>

<template>
  <div class="modal" @pointerdown.self="close">
    <div ref="box" class="box" role="dialog" aria-modal="true" :aria-label="title">
      <h2>{{ title }}</h2>
      <slot />
    </div>
  </div>
</template>
