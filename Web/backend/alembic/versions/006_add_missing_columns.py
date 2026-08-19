"""sixth migration: add missing is_deleted, created_at, updated_at columns

Revision ID: 006_add_missing_columns
Revises: 005_finance_alertes_sync
Create Date: 2026-08-19 12:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "006_add_missing_columns"
down_revision: Union[str, None] = "005_finance_alertes_sync"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_deleted to utilisateurs
    op.add_column("utilisateurs", sa.Column("is_deleted", sa.Boolean, server_default="0"))

    # Add is_deleted to roles
    op.add_column("roles", sa.Column("is_deleted", sa.Boolean, server_default="0"))

    # Add is_deleted to entreprises
    op.add_column("entreprises", sa.Column("is_deleted", sa.Boolean, server_default="0"))

    # Add is_deleted to preferences
    op.add_column("preferences", sa.Column("is_deleted", sa.Boolean, server_default="0"))

    # Add missing columns to historique_connexions
    op.add_column("historique_connexions", sa.Column("is_deleted", sa.Boolean, server_default="0"))
    op.add_column("historique_connexions", sa.Column("created_at", sa.DateTime, server_default=sa.func.now()))
    op.add_column("historique_connexions", sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()))

    # Add missing columns to refresh_tokens
    op.add_column("refresh_tokens", sa.Column("is_deleted", sa.Boolean, server_default="0"))
    op.add_column("refresh_tokens", sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()))


def downgrade() -> None:
    # Remove columns from refresh_tokens
    op.drop_column("refresh_tokens", "updated_at")
    op.drop_column("refresh_tokens", "is_deleted")

    # Remove columns from historique_connexions
    op.drop_column("historique_connexions", "updated_at")
    op.drop_column("historique_connexions", "created_at")
    op.drop_column("historique_connexions", "is_deleted")

    # Remove is_deleted from preferences
    op.drop_column("preferences", "is_deleted")

    # Remove is_deleted from entreprises
    op.drop_column("entreprises", "is_deleted")

    # Remove is_deleted from roles
    op.drop_column("roles", "is_deleted")

    # Remove is_deleted from utilisateurs
    op.drop_column("utilisateurs", "is_deleted")