#!/usr/bin/env python3
"""Régénère src/data/cgbuilder.json : pour chaque carte qu'un deck importé peut amener sur la table, l'adresse
de son scan français sur cgbuilder (CardGame Builder), à la place du scan anglais de MarvelCDB.

cgbuilder range ses images en images/carte/<dossier>/<numéro><face>.jpg (https://mc-src.cgbuilder.fr/images/
carte/60/17.jpg ; face A ou B en majuscule, rien pour une carte à une face). Le numéro et la face sont ceux du
code MarvelCDB ("06001a" → 1A), mais pas toujours le dossier : cgbuilder numérote ses boîtes dans l'ordre des
sorties françaises (MarvelCDB 02, Le Bouffon Vert, est le dossier 3 ; MarvelCDB 03, Captain America, le 2).
Et une image absente n'y répond pas « introuvable » : le serveur redirige vers un nom voisin, souvent une
autre carte (1/200.jpg → 1/20.jpg), ce qu'une page ne peut pas voir. D'où cette liste, vérifiée ici :

  1. les cartes de MarvelCDB (en français : https://fr.marvelcdb.com/api/public/cards/?encounter=1) ;
  2. les cartes de cgbuilder, boîte par boîte (https://mc.cgbuilder.fr/liste_carte/<dossier>/ : nom
     français et image de chaque carte) ;
  3. chaque boîte de MarvelCDB va au dossier de cgbuilder où le plus de cartes portent le même nom au même
     numéro, s'il l'emporte nettement (sinon la boîte n'est pas encore sur cgbuilder) ;
  4. une carte est gardée si son image existe dans ce dossier et que son nom concorde : le même, ou presque
     (une faute de frappe d'un côté ou de l'autre) ; la face B d'une carte peut porter le nom de sa face A,
     un héros « Spider-Man | Peter Parker » ; une carte que MarvelCDB n'a pas encore traduite (son nom
     français est l'anglais) est gardée sur son seul numéro, la boîte ayant été reconnue.

Seules les cartes qu'un deck importé peut amener comptent (src/game/marvelcdb.js) : les cartes des joueurs,
et le set de chaque héros (obligation) et son set Némésis ; pas les réimpressions (une réimpression devient la
carte qu'elle reproduit).

Utilisation (aucune dépendance ; une soixantaine de pages lues sur cgbuilder, une par boîte) :
  python3 scripts/cgbuilder-images.py
  python3 scripts/cgbuilder-images.py --verbose   # chaque carte écartée, avec les deux noms

À relancer quand cgbuilder ajoute une boîte : les cartes absentes de la liste gardent l'image de MarvelCDB.
"""
import argparse
import datetime
import difflib
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
from collections import defaultdict

MARVELCDB_CARDS_URL = 'https://fr.marvelcdb.com/api/public/cards/?encounter=1'
CGBUILDER_SITE_URL = 'https://mc.cgbuilder.fr'
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'cgbuilder.json')
# deux noms qui se ressemblent au moins à ce point sont une même carte écrite autrement (« Rage sans limites »
# et « Rage Sans Lmimites ») ; deux cartes différentes d'une même boîte restent bien en dessous
SAME_NAME_RATIO = 0.8


def read_url(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'marvel-champions-table (scripts/cgbuilder-images.py)'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode('utf-8', errors='replace')


def plain_name(name):
    """Un nom réduit à ses lettres et chiffres, sans accents ni majuscules, sans « (II) » de fin."""
    name = re.sub(r'\([IVX]+\)\s*$', '', html.unescape(name or ''))
    name = unicodedata.normalize('NFKD', name)
    name = ''.join(character for character in name if not unicodedata.combining(character)).lower()
    return re.sub(r'[^a-z0-9]', '', name)


def cgbuilder_folders():
    """Les dossiers de cgbuilder : {numéro: nom français de la boîte}, lus sur la page des cycles."""
    page = read_url(f'{CGBUILDER_SITE_URL}/cycle/')
    folders = {int(number): html.unescape(name) for number, name in re.findall(r'liste_carte/(\d+)/"><img[^>]*alt="([^"]*)"', page)}
    if not folders:
        sys.exit('La page des cycles de cgbuilder a changé : aucune boîte trouvée.')
    return folders


def cgbuilder_cards(folder):
    """Les images d'un dossier de cgbuilder : {"1A": nom de la carte, "2": …}."""
    page = read_url(f'{CGBUILDER_SITE_URL}/liste_carte/{folder}/')
    cards = {}
    for block in re.split(r'<div id="info_bulle_', page)[1:]:
        names = [re.sub(r'<[^>]+>', '', name) for name in re.findall(r'<h1[^>]*>(.*?)</h1>', block, re.S)]
        for index, (image_folder, stem) in enumerate(re.findall(r'images/carte/(\d+)/(\d+[A-Z]?)\.jpg', block)):
            if int(image_folder) == folder:
                cards[stem] = names[min(index, len(names) - 1)] if names else ''
    return cards


def marvelcdb_packs():
    """Les cartes de MarvelCDB par boîte : {"02": {"1A": carte de l'API, "49": …}}."""
    packs = defaultdict(dict)
    for card in json.loads(read_url(MARVELCDB_CARDS_URL)):
        match = re.fullmatch(r'(\d{2})(\d{3})([a-z]?)', card['code'])
        if match:
            packs[match[1]][f'{int(match[2])}{match[3].upper()}'] = card
    return packs


def is_importable(card):
    """Une carte qu'un deck importé peut amener : une carte des joueurs, ou du set (Némésis) d'un héros."""
    if card.get('duplicate_of_code'):
        return False
    return card.get('faction_code') != 'encounter' or card.get('card_set_type_name_code') in ('hero', 'nemesis')


def cgbuilder_stem(stem, cards):
    """L'image de cgbuilder pour ce numéro de MarvelCDB : la même, ou la face A d'un code sans lettre."""
    if stem in cards:
        return stem
    if stem[-1].isdigit() and f'{stem}A' in cards:
        return f'{stem}A'
    return None


def names_agree(names, cgbuilder_name, ratio=SAME_NAME_RATIO):
    """Un des noms de MarvelCDB est celui de cgbuilder (ou d'une de ses parties « Héros | Alter ego »)."""
    cgbuilder_names = {plain_name(cgbuilder_name)} | {plain_name(part) for part in html.unescape(cgbuilder_name).split('|')}
    for name in filter(None, (plain_name(name) for name in names)):
        if name in cgbuilder_names:
            return True
        if ratio < 1 and any(difflib.SequenceMatcher(None, name, other).ratio() >= ratio for other in cgbuilder_names if other):
            return True
    return False


def find_folder(pack, cgbuilder):
    """Le dossier de cgbuilder de cette boîte de MarvelCDB, ou None ; et le nombre de noms qui l'ont désigné."""
    scores = sorted(
        ((sum(1 for stem, card in pack.items() if (match := cgbuilder_stem(stem, cards)) and names_agree([card['name']], cards[match], 1)), folder)
         for folder, cards in cgbuilder.items()),
        reverse=True)
    (best, folder), (second, _) = scores[0], scores[1]
    return (folder if best >= 5 and best >= 2 * second + 1 else None), best


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--verbose', action='store_true', help='affiche chaque carte écartée')
    arguments = parser.parse_args()

    folders = cgbuilder_folders()
    cgbuilder = {}
    for folder in sorted(folders):
        cgbuilder[folder] = cgbuilder_cards(folder)
        time.sleep(0.3)  # une page à la fois, sans presser le site
    print(f'cgbuilder : {len(cgbuilder)} boîtes, {sum(map(len, cgbuilder.values()))} images')

    packs = {}
    for prefix, pack in sorted(marvelcdb_packs().items()):
        pack_name = next(iter(pack.values()))['pack_name']
        folder, votes = find_folder(pack, cgbuilder)
        if folder is None:
            print(f'{prefix} {pack_name} : pas sur cgbuilder')
            continue
        cards = cgbuilder[folder]
        kept, missing, rejected = [], 0, []
        for stem, card in sorted(pack.items(), key=lambda item: (int(re.match(r'\d+', item[0])[0]), item[0])):
            if not is_importable(card):
                continue
            match = cgbuilder_stem(stem, cards)
            if not match:
                missing += 1
                continue
            front = pack.get(re.sub(r'[B-Z]$', 'A', stem))  # la face A : cgbuilder nomme parfois la face B comme elle
            names = [card['name'], front['name'] if front else None]
            untranslated = card['name'] == card.get('real_name')
            if names_agree(names, cards[match]) or untranslated:
                kept.append(stem if match == stem else f'{stem}={match}')
            else:
                rejected.append(f'{stem} « {html.unescape(card["name"])} » ≠ {folder}/{match} « {html.unescape(cards[match])} »')
        if kept:  # une boîte de scénarios n'a aucune carte qu'un deck importe
            packs[prefix] = {'folder': folder, 'cards': ' '.join(kept)}
        print(f'{prefix} {pack_name} → dossier {folder} « {folders[folder]} » ({votes} noms) : {len(kept)} cartes, '
              f'{missing} absentes, {len(rejected)} écartées')
        if arguments.verbose:
            for line in rejected:
                print(f'    écartée : {line}')

    data = {
        '_': 'Scans français de cgbuilder (https://mc-src.cgbuilder.fr/images/carte/<folder>/<carte>.jpg) des cartes '
             'lues sur MarvelCDB, par préfixe de code MarvelCDB ; « 17=17A » : la carte 17 est le fichier 17A. '
             f'Généré par scripts/cgbuilder-images.py le {datetime.date.today().isoformat()}.',
        'packs': packs
    }
    with open(OUTPUT_PATH, 'w', encoding='utf-8', newline='\n') as file:
        json.dump(data, file, ensure_ascii=False, indent=1)
        file.write('\n')
    print(f'{os.path.normpath(OUTPUT_PATH)} : {sum(len(pack["cards"].split()) for pack in packs.values())} cartes')


if __name__ == '__main__':
    main()
