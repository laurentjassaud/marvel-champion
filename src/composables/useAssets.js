import { def, isEnc } from '../game/engine.js'
import { BY_ID } from '../game/data.js'

// BASE_URL is '/' in the PWA build, './' in the artifact build, or the --base you deploy under.
const base = import.meta.env.BASE_URL
// each pack has its own folder under cards/ (encoded: "bouffon vert" has a space)
const folder = d => `${base}cards/${encodeURIComponent(d?.dir ?? 'base')}`

/** Face image of a card (".b" = back side of double-sided cards). */
export const cardImage = c => `${folder(def(c))}/${c.g}${c.side && def(c).bn ? '.b' : ''}.jpg`

/** Card back: orange for encounter cards, the chosen colour for the player deck. */
export const backImage = (c, pback = 'blue') => `${base}backs/${isEnc(c) ? 'orange' : pback}.jpg`

/** Status card overlay (stunned, confused, tough). */
export const statusImage = id => `${base}status/${id}.png`

export const imageById = gid => `${folder(BY_ID[gid])}/${gid}.jpg`
export const backById = name => `${base}backs/${name}.jpg`
