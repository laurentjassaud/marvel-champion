// « Signaler un bug » : le rapport envoyé au script serveur (contenu, réponses traduites en erreurs lisibles,
// avec un faux réseau), le contexte en clair qui ne nomme pas ce qui a été tiré au hasard, et le même rapport par
// la messagerie du joueur.
import { describe, it, expect } from 'vitest'
import { PRECON_DECKS } from '../game/data.js'
import { newGame } from '../game/engine.js'
import { reportContext, reportPayload, sendBugReport, buildMailUrl, gameFileName, logLines, BugReportError, REPORT_ENTRIES } from './bugReport.js'

const LAYOUT = { width: 1400, height: 700, cardWidth: 110, villainInset: 0, heroInset: 0, villainHud: null }
const aGame = (options = {}) => newGame({
  hero: 'spider_man', deckList: PRECON_DECKS.spider_man, scenario: 'rhino', modulars: ['bomb_scare'], expert: false,
  deckLabel: 'précon Justice', ...options
}, LAYOUT)
/** Une fausse réponse du serveur : son statut et son corps JSON (null : pas du JSON). */
const answer = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === null) throw new SyntaxError('pas du JSON'); return body } })
const failure = async (promise) => { try { await promise } catch (error) { return error } return null }

describe('signaler un bug', () => {
  it('le rapport porte le texte du joueur, le contexte, les derniers messages du journal et la partie complète', () => {
    const game = aGame()
    for (let index = 0; index < 80; index++) game.log.push({ time: '10:00', text: `message ${index}`, important: index === 79 })
    const payload = reportPayload({ title: '  Carte bloquée ', description: ' Elle ne bouge plus ', email: ' moi@example.com ', context: [['Partie', 'x']], game, elapsedMs: 4200.6 })
    expect(payload).toMatchObject({ title: 'Carte bloquée', description: 'Elle ne bouge plus', email: 'moi@example.com', context: [['Partie', 'x']], website: '', elapsedMs: 4201 })
    expect(payload.journal).toHaveLength(REPORT_ENTRIES)
    expect(payload.journal.at(-1)).toBe('10:00 ★ message 79')
    expect(JSON.parse(payload.game).cards).toHaveLength(game.cards.length)
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(reportPayload({ title: 't', description: '', context: [], game: null, elapsedMs: 0 })).toMatchObject({ game: null, journal: [] })
  })

  it('le contexte dit la partie et la situation, sans nommer le set tiré au hasard', () => {
    const context = Object.fromEntries(reportContext({ game: aGame(), table: { width: 1400, height: 700, cardWidth: 110 }, screen: '1920 × 1080 px' }))
    expect(context.Partie).toBe('Spider-Man (précon Justice) contre Rhino, module Alerte à la Bombe, standard')
    expect(context.Situation).toMatch(/^round 1, phase du héros ; /)
    expect(context.Table).toBe('1400 × 700 px, cartes de 110 px')
    expect(Object.fromEntries(reportContext({ game: aGame({ randomChoices: ['modular'] }) })).Partie).not.toContain('Alerte')
    expect(Object.fromEntries(reportContext({ game: null })).Partie).toBe('aucune partie en cours')
    expect(logLines([{ time: '08:15', text: 'Rhino attaque', important: true }])).toEqual(['08:15 ★ Rhino attaque'])
  })

  it('le rapport part en POST JSON ; les refus du serveur deviennent des erreurs lisibles', async () => {
    let request = null
    await sendBugReport({ title: 'Titre' }, async (url, options) => { request = { url, options }; return answer(200, { ok: true })() })
    expect(request.url).toBe('/api/bug-report.php')
    expect(request.options).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(request.options.body)).toEqual({ title: 'Titre' })

    const invalid = await failure(sendBugReport({}, answer(422, { ok: false, message: 'Certains champs sont à corriger.', errors: { email: 'Adresse invalide' } })))
    expect(invalid).toBeInstanceOf(BugReportError)
    expect(invalid).toMatchObject({ kind: 'validation', fields: { email: 'Adresse invalide' } })
    expect(await failure(sendBugReport({}, answer(429, { ok: false, message: 'Trop de rapports.' })))).toMatchObject({ kind: 'rate-limit', message: 'Trop de rapports.' })
    expect(await failure(sendBugReport({}, answer(502, { ok: false, message: "Le rapport n'a pas pu partir." })))).toMatchObject({ kind: 'unavailable' })
    expect(await failure(sendBugReport({}, answer(503, null)))).toMatchObject({ kind: 'unavailable' })
    expect(await failure(sendBugReport({}, answer(403, { ok: false })))).toMatchObject({ kind: 'rejected' })
    expect(await failure(sendBugReport({}, answer(500, null)))).toMatchObject({ kind: 'server' })
    expect(await failure(sendBugReport({}, async () => { throw new TypeError('Failed to fetch') }))).toMatchObject({ kind: 'network' })
  })

  it('le même rapport par la messagerie, et le nom du fichier de la partie', () => {
    const url = buildMailUrl({ title: 'Carte bloquée', description: 'Elle ne se retourne pas', context: [['Partie', 'Thor contre Klaw']], fileName: 'f.json' })
    expect(url.startsWith('mailto:contact@gameboxheroes.fr?subject=%5BBug%5D%20Carte%20bloqu%C3%A9e&body=')).toBe(true)
    const body = decodeURIComponent(url.split('body=')[1])
    expect(body).toContain('- Partie : Thor contre Klaw')
    expect(body).toContain('Le fichier de la partie (f.json)')
    expect(gameFileName(new Date(2026, 10, 23, 8, 5))).toBe('bug-report_mc-table_2026-11-23_08-05.json')
  })
})
