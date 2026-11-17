<script setup>
// « Bientôt disponible » : un lien de l'accueil qui ne mène encore nulle part. Le lien, passé dans le slot,
// reçoit ses attributs (attrs : désactivé pour les lecteurs d'écran, décrit par l'étiquette) ; au survol de la
// souris, au focus clavier ou à l'appui du doigt (qui ne survole pas), une petite étiquette rouge, comme celle
// du titre, l'annonce à côté de lui.
import { ref, useId, onBeforeUnmount } from 'vue'

defineProps({
  /** Où l'étiquette apparaît : 'end' à droite du lien (menu), 'below' dessous (onglets de la barre). */
  placement: { type: String, default: 'end' }
})
const id = useId()
/** Montrée par un appui : elle reste un instant, puis s'efface. */
const isShown = ref(false)
let hideTimer
function show() {
  isShown.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { isShown.value = false }, 1600)
}
onBeforeUnmount(() => clearTimeout(hideTimer))
const linkAttrs = { 'aria-disabled': 'true', 'aria-describedby': id, onClick: show }
</script>

<template>
  <span class="soon-wrap" :class="[placement, { shown: isShown }]">
    <slot :attrs="linkAttrs" />
    <span :id="id" class="soon" role="tooltip">Bientôt disponible</span>
  </span>
</template>

<style scoped>
.soon-wrap { position: relative; display: inline-flex; }
/* l'étiquette rouge du titre (« Marvel »), en petit ; elle sort du lien vers l'extérieur, plus vite qu'elle n'entre */
.soon {
  position: absolute; z-index: 1; pointer-events: none; white-space: nowrap;
  padding: 2px 6px 4px; background: var(--red); color: #fff;
  font: normal 700 16px/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
  opacity: 0;
  transition: opacity 120ms ease, transform 120ms var(--ease-out);
}
.end .soon { left: calc(100% + 14px); top: 50%; transform: translate(-6px, -50%); transform-origin: left center; }
.below .soon { left: 50%; top: calc(100% + 6px); transform: translate(-50%, -4px); transform-origin: top center; }
.shown .soon, .soon-wrap:has(:focus-visible) .soon { opacity: 1; transition-duration: 160ms; }
.end.shown .soon, .end:has(:focus-visible) .soon { transform: translate(0, -50%); }
.below.shown .soon, .below:has(:focus-visible) .soon { transform: translate(-50%, 0); }
@media (hover: hover) and (pointer: fine) {
  .soon-wrap:hover .soon { opacity: 1; transition-duration: 160ms; }
  .end:hover .soon { transform: translate(0, -50%); }
  .below:hover .soon { transform: translate(-50%, 0); }
}
/* téléphones : pas la place à droite d'un lien du menu ; l'étiquette se pose sur le lien lui-même */
@media (max-width: 700px) {
  .end .soon { left: 50%; top: 50%; transform: translate(-50%, -50%) scale(.96); transform-origin: center; }
  .end.shown .soon, .end:has(:focus-visible) .soon { transform: translate(-50%, -50%); }
}
/* mouvement réduit : l'étiquette apparaît en fondu, sans glisser */
@media (prefers-reduced-motion: reduce) {
  .soon { transition: opacity 120ms ease; }
  .end .soon { transform: translate(0, -50%); }
  .below .soon { transform: translate(-50%, 0); }
}
@media (prefers-reduced-motion: reduce) and (max-width: 700px) {
  .end .soon { transform: translate(-50%, -50%); }
}
</style>
