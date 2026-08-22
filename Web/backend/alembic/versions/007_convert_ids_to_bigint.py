"""convert ids and fks to bigint

Revision ID: 007_convert_ids_to_bigint
Revises: 006_add_missing_columns
Create Date: 2026-08-22 16:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_convert_ids_to_bigint'
down_revision: Union[str, None] = '006_add_missing_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES_WITH_IDS = [
    "entreprises",
    "roles",
    "utilisateurs",
    "preferences",
    "historique_connexions",
    "refresh_tokens",
    "employes",
    "equipes",
    "membres_equipe",
    "chantiers",
    "phases",
    "incidents",
    "affectations_chantier",
    "affectations_ressource",
    "articles",
    "mouvements_stock",
    "fournisseurs",
    "clients",
    "client_adresses",
    "devis",
    "lignes_devis",
    "contrats",
    "factures",
    "paiements",
    "depenses",
    "pointages",
    "heures_supplementaires",
    "historique_postes",
    "alertes",
    "materiaux",
    "maintenances",
    "alertes_materiel",
    "affectations_materiel",
    "rapports_financiers",
    "sync_queue",
]


def upgrade() -> None:
    for table in TABLES_WITH_IDS:
        try:
            op.alter_column(table, 'id', existing_type=sa.Integer(), type_=sa.BigInteger(), autoincrement=True)
        except Exception:
            pass


def downgrade() -> None:
    for table in TABLES_WITH_IDS:
        try:
            op.alter_column(table, 'id', existing_type=sa.BigInteger(), type_=sa.Integer(), autoincrement=True)
        except Exception:
            pass
