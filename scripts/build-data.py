#!/usr/bin/env python3
"""Regenerate src/data/cards.json (core set) and src/data/precons.json.
Scenario packs have their own hand-written file (src/data/bouffon-vert.json) and are not touched.

Sources:
  - MarvelCDB data (card stats + French translations):
      git clone --depth 1 https://github.com/zzorba/marvelsdb-json-data.git
  - OCTGN Marvel Champions module (precon deck lists in scripts/constants.py):
      git clone --depth 1 https://github.com/twistedsistem/OCTGN-Marvel-Champions.git
  - The card images exported from OCTGN, named <octgn GUID>.jpg (and <GUID>.b.jpg for back sides).

Usage:
  pip install pillow
  python3 scripts/build-data.py --marvelsdb ../marvelsdb-json-data \
      --octgn ../OCTGN-Marvel-Champions --images public/cards/base --packs core

An expansion can instead get its own data file and image folder, declared in PACKS
(src/game/data.js), like the Green Goblin pack.
"""
import argparse
import ast
import glob
import json
import os
import re

from PIL import Image

# obligations carry no set_code in MarvelCDB: map them to their hero
OBLIGATIONS = {'01155': 'black_panther', '01160': 'she_hulk', '01165': 'spider_man', '01170': 'iron_man', '01175': 'captain_marvel'}
HEROES = ['black_panther', 'captain_marvel', 'she_hulk', 'iron_man', 'spider_man']


def load_pack(root, pack):
    cards, fr = [], {}
    for suffix in ('', '_encounter'):
        path = f'{root}/pack/{pack}{suffix}.json'
        if os.path.exists(path):
            cards += json.load(open(path, encoding='utf-8'))
        tpath = f'{root}/translations/fr/pack/{pack}{suffix}.json'
        if os.path.exists(tpath):
            fr.update({c['code']: c for c in json.load(open(tpath, encoding='utf-8'))})
    return cards, fr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--marvelsdb', required=True)
    ap.add_argument('--octgn', required=True)
    ap.add_argument('--images', default='public/cards/base')
    ap.add_argument('--packs', default='core')
    ap.add_argument('--out', default='src/data')
    a = ap.parse_args()

    cards, fr = [], {}
    for pack in a.packs.split(','):
        c, f = load_pack(a.marvelsdb, pack)
        cards += c
        fr.update(f)
    by_code = {c['code']: c for c in cards}
    backs = {c['back_link'] for c in cards if c.get('back_link')}

    defs = []
    for c in cards:
        if c['code'] in backs:
            continue  # back side, merged into its front below
        gid = c.get('octgn_id')
        img = f"{a.images}/{gid}.jpg"
        if not gid or not os.path.exists(img):
            print('no image, skipped:', c['code'], c['name'])
            continue
        t = fr.get(c['code'], {})
        d = {'id': gid, 'code': c['code'], 'n': t.get('name', c['name']), 't': c['type_code'], 'f': c['faction_code'],
             's': c.get('set_code') or OBLIGATIONS.get(c['code']) or '', 'q': c.get('quantity', 1)}
        w, h = Image.open(img).size
        d['l'] = 1 if w > h else 0
        if c.get('stage'):
            d['st'] = c['stage']
        for k, kk in [('health', 'hp'), ('hand_size', 'hs'), ('threat', 'th'), ('escalation_threat', 'esc'), ('base_threat', 'bth')]:
            if k in c:
                d[kk] = c[k]
        if c.get('back_link'):
            b = by_code[c['back_link']]
            d['bn'] = fr.get(b['code'], {}).get('name', b['name'])
            d['bt'] = b['type_code']
            for k, kk in [('hand_size', 'bhs'), ('threat', 'th'), ('escalation_threat', 'esc'), ('base_threat', 'bth')]:
                if k in b:
                    d[kk] = b[k]
        if c['type_code'] == 'obligation':
            d['f'] = 'encounter'
        else:
            # English name: MarvelCDB text deck lists name the cards in English
            if d['f'] != 'encounter':
                d['en'] = c['name']
        defs.append(d)

    # precon lists from the OCTGN module (dicts named after each hero, code -> qty)
    src = open(glob.glob(f'{a.octgn}/*/scripts/constants.py')[0], encoding='utf-8').read()
    by_card_code = {d['code']: d for d in defs}
    precons = {}
    for hero in HEROES:
        m = re.search(rf'^{hero}\s*=\s*(\{{.*?\}})', src, re.S | re.M)
        lst = []
        for code, q in ast.literal_eval(m.group(1)).items():
            d = by_card_code.get(code) or by_card_code.get(code.rstrip('ab') + 'a') or by_card_code.get(code + 'a')
            if d:
                lst.append([d['id'], q])
        precons[hero] = lst

    os.makedirs(a.out, exist_ok=True)
    json.dump(defs, open(f'{a.out}/cards.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=4)
    json.dump(precons, open(f'{a.out}/precons.json', 'w', encoding='utf-8'))
    print(f'{len(defs)} cartes, {len(precons)} précons → {a.out}')


if __name__ == '__main__':
    main()
