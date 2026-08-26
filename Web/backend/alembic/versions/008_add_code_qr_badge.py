"""eighth migration: add code_qr_badge column to employes table

Revision ID: 008_add_code_qr_badge
Revises: 007_convert_ids_to_bigint
Create Date: 2026-08-26 09:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "008_add_code_qr_badge"
down_revision: Union[str, None] = "007_convert_ids_to_bigint"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.add_column("employes", sa.Column("code_qr_badge", sa.String(100), nullable=True, unique=True))
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column("employes", "code_qr_badge")
    except Exception:
        pass
