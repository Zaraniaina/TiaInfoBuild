"""twelfth migration: add avenants table

Revision ID: 012_add_avenants
Revises: 011_ligne_categories_factures
Create Date: 2026-09-01 17:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012_add_avenants"
down_revision: Union[str, None] = "011_ligne_categories_factures"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "avenants",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contrat_id", sa.Integer, sa.ForeignKey("contrats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("numero", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("impact_montant", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("date_signature", sa.Date, nullable=True),
        sa.Column("statut", sa.String(20), server_default="propose", nullable=False),
        sa.Column("fichier_url", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_deleted", sa.Boolean, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("idx_avenants_entreprise_id", "avenants", ["entreprise_id"])
    op.create_index("idx_avenants_contrat_id", "avenants", ["contrat_id"])
    op.create_index("idx_avenants_numero", "avenants", ["numero"])


def downgrade() -> None:
    op.drop_index("idx_avenants_numero", table_name="avenants")
    op.drop_index("idx_avenants_contrat_id", table_name="avenants")
    op.drop_index("idx_avenants_entreprise_id", table_name="avenants")
    op.drop_table("avenants")
