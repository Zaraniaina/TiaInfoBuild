"""tenth migration: add subscription plans and subscription tracking

Revision ID: 010_add_subscriptions
Revises: 009_add_pointage_columns
Create Date: 2026-09-01 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010_add_subscriptions"
down_revision: Union[str, None] = "009_add_pointage_columns"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("nom", sa.String(100), nullable=False),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("prix_mensuel", sa.Numeric(10, 2), nullable=False),
        sa.Column("prix_annuel", sa.Numeric(10, 2), nullable=False),
        sa.Column("utilisateurs_max", sa.Integer, server_default="5"),
        sa.Column("chantiers_max", sa.Integer, server_default="3"),
        sa.Column("stockage_go", sa.Integer, server_default="5"),
        sa.Column("duree_essai_jours", sa.Integer, server_default="30"),
        sa.Column("actif", sa.Boolean, server_default="1"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_plan_code", "plans", ["code"])

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", sa.BigInteger, sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("date_debut", sa.DateTime, server_default=sa.func.now()),
        sa.Column("date_fin", sa.DateTime),
        sa.Column("date_prochain_renouvellement", sa.DateTime),
        sa.Column("statut", sa.String(20), server_default="actif"),
        sa.Column("mode_paiement", sa.String(50)),
        sa.Column("prix_paye", sa.Numeric(10, 2)),
        sa.Column("periode", sa.String(20)),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_subscription_entreprise", "subscriptions", ["entreprise_id"])
    op.create_index("idx_subscription_plan", "subscriptions", ["plan_id"])


def downgrade() -> None:
    op.drop_index("idx_subscription_plan", table_name="subscriptions")
    op.drop_index("idx_subscription_entreprise", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index("idx_plan_code", table_name="plans")
    op.drop_table("plans")
