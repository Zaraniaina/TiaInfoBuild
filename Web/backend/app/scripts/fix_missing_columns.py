"""
Script d'urgence pour s'assurer que toutes les colonnes requises (ex: code_qr_badge) sont bien présentes dans MySQL.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import text
from app.database import engine

async def fix_columns():
    async with engine.begin() as conn:
        print(" Vérification des colonnes MySQL...")
        try:
            await conn.execute(text("ALTER TABLE employes ADD COLUMN code_qr_badge VARCHAR(100) UNIQUE;"))
            print("    Colonne code_qr_badge ajoutée à la table employes.")
        except Exception as e:
            if "Duplicate column name" in str(e) or "1060" in str(e):
                print("   ℹ Colonne code_qr_badge déjà présente.")
            else:
                print(f"    Remarque: {e}")

if __name__ == "__main__":
    asyncio.run(fix_columns())
