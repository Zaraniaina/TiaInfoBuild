"""eleventh migration: add ligne categories and facture calculated fields

Revision ID: 011_ligne_categories_factures
Revises: 010_add_subscriptions
Create Date: 2026-09-01 10:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011_ligne_categories_factures"
down_revision: Union[str, None] = "010_add_subscriptions"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("lignes_devis", schema=None) as batch_op:
        batch_op.add_column(sa.Column("categorie", sa.String(50), nullable=True))

    with op.batch_alter_table("factures", schema=None) as batch_op:
        batch_op.add_column(sa.Column("montant_tva", sa.Numeric(12, 2), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("montant_acompte_deduit", sa.Numeric(12, 2), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("reste_a_payer", sa.Numeric(12, 2), server_default="0", nullable=False))

    op.create_table(
        "lignes_factures",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("facture_id", sa.BigInteger, nullable=False),
        sa.Column("type", sa.String(20), server_default="article"),
        sa.Column("article_id", sa.BigInteger, nullable=True),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("categorie", sa.String(50), nullable=True),
        sa.Column("quantite", sa.Numeric(10, 2), server_default="0"),
        sa.Column("unite", sa.String(20), nullable=True),
        sa.Column("prix_unitaire", sa.Numeric(10, 2), server_default="0"),
        sa.Column("remise", sa.Numeric(5, 2), server_default="0"),
        sa.Column("taux_tva", sa.Numeric(5, 2), server_default="20.00"),
        sa.Column("total_ht", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_ttc", sa.Numeric(12, 2), server_default="0"),
        sa.Column("ordre", sa.Integer, server_default="0"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("idx_lignes_factures_facture_id", "lignes_factures", ["facture_id"])
    op.create_index("idx_lignes_factures_article_id", "lignes_factures", ["article_id"])

    try:
        with op.batch_alter_table("lignes_factures", schema=None) as batch_op:
            batch_op.create_foreign_key(
                "fk_lignes_factures_facture_id",
                "factures",
                ["facture_id"],
                ["id"],
                ondelete="CASCADE",
            )
    except Exception:
        pass

    try:
        with op.batch_alter_table("lignes_factures", schema=None) as batch_op:
            batch_op.create_foreign_key(
                "fk_lignes_factures_article_id",
                "articles",
                ["article_id"],
                ["id"],
            )
    except Exception:
        pass


def downgrade() -> None:
    try:
        with op.batch_alter_table("lignes_factures", schema=None) as batch_op:
            batch_op.drop_constraint("fk_lignes_factures_article_id", type_="foreignkey")
    except Exception:
        pass
    try:
        with op.batch_alter_table("lignes_factures", schema=None) as batch_op:
            batch_op.drop_constraint("fk_lignes_factures_facture_id", type_="foreignkey")
    except Exception:
        pass

    op.drop_index("idx_lignes_factures_article_id", table_name="lignes_factures")
    op.drop_index("idx_lignes_factures_facture_id", table_name="lignes_factures")
    op.drop_table("lignes_factures")

    with op.batch_alter_table("factures", schema=None) as batch_op:
        batch_op.drop_column("reste_a_payer")
        batch_op.drop_column("montant_acompte_deduit")
        batch_op.drop_column("montant_tva")

    with op.batch_alter_table("lignes_devis", schema=None) as batch_op:
        batch_op.drop_column("categorie")
