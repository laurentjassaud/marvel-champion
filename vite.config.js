import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Le commit construit (« 1679dc1 »), que « Signaler un bug » joint au rapport (src/api/bugReport.js,
 * __APP_COMMIT__) ; « (dev) » derrière sur le serveur de développement ; vide hors d'un dépôt git.
 */
function gitCommit(command) {
  try {
    const commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return command === 'serve' ? `${commit} (dev)` : commit
  } catch {
    return ''
  }
}

// Trois constructions possibles :
//  - par défaut : application installable (PWA : service worker, images des cartes gardées hors ligne) ;
//  - `--mode artifact` : sans service worker ; scripts/inline-artifact.mjs intègre ensuite le JS et le CSS
//    dans une seule page, pour l'hébergement en artefact Claude ;
//  - `--mode staging` (npm run build:test) : la copie de test, dans dist-test/, à servir dans un autre dossier du
//    même site (/test/) : ses clés du navigateur sont préfixées (« test- », src/stores/storagePrefix.js), pour ne
//    partager ni partie, ni decks, ni réglages avec la production, et la page n'est pas référencée (noindex, pas
//    de plan du site). Elle appelle les mêmes scripts du serveur (/api/…) que la production. Elle est réservée
//    aux personnes qui ont le mot de passe (règle dans la configuration d'Apache, server/test/gamebox-test.conf ;
//    son .htaccess en seconde ligne de défense) et n'a donc pas de service worker : il servirait la page depuis
//    son cache sans que le navigateur redemande le mot de passe, et ses propres demandes (nouvelle version, images
//    pas encore gardées) seraient alors refusées.
// Les chemins sont relatifs ('./') par défaut : dist/ fonctionne où qu'il soit déposé (racine du domaine ou
// sous-dossier). BASE_PATH impose un préfixe absolu si besoin.
// L'inscription aux nouvelles (« Rester informé ») appelle /api/signup.php, le script PHP du site. En local
// (npm run dev, npm run preview), /api est relayé vers ce script lancé à part sur le port 8000 (voir README).
const SIGNUP_PROXY = { '/api': 'http://127.0.0.1:8000' }

// Référencement : l'adresse publique de l'appli (SITE_URL, avec sa barre finale), dont index.html a besoin en
// entier (adresse canonique, image de partage, données structurées) et le plan du site.
const SITE_URL = (process.env.SITE_URL || 'https://www.gameboxheroes.fr/marvel-champions-table/').replace(/\/?$/, '/')
// La description, reprise dans les résultats de recherche, og:description, les données structurées, le texte montré
// sans JavaScript (index.html) et le manifeste (espace insécable avant le point d'exclamation).
const DESCRIPTION = 'Projet perso fan-made partagé avec la communauté : Marvel Champions dans le navigateur, sur ordinateur ou tablette, et en français, of course ! :)'

/**
 * Remplit index.html (__SITE_URL__, __SITE_ORIGIN__, __DESCRIPTION__) et, à la construction du site, écrit le
 * plan du site (sitemap.xml) à côté de la page : sa seule adresse, datée du jour.
 */
function seo({ sitemap, noindex = false }) {
  const origin = new URL(SITE_URL).origin
  return {
    name: 'mc-seo',
    transformIndexHtml: html => {
      const filled = html.replaceAll('__SITE_URL__', SITE_URL).replaceAll('__SITE_ORIGIN__', origin)
        .replaceAll('__DESCRIPTION__', DESCRIPTION)
      // la copie de test : pas référencée (sa balise robots remplacée, pas doublée)
      return noindex ? filled.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">') : filled
    },
    generateBundle() {
      if (!sitemap) return
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset', fileName: 'sitemap.xml',
        source: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + `  <url><loc>${SITE_URL}</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`
      })
    }
  }
}

/**
 * La copie de test : pose à côté de la page son .htaccess (server/test/.htaccess), qui la réserve aux personnes
 * qui ont l'identifiant et le mot de passe (authentification HTTP de base d'Apache). Seconde ligne de défense : sur
 * le VPS, la règle est dans la configuration d'Apache (server/test/gamebox-test.conf).
 */
function testAccess() {
  return {
    name: 'mc-test-access',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '.htaccess', source: readFileSync(new URL('./server/test/.htaccess', import.meta.url), 'utf8') })
    }
  }
}

export default defineConfig(({ mode, command }) => {
  const artifact = mode === 'artifact'
  const staging = mode === 'staging'
  return {
    base: artifact ? './' : (process.env.BASE_PATH || './'),
    define: { __APP_COMMIT__: JSON.stringify(gitCommit(command)), __STORAGE_PREFIX__: JSON.stringify(staging ? 'test-' : '') },
    server: { proxy: SIGNUP_PROXY },
    preview: { proxy: SIGNUP_PROXY },
    build: {
      outDir: artifact ? 'dist-artifact' : staging ? 'dist-test' : 'dist',
      emptyOutDir: true,
      copyPublicDir: !artifact,
      // la page unique de l'artefact embarque ses polices (src/styles/fonts.css, ≈450 Ko de woff2), ses SVG (le
      // grand logo de l'accueil, ≈70 Ko), le fond de comics des fenêtres (webp, ≈70 Ko) et la bande des decks de
      // « Préparation de la partie » (png, 12 Ko) : elle n'a pas de dossier assets/ à côté d'elle. Une seule page
      // par principe (scripts/inline-artifact.mjs) : son script dépasse les 500 Ko de l'avertissement de Vite
      // sans qu'un découpage y serve à rien
      ...(artifact ? { assetsInlineLimit: filePath => (/\.(woff2|svg|webp|png)$/.test(filePath) ? true : undefined), chunkSizeWarningLimit: 1024 } : {})
    },
    plugins: [
      vue(),
      seo({ sitemap: !artifact && !staging, noindex: staging }),
      staging && testAccess(),
      !artifact && !staging && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'backs/*.jpg'],
        manifest: {
          name: 'Marvel Champions Table',
          short_name: 'MC Table',
          description: DESCRIPTION,
          categories: ['games', 'entertainment'],
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
          // les cartes des boîtes proposées (AVAILABLE_PACKS dans data.js) sont téléchargées dès l'installation :
          // la boîte de base (cards/base, 209 images, ≈16 Mo), le paquet Le Bouffon Vert (57 images, ≈4 Mo), les
          // paquets héros Captain America, Hulk et Thor (84 images, ≈6 Mo) et le scénario fan-made Kraven le Chasseur
          // (33 images, ≈2,5 Mo). Toute partie proposée se joue hors ligne, quels que soient le héros, le méchant et
          // le set modulaire. Une autre boîte proposée un jour : l'ajouter ici.
          // Les polices (woff2, src/styles/fonts.css) aussi : le texte garde sa police hors ligne ; et les SVG (le
          // grand logo de l'accueil)
          globPatterns: ['**/*.{js,css,html,png,webp,woff2,svg}', 'backs/*.jpg', 'cards/base/*.jpg', 'cards/bouffon vert/*.jpg',
            'cards/captain america/*.jpg', 'cards/hulk/*.jpg', 'cards/thor/*.jpg', 'cards/kraven/*.jpg'],
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
              // leurs scans français, pris sur cgbuilder quand il les a (src/data/cgbuilder.json) : gardés de même
              urlPattern: /^https:\/\/mc-src\.cgbuilder\.fr\/images\/carte\//,
              handler: 'CacheFirst',
              options: { cacheName: 'mc-cgbuilder', expiration: { maxEntries: 600 }, cacheableResponse: { statuses: [0, 200] } }
            },
            {
              // les images des cartes de fans lues sur MC4DB (src/game/mc4db.js), par le relais du site
              // (/api/mc4db.php?image=…), ou directement depuis MC4DB sans relais : gardées de même
              urlPattern: /\/api\/mc4db\.php\?image=|^https:\/\/mc4db\.merlindumesnil\.net\/bundles\/cards\//,
              handler: 'CacheFirst',
              options: { cacheName: 'mc-mc4db', expiration: { maxEntries: 600 }, cacheableResponse: { statuses: [0, 200] } }
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
