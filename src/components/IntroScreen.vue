<script>
/** L'entrée de 2 s ne se joue qu'une fois, au lancement de l'application ; un retour depuis la table est un simple fondu. */
let hasPlayed = false
/** De même, la vidéo du ciel ne se lit qu'une fois par lancement ; ensuite, l'accueil la montre sur sa dernière image. */
let hasPlayedSky = false
</script>

<script setup>
// La page d'accueil (maquette Figma « accueil », 1920 × 1080) : un ciel étoilé en vidéo entre la ville vue
// d'en bas et ses immeubles au premier plan, six héros autour du titre et du menu, la barre du haut. Elle
// s'affiche au lancement par-dessus la table, déjà prête et mesurée (une nouvelle partie s'y pose donc
// normalement), et revient par le titre de la barre. « Scénarios » ouvre la fenêtre « Nouvelle partie »,
// « Reprendre une partie » découvre la table, « Guide de référence 1.8 » ouvre le guide des règles dans une
// nouvelle fenêtre ; les autres liens ne sont pas encore prêts (SoonHint).
//
// L'entrée, au lancement : le titre, puis les héros un à un, puis la barre et le menu, en 2 s. Ce sont des
// animations CSS : elles restent fluides pendant que la table se monte derrière. Elle attend les polices et
// les images (1,2 s au plus), pour ne pas jouer sur des héros encore invisibles.
import { ref, onMounted, watch } from 'vue'
import TopBar from './TopBar.vue'
import SoonHint from './SoonHint.vue'
import { INTRO_SKY_URL, INTRO_CITY_URL, INTRO_FOREGROUND_URL, introHeroUrl } from '../composables/useAssets.js'
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()

/**
 * Les héros, du plus au fond au plus en avant (calques de la maquette) ; leur place, leur taille et leur
 * moment d'entrée sont dans le style. mirrored : retourné de gauche à droite, comme sur la maquette.
 */
const HEROES = [
  { id: 'tornade', width: 391, height: 690 },
  { id: 'spider-man', width: 562, height: 782 },
  { id: 'miss-marvel', width: 1097, height: 1661, mirrored: true },
  { id: 'captain-america', width: 600, height: 911, mirrored: true },
  { id: 'wolverine', width: 447, height: 445, mirrored: true },
  { id: 'hulk', width: 735, height: 1117 }
]
const SOON_LINKS = ['Campagnes', 'Fanmades', 'Marathon']
/** Le guide de référence des règles (version 1.8, site externe), ouvert dans une nouvelle fenêtre. */
const REFERENCE_GUIDE_URL = 'https://deejimy.github.io/mc-reference/'

const plays = !hasPlayed
hasPlayed = true
/** Polices et images prêtes : l'entrée démarre (sans entrée, rien à attendre). */
const isReady = ref(!plays)
const rootElement = ref(null)

// le ciel : la vidéo se lit une fois, au lancement, puis s'arrête sur sa dernière image ; un retour depuis la
// table, ou « réduire les animations », la montre directement sur cette image ; économie de données : pas de vidéo
const reducesMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const withVideo = navigator.connection?.saveData !== true
const playsSky = withVideo && !reducesMotion && !hasPlayedSky
if (playsSky) hasPlayedSky = true
const videoElement = ref(null)
/** La vidéo a l'image à montrer (la première, ou la dernière) : elle apparaît en fondu par-dessus la ville (jamais un cadre vide). */
const isVideoVisible = ref(false)
/** Sans lecture : aller à la dernière image (un rien avant la fin, que certains navigateurs montrent noire). */
function showLastFrame(event) {
  if (!playsSky) event.target.currentTime = Math.max(0, event.target.duration - 0.05)
}
function onFrameReady(event) {
  if (playsSky || event.type === 'seeked') isVideoVisible.value = true
}

onMounted(() => {
  const video = videoElement.value
  if (playsSky && video.readyState >= 2) isVideoVisible.value = true
  if (playsSky) video.play().catch(() => {}) // iOS : lecture muette relancée à la main si besoin
  if (!plays) return
  const fonts = document.fonts
    ? [document.fonts.load('italic 700 120px "Barlow Condensed"'), document.fonts.load('700 36px "Barlow Condensed"')]
    : []
  const images = [...rootElement.value.querySelectorAll('img')].map(image => image.decode())
  const loaded = Promise.allSettled([...fonts, ...images])
  Promise.race([loaded, new Promise(resolve => setTimeout(resolve, 1200))]).then(() => { isReady.value = true })
})

// une fenêtre ouverte par-dessus (Nouvelle partie, aide) floute l'accueil : la vidéo s'arrête derrière, et
// reprend à sa fermeture si elle n'était pas finie (sinon elle repartirait du début)
watch(() => ui.modal, modal => {
  const video = videoElement.value
  if (!video || !playsSky) return
  if (modal) video.pause()
  else if (!video.ended) video.play().catch(() => {})
})
</script>

<template>
  <section ref="rootElement" class="intro-screen" :class="{ plays, ready: isReady }" aria-labelledby="intro-title">
    <!-- le décor : fond indigo, ville vue d'en bas (produit, 57 %), ciel étoilé, immeubles au premier plan -->
    <div class="scenery" aria-hidden="true">
      <img class="city" :src="INTRO_CITY_URL" alt="" width="1672" height="941" draggable="false">
      <video v-if="withVideo" ref="videoElement" class="sky" :class="{ visible: isVideoVisible }" :src="INTRO_SKY_URL"
        muted playsinline :autoplay="playsSky" :preload="playsSky ? 'auto' : 'metadata'"
        disablepictureinpicture disableremoteplayback tabindex="-1"
        @loadedmetadata="showLastFrame" @loadeddata="onFrameReady" @seeked="onFrameReady" />
      <img class="foreground" :src="INTRO_FOREGROUND_URL" alt="" width="1672" height="941" draggable="false">
    </div>

    <div class="heroes" aria-hidden="true">
      <div v-for="hero in HEROES" :key="hero.id" class="hero" :class="hero.id">
        <img :class="{ mirrored: hero.mirrored }" :src="introHeroUrl(hero.id)" alt="" :width="hero.width" :height="hero.height" draggable="false">
      </div>
    </div>

    <div class="top">
      <TopBar intro />
    </div>

    <!-- sous la barre : le titre, sous les héros, et le menu, par-dessus -->
    <div class="stage">
      <h1 id="intro-title" class="title">
        <span class="tag">Marvel</span>
        <span class="name">Champions</span>
      </h1>
      <nav class="main-menu" aria-label="Menu principal">
        <ul class="links">
          <li><button type="button" class="link" @click="ui.openModal('setup')">Scénarios</button></li>
          <li v-for="label in SOON_LINKS" :key="label">
            <SoonHint v-slot="{ attrs }">
              <button type="button" class="link" v-bind="attrs">{{ label }}</button>
            </SoonHint>
          </li>
        </ul>
        <hr class="rule">
        <div class="after-rule">
          <button type="button" class="link resume" @click="ui.closeIntro()">Reprendre une partie</button>
          <a class="link guide" :href="REFERENCE_GUIDE_URL" target="_blank" rel="noopener noreferrer"
            aria-label="Guide de référence 1.8 (s'ouvre dans une nouvelle fenêtre)">
            Guide de référence 1.8
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2 2 10" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
          </a>
        </div>
      </nav>
    </div>
  </section>
</template>

<style scoped>
/* tout l'écran, par-dessus la table et sous les fenêtres (1500) ; le fond indigo de la table (main.css .app) */
.intro-screen {
  position: fixed; inset: 0; z-index: 1000; isolation: isolate; overflow: hidden;
  display: grid; grid-template-rows: auto minmax(0, 1fr);
  background: radial-gradient(ellipse 58.7% 58.7% at 50% 73.5%, var(--bg-center), var(--bg-mid) 50%, var(--bg));
  /* un pixel de la maquette (--u, main.css) ; le titre et le menu ne descendent pas sous une taille lisible */
  --tu: max(var(--u), .46px);
  --mu: max(var(--u), .62px);
}

/* ---------- le décor ---------- */
.scenery { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.scenery > * { position: absolute; max-width: none; object-fit: cover; }
/* la ville et les immeubles débordent un peu de l'écran, comme sur la maquette (1962 × 1104 sur 1920 × 1080) */
.city { left: -.68%; top: 0; width: 102.2%; height: 102.2%; mix-blend-mode: multiply; opacity: .57; }
/* le ciel étoilé, à peine visible sur le fond indigo (maquette : vidéo à 15 %) */
.sky { inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 900ms ease; }
.sky.visible { opacity: .15; }
.foreground { left: -.57%; top: .1%; width: 102.2%; height: 102.2%; }

/* ---------- les héros : collés aux bords de l'écran, à l'échelle de la maquette ---------- */
.heroes { position: absolute; inset: 0; z-index: 2; overflow: hidden; pointer-events: none; }
.hero { position: absolute; }
.hero img { display: block; width: 100%; height: 100%; max-width: none; }
.hero img.mirrored { transform: scaleX(-1); }
.captain-america { left: calc(-94 * var(--u)); top: calc(-173 * var(--u)); width: calc(600 * var(--u)); height: calc(911 * var(--u)); }
.wolverine { left: calc(293 * var(--u)); bottom: calc(-118 * var(--u)); width: calc(447 * var(--u)); height: calc(445 * var(--u)); }
.hulk { left: calc(-94 * var(--u)); bottom: calc(-571 * var(--u)); width: calc(735 * var(--u)); height: calc(1117 * var(--u)); }
.tornade { right: calc(476 * var(--u)); bottom: calc(-182 * var(--u)); width: calc(391 * var(--u)); height: calc(690 * var(--u)); }
.spider-man { right: calc(-64 * var(--u)); top: calc(-182 * var(--u)); width: calc(562 * var(--u)); height: calc(782 * var(--u)); }
.miss-marvel { right: calc(-322 * var(--u)); bottom: calc(-697 * var(--u)); width: calc(1097 * var(--u)); height: calc(1661 * var(--u)); }

/* ---------- la barre : opaque sur l'accueil, jusque sous l'encoche ---------- */
.top {
  position: relative; z-index: 4;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
  background: linear-gradient(90deg, var(--bg-deep), #454c8d);
}

/* ---------- le titre et le menu ---------- */
.stage { position: relative; min-height: 0; }
/* le titre : « Marvel » dans son étiquette rouge, posé sur « Champions » ; 37 px sous la barre (maquette : 85 px du haut) */
.title {
  position: absolute; z-index: 1; left: 50%; top: calc(37 * var(--tu)); translate: -50% 0;
  margin: 0; display: grid; justify-items: center; pointer-events: none; white-space: nowrap;
}
.tag {
  display: flex; align-items: center; height: calc(29 * var(--tu)); padding: 0 calc(2 * var(--tu)) calc(3 * var(--tu));
  background: var(--red); font: normal 700 calc(36 * var(--tu))/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
}
.name {
  margin-top: calc(-16 * var(--tu));
  font: italic 700 calc(120 * var(--tu))/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase;
}
/* le menu, au milieu de l'écran : les liens à 72 px d'écart, un filet, puis « Reprendre une partie » et,
   juste dessous, plus petit, le lien du guide de référence */
.main-menu {
  position: absolute; z-index: 3; left: 50%; top: calc(50% - 8 * var(--u)); translate: -50% -50%;
  display: grid; justify-items: center; gap: calc(48 * var(--mu));
}
.links { list-style: none; margin: calc(-18 * var(--mu)) 0; padding: 0; display: grid; justify-items: center; }
.links li { display: flex; }
.link {
  display: flex; align-items: center; height: calc(72 * var(--mu)); padding: 0 calc(10 * var(--mu)); border: 0; background: none;
  color: #fff; font: italic 700 calc(54 * var(--mu))/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; white-space: nowrap;
  transition: transform 160ms var(--ease-out), text-shadow 150ms ease;
}
.link:active:not([aria-disabled]) { transform: scale(.97); }
/* pas encore prêt : le violet de la maquette */
.link[aria-disabled] { color: #565dad; cursor: default; }
@media (hover: hover) and (pointer: fine) {
  .link:not([aria-disabled]):hover { text-shadow: 0 0 calc(22 * var(--mu)) rgb(101 103 198 / .95); }
}
.rule { width: calc(450 * var(--mu)); height: 1px; margin: 0; border: 0; background: #3a45c3; }
.after-rule { display: grid; justify-items: center; }
.resume { height: calc(48 * var(--mu)); font-size: calc(32 * var(--mu)); }
.guide {
  gap: calc(8 * var(--mu)); height: calc(40 * var(--mu)); font-size: calc(24 * var(--mu));
  color: #c3c5f5; text-decoration: none;
}
.guide svg { width: .6em; height: .6em; }

/* ---------- l'entrée (2 s, au lancement) ----------
   0 ms le titre, 250 ms son étiquette ; de 450 ms à 1,7 s les héros, un toutes les 110 ms, chacun depuis son
   bord ; 1,35 s la barre ; de 1,4 s à 2 s le menu, ligne après ligne */
@media (prefers-reduced-motion: no-preference) {
  .plays .name { animation: intro-title 700ms var(--ease-out) both; }
  .plays .tag { animation: intro-tag 450ms var(--ease-out) 250ms both; }
  .plays .hero { animation: intro-hero 700ms var(--ease-drawer) both; }
  .plays .captain-america { --from-x: calc(-60 * var(--u)); --from-y: calc(-40 * var(--u)); animation-delay: 450ms; }
  .plays .spider-man { --from-x: calc(60 * var(--u)); --from-y: calc(-40 * var(--u)); animation-delay: 560ms; }
  .plays .hulk { --from-x: calc(-60 * var(--u)); --from-y: calc(50 * var(--u)); animation-delay: 670ms; }
  .plays .miss-marvel { --from-x: calc(70 * var(--u)); --from-y: calc(40 * var(--u)); animation-delay: 780ms; }
  .plays .wolverine { --from-x: calc(-40 * var(--u)); --from-y: calc(50 * var(--u)); animation-delay: 890ms; }
  .plays .tornade { --from-x: 0px; --from-y: calc(60 * var(--u)); animation-delay: 1000ms; }
  .plays .top { animation: intro-top 450ms var(--ease-out) 1350ms both; }
  .plays .links li, .plays .resume, .plays .guide { animation: intro-rise 360ms var(--ease-out) both; }
  .plays .links li:nth-child(1) { animation-delay: 1400ms; }
  .plays .links li:nth-child(2) { animation-delay: 1460ms; }
  .plays .links li:nth-child(3) { animation-delay: 1520ms; }
  .plays .links li:nth-child(4) { animation-delay: 1580ms; }
  .plays .rule { animation: intro-rule 360ms var(--ease-out) 1640ms both; }
  .plays .resume { animation-delay: 1640ms; }
  .plays .guide { animation-delay: 1700ms; }
}
/* en attendant les polices et les images, tout reste à sa première image */
.plays:not(.ready) * { animation-play-state: paused; }

@keyframes intro-title {
  from { opacity: 0; transform: translateY(calc(24 * var(--tu))) scale(.96); filter: blur(6px); }
}
/* l'étiquette se dévoile de gauche à droite */
@keyframes intro-tag {
  from { clip-path: inset(0 100% 0 0); }
}
@keyframes intro-hero {
  from { opacity: 0; transform: translate(var(--from-x), var(--from-y)) scale(.97); }
}
@keyframes intro-top {
  from { opacity: 0; transform: translateY(-100%); }
}
@keyframes intro-rise {
  from { opacity: 0; transform: translateY(calc(16 * var(--mu))); }
}
/* le filet se dessine depuis son milieu */
@keyframes intro-rule {
  from { clip-path: inset(0 50%); }
}
@keyframes intro-fade {
  from { opacity: 0; }
}

/* quitter l'accueil : il s'efface en s'approchant, la table apparaît dessous ; y revenir : un fondu court */
.fade-intro-enter-active { transition: opacity 250ms var(--ease-out); }
.fade-intro-leave-active { transition: opacity 300ms var(--ease-out), transform 300ms var(--ease-out); pointer-events: none; }
.fade-intro-enter-from, .fade-intro-leave-to { opacity: 0; }
.fade-intro-leave-to { transform: scale(1.04); }

/* téléphones : les héros un peu plus grands que l'échelle de la maquette, qui les rendrait minuscules, et
   sous la barre, plus haute (ses onglets passent sous le titre) : leur cadre est la rangée de la scène ; le
   titre passe devant Captain America, le menu remonte un peu et se détache des héros du bas */
@media (max-width: 700px) {
  .intro-screen { --u: max(min(100vw / 1920, 100dvh / 1080), 100vw / 1300); }
  .heroes { grid-row: 2; grid-column: 1; }
  .title { z-index: 3; }
  .main-menu { top: 46%; }
  .link { text-shadow: 0 2px 14px rgb(19 21 39 / .85); }
}

/* mouvement réduit : pas d'entrée chorégraphiée ; tout apparaît ensemble, en fondu, sans rien déplacer */
@media (prefers-reduced-motion: reduce) {
  .plays :is(.name, .tag, .hero, .top, .links li, .rule, .resume, .guide) { animation: intro-fade 400ms ease both; }
  .sky { transition-duration: 400ms; }
  .fade-intro-leave-to { transform: none; }
}
</style>
