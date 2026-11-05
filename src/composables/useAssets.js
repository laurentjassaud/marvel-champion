import { def, isEnc } from '../game/engine.js'
import { BY_ID } from '../game/data.js'

// BASE_URL is '/' in the PWA build, './' in the artifact build, or the --base you deploy under.
const base = import.meta.env.BASE_URL
// each pack has its own folder under cards/ (encoded: "bouffon vert" has a space)
const folder = d => `${base}cards/${encodeURIComponent(d?.dir ?? 'base')}`

// a card read from MarvelCDB has the site's image (null if the site has none)
const online = d => d?.pack === 'marvelcdb'

/** Face image of a card (".b" = back side of double-sided cards); null when there is none. */
export function cardImage(c) {
  const d = def(c)
  const back = c.side && d.bn
  if (online(d)) return (back ? d.bimg : d.img) ?? null
  return `${folder(d)}/${c.g}${back ? '.b' : ''}.jpg`
}

/** Card back: blue for the hero's cards, purple for the villain cards, yellow-orange for the other encounter cards. */
export const backImage = c => `${base}backs/${!isEnc(c) ? 'blue' : def(c).t === 'villain' ? 'purple' : 'orange'}.jpg`

/** Status card overlay (stunned, confused, tough). */
export const statusImage = id => `${base}status/${id}.png`

export const imageById = gid => (online(BY_ID[gid]) ? BY_ID[gid].img ?? '' : `${folder(BY_ID[gid])}/${gid}.jpg`)
