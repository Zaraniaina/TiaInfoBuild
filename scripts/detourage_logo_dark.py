"""Utilitaire : détourage du fond noir du logo_dark.png (bord empiété).

Le fond du logo_dark n'est pas strictement transparent : un halo noir
opaque déborde du liseré coloré. On force l'alpha à 0 pour tout pixel
sombre ET peu saturé (fond + franges noires), en préservant le blanc du
logo (sombre mais désaturé CLAIR) et les couleurs du dégradé.
"""
from PIL import Image

SRC = r"C:/Users/Zaraniaina/Downloads/logo_dark.png"
DST = r"Web/frontend/src/assets/logo-dark.png"

im = Image.open(SRC).convert("RGBA")
px = im.load()
w, h = im.size
changed = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        # Sombre et peu saturé => fond/frange noire (le blanc du logo est
        # sombre-canal mais très désaturé et CLAIR : mx > 120 le préserve).
        if mx <= 60 and (mx - mn) < 30 and a > 0:
            px[x, y] = (r, g, b, 0)
            changed += 1
im.save(DST)
print(f"{changed} pixels detoures -> {DST}")
