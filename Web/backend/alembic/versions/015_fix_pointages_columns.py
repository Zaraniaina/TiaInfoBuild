"""quinzieme migration: repare la derive de schema sur la table pointages

Revision ID: 015_fix_pointages_columns
Revises: 014_devis_projet_facture_situation
Create Date: 2026-09-05

Correction definitive de l'erreur de login :
  OperationalError (1054) - Unknown column 'pointages.methode_pointage' in 'field list'
La migration 009 avait ete marquee comme appliquee (no-op) alors que les colonnes
n'avaient jamais ete creees dans la base. Cette migration ajoute les colonnes
manquantes de maniere idempotente (verification via inspecteur avant ajout).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015_fix_pointages_columns"
down_revision: Union[str, None] = "014_devis_projet_facture_situation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COLUMNS_AJOUTER = [
    ("methode_pointage", sa.String(50), {"server_default": "manuel"}),
    ("scanne_par_id", sa.BigInteger(), {}),
    ("latitude", sa.Numeric(10, 8), {}),
    ("longitude", sa.Numeric(11, 8), {}),
    ("statut_validation", sa.String(20), {"server_default": "valide"}),
]


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols_existantes = {c["name"] for c in insp.get_columns("pointages")}
    for name, col_type, kwargs in COLUMNS_AJOUTER:
        if name not in cols_existantes:
            op.add_column("pointages", sa.Column(name, col_type, nullable=True, **kwargs))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols_existantes = {c["name"] for c in insp.get_columns("pointages")}
    for name, _, _ in COLUMNS_AJOUTER:
        if name in cols_existantes:
            op.drop_column("pointages", name)
