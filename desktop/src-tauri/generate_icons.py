# Génération des icônes de l'application Tauri à partir du logo officiel TIA Info Build
import os
from PIL import Image

TAURI_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(TAURI_DIR, "..", ".."))
LOGO_PATH = os.path.join(PROJECT_ROOT, "Web", "frontend", "src", "assets", "logo-dark.png")
ICONS_DIR = os.path.join(TAURI_DIR, "icons")

def generate_icons():
    os.makedirs(ICONS_DIR, exist_ok=True)
    if not os.path.exists(LOGO_PATH):
        print(f"Erreur: logo introuvable à {LOGO_PATH}")
        return

    base_img = Image.open(LOGO_PATH).convert("RGBA")
    
    # 1. icon.png (512x512 et 256x256)
    icon_256 = base_img.resize((256, 256), Image.Resampling.LANCZOS)
    icon_512 = base_img.resize((512, 512), Image.Resampling.LANCZOS)
    icon_256.save(os.path.join(ICONS_DIR, "icon.png"), format="PNG")
    
    # 2. icon.ico (Multi-taille pour Windows)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_256.save(
        os.path.join(ICONS_DIR, "icon.ico"),
        format="ICO",
        sizes=ico_sizes
    )
    
    # 3. Tailles PNG spécifiques pour Tauri 2 / Windows / macOS / Linux
    specific_sizes = {
        "32x32.png": (32, 32),
        "128x128.png": (128, 128),
        "128x128@2x.png": (256, 256),
        "Square150x150Logo.png": (150, 150),
        "Square44x44Logo.png": (44, 44),
        "StoreLogo.png": (50, 50),
    }

    for filename, size in specific_sizes.items():
        resized = base_img.resize(size, Image.Resampling.LANCZOS)
        resized.save(os.path.join(ICONS_DIR, filename), format="PNG")

    print(f"OK: Icones generees avec succes dans {ICONS_DIR} a partir du logo officiel !")

if __name__ == "__main__":
    generate_icons()
