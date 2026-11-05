import { def, isCharacter, counterOf, discardOf, nameOf } from '../game/engine.js'
import { STATUSES } from '../game/data.js'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

/** Piles drawn from the top: a card in one of them opens the pile's menu. */
export const DRAW_PILES = ['deck', 'edeck', 'ideck']
/** Piles with a menu of their own on right click / long press: the draw piles and the discard piles. */
export const MENU_PILES = [...DRAW_PILES, 'discard', 'ediscard', 'idiscard']

const item = (label, run, key) => ({ label, run, key })
/** Toggle item, shown with a check mark when on. */
const check = (label, on, run) => ({ label, run, checked: on })

/** Remove leading, trailing and doubled separators. */
function tidy(items) {
  const out = []
  for (const it of items) {
    if (!it && (!out.length || !out[out.length - 1])) continue
    out.push(it)
  }
  while (out.length && !out[out.length - 1]) out.pop()
  return out
}

/** Context menus for cards and for the two draw piles. */
export function useCardMenu() {
  const game = useGameStore()
  const ui = useUiStore()

  function openCardMenu(c, x, y) {
    if (DRAW_PILES.includes(c.zone)) return openPileMenu(c.zone, x, y)
    ui.select(c.id)
    const id = c.id
    const items = []
    if (c.kind === 'token') {
      items.push(item('Supprimer le pion', () => game.move(id, 'discard'), 'Suppr'))
    } else {
      if (c.zone === 'table') {
        const flip = c.hero ? (c.side ? 'Passer en héros' : 'Passer en alter ego')
          : def(c).bn && c.faceUp ? `Retourner (face ${c.side ? 'A' : 'B'})`
            : c.faceUp ? 'Retourner face cachée' : 'Révéler'
        // damage on characters, threat on schemes, plain tokens on the rest
        const counter = {
          dmg: [item('Dégât +1', () => game.damage(id, 1), 'G'), item('Dégât −1', () => game.damage(id, -1), '⇧G')],
          thr: [item('Menace +1', () => game.threat(id, 1), 'M'), item('Menace −1', () => game.threat(id, -1), '⇧M')],
          tok: [item('Jeton +1', () => game.tokens(id, 1), 'J'), item('Jeton −1', () => game.tokens(id, -1), '⇧J')]
        }[counterOf(c)]
        items.push(
          item(c.tapped ? 'Redresser' : 'Épuiser', () => game.tap(id), 'T'),
          item(flip, () => game.flip(id), 'F'),
          null,
          ...counter,
          null
        )
        // several villains (Les Démolisseurs): hand the Active token to another one
        if (game.s.crew && def(c).t === 'villain' && def(c).s !== game.s.active) {
          items.push(item('Rendre actif (jeton Actif)', () => game.setActive(def(c).s)), null)
        }
        if (c.faceUp && isCharacter(c)) {
          items.push(...STATUSES.map(st => check(st.label, !!c[st.id], () => game.status(id, st.id))), null)
        }
      }
      if (c.zone === 'hand') {
        items.push(item('Jouer sur la table', () => game.playToTable(id), '↵'), item('Jouer face cachée', () => game.playToTable(id, true)), null)
      }
      if (!c.hero) {
        if (c.zone !== 'hand') items.push(item('Prendre en main', () => game.move(id, 'hand'), 'H'))
        if (c.zone !== discardOf(c)) items.push(item('Défausser', () => game.move(id, 'discard'), 'Suppr'))
        if (c.zone !== 'aside') items.push(item('Mettre de côté', () => game.move(id, 'aside'), 'X'))
        items.push(item('Sur le paquet', () => game.move(id, 'deck')), item('Sous le paquet', () => game.move(id, 'deck', { bottom: true })))
      }
    }
    const known = c.kind !== 'token' && (c.faceUp || c.zone === 'hand')
    const title = c.kind === 'token' ? 'Pion' : known ? nameOf(c) : 'Carte face cachée'
    // `card`: shown enlarged next to the options on touch screens, where the side preview is small
    ui.openMenu({ x, y, title, items: tidy(items), card: known ? id : null })
  }

  function openPileMenu(zone, x, y) {
    const menus = {
      deck: ['Paquet joueur', [
        item('Piocher 1', () => game.draw(), 'D'),
        item('Piocher 3', () => game.drawMany(3)),
        item('Mélanger', () => game.shuffle('deck')),
        item('Défausser la carte du dessus', () => game.discardTop()),
        item('Chercher dans le paquet…', () => ui.openModal('pile', { zone: 'deck' }))
      ]],
      edeck: ['Paquet Rencontre', [
        item('Révéler une carte', () => game.reveal(), 'E'),
        item('Carte face cachée (boost)', () => game.boost()),
        item('Mélanger', () => game.shuffle('edeck')),
        item('Chercher dans le paquet…', () => ui.openModal('pile', { zone: 'edeck' }))
      ]],
      // Docteur Strange: the top card is face up, the card abilities name the option
      ideck: ['Deck Invocation', [
        item('Lancer (Maîtrise des Sorts)', () => game.invoke(), 'I'),
        item('Lancer et la garder (Maître des Arts Mystiques)', () => game.invokeKeep()),
        item('Défausser sans lancer (Talent Naturel, Wong)', () => game.discardInvocation()),
        item('Mélanger', () => game.shuffle('ideck')),
        item('Chercher dans le deck…', () => ui.openModal('pile', { zone: 'ideck' }))
      ]],
      // discard piles: search them, or take the top card back
      discard: ['Défausse', [
        item('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'discard' })),
        topItem('discard', name => `Reprendre « ${name} » en main`, id => game.move(id, 'hand'))
      ]],
      ediscard: ['Défausse Rencontre', [
        item('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'ediscard' })),
        topItem('ediscard', name => `Remettre « ${name} » en jeu`, id => game.takeFromPile(id, 'ediscard'))
      ]],
      idiscard: ['Défausse Invocation', [
        item('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'idiscard' })),
        topItem('idiscard', name => `Remettre « ${name} » sur le deck Invocation`, id => game.move(id, 'deck'))
      ]]
    }
    const [title, items] = menus[zone]
    ui.openMenu({ x, y, title, items: items.filter(Boolean) })
  }

  /** Item acting on the top card of a pile, or nothing when the pile is empty. */
  function topItem(zone, label, run) {
    const top = game.pile(zone).at(-1)
    return top ? item(label(nameOf(top)), () => run(top.id)) : null
  }

  return { openCardMenu, openPileMenu }
}
