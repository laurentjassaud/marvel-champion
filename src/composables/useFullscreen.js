// Plein écran : toute la page (la table et ses fenêtres), par l'API du navigateur ; Échap en sort aussi.
// isSupported est faux là où le navigateur ne le permet pas (iPhone) : le bouton n'est alors pas proposé.

import { ref, onMounted, onBeforeUnmount } from 'vue'

/** L'élément en plein écran, ou null (préfixe webkit : Safari sur iPad, anciens navigateurs). */
const fullscreenElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null

export function useFullscreen() {
  const isSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled)
  const isFullscreen = ref(!!fullscreenElement())
  const sync = () => { isFullscreen.value = !!fullscreenElement() }

  onMounted(() => {
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', sync)
    document.removeEventListener('webkitfullscreenchange', sync)
  })

  /** Passe la page en plein écran, ou en sort. */
  function toggle() {
    if (fullscreenElement()) {
      (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)?.catch?.(() => {})
      return
    }
    const root = document.documentElement
    const request = root.requestFullscreen ?? root.webkitRequestFullscreen
    request?.call(root, { navigationUI: 'hide' })?.catch?.(() => {})
  }

  return { isSupported, isFullscreen, toggle }
}
