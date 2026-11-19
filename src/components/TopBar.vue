<script setup>
// La barre du haut (maquette) : le titre dans son bandeau rouge, l'affiche de la partie (le héros sur un
// bandeau rouge, le logo VS, le méchant en cours sur un bandeau bleu acier, le badge Expert), puis les
// onglets en biais : poser un pion, recommencer, nouvelle partie, puis signaler un bug, plein écran et aide
// (la taille des cartes se règle à la tirette du bas de l'écran, CardSizeSlider). Le titre ramène à
// l'accueil. Sur l'accueil (intro), la barre n'a que ses liens : rester informé, buy me a coffee, à propos.
import SoonHint from './SoonHint.vue'
import FullscreenButton from './FullscreenButton.vue'
import brandShapeUrl from '../assets/table/brand-shape.svg'
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
</script>

<template>
  <header class="bar" :class="{ intro }">
    <!-- le contenu, à la taille de la maquette (réduit d'un bloc sur tablette) -->
    <div class="bar-inner">
      <!-- le bandeau rouge de la maquette déborde sous la barre ; pendant la partie, il ramène à l'accueil -->
      <div v-if="intro" class="brand">
        <img class="brand-shape" :src="brandShapeUrl" alt="" width="335.384" height="70" draggable="false">
        <span class="brand-title">Marvel Champions</span>
      </div>
      <button v-else type="button" class="brand" title="Retour à l'accueil" @click="ui.openIntro()">
        <img class="brand-shape" :src="brandShapeUrl" alt="" width="335.384" height="70" draggable="false">
        <span class="brand-title">Marvel Champions</span>
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
      <!-- l'accueil : rester informé (l'inscription aux nouvelles ; pas dans la version artefact, d'où le script
           serveur n'est pas joignable), buy me a coffee et à propos (pas encore prêts) ; signaler un bug, plein
           écran et aide sont dans la barre de la partie -->
      <nav v-if="intro" class="tabs" aria-label="Liens">
        <button v-if="canSignUp" type="button" class="slant tab wide" @click="ui.openModal('signup')">Rester informé</button>
        <SoonHint v-else v-slot="{ attrs }" placement="below">
          <button type="button" class="slant tab wide" v-bind="attrs">Rester informé</button>
        </SoonHint>
        <SoonHint v-slot="{ attrs }" placement="below">
          <button type="button" class="slant tab wide" v-bind="attrs">Buy me a coffee</button>
        </SoonHint>
        <SoonHint v-slot="{ attrs }" placement="below">
          <button type="button" class="slant tab red wide" v-bind="attrs">À propos</button>
        </SoonHint>
      </nav>
      <nav v-else class="tabs" aria-label="Partie">
        <button type="button" class="slant tab" title="Poser un pion sur la table" @click="gameStore.addPawn()">Pions</button>
        <button type="button" class="slant tab" :disabled="!gameStore.isReady" title="Même héros, même deck, même scénario, depuis le début" @click="ui.openModal('restart')">Recommencer</button>
        <button type="button" class="slant tab red" @click="ui.openModal('setup')">Nouvelle partie</button>
        <!-- au bout de la barre : signaler un bug (pas encore prêt), plein écran et aide -->
        <SoonHint v-slot="{ attrs }" placement="below">
          <button type="button" class="slant tab bug" aria-label="Signaler un bug" v-bind="attrs">
            <!-- un insecte, au trait du bouton plein écran : la barre étroite n'a pas la place du mot -->
            <svg class="bug-icon" viewBox="0 0 24 24" width="25" height="25" aria-hidden="true">
              <path d="M8 10h8v5a4 4 0 0 1-8 0zM10 10V8a2 2 0 0 1 4 0v2M3.5 12.5H8M16 12.5h4.5M4.5 19l3.5-2.5M19.5 19 16 16.5" />
            </svg>
            <span class="bug-label" aria-hidden="true">Signaler un bug</span>
          </button>
        </SoonHint>
        <FullscreenButton class="slant tab" />
        <button type="button" class="slant tab" title="Raccourcis clavier (?)" aria-label="Raccourcis clavier" @click="ui.openModal('help')">?</button>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.bar {
  height: 48px; min-width: 0;
  background: linear-gradient(90deg, rgb(19 21 39 / .6), rgb(69 76 141 / .6));
}
.bar-inner { display: flex; align-items: flex-start; height: 48px; min-width: 0; }
/* l'accueil : la même barre, opaque (maquette « accueil ») */
.bar.intro { background: linear-gradient(90deg, var(--bg-deep), #454c8d); }
/* le bandeau rouge : 329 × 68 px, à cheval sur le bord gauche (maquette) */
.brand { --brand-w: 302px; position: relative; flex: none; width: var(--brand-w); height: 68px; }
/* pendant la partie, c'est un bouton : il s'enfonce d'un rien sous le doigt, comme les onglets */
button.brand { display: block; padding: 0; border: 0; background: none; transition: transform 140ms var(--ease-out); }
button.brand:active { transform: translateY(2px); }
.brand-shape { position: absolute; left: -27.38px; top: -1px; width: 335.384px; height: 70px; max-width: none; pointer-events: none; }
.brand-title {
  position: absolute; left: 0; top: 0; width: 272px; height: 68px; display: grid; place-items: center;
  font: italic 700 36px/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #fff; white-space: nowrap;
}
/* l'affiche : elle commence sous le bout du bandeau du titre (son début est transparent) ; mesures de la maquette */
.matchup { position: relative; display: flex; align-items: center; height: 48px; margin: 0 0 0 -32px; min-width: 0; white-space: nowrap; }
/* un bandeau de 40 px en biais derrière chaque nom, en dégradé qui s'efface vers l'extérieur ; ils s'ouvrent en V
   de part et d'autre du VS */
.plate {
  display: flex; align-items: center; height: 40px;
  font: italic 700 28px/1 var(--font-display); letter-spacing: -.02em; text-transform: uppercase; color: #fff;
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
/* les longs onglets (« À propos », « Signaler un bug ») font 194 px, comme sur la maquette */
.tab.wide, .tab.bug { width: 194px; padding-inline: 0; }
/* « Signaler un bug » : son mot quand la barre a la place, sinon une icône (barre plus étroite, plus bas) */
.bug-icon { display: none; flex: none; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: square; transform: skewX(-10deg); }
/* écran moins large : « Signaler un bug » passe en icône, le badge Expert s'efface, les onglets se resserrent,
   puis l'affiche s'efface, puis le titre et les onglets rapetissent */
@media (max-width: 1579px) {
  .expert { display: none; }
}
@media (max-width: 1539px) {
  .tab, .tab.bug { padding-inline: 28px; }
  .tab.bug { width: auto; }
  .bug-icon { display: block; }
  .bug-label { display: none; }
}
@media (max-width: 1420px) {
  .matchup { display: none; }
}
@media (max-width: 1100px) {
  .tab, .tab.bug { padding-inline: 22px; }
}
@media (max-width: 900px) {
  .brand { --brand-w: 238px; }
  .brand-shape { transform: scale(.79); transform-origin: 0 0; }
  .brand-title { width: 215px; height: 54px; font-size: 28px; }
  .tab, .tab.bug { --h: 50px; --lip-h: 6px; --cut: 22px; padding-inline: 18px; font-size: 20px; }
  .tabs { margin-right: 8px; }
  .tabs > * + * { margin-left: -21px; }
}
/* tablette (écran tactile assez large) : toute la barre aux trois quarts de sa taille, titre, affiche et
   onglets compris ; la rangée de la page qui la porte fait 36 px (main.css). Le titre, encore trop grand,
   est réduit une fois de plus aux trois quarts (le bandeau rouge avec lui). Par scale, et non zoom : Safari
   (iPad) n'applique pas zoom à toutes les mesures (formes en biais des onglets, titre), scale réduit tout
   d'un bloc. Le contenu est mis en page plus large (100 % / 0,75) puis réduit à la largeur de l'écran ; le
   titre rend la place qu'il ne prend plus (marge négative d'un quart de sa largeur) */
@media (pointer: coarse) and (min-width: 701px) {
  .bar { height: 36px; }
  .bar-inner { width: calc(100% / .75); scale: .75; transform-origin: 0 0; }
  .brand { scale: .75; transform-origin: 0 0; margin-right: calc(var(--brand-w) * -.25); }
}
/* téléphones : les onglets passent sous le titre, sur deux rangées s'il le faut */
@media (max-width: 700px) {
  .bar { height: auto; }
  .bar-inner { flex-wrap: wrap; height: auto; row-gap: 4px; }
  .tabs { width: 100%; flex-wrap: wrap; justify-content: center; row-gap: 6px; margin: 0 0 6px; }
  .tab { --h: 44px; --lip-h: 5px; --cut: 19px; padding-inline: 26px; font-size: 20px; }
  .tab.wide { width: auto; padding-inline: 26px; }
  .tabs > * + * { margin-left: -17px; }
}
</style>
