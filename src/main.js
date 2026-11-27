// Point d'entrée : crée l'application Vue, lui ajoute Pinia (les stores) et la monte dans <div id="app">.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/fonts.css'
import './styles/main.css'

createApp(App).use(createPinia()).mount('#app')

// Compte les ouvertures dans les journaux du serveur, même quand l'appli installée s'ouvre depuis le cache
// du service worker : une requête vers ping.txt (fichier vide, jamais mis en cache) à chaque ouverture, et à
// chaque retour après plus de 30 min en arrière-plan. m=appli : installée sur l'écran d'accueil ; m=web :
// dans le navigateur. Seulement dans le build installable, la production (ni en développement, ni dans
// l'artefact Claude, ni dans la copie de test, dont les ouvertures se compteraient avec celles de la production).
if (import.meta.env.MODE === 'production') {
  const ping = event => {
    const mode = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'appli' : 'web'
    fetch(`${import.meta.env.BASE_URL}ping.txt?e=${event}&m=${mode}&t=${Date.now()}`, { cache: 'no-store', keepalive: true })
      .catch(() => {}) // hors ligne : on ignore
  }
  ping('ouverture')

  let hiddenSince = 0
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenSince = Date.now()
    else if (hiddenSince && Date.now() - hiddenSince > 30 * 60 * 1000) ping('retour')
  })
}
