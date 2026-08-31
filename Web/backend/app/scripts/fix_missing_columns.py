"""
Script de synchronisation du schéma MySQL avec les modèles SQLAlchemy.

Problème rencontré : l'ORM déclare des colonnes (ex: pointages.methode_pointage)
qui sont absentes de la base de données. Toute requête touchant ces tables
(ex: db.refresh(entreprise) qui charge la relation pointages en eager) lève
une erreur 500 "Unknown column".

Ce script parcourt tous les modèles et ajoute, colonne par colonne, les colonnes
manquantes dans MySQL (sans toucher aux colonnes existantes ni aux données).
Il est idempotent : relancer plusieurs fois est sans danger.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import inspect, text
from sqlalchemy import (
    BigInteger,
    Integer,
    String,
    Text,
    Boolean,
    Numeric,
    DateTime,
    Date,
    Time,
    Float,
    JSON,
)
from app.database import engine, Base
import app.models  # noqa: F401  (importe tous les modèles pour peupler Base.metadata)


def mysql_type(col) -> str | None:
    """Convertit un type SQLAlchemy en type MySQL (DDL). Retourne None si non géré."""
    t = col.type
    if isinstance(t, BigInteger):
        return "BIGINT"
    if isinstance(t, Integer):
        return "INT"
    if isinstance(t, Boolean):
        return "TINYINT(1)"
    if isinstance(t, String):
        return f"VARCHAR({t.length or 255})"
    if isinstance(t, Text):
        return "TEXT"
    if isinstance(t, JSON):
        return "JSON"
    if isinstance(t, Numeric):
        return f"DECIMAL({t.precision or 10},{t.scale or 2})"
    if isinstance(t, Float):
        return "DOUBLE"
    if isinstance(t, DateTime):
        return "DATETIME"
    if isinstance(t, Date):
        return "DATE"
    if isinstance(t, Time):
        return "TIME"
    return None


def default_clause(col) -> str:
    """Construit la clause DEFAULT à partir de server_default (si pertinent)."""
    sd = col.server_default
    if sd is None:
        return ""
    arg = sd.arg
    # server_default peut être une chaîne ("manuel") ou une expression SQL (func.now())
    if isinstance(arg, str):
        return f" DEFAULT '{arg}'"
    s = str(arg).lower()
    if "now()" in s or "current_timestamp" in s:
        return " DEFAULT CURRENT_TIMESTAMP"
    return ""


async def fix_columns():
    async with engine.begin() as conn:
        print(" Synchronisation du schéma MySQL avec les modèles ORM...")

        # Inspection des colonnes existantes, table par table (connexion async -> await)
        async def _existing_columns(table_name: str) -> set[str]:
            try:
                result = await conn.execute(
                    text(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_NAME = :t AND TABLE_SCHEMA = DATABASE()"
                    ),
                    {"t": table_name},
                )
                rows = result.fetchall()
                return {r[0] for r in rows}
            except Exception:
                return set()

        for table in Base.metadata.tables.values():
            table_name = table.name
            existing = await _existing_columns(table_name)
            for col in table.columns:
                if col.name in existing:
                    continue
                col_type = mysql_type(col)
                if col_type is None:
                    print(f"   Colonne {table_name}.{col.name} ignoree (type non gere: {col.type})")
                    continue
                # NOT NULL sans defaut : on ajoute la colonne en nullable pour ne pas
                # faire echouer l'ALTER sur une table non vide (l'app fournit la valeur a l'insert).
                if col.nullable:
                    null_clause = ""
                elif default_clause(col):
                    null_clause = " NOT NULL"
                else:
                    null_clause = ""
                ddl = (
                    f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"
                    f"{default_clause(col)}{null_clause};"
                )
                try:
                    await conn.execute(text(ddl))
                    print(f"   Colonne {table_name}.{col.name} ajoutee ({col_type}).")
                except Exception as e:
                    msg = str(e)
                    if "Duplicate column name" in msg or "1060" in msg:
                        print(f"   {table_name}.{col.name} deja presente.")
                    else:
                        print(f"   {table_name}.{col.name} non ajoutee : {e}")


if __name__ == "__main__":
    asyncio.run(fix_columns())
