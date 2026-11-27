<script setup>
// La barre du haut (maquette) : le titre dans son bandeau rouge, l'affiche de la partie (le héros sur un
// bandeau rouge, le logo VS, le méchant en cours sur un bandeau bleu acier, le badge Expert), puis les
// onglets en biais : les pions (leur liste, PawnTray), recommencer, nouvelle partie, puis signaler un bug (sa
// fenêtre, BugReportModal), plein écran et aide
// (la taille des cartes se règle à la tirette du bas de l'écran, CardSizeSlider). Le titre ramène à
// l'accueil. Sur l'accueil (intro), la barre n'a que ses liens : à propos, buy me a coffee, rester informé,
// contact (en rouge). Quand la barre manque de place, le titre devient « MC Table » (fitTitle).
import { watch, ref, onMounted, onBeforeUnmount } from 'vue'
import SoonHint from './SoonHint.vue'
import FullscreenButton from './FullscreenButton.vue'
import vsLogoUrl from '../assets/table/vs-logo.svg'
import expertFrameUrl from '../assets/table/expert-frame.svg'
import expertDotUrl from '../assets/table/expert-dot.svg'
import expertBarUrl from '../assets/table/expert-bar.svg'
import expertHookUrl from '../assets/table/expert-hook.svg'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

defineProps({
  /** La barre de la page d'accueil (IntroScreen), et non celle de la partie. */
  intro: { type: Boolean, default: false }
})
const gameStore = useGameStore()
const ui = useUiStore()
/** L'inscription aux nouvelles demande le script serveur du site : absente de la version artefact. */
const canSignUp = import.meta.env.MODE !== 'artifact'
/** « Contact » ouvre la messagerie du visiteur, vers l'adresse des mentions légales. */
const CONTACT_HREF = 'mailto:contact@gameboxheroes.fr'

/**
 * Le titre entier, « Marvel Champions Table », quand tout tient dans la barre ; sinon « MC Table », sur un
 * bandeau plus court : les onglets dépasseraient de la barre, ou les noms de l'affiche seraient coupés. Mesuré
 * avec le titre entier, puis raccourci s'il le faut ; l'attribut data-compact, posé directement (Vue n'y touche
 * pas), change la mise en page aussitôt : les deux mesures se font d'un coup, sans image intermédiaire. Refait
 * quand la barre change de taille, quand l'affiche change (autre partie) et quand les polices arrivent.
 */
const barElement = ref(null)
function fitTitle() {
  const bar = barElement.value
  if (!bar) return
  delete bar.dataset.compact
  const inner = bar.querySelector('.bar-inner')
  const squeezed = inner.scrollWidth > inner.clientWidth + 1
    || [...bar.querySelectorAll('.plate')].some(plate => plate.scrollWidth > plate.clientWidth + 1)
  if (squeezed) bar.dataset.compact = ''
}
let resizeObserver = null
onMounted(() => {
  fitTitle()
  resizeObserver = new ResizeObserver(fitTitle)
  resizeObserver.observe(barElement.value)
  document.fonts?.ready.then(fitTitle)
  document.fonts?.addEventListener?.('loadingdone', fitTitle)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  document.fonts?.removeEventListener?.('loadingdone', fitTitle)
})
watch(() => gameStore.matchup, fitTitle, { deep: true, flush: 'post' })
</script>

<template>
  <header ref="barElement" class="bar" :class="{ intro }">
    <!-- le contenu, à la taille de la maquette (réduit d'un bloc sur tablette) -->
    <div class="bar-inner">
      <!-- le bandeau rouge de la maquette déborde sous la barre ; pendant la partie, il ramène à l'accueil. Le
           titre court est seulement vu : le titre entier reste lu par les lecteurs d'écran -->
      <div v-if="intro" class="brand">
        <span class="brand-shape" aria-hidden="true" />
        <span class="brand-title">
          <span class="brand-full">Marvel Champions Table</span>
          <span class="brand-short" aria-hidden="true">MC Table</span>
        </span>
      </div>
      <button v-else type="button" class="brand" title="Retour à l'accueil" @click="ui.openIntro()">
        <span class="brand-shape" aria-hidden="true" />
        <span class="brand-title">
          <span class="brand-full">Marvel Champions Table</span>
          <span class="brand-short" aria-hidden="true">MC Table</span>
        </span>
      </button>
      <p v-if="gameStore.matchup && !intro" class="matchup" :title="gameStore.subtitle">
        <span class="plate hero">{{ gameStore.matchup.hero }}</span>
        <img class="vs" :src="vsLogoUrl" alt="contre" width="31.0062" height="25.987" draggable="false">
        <span class="plate villain">{{ gameStore.matchup.villain }}</span>
        <!-- le badge Expert de la maquette : son cadre, son point, son mot, son trait et son crochet -->
        <span v-if="gameStore.matchup.expert" class="expert">
          <img class="expert-frame" :src="expertFrameUrl" alt="" width="88.1245" height="26" draggable="false">
          <img class="expert-dot" :src="expertDotUrl" alt="" width="6" height="6" draggable="false">
          <span class="expert-label">Expert</span>
          <img class="expert-bar" :src="expertBarUrl" alt="" width="56" height="3" draggable="false">
          <img class="expert-hook" :src="expertHookUrl" alt="" width="7.72742" height="7" draggable="false">
        </span>
      </p>
      <div class="sp" />
      <!-- l'accueil : à propos (sa fenêtre, AboutModal), buy me a coffee (pas encore prêt), rester informé
           (l'inscription aux nouvelles ; pas dans la version artefact, d'où le script serveur n'est pas
           joignable), contact (un e-mail, en rouge) ; signaler un bug, plein écran et aide sont dans la barre de
           la partie -->
      <nav v-if="intro" class="tabs" aria-label="Liens">
        <button type="button" class="slant tab wide" @click="ui.openModal('about')">À propos</button>
        <SoonHint v-slot="{ attrs }" placement="below">
          <button type="button" class="slant tab wide" v-bind="attrs">Buy me a coffee</button>
        </SoonHint>
        <button v-if="canSignUp" type="button" class="slant tab wide" @click="ui.openModal('signup')">Rester informé</button>
        <SoonHint v-else v-slot="{ attrs }" placement="below">
          <button type="button" class="slant tab wide" v-bind="attrs">Rester informé</button>
        </SoonHint>
        <a class="slant tab wide red" :href="CONTACT_HREF">Contact</a>
      </nav>
      <nav v-else class="tabs" aria-label="Partie">
        <!-- ouvre la liste des pions à glisser sur la table (PawnTray, posée sous l'onglet : data-pawn-anchor) -->
        <button type="button" class="slant tab" title="Des pions à glisser sur la table" data-pawn-anchor
          aria-controls="pawn-tray" :aria-expanded="ui.pawnTrayOpen" @click="ui.togglePawnTray()">Pions</button>
        <button type="button" class="slant tab" :disabled="!gameStore.isReady" title="Même héros, même deck, même scénario, depuis le début" @click="ui.openModal('restart')">Recommencer</button>
        <!-- la fenêtre s'ouvre sur la page d'accueil ; fermée sans lancer de partie, retour à la table (ui.openNewGame) -->
        <button type="button" class="slant tab red" @click="ui.openNewGame()">Nouvelle partie</button>
        <!-- au bout de la barre : signaler un bug (sa fenêtre, BugReportModal : le rapport part par e-mail, avec
             la partie), plein écran et aide -->
        <button type="button" class="slant tab bug" aria-label="Signaler un bug" title="Signaler un bug : le rapport part avec la partie en cours"
          @click="ui.openModal('bug')">
          <!-- un insecte, au trait du bouton plein écran : la barre étroite n'a pas la place du mot -->
          <svg class="bug-icon" viewBox="0 0 24 24" width="25" height="25" aria-hidden="true">
            <path d="M8 10h8v5a4 4 0 0 1-8 0zM10 10V8a2 2 0 0 1 4 0v2M3.5 12.5H8M16 12.5h4.5M4.5 19l3.5-2.5M19.5 19 16 16.5" />
          </svg>
          <span class="bug-label" aria-hidden="true">Signaler un bug</span>
        </button>
        <FullscreenButton class="slant tab" />
        <button type="button" class="slant tab" title="Raccourcis clavier (?)" aria-label="Raccourcis clavier" @click="ui.openModal('help')">?</button>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.bar {
  --brand-scale: 1; /* le titre et son bandeau, réduits d'un bloc sur les écrans étroits (plus bas) */
  --title-w: 387px; /* la place du titre sur le bandeau (maquette), avant réduction ; plus courte pour « MC Table » */
  height: 48px; min-width: 0;
  background: linear-gradient(90deg, rgb(19 21 39 / .6), rgb(69 76 141 / .6));
  /* une étiquette « Bientôt disponible » sous un onglet (Buy me a coffee), même invisible, élargissait la page
     sur téléphone : coupée sur les côtés, elle reste visible sous la barre */
  overflow-x: clip;
}
.bar-inner { display: flex; align-items: flex-start; height: 48px; min-width: 0; }
/* l'accueil : la même barre, opaque (maquette « accueil ») */
.bar.intro { background: linear-gradient(90deg, var(--bg-deep), #454c8d); }
/* le bandeau rouge : 436 × 68 px, à cheval sur le bord gauche (maquette) ; --brand-w : jusqu'à son coin
   haut droit. Réduit, il garde sa place à gauche (le bandeau rapetisse depuis son coin haut gauche) */
.brand { --brand-w: calc((var(--title-w) + 49.041px) * var(--brand-scale) - 27.38px); position: relative; flex: none; width: var(--brand-w); height: 68px; }
/* pendant la partie, c'est un bouton : il s'enfonce d'un rien sous le doigt, comme les onglets */
button.brand { display: block; padding: 0; border: 0; background: none; transition: transform 140ms var(--ease-out); }
button.brand:active { transform: translateY(2px); }
/* le bandeau de la maquette (« Rectangle 4 ») : biseauté aux deux bouts (26 px sur 68), un dégradé de #900 à
   #f00 sur toute sa longueur, une ombre de 5 px à droite. Dessiné ici, et non en image, pour suivre la longueur
   du titre ; son bout gauche est hors de l'écran */
.brand-shape {
  position: absolute; left: -27.38px; top: 0; width: calc(var(--title-w) + 49.041px); height: 68px; pointer-events: none;
  transform: scale(var(--brand-scale)); transform-origin: 0 0;
  filter: drop-shadow(5px 0 1px rgb(0 0 0 / .25));
}
.brand-shape::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, #990000, #f00);
  clip-path: polygon(26.157px 0, 100% 0, calc(100% - 26.157px) 100%, 0 100%);
}
.brand-title {
  position: absolute; left: 0; top: 0; width: calc(var(--title-w) * var(--brand-scale)); height: calc(68px * var(--brand-scale));
  display: grid; place-items: center;
  font: italic 700 calc(36px * var(--brand-scale))/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #fff; white-space: nowrap;
}
/* le titre court (fitTitle) : « MC Table » (114 px), 33 px de part et d'autre comme le titre entier ; le titre
   entier reste lu, sans être vu */
.brand-short { display: none; }
.bar[data-compact] { --title-w: 180px; }
.bar[data-compact] .brand-short { display: inline; }
.bar[data-compact] .brand-full {
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
/* l'affiche : elle commence sous le bout du bandeau du titre (son début est transparent) ; mesures de la maquette.
   Quand la place manque (noms longs, écran moins large), le titre passe d'abord à « MC Table » (fitTitle) ; s'il
   en manque encore, elle se resserre au lieu de passer sous les onglets : les noms finissent par « … » (le
   titre de l'affiche les donne en entier). Le badge Expert reste toujours. Seule la fin du bandeau du méchant,
   un dégradé qui s'efface, peut glisser sous les onglets (70 px : le nom reste à 15 px d'eux) ; pas avec le
   badge Expert, posé sur cette fin */
.matchup { position: relative; display: flex; align-items: center; height: 48px; margin: 0 -70px 0 -32px; min-width: 0; white-space: nowrap; }
.matchup:has(.expert) { margin-right: 0; }
/* un bandeau de 40 px en biais derrière chaque nom, en dégradé qui s'efface vers l'extérieur ; ils s'ouvrent en V
   de part et d'autre du VS */
.plate {
  min-width: 0; height: 40px; overflow: hidden; text-overflow: ellipsis;
  font: italic 700 28px/40px var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #fff;
}
.plate.hero {
  padding: 0 28px 0 50px;
  background: linear-gradient(to left, #990000, rgb(255 0 0 / 0) 92.79%);
  clip-path: polygon(0 0, calc(100% - 24.25px) 0, 100% 100%, 24.25px 100%);
}
.plate.villain {
  margin-left: 6px; padding: 0 85px 0 30px;
  background: linear-gradient(to right, #324567, rgb(101 103 198 / 0) 92.79%);
  clip-path: polygon(24.25px 0, 100% 0, calc(100% - 24.25px) 100%, 0 100%);
}
.vs { flex: none; width: 31.0062px; height: 25.987px; margin-left: -1px; }
/* le badge Expert, posé sur la fin du bandeau du méchant ; son mot fait 16 px, comme sur la maquette */
.expert { position: relative; top: 2px; flex: none; width: 95.5px; height: 26px; margin-left: -63px; }
.expert > img { position: absolute; max-width: none; }
/* le cadre penche comme le bandeau du méchant (« / ») ; son trait et son crochet soulignent son angle aigu
   en bas à gauche : ils sont retournés et posés en miroir autour du milieu du cadre (x' = 95,5 − x) */
.expert-frame { left: 3.686px; top: 0; width: 88.1245px; height: 26px; }
.expert-dot { left: 20px; top: 8px; width: 6px; height: 6px; }
.expert-bar { left: 4.5px; top: 23px; width: 56px; height: 3px; transform: scaleX(-1); }
.expert-hook { left: 3.773px; top: 17px; width: 7.72742px; height: 7px; transform: scaleX(-1); }
.expert-label {
  position: absolute; left: 13px; top: -9px; width: 79px; height: 40px; display: grid; place-items: center;
  font: italic 500 16px/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #6567c6;
}
/* les onglets : 55 px de haut (7 px de liseré sous la barre), en biais, posés bord à bord */
.tabs { display: flex; flex: none; margin-right: 20px; }
.tab { --h: 55px; --lip-h: 7px; --cut: 24.25px; padding-inline: 37px; font-size: 24px; }
.tabs > * + * { margin-left: -23px; }
/* les onglets de l'accueil prennent la largeur de leur nom, avec deux fois plus d'espace de part et d'autre que
   ceux de la partie (--wide-pad : 74 px au lieu de 37, moins quand l'écran rétrécit) ; « Signaler un bug »,
   pendant la partie, fait 194 px, comme sur la maquette. « Contact » est un lien : pas de soulignement */
.tab.wide { width: auto; padding-inline: var(--wide-pad, 74px); }
.tab.bug { width: 194px; padding-inline: 0; }
a.slant { text-decoration: none; }
/* « Pions », sa liste ouverte : le liseré jaune, comme au focus */
.tab[aria-expanded='true'] { --lip: var(--yellow); }
/* l'accueil sur un écran moins large : ses onglets se resserrent par paliers, sans jamais passer sous le titre
   (à 74 px, ils prennent 942 px ; sous 900 px, les réglages communs plus bas prennent le relais) */
@media (max-width: 1399px) { .bar.intro { --wide-pad: 56px; } }
@media (max-width: 1279px) { .bar.intro { --wide-pad: 37px; } }
@media (max-width: 1100px) { .bar.intro { --wide-pad: 22px; } }
/* « Signaler un bug » : son mot quand la barre a la place, sinon une icône (barre plus étroite, plus bas) */
.bug-icon { display: none; flex: none; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: square; transform: skewX(-10deg); }
/* écran moins large, pendant la partie : le titre passe à 79 % (à pleine taille, il laisserait trop peu de
   place à l'affiche), « Signaler un bug » passe en icône, les onglets se resserrent ; enfin, sur l'accueil
   aussi, le titre et les onglets rapetissent. L'affiche et son badge Expert restent : c'est le titre qui se
   raccourcit pour leur faire de la place (fitTitle) */
@media (min-width: 1001px) and (max-width: 1736px) {
  .bar:not(.intro) { --brand-scale: .79; }
}
@media (max-width: 1643px) {
  .tab, .tab.bug { padding-inline: 28px; }
  .tab.bug { width: auto; }
  .bug-icon { display: block; }
  .bug-label { display: none; }
}
@media (max-width: 1100px) {
  .tab, .tab.bug { padding-inline: 22px; }
}
@media (max-width: 1000px) {
  .bar { --brand-scale: .79; }
}
@media (max-width: 900px) {
  .tab, .tab.bug { --h: 50px; --lip-h: 6px; --cut: 22px; padding-inline: 18px; font-size: 20px; }
  .tab.wide { width: auto; padding-inline: 18px; }
  .tabs { margin-right: 8px; }
  .tabs > * + * { margin-left: -21px; }
}
@media (max-width: 760px) {
  .bar { --brand-scale: .63; }
}
/* tablette (écran tactile assez large) : toute la barre aux trois quarts de sa taille, titre, affiche et
   onglets compris ; la rangée de la page qui la porte fait 36 px (main.css). Par scale, et non zoom : Safari
   (iPad) n'applique pas zoom à toutes les mesures (formes en biais des onglets, titre), scale réduit tout
   d'un bloc. Le contenu est mis en page plus large (100 % / 0,75) puis réduit à la largeur de l'écran ; si
   le titre entier ne laisse pas assez de place, il devient « MC Table » (fitTitle) */
@media (pointer: coarse) and (min-width: 701px) {
  .bar { height: 36px; }
  .bar-inner { width: calc(100% / .75); scale: .75; transform-origin: 0 0; }
}
/* téléphones : les onglets passent sous le titre, sur deux rangées s'il le faut */
@media (max-width: 700px) {
  .bar { --brand-scale: .79; height: auto; }
  .bar-inner { flex-wrap: wrap; height: auto; row-gap: 4px; }
  .tabs { width: 100%; flex-wrap: wrap; justify-content: center; row-gap: 6px; margin: 0 0 6px; }
  .tab { --h: 44px; --lip-h: 5px; --cut: 19px; padding-inline: 26px; font-size: 20px; }
  .tab.wide { width: auto; padding-inline: 26px; }
  .tabs > * + * { margin-left: -17px; }
}
</style>
