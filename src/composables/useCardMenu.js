// Menus contextuels (clic droit, ou appui long sur écran tactile) des cartes et des piles.

import {
  definitionOf, isCharacter, counterKindOf, discardZoneOf, cardName, takesTokens, isAlterEgo, kangStage3Scheme
} from '../game/engine.js'
import { STATUS_CARDS } from '../game/data.js'
import { SHADOW_OF_THE_PAST_ID } from '../game/rules.js'
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

  /**
   * Ouvre le menu d'une carte à la position (x, y). La carte du dessus d'une pioche, sur le plateau, ouvre le
   * menu de la pile ; dans la fenêtre d'une pile (inPileWindow), chaque carte a son propre menu.
   */
  function openCardMenu(card, x, y, { inPileWindow = false } = {}) {
    if (DECK_PILES.includes(card.zone) && !inPileWindow) {
      openPileMenu(card.zone, x, y)
      return
    }
    ui.selectCard(card.id)
    const items = card.isPawn
      ? [menuItem('Supprimer le pion', () => gameStore.moveCard(card.id, 'discard'), 'Suppr')]
      : [...tableItems(card), ...handItems(card), ...pileItems(card), ...moveItems(card)]
    // une carte d'une pioche est face cachée, mais sa fenêtre la montre : son menu la nomme et la montre
    const isKnown = !card.isPawn && (card.faceUp || card.zone === 'hand' || inPileWindow)
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
    // dégâts sur les personnages, menace sur les manigances, jetons sur le reste ; des jetons en plus sur la
    // manigance principale (jetons Retard de L'Homme Absorbant, jetons Test de Zola) et sur un personnage qui
    // en porte (jetons Flèche de Hawkeye)
    const counterItems = {
      damage: [menuItem('Dégât +1', () => gameStore.addDamage(cardId, 1), 'G'), menuItem('Dégât −1', () => gameStore.addDamage(cardId, -1), '⇧G')],
      threat: [menuItem('Menace +1', () => gameStore.addThreat(cardId, 1), 'M'), menuItem('Menace −1', () => gameStore.addThreat(cardId, -1), '⇧M')],
      tokens: [menuItem('Jeton +1', () => gameStore.addTokens(cardId, 1), 'J'), menuItem('Jeton −1', () => gameStore.addTokens(cardId, -1), '⇧J')]
    }
    // L'Ombre du Passé révélée : son « Une fois révélée » en une ligne, en tête du menu
    const nemesisItem = card.faceUp && card.definitionId === SHADOW_OF_THE_PAST_ID
      ? menuItem('Mettre en jeu la Némésis', () => gameStore.putNemesisIntoPlay(cardId))
      : null
    const items = [
      nemesisItem,
      null,
      menuItem(card.exhausted ? 'Redresser' : 'Épuiser', () => gameStore.toggleExhausted(cardId), 'T'),
      menuItem(flipLabel, () => gameStore.flipCard(cardId), 'F'),
      otherFormItem,
      null,
      ...counterItems[counterKindOf(card)],
      ...(counterKindOf(card) !== 'tokens' && takesTokens(card) ? counterItems.tokens : []),
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

  /**
   * Lignes d'une carte d'une pile, montrée dans sa fenêtre (un clic ne fait que l'agrandir) : la mettre en
   * jeu (paquet Rencontre, deck du scénario, « De côté » : une étape du méchant y fait son « Une fois
   * révélée »), la remettre en jeu (défausse Rencontre), la poser sur la table (Invocation) ; « Prendre en
   * main » suit, la seule action d'une carte du paquet ou de la défausse du joueur.
   */
  function pileItems(card) {
    const takeLabels = {
      encounterDeck: 'Mettre en jeu', scenarioDeck: 'Mettre en jeu', setAside: 'Mettre en jeu', encounterDiscard: 'Remettre en jeu',
      invocationDeck: 'Poser sur la table', invocationDiscard: 'Poser sur la table'
    }
    const label = takeLabels[card.zone]
    return label ? [menuItem(label, () => gameStore.takeFromPile(card.id, card.zone)), null] : []
  }

  /**
   * Lignes pour ranger une carte ailleurs (pas l'identité) : main, défausse, de côté, sur ou sous sa pioche.
   * Une carte d'une pioche qu'on fouille n'a pas « Sur / Sous le paquet » : la pioche est mélangée à la
   * fermeture de sa fenêtre.
   */
  function moveItems(card) {
    if (card.isIdentity) return []
    const items = []
    if (card.zone !== 'hand') items.push(menuItem('Prendre en main', () => gameStore.moveCard(card.id, 'hand'), 'H'))
    if (card.zone !== discardZoneOf(card)) items.push(menuItem('Défausser', () => gameStore.moveCard(card.id, 'discard'), 'Suppr'))
    if (card.zone !== 'setAside') items.push(menuItem('Mettre de côté', () => gameStore.moveCard(card.id, 'setAside'), 'X'))
    if (!DECK_PILES.includes(card.zone)) {
      items.push(
        menuItem('Sur le paquet', () => gameStore.moveCard(card.id, 'deck')),
        menuItem('Sous le paquet', () => gameStore.moveCard(card.id, 'deck', { bottom: true }))
      )
    }
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
      // les défausses : y chercher, reprendre la carte du dessus, ou tout remélanger dans le paquet (confirmé
      // dans une fenêtre)
      playerDiscard: ['Défausse', [
        menuItem('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'playerDiscard' })),
        topCardItem('playerDiscard', name => `Reprendre « ${name} » en main`, cardId => gameStore.moveCard(cardId, 'hand')),
        reshuffleItem('playerDiscard', 'Remélanger dans le paquet…')
      ]],
      encounterDiscard: ['Défausse Rencontre', [
        menuItem('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'encounterDiscard' })),
        topCardItem('encounterDiscard', name => `Remettre « ${name} » en jeu`, cardId => gameStore.takeFromPile(cardId, 'encounterDiscard')),
        reshuffleItem('encounterDiscard', 'Remélanger dans le paquet Rencontre…')
      ]],
      invocationDiscard: ['Défausse Invocation', [
        menuItem('Chercher dans la défausse…', () => ui.openModal('pile', { zone: 'invocationDiscard' })),
        topCardItem('invocationDiscard', name => `Remettre « ${name} » sur le deck Invocation`, cardId => gameStore.moveCard(cardId, 'deck'))
      ]]
    }
    const [title, items] = menus[zone]
    ui.openContextMenu({ x, y, title, items: items.filter(Boolean) })
  }

  /** Ligne « Remélanger dans le paquet » d'une défausse, qui ouvre sa fenêtre de confirmation ; rien si elle est vide. */
  function reshuffleItem(zone, label) {
    return gameStore.pileOf(zone).length ? menuItem(label, () => ui.openModal('reshuffle', { zone })) : null
  }

  /** Ligne qui agit sur la carte du dessus d'une pile ; rien si la pile est vide. */
  function topCardItem(zone, labelFor, run) {
    const topCard = gameStore.pileOf(zone).at(-1)
    return topCard ? menuItem(labelFor(cardName(topCard)), () => run(topCard.id)) : null
  }

  return { openCardMenu, openPileMenu }
}
