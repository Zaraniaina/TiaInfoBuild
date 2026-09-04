"""Répare la table pointages : ajoute les 5 colonnes manquantes (migration 009 no-op)."""
import asyncio

from sqlalchemy import text

from app.database import engine

COLUMNS = [
    ("methode_pointage", "VARCHAR(50) NOT NULL DEFAULT 'manuel'"),
    ("scanne_par_id", "BIGINT NULL"),
    ("latitude", "NUMERIC(10, 8) NULL"),
    ("longitude", "NUMERIC(11, 8) NULL"),
    ("statut_validation", "VARCHAR(20) NOT NULL DEFAULT 'valide'"),
]


async def main():
    async with engine.begin() as conn:
        result = await conn.execute(text("SHOW COLUMNS FROM pointages"))
        existing = {row[0] for row in result}
        added_scanne = False
        for name, ddl in COLUMNS:
            if name in existing:
                print(f"SKIP {name} (déjà présent)")
                continue
            await conn.execute(text(f"ALTER TABLE pointages ADD COLUMN {name} {ddl}"))
            print(f"ADD COLUMN {name} {ddl}")
            if name == "scanne_par_id":
                added_scanne = True
        if added_scanne:
            await conn.execute(
                text(
                    "ALTER TABLE pointages ADD CONSTRAINT fk_pointages_utilisateurs "
                    "FOREIGN KEY (scanne_par_id) REFERENCES utilisateurs(id)"
                )
            )
            print("ADD FK pointages.scanne_par_id -> utilisateurs(id)")
    print("TERMINÉ")


asyncio.run(main())