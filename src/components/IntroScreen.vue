<script>
/** L'entrée de 2 s ne se joue qu'une fois, au lancement de l'application ; un retour depuis la table est un simple fondu. */
let hasPlayed = false
/** De même, la vidéo du ciel ne se lit qu'une fois par lancement ; ensuite, l'accueil la montre sur sa dernière image. */
let hasPlayedSky = false
</script>

<script setup>
// La page d'accueil (maquette Figma « accueil », 1920 × 1080) : un ciel étoilé en vidéo entre la ville vue
// d'en bas et ses immeubles au premier plan, six héros autour du grand logo « Marvel Champions Table » et du
// menu, la barre du haut. Elle
// s'affiche au lancement par-dessus la table, déjà prête et mesurée (une nouvelle partie s'y pose donc
// normalement), et revient par le titre de la barre. « Scénarios » ouvre la fenêtre « Nouvelle partie »,
// « Reprendre une partie » découvre la table, « Guide de référence 1.8 » ouvre le guide des règles et
// « Apprendre le jeu » une vidéo d'explication des règles, chacun dans une nouvelle fenêtre ; les autres liens
// ne sont pas encore prêts (SoonHint). Tout en bas, discrets, « Mentions légales » et « Remerciements » (qui
// ouvrent chacun la fenêtre du même nom) et la version de l'appli.
//
// L'entrée, au lancement : le logo (« TABLE » frappe, « MARVEL CHAMPIONS » se dévoile, un reflet passe sur
// l'or), puis les héros un à un, puis la barre et le menu, en 2 s. Ce sont des animations CSS : elles restent
// fluides pendant que la table se monte derrière. Elle attend les polices et les images (1,2 s au plus), pour
// ne pas jouer sur des héros encore invisibles.
//
// Sur téléphone (700 px de large au plus, comme main.css, ou un écran tactile de 500 px de haut au plus : un
// téléphone tenu à l'horizontale ; maquette « iPhone 17 - 1 ») : le fond de comics, le logo et, dessous, le
// message « Pas encore sur mobile » : l'appli ne s'y joue pas pour l'instant ; tout en bas, les mentions
// légales, les remerciements et la version. Ni décor, ni vidéo, ni héros, ni barre, ni menu : ils ne sont pas
// créés, donc pas téléchargés. L'accueil y fait la hauteur visible de l'écran (100dvh, qui suit les barres du
// navigateur), et la page de jeu, dessous, ne défile pas tant qu'il est ouvert (main.css).
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import TopBar from './TopBar.vue'
import SoonHint from './SoonHint.vue'
import { INTRO_SKY_URL, INTRO_CITY_URL, INTRO_FOREGROUND_URL, introHeroUrl } from '../composables/useAssets.js'
// seul le numéro de version est gardé de package.json (import nommé : le reste n'entre pas dans l'appli)
import { version as packageVersion } from '../../package.json'
// le grand logo (maquette Figma, calque « Calque 4 ») : « MARVEL CHAMPIONS » et « TABLE », chacun avec son halo
import logoTopUrl from '../assets/intro/logo-top.svg'
import logoTopHaloUrl from '../assets/intro/logo-top-halo.svg'
import logoTableUrl from '../assets/intro/logo-table.svg'
import logoTableHaloUrl from '../assets/intro/logo-table-halo.svg'
/** Le masque du reflet : le dessin des lettres de « TABLE » (entre guillemets : une image intégrée, data:, en contient). */
const LETTERS_MASK = `url("${logoTableUrl}")`
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
const SOON_LINKS = ['Campagnes', 'Marathon', 'Challenge', 'Fanmades']
/** Le guide de référence des règles (version 1.8, site externe), ouvert dans une nouvelle fenêtre. */
const REFERENCE_GUIDE_URL = 'https://deejimy.github.io/mc-reference/'
/** La vidéo qui explique les règles (YouTube, à partir de 25 min 34 s), ouverte dans une nouvelle fenêtre. */
const LEARN_VIDEO_URL = 'https://www.youtube.com/watch?v=lTCTixyOQd0&t=1534s'
/** Les mentions légales sont celles de gameboxheroes.fr : pas dans l'artefact Claude, hébergé ailleurs et sans inscription. */
const hasLegalNotice = import.meta.env.MODE !== 'artifact'
/** La version de l'appli (celle de package.json), sans un « .0 » final : 0.1.0 s'affiche « 0.1 ». */
const APP_VERSION = packageVersion.replace(/\.0$/, '')

/**
 * Téléphone, en portrait (700 px de large au plus) ou à l'horizontale (écran tactile de 500 px de haut au plus) :
 * l'accueil n'y montre que le fond de comics, le logo et le message « Pas encore sur mobile » ; suit l'écran
 * (rotation, fenêtre). La même requête est dans le style plus bas et dans main.css.
 */
const PHONE_QUERY = window.matchMedia('(max-width: 700px), (pointer: coarse) and (max-height: 500px)')
const isPhone = ref(PHONE_QUERY.matches)
const onPhoneChange = event => { isPhone.value = event.matches }

const plays = !hasPlayed
hasPlayed = true
/** Polices et images prêtes : l'entrée démarre (sans entrée, rien à attendre). */
const isReady = ref(!plays)
const rootElement = ref(null)

// le ciel : la vidéo se lit une fois, au lancement, puis s'arrête sur sa dernière image ; un retour depuis la
// table, ou « réduire les animations », la montre directement sur cette image ; économie de données, ou
// téléphone à l'ouverture (pas de décor) : pas de vidéo
const reducesMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const withVideo = navigator.connection?.saveData !== true && !PHONE_QUERY.matches
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
  PHONE_QUERY.addEventListener('change', onPhoneChange)
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
onBeforeUnmount(() => PHONE_QUERY.removeEventListener('change', onPhoneChange))

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
  <section ref="rootElement" class="intro-screen" :class="{ plays, ready: isReady, leaving: ui.scene === 'out' }" aria-labelledby="intro-title">
    <!-- le décor : fond indigo, ville vue d'en bas (produit, 57 %), ciel étoilé, immeubles au premier plan ; sur
         téléphone, le fond de comics de la feuille de style à la place -->
    <div v-if="!isPhone" class="scenery" aria-hidden="true">
      <img class="city" :src="INTRO_CITY_URL" alt="" width="1672" height="941" draggable="false">
      <video v-if="withVideo" ref="videoElement" class="sky" :class="{ visible: isVideoVisible }" :src="INTRO_SKY_URL"
        muted playsinline :autoplay="playsSky" :preload="playsSky ? 'auto' : 'metadata'"
        disablepictureinpicture disableremoteplayback tabindex="-1"
        @loadedmetadata="showLastFrame" @loadeddata="onFrameReady" @seeked="onFrameReady" />
      <img class="foreground" :src="INTRO_FOREGROUND_URL" alt="" width="1672" height="941" draggable="false">
    </div>

    <div v-if="!isPhone" class="heroes" aria-hidden="true">
      <div v-for="hero in HEROES" :key="hero.id" class="hero" :class="hero.id">
        <img :class="{ mirrored: hero.mirrored }" :src="introHeroUrl(hero.id)" alt="" :width="hero.width" :height="hero.height" draggable="false">
      </div>
    </div>

    <div v-if="!isPhone" class="top">
      <TopBar intro />
    </div>

    <!-- sous la barre : le logo, sous les héros, et le menu, par-dessus -->
    <div class="stage">
      <h1 id="intro-title" class="title">
        <span class="sr">Marvel Champions Table</span>
        <!-- les calques de la maquette, chacun à sa taille d'origine : halo puis lettres ; sur « TABLE », le
             reflet de l'entrée, découpé à la forme des lettres -->
        <span class="logo-part logo-top" aria-hidden="true">
          <img class="halo" :src="logoTopHaloUrl" alt="" width="389.238" height="45.5885" draggable="false">
          <img class="letters" :src="logoTopUrl" alt="" width="381.238" height="37.5885" draggable="false">
        </span>
        <span class="logo-part logo-table" aria-hidden="true">
          <img class="halo" :src="logoTableHaloUrl" alt="" width="592.987" height="135.767" draggable="false">
          <img class="letters" :src="logoTableUrl" alt="" width="576.989" height="119.767" draggable="false">
          <span class="sheen" :style="{ '--letters-mask': LETTERS_MASK }" />
        </span>
      </h1>
      <!-- téléphone : l'appli ne s'y joue pas encore -->
      <div v-if="isPhone" class="phone-note">
        <p class="phone-note-title">Pas encore sur mobile</p>
        <p>Marvel Champions Table ne se joue pas encore sur téléphone. Pour lancer une partie, ouvrez-la sur un
          ordinateur ou une tablette.</p>
      </div>
      <nav v-if="!isPhone" class="main-menu" aria-label="Menu principal">
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
          <a class="link guide learn" :href="LEARN_VIDEO_URL" target="_blank" rel="noopener noreferrer"
            aria-label="Apprendre le jeu, vidéo YouTube (s'ouvre dans une nouvelle fenêtre)">
            Apprendre le jeu
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2 2 10" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
          </a>
        </div>
      </nav>
    </div>

    <!-- tout en bas, aussi sur téléphone : les mentions légales, les remerciements et la version de l'appli -->
    <footer class="legal">
      <template v-if="hasLegalNotice">
        <button type="button" class="legal-link" @click="ui.openModal('legal')">Mentions légales</button>
        <span class="legal-sep" aria-hidden="true">·</span>
      </template>
      <button type="button" class="legal-link" @click="ui.openModal('thanks')">Remerciements</button>
      <span class="legal-sep" aria-hidden="true">·</span>
      <span class="version">Version {{ APP_VERSION }}</span>
    </footer>
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
/* le logo : 577 × 170 px, centré, 46 px sous la barre (maquette : 94 px du haut). Ses calques débordent de
   ce cadre (les halos) ; positions et tailles de la maquette, en pixels de maquette (--tu) */
.title {
  position: absolute; z-index: 1; left: 50%; top: calc(46 * var(--tu)); translate: -50% 0;
  width: calc(576.989 * var(--tu)); height: calc(170 * var(--tu)); margin: 0; pointer-events: none;
}
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.logo-part { position: absolute; }
.logo-part img { position: absolute; display: block; max-width: none; }
/* « MARVEL CHAMPIONS » : 381 × 38 px, à 87 px du bord gauche ; son halo, 4 px tout autour */
.logo-top { left: calc(82.894 * var(--tu)); top: calc(-4 * var(--tu)); width: calc(389.238 * var(--tu)); height: calc(45.5885 * var(--tu)); }
.logo-top .halo { inset: 0; width: 100%; height: 100%; }
.logo-top .letters { left: calc(4 * var(--tu)); top: calc(4 * var(--tu)); width: calc(381.238 * var(--tu)); height: calc(37.5885 * var(--tu)); }
/* « TABLE » : 577 × 120 px, 50 px sous le haut du logo ; son halo, 8 px tout autour */
.logo-table { left: calc(-8 * var(--tu)); top: calc(42.233 * var(--tu)); width: calc(592.987 * var(--tu)); height: calc(135.767 * var(--tu)); }
.logo-table .halo { inset: 0; width: 100%; height: 100%; }
.logo-table .letters, .sheen {
  left: calc(8 * var(--tu)); top: calc(8 * var(--tu)); width: calc(576.989 * var(--tu)); height: calc(119.767 * var(--tu));
}
/* le reflet : une bande de lumière, cachée à gauche du mot au repos, que l'entrée fait traverser ; elle ne
   se voit que sur les lettres (masque : le dessin des lettres) */
.sheen {
  position: absolute; overflow: hidden;
  -webkit-mask: var(--letters-mask) 0 0 / 100% 100% no-repeat; mask: var(--letters-mask) 0 0 / 100% 100% no-repeat;
}
.sheen::before {
  content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 35%;
  background: linear-gradient(105deg, rgb(255 255 255 / 0) 15%, rgb(255 255 255 / .8) 50%, rgb(255 255 255 / 0) 85%);
  transform: translateX(-100%);
}
/* le menu, au milieu de l'écran : les cinq liens à 72 px d'écart, un filet, puis « Reprendre une partie » et,
   juste dessous, plus petits, les liens du guide de référence et de la vidéo « Apprendre le jeu ». Il descend
   d'une demi-ligne (36 px) depuis le cinquième lien (« Challenge ») : le premier reste à sa place, sous le logo */
.main-menu {
  position: absolute; z-index: 3; left: 50%; top: calc(50% - 8 * var(--u) + 36 * var(--mu)); translate: -50% -50%;
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

/* ---------- tout en bas, au milieu (entre Wolverine et Tornade) : les mentions légales et la version, petites et
   discrètes, sur une ligne ---------- */
.legal {
  position: absolute; z-index: 4; left: 50%; bottom: 0; translate: -50% 0;
  display: flex; align-items: center; white-space: nowrap;
  padding-bottom: max(6px, env(safe-area-inset-bottom, 0px));
  font: 400 14px/1 var(--font-text); color: #c3c5f5;
}
.legal-link, .legal-sep, .version { opacity: .75; text-shadow: 0 1px 6px rgb(19 21 39 / .9); }
.legal-link {
  min-height: 32px; padding: 0 12px; border: 0; background: none; cursor: pointer;
  font: inherit; color: inherit;
  text-decoration: underline; text-decoration-color: rgb(195 197 245 / .4); text-underline-offset: 3px;
  transition: opacity 150ms ease, text-decoration-color 150ms ease;
}
.version { padding: 0 12px; }
.legal-link:focus-visible { opacity: 1; outline: 2px solid var(--yellow); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .legal-link:hover { opacity: 1; text-decoration-color: currentColor; }
}
@media (pointer: coarse) {
  .legal-link { min-height: 44px; }
}
/* téléphone étroit : les liens se resserrent, et passent sur deux lignes plutôt que de sortir de l'écran */
@media (max-width: 420px) {
  .legal { flex-wrap: wrap; justify-content: center; width: max-content; max-width: calc(100vw - 16px); }
  .legal-link, .version { padding: 0 6px; }
}

/* ---------- l'entrée (2 s, au lancement) ----------
   0 ms « TABLE » frappe (un peu trop grand, il se pose), 250 ms « MARVEL CHAMPIONS » se dévoile de gauche à
   droite, 750 ms un reflet traverse l'or de « TABLE » ; de 450 ms à 1,7 s les héros, un toutes les 110 ms,
   chacun depuis son bord ; 1,35 s la barre ; de 1,4 s à 2,2 s le menu, ligne après ligne */
@media (prefers-reduced-motion: no-preference) {
  .plays .logo-table { animation: intro-slam 550ms var(--ease-out) both; }
  .plays .logo-top { animation: intro-wipe 450ms var(--ease-out) 250ms both; }
  .plays .sheen::before { animation: intro-sheen 800ms var(--ease-in-out) 750ms both; }
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
  .plays .links li:nth-child(5) { animation-delay: 1640ms; }
  .plays .rule { animation: intro-rule 360ms var(--ease-out) 1700ms both; }
  .plays .resume { animation-delay: 1700ms; }
  .plays .guide { animation-delay: 1760ms; }
  .plays .learn { animation-delay: 1820ms; }
  .plays .legal { animation: intro-fade 400ms ease 1860ms both; }
}
/* en attendant les polices et les images, tout reste à sa première image (le reflet aussi : un pseudo-élément) */
.plays:not(.ready) *, .plays:not(.ready) .sheen::before { animation-play-state: paused; }

/* « TABLE » arrive comme un coup de poing : de 115 % à sa taille, en apparaissant */
@keyframes intro-slam {
  from { opacity: 0; transform: scale(1.15); }
}
/* « MARVEL CHAMPIONS » se dévoile de gauche à droite */
@keyframes intro-wipe {
  from { clip-path: inset(0 100% 0 0); }
}
/* la bande de lumière part de la gauche du mot et sort à droite (elle fait 35 % de sa largeur) */
@keyframes intro-sheen {
  to { transform: translateX(290%); }
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

/* ---------- la sortie (« Lancer la partie », 800 ms : SCENE_TIMES dans ui.js ; main.css s'occupe de la
   fenêtre et cache la table dessous) ----------
   l'entrée à l'envers, en accéléré : 0 ms la barre remonte, le menu et le pied s'effacent ; de 80 à 780 ms les
   héros repartent vers leur bord, un toutes les 60 ms ; de 250 à 650 ms le logo s'efface en s'approchant ; le
   décor s'approche tout du long, et de 400 à 800 ms tout l'accueil s'efface : l'écran est vide */
.intro-screen.leaving { pointer-events: none; animation: leave-fade 400ms var(--ease-out) 400ms forwards; }
.leaving .top { animation: leave-top 300ms var(--ease-out) forwards; }
.leaving :is(.main-menu, .legal) { animation: leave-fade 300ms var(--ease-out) forwards; }
.leaving .scenery { animation: leave-scenery 800ms var(--ease-out) forwards; }
.leaving .title { animation: leave-title 400ms var(--ease-out) 250ms forwards; }
.leaving .hero { animation: leave-hero 400ms var(--ease-out) forwards; }
.leaving .captain-america { --to-x: calc(-120 * var(--u)); --to-y: calc(-80 * var(--u)); animation-delay: 80ms; }
.leaving .spider-man { --to-x: calc(120 * var(--u)); --to-y: calc(-80 * var(--u)); animation-delay: 140ms; }
.leaving .hulk { --to-x: calc(-120 * var(--u)); --to-y: calc(100 * var(--u)); animation-delay: 200ms; }
.leaving .miss-marvel { --to-x: calc(140 * var(--u)); --to-y: calc(80 * var(--u)); animation-delay: 260ms; }
.leaving .wolverine { --to-x: calc(-80 * var(--u)); --to-y: calc(100 * var(--u)); animation-delay: 320ms; }
.leaving .tornade { --to-x: 0px; --to-y: calc(120 * var(--u)); animation-delay: 380ms; }
@keyframes leave-fade {
  to { opacity: 0; }
}
@keyframes leave-top {
  to { opacity: 0; translate: 0 -100%; }
}
/* le décor s'approche, le logo plus vite que lui (il passe devant) */
@keyframes leave-scenery {
  to { scale: 1.04; }
}
@keyframes leave-title {
  to { opacity: 0; scale: 1.08; }
}
/* chaque héros repart par où il est arrivé (intro-hero), deux fois plus loin */
@keyframes leave-hero {
  to { opacity: 0; translate: var(--to-x) var(--to-y); scale: .97; }
}

/* quitter l'accueil par « Reprendre une partie » : il s'efface en s'approchant, la table apparaît dessous ;
   y revenir : un fondu court */
.fade-intro-enter-active { transition: opacity 250ms var(--ease-out); }
.fade-intro-leave-active { transition: opacity 300ms var(--ease-out), transform 300ms var(--ease-out); pointer-events: none; }
.fade-intro-enter-from, .fade-intro-leave-to { opacity: 0; }
.fade-intro-leave-to { transform: scale(1.04); }

/* téléphones (maquette « iPhone 17 - 1 », 402 px de large ; même requête que PHONE_QUERY) : le bleu nuit des
   mails, et en haut leur fond de comics recadré (402 × 416, il s'y fond de 271 à 416 px), à la largeur de
   l'écran ; le logo à 56 px du haut (plus bas que la maquette, qui le met à 28 px ; sous l'encoche de l'iPhone
   dans l'appli installée), à 32 px des bords (ses lettres font toute la largeur moins 64 px), moins large sur
   un téléphone à l'horizontale pour laisser la place au message. L'accueil fait la hauteur visible de l'écran
   (100dvh : elle suit les barres du navigateur qui apparaissent ou s'effacent), pas plus */
@media (max-width: 700px), (pointer: coarse) and (max-height: 500px) {
  .intro-screen {
    bottom: auto; height: 100dvh;
    grid-template-rows: minmax(0, 1fr);
    background: url('../assets/intro/fond-comics-mobile.webp') center top / 100% auto no-repeat, #02153a;
    /* le haut du logo, et l'échelle de la maquette du logo (--tu) : le logo et le message se placent d'après eux */
    --logo-top: calc(56px + env(safe-area-inset-top, 0px));
    --tu: min((100vw - 64px) / 576.989, (100dvh - 270px) / 170);
  }
  .title { top: var(--logo-top); }
  /* le message, 28 px sous le logo, dans un panneau comme les fenêtres : lisible sur le fond de comics */
  .phone-note {
    position: absolute; z-index: 1; left: 50%; translate: -50% 0; top: calc(var(--logo-top) + 170 * var(--tu) + 28px);
    width: min(100vw - 48px, 440px); padding: 16px 18px; text-align: center;
    background: rgb(24 30 72 / .86); border: 1px solid #353970; border-radius: 4px;
    box-shadow: 0 4px 0 rgb(0 0 0 / .25); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    font: 400 15px/1.5 var(--font-text); color: #c3c5f5;
  }
  .phone-note p { margin: 0; }
  .phone-note .phone-note-title {
    margin-bottom: 6px;
    font: italic 700 24px/1.1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #c2c3fd;
  }
}

/* mouvement réduit : pas d'entrée chorégraphiée ; tout apparaît ensemble, en fondu, sans rien déplacer */
@media (prefers-reduced-motion: reduce) {
  .plays :is(.logo-part, .hero, .top, .links li, .rule, .resume, .guide, .legal) { animation: intro-fade 400ms ease both; }
  .sky { transition-duration: 400ms; }
  .fade-intro-leave-to { transform: none; }
  /* la sortie de « Lancer la partie » : un fondu de tout l'accueil (300 ms, SCENE_TIMES_REDUCED) */
  .intro-screen.leaving { animation: leave-fade 300ms ease forwards; }
  .leaving :is(.top, .main-menu, .legal, .scenery, .title, .hero) { animation: none; }
}
</style>
