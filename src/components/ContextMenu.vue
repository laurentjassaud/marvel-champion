<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import GameCard, { bareCard } from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'
import { swallowNextClick } from '../composables/usePointer.js'

const game = useGameStore()
const ui = useUiStore()
const el = ref(null)
const pos = reactive({ x: 0, y: 0 })
// the card the menu is about, shown enlarged on touch screens (hidden by CSS elsewhere)
const peek = computed(() => {
  const c = ui.menu?.card && game.card(ui.menu.card)
  return c ? bareCard(c) : null
})

// keep the menu on screen, then focus its first item
watch(() => ui.menu, async m => {
  if (!m) return
  pos.x = m.x
  pos.y = m.y
  await nextTick()
  if (!el.value) return
  const r = el.value.getBoundingClientRect()
  pos.x = Math.max(4, Math.min(m.x, innerWidth - r.width - 8))
  pos.y = Math.max(4, Math.min(m.y, innerHeight - r.height - 8))
  el.value.querySelector('button')?.focus()
})

function run(it) {
  ui.closeMenu()
  it.run()
}
// like a native menu, the press that dismisses it does nothing else (no draw, no drag, no select)
function outside(e) {
  if (!ui.menu || e.target.closest('.menu')) return
  ui.closeMenu()
  e.stopPropagation()
  swallowNextClick()
}
onMounted(() => document.addEventListener('pointerdown', outside, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true))
</script>

<template>
  <div
    v-if="ui.menu"
    ref="el"
    class="menu"
    :class="{ peeks: peek }"
    role="menu"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @contextmenu.prevent
  >
    <GameCard v-if="peek" class="peek" :card="peek" :face="true" inert aria-hidden="true" />
    <div class="items">
      <div v-if="ui.menu.title" class="mh">{{ ui.menu.title }}</div>
      <template v-for="(it, i) in ui.menu.items" :key="i">
        <hr v-if="!it">
        <button
          v-else
          type="button"
          :role="it.checked == null ? 'menuitem' : 'menuitemcheckbox'"
          :aria-checked="it.checked ?? undefined"
          @click="run(it)"
        >
          <span>{{ it.label }}</span><kbd v-if="it.key">{{ it.key }}</kbd><span v-else-if="it.checked" class="chk" aria-hidden="true">✓</span>
        </button>
      </template>
    </div>
  </div>
</template>
