// Le nombre de colonnes des grilles de cases de « Préparation de la partie » (cases de 88 px de la maquette,
// 4 px entre elles, autant que la largeur le permet : repeat(auto-fill)) : dix à la taille de la maquette,
// moins sur un écran plus étroit. Lu dans la grille elle-même (les colonnes que le navigateur a placées, sans
// erreur d'arrondi), et relu quand l'élément qui la contient change de taille : les cases vides qui complètent
// la grille remplissent alors exactement ses rangées.
import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * @param {import('vue').Ref<HTMLElement|null>} containerRef  l'élément qui contient la grille (.choices)
 * @returns {import('vue').Ref<number>}  le nombre de colonnes (10 tant qu'il n'est pas mesuré)
 */
export function useGridColumns(containerRef) {
  const columns = ref(10)
  let observer = null
  function measure() {
    const grid = containerRef.value?.querySelector('.choices')
    if (!grid) return
    const tracks = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(track => track.endsWith('px'))
    if (tracks.length) columns.value = tracks.length
  }
  onMounted(() => {
    measure()
    observer = new ResizeObserver(measure)
    if (containerRef.value) observer.observe(containerRef.value)
  })
  onBeforeUnmount(() => observer?.disconnect())
  return columns
}
