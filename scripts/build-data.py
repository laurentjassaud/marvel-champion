#!/usr/bin/env python3
"""Régénère src/data/cards.json (boîte de base) et src/data/precons.json (ses decks préconstruits).
Les autres boîtes ont leur propre fichier écrit à la main (src/data/bouffon-vert.json…) et ne sont pas touchées.

Sources :
  - les données de MarvelCDB (caractéristiques des cartes et traductions françaises) :
      git clone --depth 1 https://github.com/zzorba/marvelsdb-json-data.git
  - le module OCTGN de Marvel Champions (listes des précons dans scripts/constants.py) :
      git clone --depth 1 https://github.com/twistedsistem/OCTGN-Marvel-Champions.git
  - les images des cartes exportées d'OCTGN, nommées <GUID OCTGN>.jpg (et <GUID>.b.jpg pour les versos).

Utilisation :
  pip install pillow
  python3 scripts/build-data.py --marvelsdb ../marvelsdb-json-data \\
      --octgn ../OCTGN-Marvel-Champions --images public/cards/base --packs core

Le fichier produit garde les clés courtes des fiches (n, t, s, hp…) : src/game/data.js les traduit en noms
lisibles au chargement (table SHORT_KEYS). Une extension peut aussi avoir son propre fichier de données et
son dossier d'images, déclarés dans PACKS (src/game/data.js), comme Le Bouffon Vert.
"""
import argparse
import ast
import glob
import json
import os
import re

from PIL import Image

# les obligations n'ont pas de set_code dans MarvelCDB : on les rattache à leur héros
OBLIGATION_HEROES = {'01155': 'black_panther', '01160': 'she_hulk', '01165': 'spider_man', '01170': 'iron_man', '01175': 'captain_marvel'}
# les héros de la boîte de base, dont on lit les précons dans le module OCTGN
CORE_SET_HEROES = ['black_panther', 'captain_marvel', 'she_hulk', 'iron_man', 'spider_man']

# mot-clé Toughness (Ténacité) : le personnage entre en jeu avec une carte d'état Tenace
TOUGHNESS_KEYWORD = re.compile(r'(^|[\s.>])Toughness(?=[\s.,<\[]|$)')
# jetons avec lesquels la carte entre en jeu (mêmes règles que entryTokensFromCardText dans
# src/game/marvelcdb.js) ; en solo, « 2[per_hero] » vaut 2
FRENCH_ENTRY_TOKENS = [
    re.compile(r'Utilisations? \((\d+)(?:\[per_hero\])? jetons? ([^).,]+?)\s*(?:, plus (\d+)\[per_hero\][^)]*)?\)', re.I),
    re.compile(r'entre en jeu avec (\d+|une?)(?:\[per_hero\])? jetons? ([^\s.,<]+)', re.I)
]
ENGLISH_ENTRY_TOKENS = re.compile(r'(?:\bUses \(|enters? play with )(\d+)(?:\[per_hero\])? [^.()]*?counters?', re.I)


def entry_tokens(french_text, english_text):
    """Jetons d'entrée en jeu, en clés courtes : {'tk': nombre, 'tkn': nom}, {'tk': nombre}, ou {}."""
    for pattern in FRENCH_ENTRY_TOKENS:
        match = pattern.search(french_text or '')
        if match:
            count = 1 if match.group(1).lower() in ('un', 'une') else int(match.group(1))
            per_hero_extra = match.group(3) if pattern.groups >= 3 else None  # « , plus 1[per_hero] … »
            return {'tk': count + int(per_hero_extra or 0), 'tkn': match.group(2)}
    match = ENGLISH_ENTRY_TOKENS.search(english_text or '')
    return {'tk': int(match.group(1))} if match else {}


def load_pack(marvelsdb_folder, pack):
    """Cartes d'une boîte (joueur et Rencontre) et leurs traductions françaises, par code."""
    cards, french_by_code = [], {}
    for suffix in ('', '_encounter'):
        cards_path = f'{marvelsdb_folder}/pack/{pack}{suffix}.json'
        if os.path.exists(cards_path):
            cards += json.load(open(cards_path, encoding='utf-8'))
        translation_path = f'{marvelsdb_folder}/translations/fr/pack/{pack}{suffix}.json'
        if os.path.exists(translation_path):
            french_by_code.update({card['code']: card for card in json.load(open(translation_path, encoding='utf-8'))})
    return cards, french_by_code


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--marvelsdb', required=True, help='dossier marvelsdb-json-data')
    parser.add_argument('--octgn', required=True, help='dossier du module OCTGN')
    parser.add_argument('--images', default='public/cards/base', help='dossier des images des cartes')
    parser.add_argument('--packs', default='core', help='boîtes à lire, séparées par des virgules')
    parser.add_argument('--out', default='src/data', help='dossier où écrire cards.json et precons.json')
    arguments = parser.parse_args()

    cards, french_by_code = [], {}
    for pack in arguments.packs.split(','):
        pack_cards, pack_french = load_pack(arguments.marvelsdb, pack)
        cards += pack_cards
        french_by_code.update(pack_french)
    card_by_code = {card['code']: card for card in cards}
    back_side_codes = {card['back_link'] for card in cards if card.get('back_link')}

    definitions = []
    for card in cards:
        if card['code'] in back_side_codes:
            continue  # face B : fusionnée plus bas dans la fiche de sa face A
        octgn_id = card.get('octgn_id')
        image_path = f"{arguments.images}/{octgn_id}.jpg"
        if not octgn_id or not os.path.exists(image_path):
            print('pas d\'image, carte ignorée :', card['code'], card['name'])
            continue
        french = french_by_code.get(card['code'], {})
        # fiche en clés courtes (voir SHORT_KEYS dans src/game/data.js)
        definition = {
            'id': octgn_id, 'code': card['code'], 'n': french.get('name', card['name']), 't': card['type_code'],
            'f': card['faction_code'], 's': card.get('set_code') or OBLIGATION_HEROES.get(card['code']) or '',
            'q': card.get('quantity', 1)
        }
        width, height = Image.open(image_path).size
        definition['l'] = 1 if width > height else 0  # carte à l'horizontale
        if card.get('stage'):
            definition['st'] = card['stage']
        for marvelsdb_key, short_key in [('health', 'hp'), ('hand_size', 'hs'), ('threat', 'th'), ('escalation_threat', 'esc'), ('base_threat', 'bth')]:
            if marvelsdb_key in card:
                definition[short_key] = card[marvelsdb_key]
        # les alliés propres aux héros gardent leur coût (Prison d'Hydra, scénario de Zola)
        if card['type_code'] == 'ally' and card['faction_code'] == 'hero' and 'cost' in card:
            definition['cost'] = card['cost']
        if card.get('back_link'):
            back = card_by_code[card['back_link']]
            definition['bn'] = french_by_code.get(back['code'], {}).get('name', back['name'])
            definition['bt'] = back['type_code']
            # la face B d'une manigance principale porte son seuil de menace
            for marvelsdb_key, short_key in [('hand_size', 'bhs'), ('threat', 'th'), ('escalation_threat', 'esc'), ('base_threat', 'bth')]:
                if marvelsdb_key in back:
                    definition[short_key] = back[marvelsdb_key]
        if card['type_code'] == 'obligation':
            definition['f'] = 'encounter'
        elif definition['f'] != 'encounter':
            # nom anglais : les decks texte de MarvelCDB nomment les cartes en anglais
            definition['en'] = card['name']
        # les améliorations du joueur gardent leurs traits (français, minuscules) : des règles en comptent (Iron Man : Tech)
        if card['type_code'] == 'upgrade' and definition['f'] != 'encounter':
            traits = [trait.strip().lower() for trait in (french.get('traits') or '').split('.') if trait.strip()]
            if traits:
                definition['tr'] = traits
        if TOUGHNESS_KEYWORD.search(card.get('text') or ''):
            definition['toughness'] = True
        definition.update(entry_tokens(french.get('text'), card.get('text')))
        definitions.append(definition)

    # les précons du module OCTGN : un dictionnaire par héros, code → exemplaires
    constants_source = open(glob.glob(f'{arguments.octgn}/*/scripts/constants.py')[0], encoding='utf-8').read()
    definition_by_code = {definition['code']: definition for definition in definitions}
    precon_decks = {}
    for hero in CORE_SET_HEROES:
        match = re.search(rf'^{hero}\s*=\s*(\{{.*?\}})', constants_source, re.S | re.M)
        deck_list = []
        for code, copies in ast.literal_eval(match.group(1)).items():
            # le code peut désigner une face (01001a) ou la carte entière : on essaie les deux
            definition = (definition_by_code.get(code) or definition_by_code.get(code.rstrip('ab') + 'a')
                          or definition_by_code.get(code + 'a'))
            if definition:
                deck_list.append([definition['id'], copies])
        precon_decks[hero] = deck_list

    os.makedirs(arguments.out, exist_ok=True)
    json.dump(definitions, open(f'{arguments.out}/cards.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=4)
    json.dump(precon_decks, open(f'{arguments.out}/precons.json', 'w', encoding='utf-8'))
    print(f'{len(definitions)} cartes, {len(precon_decks)} précons → {arguments.out}')


if __name__ == '__main__':
    main()
