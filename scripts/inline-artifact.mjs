// Turns the `--mode artifact` build into a single self-contained page (JS and CSS inlined),
// without the <html>/<head>/<body> skeleton that the Claude artifact host adds itself.
// Card images are not inlined: they are published next to the page as cards/<box>/*.jpg, backs/*.jpg and status/*.png.
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'dist-artifact'
const read = f => readFileSync(`${dir}/${f}`, 'utf8')
let html = read('index.html')

html = html
  .replace(/<link[^>]*rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, f) => `<style>${read(f)}</style>`)
  .replace(/<script[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, f) => `<script type="module">${read(f).replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace(/<link[^>]*rel="(modulepreload|icon|apple-touch-icon)"[^>]*>\s*/g, '')

const head = html.match(/<head>([\s\S]*)<\/head>/i)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace('</title>', '</title>\n    <meta name="claude:viewport-fit-sides" content="cover">')
const body = html.match(/<body>([\s\S]*)<\/body>/i)[1]

writeFileSync(`${dir}/page.html`, `${head.trim()}\n${body.trim()}\n`)
console.log(`${dir}/page.html written (${(head.length + body.length) / 1000 | 0} kB)`)
