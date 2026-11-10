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
//   setupCardId            carte que la « Mise en place » de l'identité ajoute à la main : cherchée dans le
//                          paquet ou la défausse après le mulligan, puis le paquet est mélangé
//                          (le Bouclier de Captain America)
//   setupNote              « Mise en place » de l'identité quand elle se joue à la main : écrite au journal
//                          au début de la partie (T'Challa)
//   discardsHandAtTurnEnd  sous forme de héros, la main est défaussée à la fin du tour (Hulk, « Enragé »)
//   handSizeBonus          sous forme de héros, la taille de main augmente de 1 par amélioration contrôlée
//                          qui a un trait donné : {trait, label: [singulier, pluriel] pour le journal, max}
//                          (Iron Man : Tech, 7 au plus)
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
    byHand: ['Mise en place de T\'Challa : cherchez une amélioration Black Panther dans votre paquet, ajoutez-la à votre main et mélangez le paquet.'],
    setupNote: 'Mise en place de T\'Challa, après le mulligan : cherchez une amélioration Black Panther dans votre paquet (clic droit sur le paquet → Chercher dans le paquet…) et prenez-la en main ; le paquet est mélangé ensuite.'
  },
  black_widow: {},
  doctor_strange: {
    automated: ['Stephen Strange débute avec son deck Invocation, mélangé, face visible : clic sur le deck (ou I) pour lancer la carte du dessus ; vide, sa défausse est remélangée sans pénalité.']
  },
  captain_america: {
    automated: ['Mise en place de Steve Rogers : le Bouclier de Captain America, cherché dans le paquet ou la défausse, rejoint la main après le mulligan ; le paquet est mélangé.'],
    byHand: ['Légende vivante : le premier allié joué à chaque round coûte 1 de moins.'],
    setupCardId: 'cap-09'
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

/** Règles spéciales d'un héros ; {} pour un héros sans règle particulière ou lu sur MarvelCDB. */
export const heroRules = heroId => HERO_RULES[heroId] ?? {}

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
//                      d'un type) : {set, type?, name, shortName}
//   oneEnvironment     un environnement qui entre en jeu défausse les autres (Personne ne Passe)
//   expertSet          en expert, les cartes du méchant forment un set à part (Kang Expert), toutes ses étapes servent
//   removesObligation  l'obligation du héros est retirée de la partie (Kang)
//   kang               les stades de Kang le Conquérant (moteur, villains.js) ; empireCardId : Empire de Kang
//   crew               plusieurs méchants à la fois (Les Démolisseurs), un set Rencontre chacun, le premier
//                      actif ; ni set modulaire, ni Standard ou Expert, ni obligation, ni Némésis
//   mainSchemes        manigances principales, rappels au journal : ce que demande leur « Une fois révélée »
//                      sur la face A (onRevealA, quand le stade entre en jeu) ou B (onRevealB, quand on la
//                      retourne), et leur réponse forcée après l'étape 1 de la phase du méchant (eachVillainPhase)
//   villainStages      étapes du méchant : leur « Une fois révélée » quand l'étape remplace celle qui est
//                      vaincue (ou est posée depuis « De côté »). Fait par la table :
//                        revealCardId           carte cherchée dans le paquet Rencontre et sa défausse, puis
//                                               révélée (manigance annexe avec sa menace de départ,
//                                               attachement pour le méchant) ; le paquet est ensuite mélangé
//                        dealIfAlreadyInPlay    si cette carte est déjà en jeu, une carte Rencontre pour vous
//                        dealEncounterCards     ce nombre de cartes Rencontre pour vous, face cachée devant
//                                               votre identité
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
      'Rhino (II) révélé : la manigance annexe Casser et Emporter est cherchée dans le paquet Rencontre et sa défausse, et révélée.',
      'Rhino (III) entre en jeu Tenace (Ténacité) ; révélé, il sonne votre héros (pas votre alter ego).'
    ],
    byHand: ['Casser et Emporter révélée : 1 menace de plus (son « Une fois révélée »).'],
    villainStages: {
      'd02475f1-4bfb-476a-a76d-b69dbd33e47a': { revealCardId: 'ef2f8584-2a72-46a2-81ac-076f10e7b883' }, // Rhino (II) : Casser et Emporter
      'bb54b9af-cada-43e0-8602-258169423892': { stunHero: true } // Rhino (III)
    }
  },
  klaw: {
    automated: [
      'Mise en place : la manigance annexe Réseau de Défense est révélée, avec sa menace de départ.',
      'Klaw (II) révélé : la manigance annexe Klaw « l\'Immortel » est cherchée dans le paquet Rencontre et sa défausse, et révélée.',
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
  }
}

/** Règles spéciales d'un scénario ; {} pour un identifiant inconnu. */
export const scenarioRules = scenarioId => SCENARIO_RULES[scenarioId] ?? {}

/** Rappels des manigances principales de tous les scénarios, par identifiant de carte : {onRevealA, onRevealB, eachVillainPhase}. */
export const MAIN_SCHEME_NOTES = Object.assign({}, ...Object.values(SCENARIO_RULES).map(rules => rules.mainSchemes ?? {}))

/** Règles des étapes du méchant de tous les scénarios, par identifiant de carte (voir villainStages ci-dessus). */
export const VILLAIN_STAGE_RULES = Object.assign({}, ...Object.values(SCENARIO_RULES).map(rules => rules.villainStages ?? {}))
