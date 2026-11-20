<script setup>
// La fenêtre « À propos », ouverte par l'onglet du même nom sur l'accueil (TopBar) : le mot de l'auteur sur
// l'origine du projet, sa signature, puis, en petit, le rappel que l'appli est un projet de fan non officiel
// (comme à la fin des mentions légales, LegalNotice). « Contact », dans le texte, ouvre la messagerie, comme
// l'onglet Contact de l'accueil.
import BaseModal from './BaseModal.vue'
import { useUiStore } from '../../stores/ui.js'

const ui = useUiStore()
const CONTACT_HREF = 'mailto:contact@gameboxheroes.fr'
</script>

<template>
  <BaseModal title="À propos">
    <div class="about">
      <p>Graphiste et développeur front-end, j'avais envie de pouvoir jouer à Marvel Champions un peu partout, et surtout dans le train. Tout le monde sait qu'il est difficile de sortir ses cartes aux heures de pointe&nbsp;: les wagons de TER sont vraiment très mal faits. J'ai donc eu l'idée d'une petite application web, accessible directement depuis un navigateur, avec les cartes en français et conçue avant tout pour mon iPad.</p>
      <p>Quelques prototypes d'interface plus tard, et avec l'aide de Claude Code pour le gros du développement et la gestion du serveur, voici la première version du projet. Je suis vraiment heureux de pouvoir vous la présenter, et j'attends vos retours avec impatience&nbsp;: n'hésitez pas à m'en faire un maximum, via le bouton <a :href="CONTACT_HREF">Contact</a> du site ou sur les réseaux sociaux.</p>
      <p>Beaucoup de contenu est déjà prêt à être ajouté&nbsp;: des héros, des méchants et la première campagne. J'ai aussi plusieurs idées originales que je garde encore secrètes, mais qui devraient plaire à de nombreux joueurs. Pour l'heure, place aux tests de cette première version&nbsp;!</p>
      <p>J'espère que vous aurez autant de plaisir à utiliser cette application que j'en ai eu à la faire. Quant à mes voisins de train, ils me remercient de ne plus occuper tout le carré de quatre…</p>
      <p class="signature">Bon jeu à tous,<br>Laurent</p>
      <p class="note">Marvel Champions Table est un projet de fan, gratuit et non officiel, sans lien avec Fantasy Flight Games ni Marvel.</p>
    </div>
    <template #actions>
      <button type="button" class="modal-btn primary" @click="ui.closeModal()">Fermer</button>
    </template>
  </BaseModal>
</template>

<style scoped>
/* le texte des fenêtres (.modal p, main.css) ; la signature en blanc, la note en petit, à part */
.about { display: grid; gap: 14px; }
.signature { color: var(--fg); font-weight: 600; }
.note { margin-top: 6px; font-size: 14px; }
a { color: var(--label); }
a:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
</style>
