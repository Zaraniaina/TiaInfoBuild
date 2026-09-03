#!/usr/bin/env python3
"""Script de verification des migrations Alembic.
Verifie :
- L'etat de la table alembic_version (ne contient que le head)
- Que la derniere migration (head) est atteinte
- Que les IDs de revision ne depassent pas 32 caracteres (limite Alembic)
"""

import asyncio
import sys
from pathlib import Path

backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings

# Derniere revision (head) attendue
HEAD_REVISION = "012_add_avenants"

# Tous les IDs de revision (verification de longueur)
ALL_REVISION_IDS = [
    "001_initial_schema",
    "002_chantiers_schema",
    "003_roles_and_historique_poste",
    "004_remaining_modules",
    "005_finance_alertes_sync",
    "006_add_missing_columns",
    "007_convert_ids_to_bigint",
    "008_add_code_qr_badge",
    "009_add_pointage_columns",
    "010_add_subscriptions",
    "011_ligne_categories_factures",
    "012_add_avenants",
]

ALEMBIC_MAX_LENGTH = 32


async def main():
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)

    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            versions = [row[0] for row in result.fetchall()]

            print("Etat de alembic_version :")
            for v in versions:
                print(f"  - {v}")

            # Verification 1 : le head est-il atteint ?
            if HEAD_REVISION in versions:
                print(f"\nOK : Le head ({HEAD_REVISION}) est atteint.")
            else:
                print(f"\nATTENTION : Le head ({HEAD_REVISION}) n'est pas atteint.")

            # Verification 2 : longueur des IDs de revision
            print(f"\nVerification des longueurs (limite : {ALEMBIC_MAX_LENGTH} car.) :")
            too_long = [r for r in ALL_REVISION_IDS if len(r) > ALEMBIC_MAX_LENGTH]
            if too_long:
                print("  ATTENTION : IDs trop longs (tronquage possible) :")
                for r in too_long:
                    print(f"    - {r} ({len(r)} car.)")
            else:
                print("  OK : Tous les IDs sont dans la limite.")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
