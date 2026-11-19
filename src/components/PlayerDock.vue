<script setup>
// Le bandeau du joueur, en bas de l'écran (maquette) : à gauche ses piles ; au milieu sa main en éventail ;
// à droite le tour, les deux phases et ses PV en grand, et dessous ce qu'on fait de sa main (carte au hasard,
// mulligan, piocher) en onglets posés sur la bande rouge du bas de l'écran. Tout au bout, en bas à droite de
// l'écran, la tirette « Taille » des cartes de la table.
import { computed, nextTick } from 'vue'
import CardPile from './CardPile.vue'
import CardSizeSlider from './CardSizeSlider.vue'
import HandStrip from './HandStrip.vue'
import HudCounter from './HudCounter.vue'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

const gameStore = useGameStore()
const ui = useUiStore()
const handCount = computed(() => gameStore.cardsIn('hand').length)
// Les Démolisseurs : plusieurs méchants. Le début du libellé (« Phase du ») disparaît sur les écrans moins larges.
const villainPhaseStart = computed(() => (gameStore.game?.crew ? 'Phase des ' : 'Phase du '))
const villainPhaseNoun = computed(() => (gameStore.game?.crew ? 'méchants' : 'méchant'))

/** Tire une carte de la main au hasard et, sur téléphone (la main y défile), la fait venir à l'écran. */
async function pickRandomCard() {
  gameStore.pickRandomHandCard()
  await nextTick()
  document.querySelector(`.hand-row .card[data-id="${ui.randomlyPickedCardId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
</script>

<template>
  <footer class="dock" :class="{ inv: gameStore.hasInvocationDeck }">
    <div class="dock-left">
      <div class="piles">
        <CardPile zone="playerDeck" label="Paquet" variant="p" title="Clic : piocher" />
        <CardPile zone="playerDiscard" label="Défausse" variant="p" title="Clic : voir" />
        <template v-if="gameStore.hasInvocationDeck">
          <CardPile zone="invocationDeck" label="Invocation" variant="i"
            title="Clic : lancer l'invocation du dessus · appui long ou clic droit : autres choix" />
          <CardPile zone="invocationDiscard" label="Défausse I." variant="i" title="Clic : voir" />
        </template>
      </div>
    </div>

    <HandStrip />

    <div class="dock-right">
      <div class="turn-row">
        <div class="turn" aria-live="polite"><span>Tour</span><output>{{ gameStore.turn }}</output></div>
        <!-- le round va phase du héros → phase du méchant → phase du héros du round suivant ; l'onglet allumé est la phase en cours -->
        <div class="phases" role="group" aria-label="Phase du tour">
          <button type="button" class="slant" :class="gameStore.phase === 'hero' ? 'blue' : 'dim'"
            :aria-pressed="gameStore.phase === 'hero'"
            :title="gameStore.phase === 'hero' ? 'Phase en cours : jouez votre tour' : 'Tour suivant'"
            @click="gameStore.startHeroPhase()">
            <span><span class="long">Phase du </span>héros</span><kbd>N</kbd>
          </button>
          <button type="button" class="slant" :class="gameStore.phase === 'villain' ? 'red' : 'dim'"
            :aria-pressed="gameStore.phase === 'villain'"
            :title="gameStore.phase === 'villain' ? 'Phase en cours' : 'Complète votre main et redresse vos cartes ; la phase du méchant se joue ensuite à la main'"
            @click="gameStore.startVillainPhase()">
            <span><span class="long">{{ villainPhaseStart }}</span>{{ villainPhaseNoun }}</span><kbd>V</kbd>
          </button>
        </div>
      </div>
      <HudCounter class="hero-hp" :index="0" tone="hero" size="l" unit="PV" :renamable="false" />
      <!-- les onglets de la main, posés sur la bande rouge, dans l'ordre de la maquette -->
      <div class="actions" role="group" aria-label="Actions sur la main">
        <button type="button" class="slant foot random" :disabled="!handCount"
          title="Marque en rouge une carte de la main tirée au hasard" @click="pickRandomCard">Au hasard</button>
        <button type="button" class="slant foot mulligan" :disabled="!gameStore.canMulligan"
          :title="gameStore.canMulligan ? 'Défausser des cartes de la main de départ et repiocher' : 'Seulement au tour 1, une fois par partie, avant de mettre une carte en jeu ou d\'en défausser une'"
          @click="ui.openModal('mulligan')">
          Mulligan
        </button>
        <button type="button" class="slant foot draw" @click="gameStore.drawCard()">Piocher<kbd>D</kbd></button>
      </div>
    </div>

    <CardSizeSlider class="card-size" />
  </footer>
</template>

<style scoped>
/* trois colonnes : les côtés à leur largeur, la main au milieu ; elle se resserre quand la place manque.
   Le bandeau va jusqu'au bas de l'écran : la bande rouge et les onglets de la main y sont posés */
.dock {
  position: relative;
  z-index: 2;
  display: grid;
  align-items: end;
  grid-template-columns: minmax(max-content, 1fr) minmax(calc(var(--hw) * 2.2), calc(var(--hw) * 5)) minmax(max-content, 1fr);
  column-gap: max(16px, calc(24 * var(--u)));
  padding: 0 max(12px, calc(20 * var(--u)));
}

/* la bande rouge au ras de l'écran (maquette : 9 px visibles), sous les onglets, par-dessus l'arc de la main */
.dock::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 9px;
  background: #a21212;
}

/* les piles, à l'écart de la main, au ras de la bande rouge (maquette) */
.dock-left {
  justify-self: end;
  margin: 0 calc(190 * var(--u)) max(12px, calc(10 * var(--u))) 0;
}

.piles {
  display: flex;
  align-items: flex-end;
  gap: max(10px, calc(10 * var(--u)));
}

/* le tour et les PV du héros, bien à l'écart de l'éventail : sa dernière carte, inclinée, déborde de sa colonne */
.dock-right {
  --hud-gap: max(28px, calc(60 * var(--u)));
  justify-self: start;
  display: grid;
  justify-items: start;
  gap: max(8px, calc(14 * var(--u)));
  margin-left: var(--hud-gap);
}

/* les onglets de la main : ils dépassent à gauche sous la fin de l'éventail, comme sur la maquette (l'écart
   ajouté au bloc du héros est repris, ils restent à leur place) */
.actions {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  margin-left: calc(-80 * var(--u) - var(--hud-gap));
}

/* onglets du bas : le liseré passe en haut (le bord libre), le texte suit la maquette (14 et 16 px) */
.foot {
  --lip-h: 4px;
  --h: 34px;
  justify-content: center;
  padding: 0 0 var(--lip-h);
  font-size: 14px;
  background: linear-gradient(var(--lip), var(--lip)) top / 100% var(--lip-h) no-repeat, var(--fill-paint, var(--fill));
}

.foot.random {
  --fill: #990000;
  --lip: #860909;
  width: 120px;
}

.foot.mulligan {
  --fill: #a21212;
  --lip: #990000;
  width: 99px;
  margin-left: -14px;
}

/* Piocher, le plus haut : le dégradé rouge « actif » ; la touche D écrite comme le reste du mot */
.foot.draw {
  --h: 55px;
  --lip-h: 7px;
  --fill-paint: linear-gradient(90deg, #990000, #ff0000);
  --lip: #a21212;
  width: 112.75px;
  margin-left: -13.75px;
  padding: 0;
  gap: .22em;
  font-size: 16px;
}

.foot.draw kbd {
  font: inherit;
  opacity: 1;
}

/* indisponible : seul le texte s'efface (20 % de blanc), la forme reste */
.foot:disabled {
  opacity: 1;
  color: rgb(255 255 255 / .2);
}

.turn-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.turn {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.turn span {
  font: italic 700 20px/1 var(--font-display);
  letter-spacing: -.01em;
  text-transform: uppercase;
  color: var(--muted);
}

.turn output {
  font: italic 900 32px/1 var(--font-display);
  font-variant-numeric: tabular-nums;
}

/* les deux phases, en onglets bord à bord ; celle en cours est allumée (bleu héros, rouge méchant) */
.phases {
  display: flex;
}

.phases .slant+.slant {
  margin-left: -16px;
}

.phases .slant[aria-pressed="true"] {
  cursor: default;
}

.phases .slant[aria-pressed="true"]:active {
  transform: none;
}

/* écrans moins larges : « Héros » et « Méchant » suffisent */
@media (max-width: 1500px) {
  .long {
    display: none;
  }
}

@media (max-width: 1100px) {
  .dock {
    column-gap: 14px;
  }
}

/* la tirette « Taille » : en bas à droite de l'écran, au-dessus de la bande rouge, alignée sur le bord droit
   de la colonne de droite. Sous 1340 px, les onglets de la main iraient dessous : elle monte juste au-dessus
   du bandeau, au pied de la colonne de droite (qui lui garde la place, main.css). Sur téléphone, elle se
   range, centrée, sous la main */
.card-size {
  position: absolute;
  right: max(12px, calc(20 * var(--u)));
  bottom: calc(9px + max(8px, calc(14 * var(--u))));
}

@media (min-width: 701px) and (max-width: 1339px) {
  .card-size {
    bottom: calc(100% + 12px);
  }
}

@media (max-width: 700px) {
  .card-size {
    position: static;
    order: -1;
    justify-self: center;
  }
}

/* tablette en portrait : la main prend toute la largeur ; dessous, les piles à gauche, le héros à droite */
@media (min-width: 701px) and (max-width: 900px) {
  .dock { grid-template-columns: auto 1fr; grid-template-areas: "hand hand" "left right"; row-gap: 4px; }
  .hand { grid-area: hand; }
  .dock-left { grid-area: left; justify-self: start; margin-right: 0; }
  .dock-right { grid-area: right; justify-self: end; }
}

/* tablette : le nom du héros remonte de 5 px au-dessus de ses PV */
@media (pointer: coarse) and (min-width: 701px) {
  .hero-hp :deep(.name) {
    translate: 0 -5px;
  }
}

/* tactile : les petits onglets un peu plus hauts, pour le doigt */
@media (pointer: coarse) {
  .foot {
    --h: 40px;
  }

  .foot.draw {
    --h: 55px;
  }
}

/* téléphones : une rangée par partie, la main d'abord */
@media (max-width: 700px) {
  .dock {
    grid-template-columns: 1fr;
    row-gap: 12px;
    padding-top: 8px;
  }

  .hand {
    order: -1;
  }

  .dock-left {
    justify-self: stretch;
  }

  .dock-right {
    justify-self: stretch;
    margin-left: 0;
  }

  .actions {
    margin-left: 0;
  }
}
</style>
