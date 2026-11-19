import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Deux constructions possibles :
//  - par défaut : application installable (PWA : service worker, images des cartes gardées hors ligne) ;
//  - `--mode artifact` : sans service worker ; scripts/inline-artifact.mjs intègre ensuite le JS et le CSS
//    dans une seule page, pour l'hébergement en artefact Claude.
// Les chemins sont relatifs ('./') par défaut : dist/ fonctionne où qu'il soit déposé (racine du domaine ou
// sous-dossier). BASE_PATH impose un préfixe absolu si besoin.
// L'inscription aux nouvelles (« Rester informé ») appelle /api/signup.php, le script PHP du site. En local
// (npm run dev, npm run preview), /api est relayé vers ce script lancé à part sur le port 8000 (voir README).
const SIGNUP_PROXY = { '/api': 'http://127.0.0.1:8000' }

export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact'
  return {
    base: artifact ? './' : (process.env.BASE_PATH || './'),
    server: { proxy: SIGNUP_PROXY },
    preview: { proxy: SIGNUP_PROXY },
    build: {
      outDir: artifact ? 'dist-artifact' : 'dist',
      emptyOutDir: true,
      copyPublicDir: !artifact,
      // la page unique de l'artefact embarque ses polices (src/styles/fonts.css, ≈450 Ko de woff2) : elle n'a
      // pas de dossier assets/ à côté d'elle
      ...(artifact ? { assetsInlineLimit: filePath => (filePath.endsWith('.woff2') ? true : undefined) } : {})
    },
    plugins: [
      vue(),
      !artifact && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'backs/*.jpg'],
        manifest: {
          name: 'Table Marvel Champions',
          short_name: 'MC Table',
          description: 'Table solo Marvel Champions : mise en place automatique, decks préconstruits, import OCTGN.',
          lang: 'fr',
          display: 'standalone',
          orientation: 'landscape',
          background_color: '#2b2c55',
          theme_color: '#2b2c55',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          // les cartes de la boîte de base (cards/base, 209 images, ≈16 Mo) sont téléchargées dès l'installation :
          // toute partie proposée (AVAILABLE_PACKS dans data.js, la boîte de base) se joue hors ligne, quels que
          // soient le héros, le méchant et le set modulaire. Une autre boîte proposée un jour : l'ajouter ici.
          // Les polices (woff2, src/styles/fonts.css) aussi : le texte garde sa police hors ligne
          globPatterns: ['**/*.{js,css,html,png,webp,woff2}', 'backs/*.jpg', 'cards/base/*.jpg'],
          // les pages du script d'inscription (api/unsubscribe.php, ouverte depuis le lien d'un e-mail) ne sont pas
          // l'appli : le service worker ne les remplace pas par index.html
          navigateFallbackDenylist: [/\/api\//],
          runtimeCaching: [
            {
              // les images des autres boîtes (decks importés) sont gardées dès leur premier affichage
              urlPattern: /\/cards\/.*\.jpg$/,
              handler: 'CacheFirst',
              options: { cacheName: 'mc-cards', expiration: { maxEntries: 1000 } }
            },
            {
              // les images des cartes lues sur MarvelCDB (decks importés par lien) : gardées pour jouer hors ligne
              urlPattern: /^https:\/\/(fr\.)?marvelcdb\.com\/bundles\/cards\//,
              handler: 'CacheFirst',
              options: { cacheName: 'mc-marvelcdb', expiration: { maxEntries: 600 }, cacheableResponse: { statuses: [0, 200] } }
            },
            {
              // la vidéo du ciel de l'accueil (11 Mo) : la balise <video> ne la demande que par morceaux (réponses
              // 206, que le cache ne garde pas) ; usePreload la télécharge donc une fois en entier, et le service
              // worker en sert ensuite les morceaux depuis son cache (rangeRequests : Safari l'exige)
              urlPattern: /\/intro\/.*\.mp4$/,
              handler: 'CacheFirst',
              options: { cacheName: 'mc-intro', rangeRequests: true, cacheableResponse: { statuses: [200] } }
            }
          ]
        }
      })
    ].filter(Boolean),
    test: {
      environment: 'node',
      include: ['src/**/*.test.js']
    }
  }
})
