<script setup>
// Le méchant en grand, en bas à gauche de la table, sur son illustration (maquette « RHINO II / 21 PV ») :
// son nom et ses PV, puis la menace de la manigance principale, chacun avec − et +. Il passe au-dessus des
// cartes ; sa largeur est donnée au moteur (ui.setHeroInset) pour que la rangée du héros commence après
// lui plutôt que dessous. Il a une largeur minimale : elle est connue avant même la première partie.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import HudCounter from './HudCounter.vue'
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
const hudElement = ref(null)

let resizeObserver
/**
 * Bord droit du bloc, depuis le bord gauche de la table (ils ont le même parent, .play) ; 0 sur téléphone,
 * où le bloc passe au-dessus de la table au lieu de la recouvrir.
 */
function measureHud() {
  const hud = hudElement.value
  ui.setHeroInset(getComputedStyle(hud).position === 'absolute' ? hud.offsetLeft + hud.offsetWidth : 0)
}
// mesuré tout de suite (la partie d'exemple se met en place juste après, dans App), puis à chaque changement de taille
onMounted(() => {
  measureHud()
  resizeObserver = new ResizeObserver(measureHud)
  resizeObserver.observe(hudElement.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <section ref="hudElement" class="hud villain-hud" aria-label="Méchant et manigance principale">
    <HudCounter :index="1" tone="villain" size="xl" unit="PV" />
    <HudCounter :index="2" tone="threat" size="m" split-limit />
  </section>
</template>

<style scoped>
/* au-dessus des cartes de la table ; seuls les champs et les boutons captent le pointeur, une carte glissée
   dessous se reprend à travers le texte */
.villain-hud {
  position: absolute; z-index: 2; left: max(12px, calc(48 * var(--u))); bottom: max(12px, calc(70 * var(--u)));
  min-width: max(200px, calc(400 * var(--u)));
  display: grid; justify-items: start; gap: max(8px, calc(18 * var(--u))); pointer-events: none;
}
.villain-hud :deep(input), .villain-hud :deep(button) { pointer-events: auto; }
/* la menace, en retrait sous les PV : l'escalier continue */
.villain-hud > :last-child { margin-left: calc(var(--u) * 92); }
/* arrivée (une fois par partie) : le nom, puis les PV, puis la menace montent en place */
.villain-hud > * { animation: hud-enter 520ms var(--ease-out) both; }
.villain-hud > :nth-child(2) { animation-delay: 70ms; }
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
