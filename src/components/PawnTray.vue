<script setup>
// La liste des pions, ouverte par l'onglet « Pions » de la barre (TopBar, data-pawn-anchor) : les pions libres
// de PAWN_KINDS, à glisser sur la table (le glisser est géré par usePointer, grâce à l'attribut data-pawn), ou à
// toucher (ou Entrée) pour en poser un au milieu de la table. Elle reste ouverte pour en poser plusieurs ; un
// appui ailleurs, Échap (useKeyboard) ou l'onglet la ferment. Posée sous l'onglet, ramenée dans l'écran ; dans
// le style des fenêtres (fond dégradé, barre rouge en haut, titre en Barlow).
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import redBarUrl from '../assets/modal/red-bar.svg'
import { PAWN_KINDS } from '../game/data.js'
import { pawnImageUrl } from '../composables/useAssets.js'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const trayElement = ref(null)
const position = reactive({ left: 0, top: 0 })

/** Sous l'onglet « Pions », alignée sur son bord gauche, sans sortir de l'écran. */
function place() {
  const anchor = document.querySelector('[data-pawn-anchor]')
  const tray = trayElement.value
  if (!anchor || !tray) return
  const rect = anchor.getBoundingClientRect()
  position.left = Math.round(Math.max(8, Math.min(rect.left, innerWidth - tray.offsetWidth - 8)))
  position.top = Math.round(rect.bottom + 6)
}
// à l'ouverture : à sa place, le focus sur le premier pion (au clavier, on enchaîne aussitôt)
watch(() => ui.pawnTrayOpen, async open => {
  if (!open) return
  await nextTick()
  place()
  trayElement.value?.querySelector('button')?.focus({ preventScroll: true })
})

/** Toucher, clic ou Entrée sur un pion : il se pose au milieu de la table, sélectionné. */
function placeInMiddle(pawnId) {
  const pawn = gameStore.addPawn(pawnId)
  if (pawn) ui.selectCard(pawn.id)
}

// un appui hors de la liste (et hors de l'onglet, qui la ferme lui-même) la ferme ; il fait aussi ce qu'il
// devait faire (prendre une carte…) : la liste n'est qu'une palette, pas un menu qui attend une réponse
function onPointerDownOutside(event) {
  if (!ui.pawnTrayOpen || event.target.closest?.('.pawn-tray, [data-pawn-anchor]')) return
  ui.closePawnTray()
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDownOutside, true)
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDownOutside, true)
  window.removeEventListener('resize', place)
})
</script>

<template>
  <div v-if="ui.pawnTrayOpen" id="pawn-tray" ref="trayElement" class="pawn-tray" role="dialog" aria-label="Pions"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }">
    <img class="tray-bar" :src="redBarUrl" alt="" width="395" height="16" draggable="false">
    <p class="tray-title">Pions</p>
    <p class="tray-hint">Glissez-les sur la table</p>
    <ul class="tray-list">
      <li v-for="kind in PAWN_KINDS" :key="kind.id" :class="kind.id">
        <button type="button" class="pawn-source" :data-pawn="kind.id" :title="kind.label"
          :aria-label="`Poser sur la table : ${kind.label}`" @click="placeInMiddle(kind.id)">
          <img :src="pawnImageUrl(kind.id)" alt="" draggable="false">
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* au-dessus de la table et de la barre, sous les fenêtres (1500) et le menu contextuel (2000) ; le panneau des
   fenêtres (main.css, .modal .box), en petit. Elle s'ouvre depuis l'onglet : fondu et léger grossissement
   depuis son coin haut gauche (fermeture immédiate, comme le menu) */
.pawn-tray {
  position: fixed; z-index: 1400; padding: 18px 16px 16px;
  border: 2px solid rgb(34 60 94 / .25); border-radius: 4px;
  background: linear-gradient(rgb(24 34 82), rgb(33 36 66));
  box-shadow: 0 18px 40px -8px rgb(6 7 20 / .7), 0 2px 6px rgb(0 0 0 / .3);
  transform-origin: top left; transition: opacity 160ms var(--ease-out), transform 160ms var(--ease-out);
}
@starting-style {
  .pawn-tray { opacity: 0; transform: translateY(-6px) scale(.97); }
}
/* la barre rouge des fenêtres, au milieu du haut */
.tray-bar { position: absolute; left: 50%; top: -2px; width: 170px; height: 7px; translate: -50% 0; pointer-events: none; }
.tray-title { margin: 0; font: italic 700 22px/1 var(--font-display); letter-spacing: -.01em; text-transform: uppercase; color: #c2c3fd; }
.tray-hint { margin: 4px 0 12px; font-size: 13px; line-height: 1.3; color: var(--muted); }
/* quatre colonnes : les trois ronds et le +1, puis les deux bulles, deux colonnes chacune */
.tray-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 64px); gap: 8px; }
.tray-list .ready, .tray-list .shoot { grid-column: span 2; }
/* chaque pion sur sa case, comme un champ des fenêtres ; il se saisit (cursor grab), le doigt ne fait pas
   défiler la page en le tirant (touch-action), pas de loupe ni de menu iOS sur l'image */
.pawn-source {
  display: grid; place-items: center; width: 100%; height: 64px; padding: 6px;
  background: rgb(17 23 50 / .6); border: 1px solid #34426c; border-radius: 6px;
  cursor: grab; touch-action: none; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none;
  transition: border-color 150ms ease, transform 140ms var(--ease-out);
}
.pawn-source img { display: block; max-width: 100%; height: 44px; object-fit: contain; pointer-events: none; filter: drop-shadow(0 2px 2px rgb(0 0 0 / .35)); }
.plus-un .pawn-source img { height: 52px; }
.ready .pawn-source img, .shoot .pawn-source img { height: 50px; }
.pawn-source:active { transform: scale(.97); }
.pawn-source:focus-visible { outline: none; border-color: var(--yellow); box-shadow: 0 0 0 1px var(--yellow); }
@media (hover: hover) and (pointer: fine) {
  .pawn-source:hover { border-color: rgb(120 158 202 / .8); }
}
@media (prefers-reduced-motion: reduce) {
  .pawn-tray, .pawn-source { transition: opacity 160ms ease; }
  @starting-style {
    .pawn-tray { transform: none; }
  }
}
</style>
