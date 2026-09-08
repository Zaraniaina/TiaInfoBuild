"""Applique la migration 011 de manière idempotente via SQLAlchemy."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import text, inspect as sa_inspect
from app.database import engine

ALTERS = [
    ("lignes_devis", "categorie", "ALTER TABLE lignes_devis ADD COLUMN categorie VARCHAR(50) NULL"),
    ("factures", "montant_tva", "ALTER TABLE factures ADD COLUMN montant_tva NUMERIC(12,2) NOT NULL DEFAULT 0"),
    ("factures", "montant_acompte_deduit", "ALTER TABLE factures ADD COLUMN montant_acompte_deduit NUMERIC(12,2) NOT NULL DEFAULT 0"),
    ("factures", "reste_a_payer", "ALTER TABLE factures ADD COLUMN reste_a_payer NUMERIC(12,2) NOT NULL DEFAULT 0"),
]

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS lignes_factures (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    facture_id BIGINT NOT NULL,
    type VARCHAR(20) DEFAULT 'article',
    article_id BIGINT NULL,
    description TEXT NOT NULL,
    categorie VARCHAR(50) NULL,
    quantite NUMERIC(10,2) DEFAULT 0,
    unite VARCHAR(20) NULL,
    prix_unitaire NUMERIC(10,2) DEFAULT 0,
    remise NUMERIC(5,2) DEFAULT 0,
    taux_tva NUMERIC(5,2) DEFAULT 20.00,
    total_ht NUMERIC(12,2) DEFAULT 0,
    total_ttc NUMERIC(12,2) DEFAULT 0,
    ordre INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
"""

INDEX_SQLS = [
    "CREATE INDEX idx_lignes_factures_facture_id ON lignes_factures (facture_id)",
    "CREATE INDEX idx_lignes_factures_article_id ON lignes_factures (article_id)",
]

ADD_FK_SQLS = [
    "ALTER TABLE lignes_factures ADD CONSTRAINT fk_lignes_factures_facture_id FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE",
    "ALTER TABLE lignes_factures ADD CONSTRAINT fk_lignes_factures_article_id FOREIGN KEY (article_id) REFERENCES articles(id)",
]


async def main():
    async with engine.begin() as conn:
        def sync_fn(conn):
            insp = sa_inspect(conn)
            for table, column, alter in ALTERS:
                cols = [c["name"] for c in insp.get_columns(table)]
                if column not in cols:
                    conn.execute(text(alter))
                    print(f"Ajout colonne {table}.{column}")
                else:
                    print(f"Colonne {table}.{column} déjà présente")

            conn.execute(text(CREATE_TABLE_SQL))
            if not insp.has_table("lignes_factures"):
                print("Création table lignes_factures")
            else:
                print("Table lignes_factures déjà présente")

            for idx in INDEX_SQLS:
                try:
                    conn.execute(text(idx))
                except Exception:
                    pass

            for fk in ADD_FK_SQLS:
                try:
                    conn.execute(text(fk))
                except Exception as e:
                    print(f"FK ignorée: {fk} -> {e}")

        await conn.run_sync(sync_fn)
    print("Migration 011 appliquée.")


if __name__ == "__main__":
    asyncio.run(main())
