# Génération d'icônes PLACEHOLDER pour le desktop Tauri
# (PNG 256x256 unis-tone + ICO contenant ce PNG, écrits avec zlib/struct uniquement)
# Usage : python generate_icons.py
# À remplacer par les vraies icônes de la marque en Phase 5 (packaging).
import os
import struct
import zlib

TAILLE = 256
# Bleu corporate BTP, unis-tone, opaque
ROUGE, VERT, BLEU, ALPHA = 31, 78, 138, 255

DOSSIER_ICONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")


def construire_png() -> bytes:
    """Construit un PNG RGBA 256x256 unis-tone (zlib + struct, sans Pillow)."""

    def bloc(type_bloc: bytes, donnees: bytes) -> bytes:
        return (
            struct.pack(">I", len(donnees))
            + type_bloc
            + donnees
            + struct.pack(">I", zlib.crc32(type_bloc + donnees) & 0xFFFFFFFF)
        )

    entete_ihdr = struct.pack(">IIBBBBB", TAILLE, TAILLE, 8, 6, 0, 0, 0)  # RGBA 8 bits
    ligne = bytes([ROUGE, VERT, BLEU, ALPHA]) * TAILLE
    # Chaque ligne de pixels est préfixée du filtre PNG 0 (aucun filtre)
    brut = b"".join(b"\x00" + ligne for _ in range(TAILLE))
    return (
        b"\x89PNG\r\n\x1a\n"
        + bloc(b"IHDR", entete_ihdr)
        + bloc(b"IDAT", zlib.compress(brut, 9))
        + bloc(b"IEND", b"")
    )


def construire_ico(png: bytes) -> bytes:
    """ICO contenant une seule entrée 256x256 PNG-compressée (format Vista+)."""
    entete = struct.pack("<HHH", 0, 1, 1)  # réservé, type=icône, nombre=1
    # 0 signifie 256 dans une entrée d'ICO ; PNG => pas besoin de masque AND
    entree = struct.pack(
        "<BBBBHHII",
        0,
        0,
        0,  # couleurs (0 = 256)
        0,  # réservé
        1,  # planes
        32,  # bpp
        len(png),
        6 + 16,  # offset : entête + 1 entrée
    )
    return entete + entree + png


def main() -> None:
    os.makedirs(DOSSIER_ICONS, exist_ok=True)
    png = construire_png()
    ico = construire_ico(png)

    chemin_png = os.path.join(DOSSIER_ICONS, "icon.png")
    chemin_ico = os.path.join(DOSSIER_ICONS, "icon.ico")
    with open(chemin_png, "wb") as f:
        f.write(png)
    with open(chemin_ico, "wb") as f:
        f.write(ico)
    print(f"OK: {chemin_png} ({len(png)} o), {chemin_ico} ({len(ico)} o)")


if __name__ == "__main__":
    main()
