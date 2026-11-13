# Prépare les pions posés sur les cartes (public/tokens/) en versions réduites et nettes, à partir des
# images d'origine (design/tokens/, qui ne sont pas publiées avec la table).
#
# Les images d'origine font 375 à 615 px de large, très détaillées (trames de points, contour fin). Le
# navigateur les réduit à la volée, sur la table à une trentaine de pixels : la trame se brouille et le pion
# paraît flou. Ces versions sont réduites à l'avance (Lanczos, en alpha prémultiplié pour ne pas laisser de
# liseré clair autour du pion), puis leurs couleurs sont légèrement renforcées en netteté.
#
# Chaque version fait le double du plus grand pion qu'elle sert (écrans haute densité) :
#   -table : les cartes de la table et de la main (au plus 130 px de large : pion de 39 px, triangle de 47 px)
#   -zoom  : la carte agrandie de la colonne de droite (au plus 400 px environ : pion de 120 px, triangle de 144 px)
#
# À relancer quand une image d'origine change :  python scripts/resize-tokens.py
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE_FOLDER = ROOT / 'design' / 'tokens'
TARGET_FOLDER = ROOT / 'public' / 'tokens'

# largeur en pixels de chaque version, par image d'origine
WIDTHS = {
    'degats': {'table': 80, 'zoom': 240},
    'jetons': {'table': 80, 'zoom': 240},
    'menace': {'table': 96, 'zoom': 288},
}


def reduce(source, width):
    """Réduit l'image à cette largeur et renforce un peu la netteté de ses couleurs (pas de sa transparence)."""
    height = round(width * source.height / source.width)
    reduced = source.convert('RGBa').resize((width, height), Image.LANCZOS).convert('RGBA')
    colors = reduced.convert('RGB').filter(ImageFilter.UnsharpMask(radius=0.8, percent=60, threshold=1))
    colors.putalpha(reduced.getchannel('A'))
    return colors


for name, widths in WIDTHS.items():
    source = Image.open(SOURCE_FOLDER / f'{name}.png')
    for usage, width in widths.items():
        target = TARGET_FOLDER / f'{name}-{usage}.png'
        reduce(source, width).save(target, optimize=True)
        print(f'{target.name} : {width} px')
