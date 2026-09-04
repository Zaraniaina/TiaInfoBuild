"""Compare le schéma défini par les modèles SQLAlchemy au schéma réel MySQL."""
import asyncio

from sqlalchemy import inspect

from app.database import engine
import app.models  # noqa: F401  (enregistre tous les modèles dans Base.metadata)
from app.database import Base


def _compare(sync_conn):
    insp = inspect(sync_conn)
    db_tables = set(insp.get_table_names())
    missing_tables = []
    missing_cols = []
    for table_name, table in Base.metadata.tables.items():
        if table_name not in db_tables:
            missing_tables.append(table_name)
            continue
        cols = {c["name"] for c in insp.get_columns(table_name)}
        for col in table.columns:
            if col.name not in cols:
                missing_cols.append(f"{table_name}.{col.name} ({col.type})")
    return missing_tables, missing_cols


async def main():
    async with engine.connect() as conn:
        missing_tables, missing_cols = await conn.run_sync(_compare)

    with open("schema-report.txt", "w", encoding="utf-8") as f:
        f.write("=== TABLES MANQUANTES ===\n")
        f.write("\n".join(missing_tables) or "(aucune)")
        f.write("\n\n=== COLONNES MANQUANTES ===\n")
        f.write("\n".join(missing_cols) or "(aucune)")
        f.write("\n")


asyncio.run(main())