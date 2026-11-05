<script setup>
import BaseModal from './BaseModal.vue'
import { useUiStore } from '../../stores/ui.js'

const ui = useUiStore()
const GROUPS = [
  { title: 'Dégâts, menace, jetons', rows: [['G +', 'Dégât +1'], ['⇧G −', 'Dégât −1 (soin)'], ['M', 'Menace +1'], ['⇧M', 'Menace −1 (contrecarrer)'], ['J', 'Jeton +1'], ['⇧J', 'Jeton −1']] },
  { title: 'Partie', rows: [['D', 'Piocher'], ['V', 'Phase du méchant (fin de votre phase)'], ['N', 'Phase du héros (tour suivant)'], ['E', 'Révéler une carte Rencontre'], ['I', 'Lancer l\'invocation (Docteur Strange)'], ['?', 'Afficher cette aide']] },
  { title: 'Carte', rows: [['T', 'Épuiser / redresser'], ['F', 'Retourner, changer de forme'], ['H', 'Prendre en main'], ['X', 'Mettre de côté'], ['Suppr', 'Défausser'], ['Entrée', 'Jouer depuis la main'], ['Échap', 'Fermer menu ou fenêtre']] }
]
</script>

<template>
  <BaseModal title="Raccourcis clavier">
    <p>Sur tablette : touchez une carte pour l'agrandir, glissez-la pour la déplacer, double tap pour l'épuiser ou la jouer depuis la main, appui long pour toutes ses options. Clic droit ou appui long sur un paquet ou une défausse : chercher dedans, piocher, mélanger, reprendre la carte du dessus.</p>
    <p>Les raccourcis de carte visent la carte sous la souris, sinon la carte sélectionnée.</p>
    <div class="help-cols">
      <div v-for="g in GROUPS" :key="g.title" class="keys">
        <div class="lab">{{ g.title }}</div>
        <template v-for="[keys, text] in g.rows" :key="text">
          <span><kbd v-for="k in keys.split(' ')" :key="k">{{ k }}</kbd></span>
          <span>{{ text }}</span>
        </template>
      </div>
    </div>
    <p class="note">Les dégâts ne vont que sur les personnages (identité, alliés, méchant, sbires), la menace que sur les manigances, les jetons sur toutes les autres cartes. Dégâts sur le méchant ou sur votre identité : le compteur de PV du bandeau baisse. Menace sur la manigance principale : le compteur de menace monte. Ailleurs, un jeton s'affiche sur la carte (rouge pour les dégâts, violet pour la menace, gris pour les jetons). Sans carte visée, G frappe le méchant et M agit sur la manigance principale.</p>
    <div class="row"><button type="button" class="btn primary" @click="ui.closeModal()">Fermer</button></div>
  </BaseModal>
</template>

<style scoped>
.keys kbd + kbd { margin-left: 4px; }
</style>
