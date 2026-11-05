import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const SIZE_KEY = 'mc-table-card-size'
const readSize = () => {
  try { return Number(localStorage.getItem(SIZE_KEY)) || 80 } catch { return 80 }
}

/** Interface state: sizes, selection, hover, preview, context menu, modals. */
export const useUiStore = defineStore('ui', () => {
  const cw = ref(readSize()) // table card width (px)
  const tableW = ref(0)
  const tableH = ref(0)
  const sel = ref(null) // selected card id
  const randomPick = ref(null) // card of the hand picked at random, outlined in red
  const hover = ref(null) // card id under the pointer
  const preview = ref(null) // {id, face} card shown enlarged
  const menu = ref(null) // {x, y, title, items: [{label, key, run, checked?} | null], card?: id}
  const modal = ref(null) // {type: 'setup'|'pile'|'mulligan'|'help'|'restart', zone?}

  watch(cw, v => { try { localStorage.setItem(SIZE_KEY, String(v)) } catch { /* storage unavailable */ } })

  // floors only cover the instant before the table is measured: above the real size they would place cards off the table
  const layout = () => ({ w: Math.max(tableW.value, 400), h: Math.max(tableH.value, 300), cw: cw.value })
  const setTable = (w, h) => { tableW.value = w; tableH.value = h }
  const select = id => { sel.value = id }
  const showPreview = (id, face = false) => { preview.value = { id, face } }
  const openMenu = m => { menu.value = m }
  const closeMenu = () => { menu.value = null }
  const openModal = (type, extra = {}) => { menu.value = null; modal.value = { type, ...extra } }
  const closeModal = () => { modal.value = null }

  return { cw, tableW, tableH, sel, randomPick, hover, preview, menu, modal, layout, setTable, select, showPreview, openMenu, closeMenu, openModal, closeModal }
})
