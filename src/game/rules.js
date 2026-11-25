// Règles spéciales de chaque héros et de chaque scénario, réunies au même endroit : tout ce que leurs
// cartes demandent en plus des règles de base.
//
// Chaque entrée donne deux listes de phrases, en français tel qu'affiché au joueur :
//   automated  ce que la table fait d'elle-même (le moteur lit pour cela les autres champs de l'entrée) ;
//   byHand     ce qui se joue à la main (le journal le rappelle quand une note donne le bon moment).
// Les capacités ordinaires des cartes (Action, Réponse, Interruption…) se jouent à la main et ne sont pas
// reprises ici, pas plus que les règles de base que suit toute partie (moteur, src/game/engine/).
//
// Les identifiants de cartes sont ceux de data.js : "<boîte>-<numéro>" pour les boîtes écrites à la main,
// le GUID OCTGN pour la boîte de base (son nom en commentaire à côté). Un test (engine.test.js) vérifie que
// chaque identifiant cité ici existe et a le bon type.

/* ---------------------------------------------------------------------------------------------------- */
/* Héros                                                                                                 */
/* ---------------------------------------------------------------------------------------------------- */
// Une entrée par héros de HEROES (data.js). Champs lus par le moteur :
//   setupCard              carte que la « Mise en place » de l'identité ajoute à la main, ou met en jeu, après le
//                          mulligan ; le paquet est mélangé ensuite (engine/setup.js, identitySetupOf). La carte
//                          cherchée :
//                            {id}           cette carte (le Bouclier de Captain America : 'cap-09')
//                            {code}         cette carte, par son code MarvelCDB : un héros lu sur MarvelCDB
//                                           (le Pistolet Élémentaire de Star-Lord : '17007')
//                            {type, trait?, label}  une carte de ce type (qui a ce trait), au choix du joueur
//                                           s'il en a plusieurs différentes (fenêtre du mulligan) ; label la
//                                           nomme dans cette fenêtre (T'Challa : une amélioration Black Panther)
//                          fromDiscard : elle est cherchée dans le paquet et la défausse (sinon le paquet seul)
//                          zones, fromText : elle est cherchée dans ces zones, que fromText nomme dans la fenêtre
//                          (Tornade : sa pile heroSetAside, « du deck Climat ») ; le paquet n'est mélangé que s'il
//                          a été fouillé
//                          intoPlay : elle entre en jeu au lieu de rejoindre la main ; une manigance annexe avec
//                          sa menace de départ, dans la zone Rencontre (Cable : une manigance annexe de joueur),
//                          une autre carte à côté de l'identité (Tornade : un soutien Climat)
//   discardsHandAtTurnEnd  sous forme de héros, la main est défaussée à la fin du tour (Hulk, « Enragé »)
//   handSizeBonus          sous forme de héros, la taille de main augmente de 1 par amélioration contrôlée
//                          qui a un trait donné : {trait, label: [singulier, pluriel] pour le journal, max}
//                          (Iron Man : Tech, 7 au plus)
//   startsInPlay           cartes du deck qui commencent en jeu : tous leurs exemplaires, posés sur la table,
//                          face A, avant la main de départ ; par leur code MarvelCDB, pour servir aussi aux héros
//                          lus sur MarvelCDB, dont les cartes s'appellent "cdb-<code>". Une entrée est un code
//                          (Intangible de Vision : '26002'), ou {code | codes, faceDown?, previewFace?, tokens?,
//                          tokenName?} : face cachée (les formes d'énergie de Spectrum), face cachée mais montrée
//                          au joueur par l'aperçu, au survol ou au toucher (Spectrum choisit laquelle retourner),
//                          jetons posés dessus (les 4 jetons Pouvoir de la Force Phénix). Ces cartes s'allument
//                          un instant une fois distribuées.
//   heroPiles              les piles de l'identité, hors jeu, dans le bandeau du joueur entre le paquet et la
//                          défausse (deux au plus : zones heroSetAside et heroSetAside2, engine/state.js
//                          HERO_PILE_ZONES) : cartes qu'elle met de côté, ou decks à part. Chaque pile :
//                            cards          ses cartes, par leur code MarvelCDB : un code (tous les exemplaires
//                                           du deck : Aura de la Mort de Valkyrie, '25002'), ou {code, copies}
//                                           quand le deck ne les contient pas : la mise en place crée les
//                                           exemplaires (les 6 Pris Dans la Glace d'Iceberg, le deck Climat de
//                                           Tornade), que l'import de MarvelCDB lit dans la boîte du héros
//                            label          son nom (« De côté » par défaut ; « Climat », « Travaux », « Sens »)
//                            faceDown       ses cartes sont face cachée (les decks d'Hercule)
//                            shuffled       elle est mélangée à la mise en place (Hercule, Daredevil)
//                            playsTop       un clic met en jeu sa carte du dessus, à côté de l'identité (Travaux
//                                           et Dons d'Hercule, Sens de Daredevil) ; sinon il ouvre la pile
//                            returnsUnder   une de ses cartes qui quitte le jeu y retourne, dessous (Daredevil :
//                                           une amélioration Sens)
//                            deck           false : une pile et non un deck, dans le journal et sa fenêtre
//                                           (les « Versions » d'Ironheart)
//                          « Mettre de côté » (X) range une de ses cartes dans sa pile. Elles s'allument un instant
//                          une fois les cartes distribuées.
//   identity               l'identité d'un héros lu sur MarvelCDB, assemblée à l'import avec d'autres cartes de sa
//                          boîte (marvelcdb.js assembleIdentity) :
//                            thirdFace      sa troisième face, une autre forme héros (Archangel d'Angel : '42001c'),
//                                           avec forms : les noms de ses deux formes héros, comme Ant-Man
//                            alterEgo       son alter ego est cette carte, et non le dos de sa carte héros (Peni
//                                           Parker de SP//dr : '31002a' ; le dos de la carte héros est la combinaison)
//                            companion      {code, backCode} : la carte qui l'accompagne, recto (en héros) et verso
//                                           (en alter ego) pris sur deux cartes ; en jeu dès la mise en place, à côté
//                                           de l'identité, elle se retourne avec elle (SP//dr : la carte « SP//dr »
//                                           de Peni en héros, la combinaison face Inactive en alter ego)
//   showsTopCard           [{zone, phase?}] : sous forme de héros (et pendant cette phase), la carte du dessus de
//                          cette pioche se montre face visible ; seul l'affichage change (Magik : son paquet ;
//                          Faucon : le paquet Rencontre, pendant la phase du joueur, 'hero'). Glissée sur la table,
//                          elle y arrive face visible
//   regeneratesAtZero      sous forme de héros, tombé à 0 PV, il n'est pas battu (Deadpool, « Le Dégénéré qui
//                          Régénère ») : ses PV reviennent à 1, il passe en alter ego et la manigance principale
//                          reçoit 1 pion Accélération ; une fenêtre l'explique (moteur : villains.js addDamage)
//   levelUp                les codes des identités suivantes, dans l'ordre (Ironheart : ses versions 2 et 3, qui
//                          attendent dans sa pile « Versions ») : « Level Up! », au menu de l'identité, la remplace
//                          par la suivante, à sa place, sur sa face héros, redressée, avec ses jetons et ses cartes
//                          d'état
// Le deck Invocation (Docteur Strange) vient du set "<héros>_invocation" de ses cartes ; la troisième face
// (Ant-Man, La Guêpe) des champs thirdName / thirdHandSize / forms de sa carte d'identité.

export const HERO_RULES = {
  spider_man: {},
  captain_marvel: {},
  she_hulk: {},
  iron_man: {
    automated: ['Iron Man (héros) : taille de main 1, +1 par amélioration Tech que vous contrôlez sur la table (7 au plus), comptée quand la main est complétée en fin de phase.'],
    handSizeBonus: { trait: 'tech', label: ['amélioration Tech', 'améliorations Tech'], max: 7 }
  },
  black_panther: {
    automated: ['Mise en place de T\'Challa : après le mulligan, vous choisissez une amélioration Black Panther de votre paquet, qui rejoint votre main ; le paquet est mélangé.'],
    setupCard: { type: 'upgrade', trait: 'black panther', label: 'une amélioration Black Panther' }
  },
  black_widow: {},
  doctor_strange: {
    automated: ['Stephen Strange débute avec son deck Invocation, mélangé, face visible : clic sur le deck (ou I) pour lancer la carte du dessus ; vide, sa défausse est remélangée sans pénalité.']
  },
  captain_america: {
    automated: ['Mise en place de Steve Rogers : le Bouclier de Captain America, cherché dans le paquet ou la défausse, rejoint la main après le mulligan ; le paquet est mélangé.'],
    byHand: ['Légende vivante : le premier allié joué à chaque round coûte 1 de moins.'],
    setupCard: { id: 'cap-09', fromDiscard: true }
  },
  hulk: {
    automated: ['Enragé : sous forme de héros, la main est défaussée à la fin de votre tour (avant de piocher).'],
    discardsHandAtTurnEnd: true
  },
  ms_marvel: {},
  thor: {},
  hawkeye: {},
  spider_woman: {
    automated: ['Agent Double : son deck prend deux affinités (Agressivité et Justice), à parts égales ; le précon les a déjà.']
  },
  quicksilver: {},
  scarlet_witch: {},
  wasp: {
    automated: ['Deux faces de héros : Minuscule (A) et Géant (C), l\'alter ego (B) entre les deux ; chaque face a sa taille de main (clic droit sur l\'identité → changer de forme).']
  },
  ant_man: {
    automated: ['Deux faces de héros : Minuscule (A) et Géant (C), l\'alter ego (B) entre les deux ; chaque face a sa taille de main (clic droit sur l\'identité → changer de forme).']
  }
}

/**
 * Héros lus sur MarvelCDB que la table refuse pour l'instant, leurs règles n'y étant pas encore gérées (Elektra : son
 * deck Ninja, mélangé dans le paquet Rencontre ; Iron Fist : ses compteurs chi et ses cartes Technique) : un deck de
 * l'un d'eux ne se charge pas (« héros non disponible sur cette plateforme »), et un deck déjà gardé n'est plus
 * proposé. Par le set de leur identité sur MarvelCDB et son code (sans la lettre de la face).
 */
export const UNAVAILABLE_HEROES = [
  { set: 'elektra', code: '63001', name: 'Elektra' },
  { set: 'iron_fist', code: '64001', name: 'Iron Fist' }
]
/** Le héros refusé pour ce set ou ce code d'identité MarvelCDB (« 63001a »), ou null. */
export const unavailableHeroOf = ({ set, code } = {}) => UNAVAILABLE_HEROES
  .find(hero => hero.set === set || (code && String(code).startsWith(hero.code))) ?? null

/**
 * Héros lus sur MarvelCDB (leur boîte n'est pas sur la table : un deck importé les amène), par le set de leur
 * identité sur MarvelCDB ('vision', 'stld' pour Star-Lord) ; mêmes champs que HERO_RULES. Leurs cartes ne sont connues qu'une fois le
 * deck importé : elles sont citées par leur code MarvelCDB.
 */
export const IMPORTED_HERO_RULES = {
  vision: {
    automated: ['Mise en place de Vision : Intangible commence en jeu, sur sa face A ; « retourner » (F) la fait passer sur Dense, et inversement.'],
    startsInPlay: ['26002']
  },
  wolverine: {
    automated: ['Mise en place de Logan : les Griffes de Wolverine commencent en jeu.'],
    startsInPlay: ['35002']
  },
  x23: {
    automated: ['Mise en place de Laura Kinney : les Griffes de X-23 commencent en jeu.'],
    startsInPlay: ['43002']
  },
  wonder_man: {
    automated: ['Mise en place de Simon Williams : Ionic Physiology commence en jeu.'],
    startsInPlay: ['58002']
  },
  jessica_jones: {
    automated: ['Mise en place de Jessica Jones : son soutien Alias Investigations commence en jeu.'],
    startsInPlay: ['61002']
  },
  shadowcat: {
    automated: ['Mise en place de Kitty Pryde : sa forme de masse commence en jeu, face Corporelle ; « retourner » (F) la fait passer sur Phased, et inversement.'],
    startsInPlay: ['32031a']
  },
  nick_fury: {
    automated: ['Mise en place de Nick Fury : sa tenue commence en jeu, face Assault ; « retourner » (F) la fait passer sur Stealth, et inversement.'],
    startsInPlay: ['50035a']
  },
  psylocke: {
    automated: ['Mise en place de Betsy Braddock : ses 2 améliorations Énergie-Psi commencent en jeu, face Psi-Couteau ; « retourner » (F) en fait passer une sur Psi-Katana, et inversement.'],
    startsInPlay: ['41002a']
  },
  phoenix: {
    automated: ['Mise en place de Jean Grey : la Force Phénix commence en jeu, face Contenue, avec 4 jetons Pouvoir.'],
    startsInPlay: [{ code: '34002a', tokens: 4, tokenName: 'Pouvoir' }]
  },
  spectrum: {
    automated: ['Mise en place de Monica Rambeau : ses 3 formes d\'énergie (Gamma, Photon, Pulsar) commencent en jeu, face cachée ; la souris sur l\'une d\'elles, ou le toucher qui la sélectionne, montre sa face dans l\'aperçu ; « retourner » (F) la révèle.'],
    startsInPlay: [{ codes: ['21002', '21003', '21004'], faceDown: true, previewFace: true }]
  },
  // Star-Lord
  stld: {
    automated: ['Mise en place de Peter Quill : après le mulligan, un exemplaire du Pistolet Élémentaire, cherché dans le paquet ou la défausse, rejoint la main ; le paquet est mélangé.'],
    setupCard: { code: '17007', fromDiscard: true }
  },
  colossus: {
    automated: ['Mise en place de Piotr Rasputin : après le mulligan, un exemplaire d\'Acier Organique, cherché dans le paquet, rejoint la main ; le paquet est mélangé.'],
    setupCard: { code: '32006' }
  },
  valk: {
    automated: ['Mise en place de Brunnhilde : l\'Aura de la Mort commence de côté, dans la pile « De côté » du bandeau du joueur ; glissez-la sur la table pour la jouer, « Mettre de côté » (X) l\'y range.'],
    heroPiles: [{ cards: ['25002'] }]
  },
  rogue: {
    automated: ['Mise en place d\'Anna Marie : Touché commence de côté, dans la pile « De côté » du bandeau du joueur ; glissez-la sur la table pour l\'attacher, « Mettre de côté » (X) l\'y range.'],
    heroPiles: [{ cards: ['38002'] }]
  },
  iceman: {
    automated: ['Mise en place de Bobby Drake : 6 Pris Dans la Glace commencent de côté, dans la pile « De côté » du bandeau du joueur ; glissez-en un sur la table pour l\'attacher, « Mettre de côté » (X) l\'y range.'],
    heroPiles: [{ cards: [{ code: '46002', copies: 6 }] }]
  },
  // Tornade : son deck Climat (4 soutiens, hors de la liste du deck sur MarvelCDB, que l'import lit dans sa boîte)
  // est sa pile du bandeau ; après le mulligan, elle en met un en jeu, au choix
  storm: {
    automated: ['Mise en place d\'Ororo Munroe : son deck Climat (Ciel Dégagé, Ouragan, Orage, Blizzard) est la pile « Climat » du bandeau du joueur ; après le mulligan, vous choisissez le soutien Climat qui entre en jeu. Contrôle Climatique : glissez un autre soutien de la pile sur la table, « Mettre de côté » (X) y range l\'ancien.'],
    heroPiles: [{ label: 'Climat', cards: [{ code: '36002', copies: 1 }, { code: '36003', copies: 1 }, { code: '36004', copies: 1 }, { code: '36005', copies: 1 }] }],
    setupCard: { type: 'support', zones: ['heroSetAside'], fromText: 'du deck Climat', label: 'un soutien Climat', intoPlay: true }
  },
  angel: {
    automated: ['Angel : trois faces, Angel (héros), Warren Worthington III (alter ego) et Archangel (héros), comme Ant-Man ; le menu de l\'identité passe de l\'une à l\'autre.'],
    identity: { thirdFace: '42001c', forms: ['Angel', 'Archangel'] }
  },
  ironheart: {
    automated: ['Ironheart : la partie commence avec la version 1 (Riri Williams) ; les versions 2 et 3 attendent dans la pile « Versions » du bandeau. Level Up! (menu de l\'identité) : la version suivante la remplace, sur sa face héros, redressée, avec ses jetons et ses cartes d\'état.'],
    heroPiles: [{ label: 'Versions', deck: false, cards: [{ code: '29002a', copies: 1 }, { code: '29003a', copies: 1 }] }],
    levelUp: ['29002a', '29003a']
  },
  spdr: {
    automated: ['SP//dr : l\'identité est SP//dr Suit (héros, main de 3) et Peni Parker (alter ego, main de 4) ; la combinaison est en jeu dès la mise en place, face Inactive, et se retourne avec l\'identité (face « SP//dr » en héros).'],
    identity: { alterEgo: '31002a', companion: { code: '31002b', backCode: '31001b' } }
  },
  deadpool: {
    automated: ['Le Dégénéré qui Régénère : Deadpool, sous forme de héros, n\'est jamais battu ; tombé à 0 PV, il revient à 1 PV, passe en alter ego (Wade Wilson) et la manigance principale reçoit 1 pion Accélération. Une fenêtre l\'explique.'],
    regeneratesAtZero: true
  },
  magik: {
    automated: ['Magik (héros) : la carte du dessus de votre paquet est face visible ; glissée sur la table, elle y arrive face visible.'],
    showsTopCard: [{ zone: 'playerDeck' }]
  },
  falcon: {
    automated: ['Faucon (héros), pendant la phase du joueur : la carte du dessus du paquet Rencontre est face visible.'],
    showsTopCard: [{ zone: 'encounterDeck', phase: 'hero' }]
  },
  // Hercule : ses decks Travaux et Dons (3 cartes chacun, hors de la liste du deck sur MarvelCDB), mélangés, face
  // cachée ; un clic sur l'un met en jeu sa carte du dessus
  hercules: {
    automated: ['Mise en place d\'Hercule : ses decks Travaux et Dons, mélangés et face cachée, sont les piles « Travaux » et « Dons » du bandeau du joueur. Nouveaux Travaux d\'Hercule (clic sur « Travaux ») : révèle la carte du dessus ; Expiation (clic sur « Dons ») : met en jeu la carte du dessus.'],
    heroPiles: [
      { label: 'Travaux', cards: [{ code: '59002', copies: 1 }, { code: '59003', copies: 1 }, { code: '59004', copies: 1 }], faceDown: true, shuffled: true, playsTop: true },
      { label: 'Dons', cards: [{ code: '59005', copies: 1 }, { code: '59006', copies: 1 }, { code: '59007', copies: 1 }], faceDown: true, shuffled: true, playsTop: true }
    ]
  },
  // Daredevil : son deck Sens (5 améliorations, hors de la liste du deck sur MarvelCDB), mélangé, face visible
  // (on peut le consulter, pas changer l'ordre) ; une amélioration Sens qui quitte le jeu retourne dessous
  daredevil: {
    automated: ['Mise en place de Matt Murdock : son deck Sens, mélangé et face visible, est la pile « Sens » du bandeau du joueur. Sens Surhumains (clic sur la pile) : met en jeu la carte du dessus (payez son coût) ; une amélioration Sens qui quitte le jeu retourne sous le deck.'],
    heroPiles: [
      { label: 'Sens', cards: [{ code: '60002', copies: 1 }, { code: '60003', copies: 1 }, { code: '60004', copies: 1 }, { code: '60005', copies: 1 }, { code: '60006', copies: 1 }], shuffled: true, playsTop: true, returnsUnder: true }
    ]
  },
  // une manigance annexe de joueur est lue sur MarvelCDB comme une manigance annexe (type side_scheme) ; dans le
  // paquet du joueur, il n'y a que les siennes
  cable: {
    automated: ['Mise en place de Nathan Summers : après le mulligan, vous choisissez une manigance annexe de joueur de votre paquet ou de votre défausse, qui entre en jeu avec sa menace de départ ; le paquet est mélangé.'],
    setupCard: { type: 'side_scheme', label: 'une manigance annexe de joueur', fromDiscard: true, intoPlay: true }
  }
}

/** Règles spéciales d'un héros ; {} pour un héros sans règle particulière. */
export const heroRules = heroId => HERO_RULES[heroId] ?? IMPORTED_HERO_RULES[heroId] ?? {}

/**
 * Les codes MarvelCDB des cartes des piles d'un héros (heroPiles) ; outsideDeck : seulement celles que la mise en
 * place crée, hors de la liste du deck (`copies` : le deck Climat de Tornade, les Pris Dans la Glace d'Iceberg).
 */
export const heroPileCodes = (heroId, { outsideDeck = false } = {}) => (heroRules(heroId).heroPiles ?? [])
  .flatMap(pile => pile.cards ?? [])
  .filter(entry => !outsideDeck || (typeof entry !== 'string' && entry.copies))
  .map(entry => (typeof entry === 'string' ? entry : entry.code))

/* ---------------------------------------------------------------------------------------------------- */
/* Scénarios                                                                                             */
/* ---------------------------------------------------------------------------------------------------- */
// Une entrée par scénario de SCENARIOS (data.js) ; son identifiant est aussi le set du méchant et des
// manigances principales. Champs lus par le moteur :
//   extraSets          autres sets Rencontre toujours utilisés par le scénario (Taskmaster : Patrouille d'Hydra)
//   setupSteps         ce que la face 1A de la manigance principale met en jeu, étape par étape :
//                        {cardId}           cette carte, cherchée dans le paquet Rencontre (elle entre en jeu
//                                           avec ses jetons ; une manigance annexe avec sa menace de départ)
//                        {type}             la première carte de ce type depuis le dessus du paquet mélangé
//                                           (L'Homme Absorbant : un environnement)
//                        {cardId, allyUnder: true}  en plus, l'allié propre au héros passe dessous, face
//                                           cachée (Prison d'Hydra)
//   setAside           cartes du set du méchant mises de côté, hors jeu (Le Dormeur, les Empire de Kang)
//   scenarioDeck       deck propre au scénario, à côté du paquet Rencontre, fait d'un set (ou de ses cartes
//                      d'un type) : {set, type?, name, shortName, dealsToPlayer?} ; dealsToPlayer : son menu
//                      attribue aussi sa carte du dessus au joueur, face cachée (Kraven : deck Piège)
//   oneEnvironment     un environnement qui entre en jeu défausse les autres (Personne ne Passe)
//   expertSet          en expert, les cartes du méchant forment un set à part (Kang Expert), toutes ses étapes servent
//   removesObligation  l'obligation du héros est retirée de la partie (Kang)
//   kang               les stades de Kang le Conquérant (moteur, villains.js) ; empireCardId : Empire de Kang
//   crew               plusieurs méchants à la fois (Les Démolisseurs), un set Rencontre chacun, le premier
//                      actif ; ni set modulaire, ni Standard ou Expert, ni obligation, ni Némésis
//   mainSchemes        manigances principales, rappels au journal : ce que demande leur « Une fois révélée »
//                      sur la face A (onRevealA, quand le stade entre en jeu) ou B (onRevealB, quand on la
//                      retourne), et leur réponse forcée après l'étape 1 de la phase du méchant (eachVillainPhase)
//   villainHitPointsFromSchemes  manigances annexes qui donnent des PV au méchant tant qu'elles sont en jeu,
//                      par identifiant : {cardId: PV} (Klaw « l'Immortel » : +10) ; quand elle quitte le jeu
//                      (vaincue, défaussée), le méchant les perd, et peut en être vaincu
//   villainStages      étapes du méchant : leur « Une fois révélée » quand l'étape remplace celle qui est
//                      vaincue (ou est posée depuis « De côté »). Fait par la table :
//                        revealCardId           carte cherchée dans le paquet Rencontre et sa défausse, puis
//                                               révélée (manigance annexe avec sa menace de départ,
//                                               attachement pour le méchant) ; le paquet est ensuite mélangé
//                        dealIfAlreadyInPlay    si cette carte est déjà en jeu, une carte Rencontre pour vous
//                        dealEncounterCards     ce nombre de cartes Rencontre pour vous, face cachée devant
//                                               votre identité
//                        dealScenarioDeckCards  ce nombre de cartes du deck du scénario pour vous, de même
//                                               (Kraven III : une carte Piège)
//                        revealScenarioDeckTop  la carte du dessus du deck du scénario est révélée
//                        stunHero               votre identité est sonnée, si elle est sous forme de héros
//                      À jouer à la main, rappelé au journal : onRevealA, ou onRevealB quand la carte est
//                      retournée (Norman Osborn devenant Le Bouffon Vert)

// Ce que plusieurs cartes demandent, rappelé au journal
const DEAL_YOURSELF = 'attribuez-vous une carte Rencontre (clic droit sur le paquet Rencontre → Carte face cachée pour vous)'
const PUT_MINION_INTO_PLAY = 'défaussez des cartes du paquet Rencontre jusqu\'à défausser un sbire, et mettez-le en jeu engagé avec vous'
const PUT_DRONE_INTO_PLAY = 'mettez en jeu la carte du dessus de votre paquet, face cachée, engagée avec vous en tant que sbire Drone (glissez-la du paquet sur la table)'
const PLACE_TEST_COUNTER = 'placez 1 jeton Test sur la manigance (J) ; à 3 jetons, défaussez des cartes Rencontre jusqu\'à un sbire, mettez-le en jeu engagé avec vous et retirez 3 jetons'
const REVEAL_SIDE_SCHEME = 'révélez la carte du dessus du deck Manigance Annexe (clic sur la pile Annexes)'
const REVEAL_WEAPON = 'révélez la carte du dessus du deck Armes Expérimentales (clic sur la pile Armes) et attachez-la au méchant'

export const SCENARIO_RULES = {
  rhino: {
    automated: [
      'Rhino (II) révélé : la manigance annexe Casser et Emporter est cherchée dans le paquet Rencontre et sa défausse, et révélée (avec 1 menace de plus par héros, son « Une fois révélée »).',
      'Rhino (III) entre en jeu Tenace (Ténacité) ; révélé, il sonne votre héros (pas votre alter ego).'
    ],
    villainStages: {
      'd02475f1-4bfb-476a-a76d-b69dbd33e47a': { revealCardId: 'ef2f8584-2a72-46a2-81ac-076f10e7b883' }, // Rhino (II) : Casser et Emporter
      'bb54b9af-cada-43e0-8602-258169423892': { stunHero: true } // Rhino (III)
    }
  },
  klaw: {
    automated: [
      'Mise en place : la manigance annexe Réseau de Défense est révélée, avec sa menace de départ et 1 menace de plus par héros (son « Une fois révélée »).',
      'Klaw (II) révélé : la manigance annexe Klaw « l\'Immortel » est cherchée dans le paquet Rencontre et sa défausse, et révélée.',
      'Tant que Klaw « l\'Immortel » est en jeu, Klaw a +10 PV (une nouvelle étape de Klaw aussi) ; la manigance vaincue ou défaussée, il les perd.',
      'Klaw (III) entre en jeu Tenace (Ténacité).'
    ],
    byHand: [
      'Klaw reçoit 1 carte de boost supplémentaire à chacune de ses attaques.',
      'Stade 1B et stade 2A révélés : un sbire du paquet Rencontre (le journal le rappelle).'
    ],
    setupSteps: [{ cardId: 'f37279a7-bbef-433f-b756-d078081a23be' }], // Réseau de Défense
    mainSchemes: {
      '77e9fb39-e38c-4b35-bf58-39072e9c6c10': { onRevealB: PUT_MINION_INTO_PLAY }, // Trafic Clandestin
      '76806fd2-3552-44be-98a5-17ab83880eca': { onRevealA: PUT_MINION_INTO_PLAY } // Rendez-Vous Secret
    },
    villainHitPointsFromSchemes: { '41d90a95-581a-40c6-b73f-acfc209b6522': 10 }, // Klaw « l'Immortel »
    villainStages: {
      '87da60fb-2502-4e5d-a8fc-9f06c447ab67': { revealCardId: '41d90a95-581a-40c6-b73f-acfc209b6522' } // Klaw (II) : Klaw « l'Immortel »
    }
  },
  ultron: {
    automated: [
      'Mise en place : l\'environnement Drones d\'Ultron est mis en jeu.',
      'Ultron (III) révélé : la manigance annexe Ordre d\'Ultron est cherchée dans le paquet Rencontre et sa défausse, et révélée.'
    ],
    byHand: [
      'Sbires Drone : la carte du dessus de votre paquet, mise en jeu face cachée (Ultron I et II quand il vous attaque, stades 1B, 2A et 3A, le journal rappelle ces derniers).',
      'Ultron (III) : chaque Drone gagne +1 ATQ et +1 PV ; Ultron ne peut pas subir de dégâts tant qu\'un Drone est en jeu.'
    ],
    setupSteps: [{ cardId: '551b46f8-e92a-47c8-8506-70127a0aca16' }], // Drones d'Ultron
    mainSchemes: {
      '741ee538-008d-4f5b-8b54-be47c3b37160': { onRevealB: PUT_DRONE_INTO_PLAY }, // Le Crimson Cowl
      '79ae1bd9-628f-40f7-8e00-049526f13041': { onRevealA: PUT_DRONE_INTO_PLAY, eachVillainPhase: `placez 2 menaces sur la manigance, ou ${PUT_DRONE_INTO_PLAY}` }, // Assaut sur le NORAD
      'af49444f-d93e-4ef5-b2fb-2035cd386d41': { onRevealA: PUT_DRONE_INTO_PLAY } // Compte à Rebours pour l'Enfer
    },
    villainStages: {
      '2a8069a6-044c-409c-a633-ded41dde6670': { revealCardId: '0f38393d-c11d-49c7-b9a0-4c7c61f098d4' } // Ultron (III) : Ordre d'Ultron
    }
  },
  risky_business: {
    automated: ['Mise en place : Entreprise Criminelle en jeu avec 2 jetons Infamie ; retournée en Accès de Folie, 2 jetons Folie.'],
    byHand: [
      'Norman Osborn n\'attaque pas : il place des jetons Infamie sur Entreprise Criminelle ; ses dégâts retirent des jetons Infamie à la place. Sans jeton, retournez Norman Osborn et Entreprise Criminelle (F).',
      'Le Bouffon Vert ne manigance pas : il retire des jetons Folie d\'Accès de Folie. Sans jeton, retournez-les de nouveau.'
    ],
    setupSteps: [{ cardId: 'gob-06' }], // Entreprise Criminelle
    villainStages: {
      // la face B de chaque Norman Osborn est Le Bouffon Vert : son « Une fois révélée » quand on le retourne
      'gob-01': { onRevealB: 'infligez 3 dégâts indirects à chaque joueur sous forme de héros' },
      'gob-02': { onRevealB: 'infligez 4 dégâts indirects à chaque joueur' },
      'gob-03': { onRevealB: 'infligez 4 dégâts à chaque joueur' }
    }
  },
  mutagen_formula: {
    automated: [
      'Mise en place : un Esclave Bouffon en jeu, engagé avec vous.',
      'Le Bouffon Vert (II) et (III) révélés : 2 et 3 cartes Rencontre pour vous, face cachée devant votre identité.'
    ],
    byHand: [
      'Quand le Bouffon Vert vous attaque et vous blesse : 1 menace sur la manigance principale (2 pour le III).',
      'Nuage Mutagène (2B) : le seuil est le nombre d\'ennemis Bouffon en jeu.'
    ],
    setupSteps: [{ cardId: 'gob-24' }], // Esclave Bouffon
    villainStages: {
      'gob-15': { dealEncounterCards: 2 }, // Le Bouffon Vert (II)
      'gob-16': { dealEncounterCards: 3 } // Le Bouffon Vert (III)
    }
  },
  wrecking_crew: {
    automated: [
      'Les quatre méchants en jeu en même temps (version A, B en expert), chacun avec sa manigance annexe et son paquet Rencontre de 15 cartes ; ni set modulaire, ni Standard ou Expert, ni obligation, ni Némésis.',
      'Jeton Actif : les piles Rencontre affichées sont celles du méchant actif ; un méchant vaincu quitte la partie avec sa manigance, le jeton passe à celui dont la manigance a le plus de menaces.'
    ],
    byHand: ['Chaque méchant manigance sur sa propre manigance annexe. Après l\'étape 1 de la phase des méchants (stade 1B) : 1 menace sur chaque manigance annexe, puis jeton Actif au méchant dont la manigance a le plus de menaces (le journal le rappelle).'],
    crew: ['wrecker', 'thunderball', 'piledriver', 'bulldozer'],
    mainSchemes: {
      'dem-01': { eachVillainPhase: 'placez 1 menace sur chaque manigance annexe, puis donnez le jeton Actif au méchant dont la manigance a le plus de menaces (clic droit sur le méchant → Rendre actif)' } // Évasion
    }
  },
  crossbones: {
    automated: [
      'Deck Armes Expérimentales à côté du paquet Rencontre (pile Armes).',
      'Crossbones (II) révélé : la Mitrailleuse de Crossbones est cherchée dans le paquet Rencontre et sa défausse, et mise en jeu avec ses 2 jetons Munition ; Crossbones (III) révélé : la carte du dessus du deck Armes est révélée.'
    ],
    byHand: [
      'Tant que Crossbones a un attachement Arme, ses attaques gagnent Perçant.',
      'Stades 1B, 2B et 3B : la carte du dessus du deck Armes (le journal le rappelle).'
    ],
    scenarioDeck: { set: 'experimental_weapons', name: 'Armes Expérimentales', shortName: 'Armes' },
    mainSchemes: {
      'rrs-061': { onRevealB: REVEAL_WEAPON }, // Attaque sur le Mont Athéna
      'rrs-062': { onRevealB: REVEAL_WEAPON }, // La Pierre d'Infinité
      'rrs-063': { onRevealB: REVEAL_WEAPON } // La Fuite
    },
    villainStages: {
      'rrs-059': { revealCardId: 'rrs-064' }, // Crossbones (II) : Mitrailleuse de Crossbones
      'rrs-060': { revealScenarioDeckTop: true } // Crossbones (III) : une Arme Expérimentale
    }
  },
  absorbing_man: {
    automated: [
      'Mise en place : les cartes du paquet Rencontre sont défaussées jusqu\'à un environnement, mis en jeu ; les autres retournent dans le paquet, mélangé.',
      'Personne ne Passe : un environnement qui entre en jeu défausse les autres.',
      'L\'Homme Absorbant (II) révélé : Pouvoir Super Absorbant est cherché dans le paquet Rencontre et sa défausse, et révélé ; s\'il est déjà en jeu, une carte Rencontre pour vous.'
    ],
    byHand: [
      'L\'Homme Absorbant gagne le trait de chaque environnement en jeu (III : Glace ou Pierre, 1 menace ; Métal ou Bois, 1 dégât indirect, après son activation).',
      'Stade 1B : 1 jeton Retard par phase du méchant (le journal le rappelle).'
    ],
    setupSteps: [{ type: 'environment' }],
    oneEnvironment: true,
    mainSchemes: {
      'rrs-079': { eachVillainPhase: 'placez 1 jeton Retard sur la manigance (J)' } // Personne ne Passe
    },
    villainStages: {
      'rrs-077': { revealCardId: 'rrs-092', dealIfAlreadyInPlay: true } // L'Homme Absorbant (II) : Pouvoir Super Absorbant
    }
  },
  taskmaster: {
    automated: [
      'Mise en place : les alliés Captifs mis de côté, hors jeu ; Patrouille d\'Hydra en jeu (le set Patrouille d\'Hydra est toujours utilisé).',
      'Capturé par Hydra : un allié Captif tiré au hasard dessous, face cachée.',
      'Taskmaster (II) et (III) révélés : une carte Rencontre pour vous, face cachée devant votre identité.'
    ],
    byHand: [
      'Après chaque passage sous forme de héros : défaussez la carte du dessus du paquet Rencontre et subissez autant de dégâts que ses icônes de boost.',
      'Stade 1B : 1 menace ou 1 dégât par phase du méchant (le journal le rappelle).'
    ],
    extraSets: ['hydra_patrol'],
    setupSteps: [{ cardId: 'rrs-154' }], // Patrouille d'Hydra
    mainSchemes: {
      'rrs-096': { eachVillainPhase: 'placez 1 menace sur la manigance ou subissez 1 dégât' } // Traquer les Héros
    },
    villainStages: {
      'rrs-094': { dealEncounterCards: 1 }, // Taskmaster (II)
      'rrs-095': { dealEncounterCards: 1 } // Taskmaster (III)
    }
  },
  zola: {
    automated: [
      'Mise en place : Prison d\'Hydra révélée, votre propre allié dessous, face cachée (sa menace augmente de son coût) ; un Bio-Serviteur Ultime en jeu, engagé avec vous.',
      'Zola (II) révélé : la manigance annexe Cobayes est cherchée dans le paquet Rencontre et sa défausse, et révélée.'
    ],
    byHand: [
      'Stades 1B et 2B : 1 jeton Test par phase du méchant, un sbire à 3 jetons ; stade 2A et Zola (III) révélés : un sbire au choix (le journal les rappelle).'
    ],
    setupSteps: [{ cardId: 'rrs-122', allyUnder: true }, { cardId: 'rrs-114' }], // Prison d'Hydra, Bio-Serviteur Ultime
    mainSchemes: {
      'rrs-112': { eachVillainPhase: PLACE_TEST_COUNTER }, // L'Île du Dr Zola
      'rrs-113': { onRevealA: 'cherchez un sbire dans le paquet Rencontre ou sa défausse et révélez-le', eachVillainPhase: PLACE_TEST_COUNTER } // Le Savant Fou
    },
    villainStages: {
      'rrs-110': { revealCardId: 'rrs-123' }, // Zola (II) : Cobayes
      'rrs-111': { onRevealA: 'cherchez un sbire dans le paquet Rencontre ou sa défausse, révélez-le et mélangez le paquet Rencontre' } // Zola (III)
    }
  },
  red_skull: {
    automated: [
      'Mise en place : La Maison Rouge en jeu ; les autres manigances annexes du set Crâne Rouge forment le deck Manigance Annexe (pile Annexes) ; Le Dormeur mis de côté, hors jeu.',
      'Crâne Rouge (II) et (III) révélés : une carte Rencontre pour vous, face cachée devant votre identité.'
    ],
    byHand: [
      'Crâne Rouge gagne +1 ATQ par manigance annexe en jeu.',
      'Stades 1B, 2A et 2B : la manigance du dessus du deck Annexes (le journal le rappelle).'
    ],
    setupSteps: [{ cardId: 'rrs-139' }], // La Maison Rouge
    setAside: ['rrs-130'], // Le Dormeur
    scenarioDeck: { set: 'red_skull', type: 'side_scheme', name: 'Manigance Annexe', shortName: 'Annexes' },
    mainSchemes: {
      'rrs-128': { eachVillainPhase: REVEAL_SIDE_SCHEME }, // L'Avènement de Crâne Rouge
      'rrs-129': { onRevealA: REVEAL_SIDE_SCHEME, eachVillainPhase: REVEAL_SIDE_SCHEME } // Nouvel Ordre Mondial d'Hydra
    },
    villainStages: {
      'rrs-126': { dealEncounterCards: 1 }, // Crâne Rouge (II)
      'rrs-127': { dealEncounterCards: 1 } // Crâne Rouge (III)
    }
  },
  // Kang (I) d'abord ; tous les Kang (II), Kang (III) et les Empire de Kang mis de côté
  kang: {
    automated: [
      'Mise en place : Kang (I) en jeu, Tenace ; les Kang (II), Kang (III) et les quatre Empire de Kang mis de côté ; l\'obligation du héros retirée de la partie. En expert, les cartes Kang Expert à la place.',
      'Changements de stade à la fin de la phase : Kang (I) vaincu, stade 2 (Le Maître du Temps, pions Accélération), stade 3A tiré au hasard avec son Kang (II) et une carte Rencontre pour vous ; Kang (II) vaincu, stade 4 avec Kang (III) et les Empire de Kang gagnés.'
    ],
    byHand: [
      'Quand Kang vous attaque : 1 menace sur la manigance principale, ou +2 ATQ pour cette attaque.',
      'Stade 1B : une carte Rencontre pour vous ; stade 4B : votre sbire Némésis en jeu (le journal les rappelle).'
    ],
    expertSet: 'kang_expert',
    removesObligation: true,
    setAside: ['kng-23'], // Empire de Kang
    kang: { empireCardId: 'kng-23' },
    // les stades 2 à 4 sont mis en jeu par le moteur (villains.js, partie Kang) : seules leurs faces B sont rappelées
    mainSchemes: {
      'kng-07': { onRevealB: DEAL_YOURSELF }, // L'Arrivée de Kang
      'kng-13': { onRevealB: 'cherchez votre sbire Némésis (De côté, paquet ou défausse Rencontre), mettez-le en jeu engagé avec vous et mélangez le paquet Rencontre' } // La Colère de Kang
    }
  },
  // fan-made : le deck Piège attend à côté du paquet Rencontre ; ses cartes s'attribuent face cachée au joueur
  kraven: {
    automated: [
      'Mise en place : le deck Piège à côté du paquet Rencontre (pile Pièges) ; « attribuez-vous une carte PIÈGE » : clic droit sur la pile → Carte face cachée pour vous.',
      'Kraven le Chasseur (III) révélé : une carte Piège pour vous, face cachée devant votre identité.'
    ],
    byHand: [
      'Quand un de vos personnages attaque Kraven le Chasseur : une carte Piège pour vous, puis révélez (F) chaque carte Piège attribuée, une fois par round.',
      'Stade 1B : 2 menaces quand vous passez sous forme de héros, 1 de moins quand vous repassez en alter ego ; stade 2B : 1 menace après chaque carte Piège révélée, une fois par round.',
      'Kraven le Chasseur (II) révélé : le Collier de Dents ; stade 2A révélé : Le Sérum de Calypso (le journal les rappelle).'
    ],
    scenarioDeck: { set: 'kraven_traps', name: 'Piège', shortName: 'Pièges', dealsToPlayer: true },
    mainSchemes: {
      'krv-05': { onRevealA: 'cherchez la manigance annexe Le Sérum de Calypso dans le paquet Rencontre ou sa défausse, révélez-la et mélangez le paquet Rencontre' } // La Grande Chasse
    },
    villainStages: {
      'krv-02': { onRevealA: 'cherchez l\'attachement Collier de Dents dans le paquet Rencontre ou sa défausse et révélez-le' }, // Kraven le Chasseur (II)
      'krv-03': { dealScenarioDeckCards: 1 } // Kraven le Chasseur (III)
    }
  }
}

/** Règles spéciales d'un scénario ; {} pour un identifiant inconnu. */
export const scenarioRules = scenarioId => SCENARIO_RULES[scenarioId] ?? {}

/** Rappels des manigances principales de tous les scénarios, par identifiant de carte : {onRevealA, onRevealB, eachVillainPhase}. */
export const MAIN_SCHEME_NOTES = Object.assign({}, ...Object.values(SCENARIO_RULES).map(rules => rules.mainSchemes ?? {}))

/** Règles des étapes du méchant de tous les scénarios, par identifiant de carte (voir villainStages ci-dessus). */
export const VILLAIN_STAGE_RULES = Object.assign({}, ...Object.values(SCENARIO_RULES).map(rules => rules.villainStages ?? {}))

/** PV que donnent au méchant les manigances annexes de tous les scénarios, par identifiant de carte (voir villainHitPointsFromSchemes). */
export const VILLAIN_HIT_POINTS_FROM_SCHEMES = Object.assign({}, ...Object.values(SCENARIO_RULES).map(rules => rules.villainHitPointsFromSchemes ?? {}))

/* ---------------------------------------------------------------------------------------------------- */
/* Cartes Rencontre communes                                                                             */
/* ---------------------------------------------------------------------------------------------------- */

/**
 * L'Ombre du Passé (set Standard) : son menu propose « Mettre en jeu la Némésis » (moteur, piles.js :
 * putNemesisIntoPlay) ; révélée, le journal le rappelle.
 */
export const SHADOW_OF_THE_PAST_ID = '6d4aa932-4d9b-40d3-bf02-283bdfff9abf'
