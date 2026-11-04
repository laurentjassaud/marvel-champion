<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useGameStore } from '../stores/game.js'

const game = useGameStore()
const el = ref(null)
const entries = computed(() => game.s?.log.slice(-90) ?? [])

watch(() => game.s?.log.length, async () => {
  await nextTick()
  if (el.value) el.value.scrollTop = el.value.scrollHeight
}, { immediate: true })
</script>

<template>
  <div ref="el" class="log">
    <h3>Journal</h3>
    <p v-for="(e, i) in entries" :key="i" :class="{ sys: e.sys }"><time>{{ e.t }}</time>{{ e.msg }}</p>
  </div>
</template>

<style scoped>
.log { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; overflow: auto; overscroll-behavior: contain; touch-action: pan-y pinch-zoom; min-height: 0; font-size: 12.5px; line-height: 1.45; }
h3 { font-family: var(--f-display); font-weight: 600; font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
p { margin: 0 0 3px; }
p.sys { color: var(--brass); }
time { font-family: var(--f-mono); color: var(--muted); font-size: 11px; margin-right: 6px; }
@media (max-width: 700px) {
  .log { max-height: 220px; }
}
</style>
