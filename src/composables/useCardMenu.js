// Menus contextuels (clic droit, ou appui long sur écran tactile) des cartes et des piles.

import {
  definitionOf, isCharacter, counterKindOf, discardZoneOf, cardName, mainSchemeTakesTokens, isAlterEgo, kangStage3Scheme
} from '../game/engine.js'
import { STATUS_CARDS } from '../game/data.js'
import { useGameStore } from '../stores/game.js'
import { useUiStore } from '../stores/ui.js'

/** Les pioches : une carte de l'une d'elles ouvre le menu de la pile. */
export const DECK_PILES = ['playerDeck', 'encounterDeck', 'invocationDeck', 'scenarioDeck']
/** Les piles qui ont leur propre menu au clic droit ou à l'appui long : les pioches et les défausses. */
export const PILES_WITH_MENU = [...DECK_PILES, 'playerDiscard', 'encounterDiscard', 'invocationDiscard']

/** Une ligne de menu : son libellé, l'action, et le raccourci clavier affiché à droite. */
const menuItem = (label, run, shortcut) => ({ label, run, key: shortcut })
/** Une ligne à cocher, montrée avec une coche quand elle est active. */
const checkItem = (label, isChecked, run) => ({ label, run, checked: isChecked })

/** Retire les séparateurs (null) en tête, en fin, et ceux qui se suivent. */
function withoutExtraSeparators(items) {
  const kept = []
  for (const item of items) {
    const previousIsSeparator = !kept.length || !kept[kept.length - 1]
    if (!item && previousIsSeparator) continue
    kept.push(item)
  }
  while (kept.length && !kept[kept.length - 1]) kept.pop()
  return kept
}

/** Menus contextuels des cartes et des piles. */
export function useCardMenu() {
  const gameStore = useGameStore()
  const ui = useUiStore()

  /** Ouvre le menu d'une carte à la position (x, y) ; une carte du dessus d'une pioche ouvre le menu de la pile. */
  function openCardMenu(card, x, y) {
    if (DECK_PILES.includes(card.zone)) {
      openPileMenu(card.zone, x, y)
      return
    }
    ui.selectCard(card.id)
    const items = card.isPawn
      ? [menuItem('Supprimer le pion', () => gameStore.moveCard(card.id, 'discard'), 'Suppr')]
      : [...tableItems(card), ...handItems(card), ...moveItems(card)]
    const isKnown = !card.isPawn && (card.faceUp || card.zone === 'hand')
    let title = 'Carte face cachée'
    if (card.isPawn) title = 'Pion'
    else if (isKnown) title = cardName(card)
    // cardId : la carte, montrée en grand à côté du menu sur écran tactile, où l'aperçu de côté est petit
    ui.openContextMenu({ x, y, title, items: withoutExtraSeparators(items), cardId: isKnown ? card.id : null })
  }

  /** Lignes d'une carte sur la table : épuiser, retourner, compteurs, stade de Kang, jeton Actif, cartes d'état. */
  function tableItems(card) {
    if (card.zone !== 'table') return []
    const definition = definitionOf(card)
    const cardId = card.id
    // une identité à deux faces héros (La Guêpe) : F va à la face A, l'autre face héros a sa propre ligne
    const heroForms = card.isIdentity && definition.thirdName ? definition.forms ?? ['A', 'C'] : null
    let flipLabel = card.faceUp ? 'Retourner face cachée' : 'Révéler'
    if (card.isIdentity) flipLabel = isAlterEgo(card) ? `Passer en héros${heroForms ? ` (${heroForms[0]})` : ''}` : 'Passer en alter ego'
    else if (definition.backName && card.faceUp) flipLabel = `Retourner (face ${card.side ? 'A' : 'B'})`
    let otherFormItem = null
    if (heroForms && isAlterEgo(card)) otherFormItem = menuItem(`Passer en héros (${heroForms[1]})`, () => gameStore.setIdentityForm(cardId, 2))
    else if (heroForms) {
      const [targetName, targetSide] = card.side === 2 ? [heroForms[0], 0] : [heroForms[1], 2]
      otherFormItem = menuItem(`Passer en ${targetName}`, () => gameStore.setIdentityForm(cardId, targetSide))
    }
    // dégâts sur les personnages, menace sur les manigances, jetons sur le reste (et sur la manigance
    // principale : jetons Retard de L'Homme Absorbant, jetons Test de Zola)
    const counterItems = {
      damage: [menuItem('Dégât +1', () => gameStore.addDamage(cardId, 1), 'G'), menuItem('Dégât −1', () => gameStore.addDamage(cardId, -1), '⇧G')],
      threat: [menuItem('Menace +1', () => gameStore.addThreat(cardId, 1), 'M'), menuItem('Menace −1', () => gameStore.addThreat(cardId, -1), '⇧M')],
      tokens: [menuItem('Jeton +1', () => gameStore.addTokens(cardId, 1), 'J'), menuItem('Jeton −1', () => gameStore.addTokens(cardId, -1), '⇧J')]
    }
    const items = [
      menuItem(card.exhausted ? 'Redresser' : 'Épuiser', () => gameStore.toggleExhausted(cardId), 'T'),
      menuItem(flipLabel, () => gameStore.flipCard(cardId), 'F'),
      otherFormItem,
      null,
      ...counterItems[counterKindOf(card)],
      ...(mainSchemeTakesTokens(card) ? counterItems.tokens : []),
      null
    ]
    const game = gameStore.game
    // Kang : stade 3 achevé → stade 4 à la fin de la phase, une carte Empire de Kang dessous
    if (kangStage3Scheme(game) === card && !game.pendingStageChange) {
      items.push(menuItem('Stade achevé : passer au stade 4 (Empire de Kang)', () => gameStore.completeKangStage3()), null)
    }
    // plusieurs méchants (Les Démolisseurs) : donner le jeton Actif à un autre
    if (game.crew && definition.type === 'villain' && definition.set !== game.activeVillainSet) {
      items.push(menuItem('Rendre actif (jeton Actif)', () => gameStore.setActiveVillain(definition.set)), null)
    }
    if (card.faceUp && isCharacter(card)) {
      items.push(...STATUS_CARDS.map(status => checkItem(status.label, !!card[status.id], () => gameStore.toggleStatus(cardId, status.id))), null)
    }
    return items
  }

  /** Lignes d'une carte de la main : la jouer, face visible ou cachée. */
  function handItems(card) {
    if (card.zone !== 'hand') return []
    return [
      menuItem('Jouer sur la table', () => gameStore.playToTable(card.id), '↵'),
      menuItem('Jouer face cachée', () => gameStore.playToTable(card.id, true)),
      null
    ]
  }

  /** Lignes pour ranger une carte ailleurs (pas l'identité) : main, défausse, de côté, sur ou sous sa pioche. */
  function moveItems(card) {
    if (card.isIdentity) return []
    const items = []
    if (card.zone !== 'hand') items.push(menuItem('Prendre en main', () => gameStore.moveCard(card.id, 'hand'), 'H'))
    if (card.zone !== discardZoneOf(card)) items.push(menuItem('Défausser', () => gameStore.moveCard(card.id, 'discard'), 'Suppr'))
    if (card.zone !== 'setAside') items.push(menuItem('Mettre de côté', () => gameStore.moveCard(card.id, 'setAside'), 'X'))
    items.push(
      menuItem('Sur le paquet', () => gameStore.moveCard(card.id, 'deck')),
      menuItem('Sous le paquet', () => gameStore.moveCard(card.id, 'deck', { bottom: true }))
    )
    return items
  }

  /** Ouvre le menu d'une pile (pioche ou défausse) à la position (x, y). */
  function openPileMenu(zone, x, y) {
    const menus = {
      playerDeck: ['Paquet joueur', [
        menuItem('Piocher 1', () => gameStore.drawCard(), 'D'),
        menuItem('Piocher 3', () => gameStore.drawCards(3)),
        menuItem('Mélanger', () => gameStore.shuffle('playerDeck')),
        menuItem('Défausser la carte du dessus', () => gameStore.discardTopOfDeck()),
        menuItem('Chercher dans le paquet…', () => ui.openModal('pile', { zone: 'playerDeck' }))
      ]],
      encounterDeck: ['Paquet Rencontre', [
        menuItem('Révéler une carte', () => gameStore.revealEncounterCard(), 'E'),
        menuItem('Carte face cachée (boost)', () => gameStore.dealBoostCard()),
        menuItem('Carte face cachée pour vous', () => gameStore.dealEncounterCardToPlayer()),
        menuItem('Mélanger', () => gameStore.shuffle('encounterDeck')),
        menuItem('Chercher dans le paquet…', () => ui.openModal('pile', { zone: 'encounterDeck' }))
      ]],
      // Docteur Strange : la carte du dessus est face visible ; les capacités des cartes nomment le choix
      invocationDeck: ['Deck Invocation', [
        menuItem('Lancer (Maîtrise des Sorts)', () => gameStore.castInvocation(), 'I'),
        menuItem('Lancer et la garder (Maître des Arts Mystiques)', () => gameStore.castInvocationAndKeep()),
        menuItem('Défausser sans lancer (Talent Naturel, Wong)', () => gameStore.discardInvocation()),
        menuItem('Mélanger', () => gameStore.shuffle('invocationDeck')),
        menuItem('Chercher dans le deck…', () => ui.openModal('pile', { zone: 'invocationDeck' }))
      ]],
      // le deck propre au scénario : Armes Expérimentales (Crossbones), Manigance Annexe (Crâne Rouge)
      scenarioDeck: [`Deck ${gameStore.scenarioDeck?.name ?? ''}`, [
        menuItem('Révéler la carte du dessus', () => gameStore.revealScenarioDeckCard()),
        menuItem('Mélanger', () => gameStore.shuffle('scenarioDeck')),
        menuItem('Chercher dans le deck…', () => ui.openModal('pile', { zone: 'scenarioDeck' }))
      ]],
      // les défausses : y chercher, ou reprendre la carte du dessus
      playerDiscard: ['Défausse', [
        menuItem('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'playerDiscard' })),
        topCardItem('playerDiscard', name => `Reprendre « ${name} » en main`, cardId => gameStore.moveCard(cardId, 'hand'))
      ]],
      encounterDiscard: ['Défausse Rencontre', [
        menuItem('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'encounterDiscard' })),
        topCardItem('encounterDiscard', name => `Remettre « ${name} » en jeu`, cardId => gameStore.takeFromPile(cardId, 'encounterDiscard'))
      ]],
      invocationDiscard: ['Défausse Invocation', [
        menuItem('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'invocationDiscard' })),
        topCardItem('invocationDiscard', name => `Remettre « ${name} » sur le deck Invocation`, cardId => gameStore.moveCard(cardId, 'deck'))
      ]]
    }
    const [title, items] = menus[zone]
    ui.openContextMenu({ x, y, title, items: items.filter(Boolean) })
  }

  /** Ligne qui agit sur la carte du dessus d'une pile ; rien si la pile est vide. */
  function topCardItem(zone, labelFor, run) {
    const topCard = gameStore.pileOf(zone).at(-1)
    return topCard ? menuItem(labelFor(cardName(topCard)), () => run(topCard.id)) : null
  }

  return { openCardMenu, openPileMenu }
}
