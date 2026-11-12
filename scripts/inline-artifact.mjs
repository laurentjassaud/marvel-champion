// Transforme la construction `--mode artifact` en une seule page autonome (JS et CSS intégrés dans la page),
// sans le squelette <html>/<head>/<body> que l'hébergeur d'artefacts de Claude ajoute lui-même.
// Les images des cartes ne sont pas intégrées : elles sont publiées à côté de la page (cards/<boîte>/*.jpg,
// backs/*.jpg, status/*.png et villains/*.png).
import { readFileSync, writeFileSync } from 'node:fs'

const BUILD_FOLDER = 'dist-artifact'
const readBuiltFile = fileName => readFileSync(`${BUILD_FOLDER}/${fileName}`, 'utf8')
let html = readBuiltFile('index.html')

html = html
  // la feuille de style dans une balise <style>
  .replace(/<link[^>]*rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, cssFile) => `<style>${readBuiltFile(cssFile)}</style>`)
  // le script dans une balise <script> (un « </script » dans le code fermerait la balise trop tôt)
  .replace(/<script[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g,
    (_, jsFile) => `<script type="module">${readBuiltFile(jsFile).replace(/<\/script/gi, '<\\/script')}</script>`)
  // préchargements et icônes : inutiles dans une page autonome
  .replace(/<link[^>]*rel="(modulepreload|icon|apple-touch-icon)"[^>]*>\s*/g, '')

const headContent = html.match(/<head>([\s\S]*)<\/head>/i)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace('</title>', '</title>\n    <meta name="claude:viewport-fit-sides" content="cover">')
const bodyContent = html.match(/<body>([\s\S]*)<\/body>/i)[1]

writeFileSync(`${BUILD_FOLDER}/page.html`, `${headContent.trim()}\n${bodyContent.trim()}\n`)
console.log(`${BUILD_FOLDER}/page.html écrit (${(headContent.length + bodyContent.length) / 1000 | 0} ko)`)
