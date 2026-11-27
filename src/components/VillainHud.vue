<script setup>
// Le méchant en grand, en bas à gauche de la table, sur son illustration (maquette « RHINO II / 21 PV ») :
// son nom et ses PV, puis la menace de la manigance principale, chacun avec − et +. La ligne des PV et la
// menace passent au-dessus des cartes, qui ne vont jamais dessous ; le nom du méchant passe sous elles : on
// peut poser des cartes dessus. Sa largeur est donnée au moteur (ui.setHeroInset) pour que la rangée du héros
// commence après lui plutôt que dessous. Il a une largeur minimale : elle est connue avant même la première partie.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import HudCounter from './HudCounter.vue'
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
const hudElement = ref(null)

let resizeObserver
/**
 * Bord droit du bloc, depuis le bord gauche de la table (ils ont le même parent, .play), puis bord haut et bord
 * droit de la ligne des PV et de la menace, sous le nom : une carte glissée dessous remonte au-dessus
 * (keepCardOnTable), elle peut rester sur le nom. 0 et null sur téléphone et tablette en portrait, où le bloc
 * passe au-dessus ou au-dessous de la table au lieu de la recouvrir.
 */
function measureHud() {
  const hud = hudElement.value
  const hudRight = hud.offsetLeft + hud.offsetWidth
  if (getComputedStyle(hud).position !== 'absolute') {
    ui.setHeroInset(0, null)
    return
  }
  // la ligne des PV et la menace (positionnées : leur offsetParent est le bloc). offsetTop et offsetLeft
  // ignorent la montée des compteurs à leur arrivée (une transformation), que getBoundingClientRect compterait
  const guarded = [...hud.querySelectorAll(':scope > .counter:first-child .value-row, :scope > .counter:last-child')]
  if (!guarded.length) {
    ui.setHeroInset(hudRight, hud.offsetTop)
    return
  }
  // elles changent de largeur sans que le bloc en change (9 → 10 PV, sous un nom plus large) : observées aussi
  for (const element of guarded) resizeObserver?.observe(element)
  const top = hud.offsetTop + Math.min(...guarded.map(element => element.offsetTop))
  const right = hud.offsetLeft + Math.max(...guarded.map(element => element.offsetLeft + element.offsetWidth))
  ui.setHeroInset(hudRight, top, right)
}
// mesuré tout de suite (la partie d'exemple se met en place juste après, dans App), puis à chaque changement
// de sa taille, ou de celle de la fenêtre (posé en bas de la table, son bord haut suit la hauteur de la table)
onMounted(() => {
  measureHud()
  resizeObserver = new ResizeObserver(measureHud)
  resizeObserver.observe(hudElement.value)
  window.addEventListener('resize', measureHud)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measureHud)
})
</script>

<template>
  <section ref="hudElement" class="hud villain-hud" aria-label="Méchant et manigance principale">
    <HudCounter :index="1" tone="villain" size="xl" unit="PV" :renamable="false" />
    <HudCounter :index="2" tone="threat" size="m" split-limit />
  </section>
</template>

<style scoped>
/* sans z-index à lui : son nom reste sous la table (z-index 1, GameTable), et ses cartes peuvent le recouvrir ;
   la ligne des PV et la menace passent au-dessus (z-index 2), les cartes ne vont jamais dessous (keepCardOnTable).
   Seuls les champs et les boutons captent le pointeur */
.villain-hud {
  position: absolute; left: max(12px, calc(48 * var(--u))); bottom: max(12px, calc(70 * var(--u)));
  /* assez large pour sa ligne de PV avant même qu'elle s'affiche : la partie d'exemple se met en place avant */
  min-width: max(300px, calc(420 * var(--u)));
  display: grid; justify-items: start; gap: max(8px, calc(18 * var(--u))); pointer-events: none;
}
.villain-hud :deep(input), .villain-hud :deep(button) { pointer-events: auto; }
.villain-hud > :first-child :deep(.value-row), .villain-hud > :last-child { position: relative; z-index: 2; }
/* la menace, en retrait sous les PV : l'escalier continue */
.villain-hud > :last-child { margin-left: calc(var(--u) * 92); }
/* arrivée (une fois par partie) : le nom, puis les PV, puis la menace montent en place. backwards, pas both :
   une animation qui reste en vigueur après sa fin garderait chaque compteur dans son propre plan, et sa ligne
   des PV (z-index 2) ne passerait plus au-dessus des cartes */
.villain-hud > * { animation: hud-enter 520ms var(--ease-out) backwards; }
.villain-hud > :nth-child(2) { animation-delay: 70ms; }
/* tablette en portrait : la table est étroite, le bloc passe sous elle, sur une ligne (la rangée du héros
   garde toute la largeur) */
@media (min-width: 701px) and (max-width: 900px) {
  .villain-hud { position: static; min-width: 0; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 32px; padding: 10px 0 4px 12px; }
  .villain-hud > :last-child { margin-left: 0; }
}
/* téléphones : le bloc passe au-dessus de la table, sur une ligne */
@media (max-width: 700px) {
  .villain-hud { position: static; order: -1; min-width: 0; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 24px; padding: 4px 0 10px; }
  .villain-hud > :last-child { margin-left: 0; }
}
@keyframes hud-enter {
  from { opacity: 0; transform: translateY(14px); }
}
@keyframes hud-fade {
  from { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .villain-hud > * { animation-name: hud-fade; }
}
</style>
