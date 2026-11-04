import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Two build targets:
//  - default: installable PWA (service worker, offline cache of the card images)
//  - `--mode artifact`: relative paths, no service worker; scripts/inline-artifact.mjs
//    then inlines JS/CSS into a single page for hosting as a Claude artifact.
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact'
  return {
    base: artifact ? './' : (process.env.BASE_PATH || '/'),
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
          background_color: '#12161c',
          theme_color: '#12161c',
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
              // card images are cached the first time they are shown (≈15 Mo in total)
              urlPattern: /\/cards\/.*\.jpg$/,
              handler: 'CacheFirst',
              options: { cacheName: 'mc-cards', expiration: { maxEntries: 400 } }
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
