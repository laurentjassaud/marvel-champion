<script setup>
// Les mentions légales de l'appli et ce qu'elle fait des données personnelles : l'inscription « Rester
// informé » et les rapports de « Signaler un bug ». Le minimum légal pour un site édité par un particulier :
// l'éditeur, son contact et l'hébergeur (LCEN, article 6-III), puis, pour chacun, qui collecte quoi, pourquoi,
// combien de temps, et comment exercer ses droits (RGPD, article 13). Montré par la fenêtre « Mentions légales »
// (lien en bas de l'accueil, LegalModal), dans « Rester informé », sous le formulaire (SignupModal), et dans
// « Signaler un bug » (BugReportModal).
// À tenir à jour avec le script serveur (server/) : données enregistrées, prestataires, durée de conservation.
const CONTACT = 'contact@gameboxheroes.fr'
</script>

<template>
  <div class="legal-notice">
    <p class="updated">Mise à jour le 23 novembre 2026.</p>

    <section>
      <h3>Éditeur</h3>
      <p>Laurent Jassaud,<br>particulier,<br>directeur de la publication.<br>Contact : <a :href="`mailto:${CONTACT}`">{{ CONTACT }}</a>.</p>
    </section>

    <section>
      <h3>Hébergeur</h3>
      <p>Diatem, Espace Européen de l'Entreprise,<br>2 rue de Dublin,<br>67300 Schiltigheim,<br>France.<br>Téléphone : 03 88 22 74 20.</p>
    </section>

    <section>
      <h3>Inscription « Rester informé »</h3>
      <ul>
        <li><strong>Responsable :</strong> Laurent Jassaud ({{ CONTACT }}).</li>
        <li><strong>Données :</strong> Votre nom, votre adresse e-mail, la date et l'origine de votre inscription (cette appli), et le suivi des envois (date, réussite ou échec).</li>
        <li><strong>But :</strong> Vous envoyer un mail de confirmation, puis des newsletters d’informations (nouveaux héros, scénarios et modules). Rien d'autre&nbsp;!<br>Vos données ne sont ni vendues, ni cédées.</li>
        <li><strong>Base légale :</strong> Votre consentement, donné en cochant la case du formulaire.</li>
        <li><strong>Accès :</strong> L'éditeur seul. Les données sont enregistrées chez l'hébergeur (Diatem) et les mails partent par OVH, deux prestataires français.</li>
        <li><strong>Durée :</strong> Jusqu'à votre désinscription, ou 3 ans après notre dernier contact.<br>Le lien « Se désinscrire », présent dans chaque mail, efface aussitôt votre nom, votre adresse et l'historique des envois.</li>
        <li><strong>Anti-spam :</strong> Pour limiter les envois répétés, une empreinte de votre adresse IP (jamais l'adresse elle-même) est utilisée pendant une heure.</li>
      </ul>
    </section>

    <section>
      <h3>Signaler un bug</h3>
      <ul>
        <li><strong>Responsable :</strong> Laurent Jassaud ({{ CONTACT }}).</li>
        <li><strong>Données :</strong> Le titre et la description que vous écrivez, votre partie en cours et son journal, des informations techniques (navigateur, taille d'écran, version de l'appli) et, si vous la donnez, votre adresse e-mail.</li>
        <li><strong>But :</strong> Comprendre et corriger le problème signalé, et vous répondre si vous avez laissé votre adresse.</li>
        <li><strong>Base légale :</strong> Votre demande, quand vous envoyez le rapport.</li>
        <li><strong>Accès :</strong> L'éditeur seul. Le rapport n'est pas enregistré sur le serveur&nbsp;: il part aussitôt par e-mail (OVH) à l'éditeur, qui le garde le temps de traiter le problème.</li>
        <li><strong>Anti-spam :</strong> Comme pour l'inscription, une empreinte de votre adresse IP, pendant une heure.</li>
      </ul>
    </section>

    <section>
      <h3>Vos droits</h3>
      <p>À tout moment, vous pouvez consulter vos données, les corriger, les faire effacer, en recevoir une copie ou retirer votre consentement : écrivez à <a :href="`mailto:${CONTACT}`">{{ CONTACT }}</a>. Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).</p>
    </section>

    <section>
      <h3>Cookies</h3>
      <p>Aucun cookie, aucune mesure d'audience, aucune publicité. L'appli garde seulement dans votre navigateur votre partie en cours, vos réglages et, après une inscription, votre nom.<br>Ces données ne quittent pas votre appareil, sauf la partie jointe à un rapport de bug que vous envoyez.</p>
    </section>

    <section>
      <h3>Marvel Champions Table</h3>
      <p>Marvel Champions Table est une application de fan, non officielle et sans lien avec Fantasy Flight Games ni Marvel. Le jeu, ses cartes, ses illustrations et ses personnages appartiennent à leurs ayants droit.</p>
    </section>
  </div>
</template>

<style scoped>
/* les intertitres comme les libellés des fenêtres (« Dégâts, menace, jetons » de l'aide) */
.legal-notice { display: grid; gap: 18px; max-width: 68ch; }
.updated { font-size: 14px; }
section { display: grid; gap: 6px; }
h3 {
  margin: 0; font: italic 700 20px/1.1 var(--font-display); letter-spacing: -.01em; text-transform: uppercase; color: var(--label);
}
ul { margin: 0; padding-left: 1.2em; display: grid; gap: 4px; color: var(--muted); line-height: 1.5; }
strong { color: var(--fg); font-weight: 600; }
a { color: var(--label); overflow-wrap: anywhere; }
a:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
</style>
