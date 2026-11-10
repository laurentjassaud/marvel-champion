// Point d'entrée : crée l'application Vue, lui ajoute Pinia (les stores) et la monte dans <div id="app">.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'

createApp(App).use(createPinia()).mount('#app')
