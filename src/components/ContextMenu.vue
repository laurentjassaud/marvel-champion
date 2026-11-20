<script setup>
// Le menu contextuel (clic droit, appui long) : ses lignes viennent de useCardMenu. Sur écran tactile, la
// carte concernée est montrée en grand à côté (cachée par le CSS ailleurs).
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import GameCard, { printedCard } from './GameCard.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'
import { swallowNextClick } from '../composables/usePointer.js'

const gameStore = useGameStore()
const ui = useUiStore()
const menuElement = ref(null)
/** Position affichée du menu (ramenée dans l'écran). */
const position = reactive({ x: 0, y: 0 })
/** La carte dont parle le menu, telle qu'imprimée, ou null. */
const menuCard = computed(() => {
  const card = ui.contextMenu?.cardId && gameStore.cardById(ui.contextMenu.cardId)
  return card ? printedCard(card) : null
})

// garde le menu dans l'écran, puis donne le focus à sa première ligne. Sa taille de mise en page (offsetWidth,
// offsetHeight), et non celle qu'il a à l'écran : il apparaît légèrement réduit (main.css, @starting-style), et
// mesuré ainsi il dépasserait de quelques pixels une fois à sa taille
watch(() => ui.contextMenu, async menu => {
  if (!menu) return
  position.x = menu.x
  position.y = menu.y
  await nextTick()
  if (!menuElement.value) return
  const { offsetWidth: width, offsetHeight: height } = menuElement.value
  position.x = Math.max(4, Math.min(menu.x, innerWidth - width - 8))
  position.y = Math.max(4, Math.min(menu.y, innerHeight - height - 8))
  menuElement.value.querySelector('button')?.focus()
})

/** Choisit une ligne : ferme le menu, puis lance son action. */
function chooseItem(item) {
  ui.closeContextMenu()
  item.run()
}
// comme un menu natif, l'appui qui le ferme ne fait rien d'autre (ni pioche, ni glisser, ni sélection)
function onPointerDownOutside(event) {
  if (!ui.contextMenu || event.target.closest('.menu')) return
  ui.closeContextMenu()
  event.stopPropagation()
  swallowNextClick()
}
onMounted(() => document.addEventListener('pointerdown', onPointerDownOutside, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDownOutside, true))
</script>

<template>
  <div
    v-if="ui.contextMenu"
    ref="menuElement"
    class="menu"
    :class="{ peeks: menuCard }"
    role="menu"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @contextmenu.prevent
  >
    <GameCard v-if="menuCard" class="peek" :card="menuCard" :show-face="true" inert aria-hidden="true" />
    <div class="items">
      <div v-if="ui.contextMenu.title" class="mh">{{ ui.contextMenu.title }}</div>
      <template v-for="(item, index) in ui.contextMenu.items" :key="index">
        <hr v-if="!item">
        <button
          v-else
          type="button"
          :role="item.checked == null ? 'menuitem' : 'menuitemcheckbox'"
          :aria-checked="item.checked ?? undefined"
          @click="chooseItem(item)"
        >
          <span>{{ item.label }}</span><kbd v-if="item.key">{{ item.key }}</kbd><span v-else-if="item.checked" class="chk" aria-hidden="true">✓</span>
        </button>
      </template>
    </div>
  </div>
</template>
