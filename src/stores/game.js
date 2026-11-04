import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import * as E from '../game/engine.js'
import { PRECONS, HEROES, VILLAINS, BY_ID } from '../game/data.js'
import { useUiStore } from './ui.js'

const KEY = 'mc-table-vue-v1'

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return s?.cards?.length && s.counters?.length === 3 ? s : null
  } catch { return null }
}

/** Game state + actions. Every action is a thin wrapper around the rules engine. */
export const useGameStore = defineStore('game', () => {
  const ui = useUiStore()
  const s = ref(load())

  // persist (debounced)
  let timer
  watch(s, () => {
    clearTimeout(timer)
    timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(s.value)) } catch { /* quota or private mode */ } }, 250)
  }, { deep: true })

  const ready = computed(() => !!s.value?.cards?.length)
  const zone = z => (s.value ? E.cardsIn(s.value, z) : [])
  const card = id => (s.value && id ? E.byId(s.value, id) : null)
  const pback = computed(() => s.value?.opt?.pback || 'blue')
  const subtitle = computed(() => {
    const o = s.value?.opt
    if (!o) return 'Table solo'
    const h = HEROES.find(x => x.id === o.hero)
    const v = VILLAINS.find(x => x.id === o.villain)
    return `${h?.name ?? ''} contre ${v?.name ?? ''}${o.expert ? ' · expert' : ''}`
  })

  // run an engine function with the state and the current layout
  const run = (fn, ...args) => (s.value ? fn(s.value, ...args) : undefined)
  const withCard = (id, fn) => { const c = card(id); if (c) fn(c) }
  const L = () => ui.layout()

  function newGame(opt) {
    s.value = E.newGame(opt, L())
    ui.select(null)
    ui.preview = null
  }
  function defaultGame() {
    newGame({ hero: 'spider_man', list: PRECONS.spider_man, villain: 'rhino', modular: 'bomb_scare', expert: false, label: 'précon Justice' })
    s.value.log.unshift({ t: s.value.log[0].t, msg: 'Bienvenue. Une partie d\'exemple est prête : Spider-Man contre Rhino. « Nouvelle partie » pour changer de héros ou de méchant.', sys: true })
  }

  return {
    s, ready, zone, card, pback, subtitle,
    newGame, defaultGame,
    precon: hero => PRECONS[hero],
    parseO8D: E.parseO8D,
    isCoreCard: id => !!BY_ID[id],

    draw: () => run(E.drawCard, L()),
    drawMany: n => run(E.drawMany, L(), n),
    discardTop: () => run(E.discardTop),
    shuffle: z => { run(E.shuffleZone, z); run(E.log, z === 'deck' ? 'Paquet mélangé.' : 'Paquet Rencontre mélangé.') },
    searched: z => { run(E.shuffleZone, z); run(E.log, `Vous cherchez dans le ${z === 'deck' ? 'paquet' : 'paquet Rencontre'}, puis le mélangez.`) },
    reveal: () => run(E.revealEncounter, L()),
    boost: () => { if (run(E.dealFaceDown, L())) run(E.log, 'Carte Rencontre posée face cachée (boost).') },
    villainPhase: () => run(E.villainPhase, L()),
    newTurn: () => run(E.newTurn, L()),
    mulligan: ids => run(E.mulligan, L(), ids),
    addToken: () => run(E.addToken, L()),
    clamp: () => run(E.clampAll, L()),

    move: (id, z, opts) => withCard(id, c => run(E.moveCard, c, z, opts)),
    playToTable: (id, faceDown) => withCard(id, c => run(E.playToTable, L(), c, faceDown)),
    takeFromPile: (id, z) => withCard(id, c => run(E.takeFromPile, L(), c, z)),
    reorderHand: (id, beforeId) => run(E.reorderHand, id, beforeId),
    tap: id => withCard(id, c => run(E.toggleTap, c)),
    flip: id => withCard(id, c => run(E.flipCard, c)),
    status: (id, st) => withCard(id, c => run(E.toggleStatus, c, st)),
    damage: (id, n) => run(E.addDamage, card(id), n),
    threat: (id, n) => run(E.addThreat, card(id), n),
    tokens: (id, n) => run(E.addTokens, card(id), n),
    untapPlayer: () => { zone('table').filter(c => !E.isEnc(c)).forEach(c => { c.tapped = false }) },

    counterAdd(i, n) { const k = s.value.counters[i]; k.v += n; E.log(s.value, `${k.l} : ${k.v}.`) },
    counterLabel(i, l) { if (l) s.value.counters[i].l = l }
  }
})
