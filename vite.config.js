import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Deux constructions possibles :
//  - par défaut : application installable (PWA : service worker, images des cartes gardées hors ligne) ;
//  - `--mode artifact` : sans service worker ; scripts/inline-artifact.mjs intègre ensuite le JS et le CSS
//    dans une seule page, pour l'hébergement en artefact Claude.
// Les chemins sont relatifs ('./') par défaut : dist/ fonctionne où qu'il soit déposé (racine du domaine ou
// sous-dossier). BASE_PATH impose un préfixe absolu si besoin.
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact'
  return {
    base: artifact ? './' : (process.env.BASE_PATH || './'),
    build: {
      outDir: artifact ? 'dist-artifact' : 'dist',
      emptyOutDir: true,
      copyPublicDir: !artifact
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
          globPatterns: ['**/*.{js,css,html,png}', 'backs/*.jpg'],
          runtimeCaching: [
            {
              // les images des cartes sont gardées dès leur premier affichage (841 images, ≈64 Mo en tout)
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
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts' }
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
