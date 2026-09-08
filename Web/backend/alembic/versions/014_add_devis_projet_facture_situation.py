"""fourteenth migration: add devis.projet_id and factures.situation_id columns

Revision ID: 014_devis_projet_facture
Revises: 013_commercial_cycle
Create Date: 2026-09-04 14:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014_devis_projet_facture"
down_revision: Union[str, None] = "013_commercial_cycle"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "devis",
        sa.Column(
            "projet_id",
            sa.Integer,
            sa.ForeignKey("projets.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "factures",
        sa.Column(
            "situation_id",
            sa.Integer,
            sa.ForeignKey("situations_travaux.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_devis_projet_id", "devis", ["projet_id"])
    op.create_index("idx_factures_situation_id", "factures", ["situation_id"])


def downgrade() -> None:
    op.drop_index("idx_factures_situation_id", table_name="factures")
    op.drop_index("idx_devis_projet_id", table_name="devis")
    op.drop_column("factures", "situation_id")
    op.drop_column("devis", "projet_id")