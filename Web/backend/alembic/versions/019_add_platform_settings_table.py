"""add_platform_settings_table

Revision ID: 019_add_platform_settings_table
Revises: 018_chantiers_projet_id
Create Date: 2026-09-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '019_add_platform_settings_table'
down_revision = '018_chantiers_projet_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'platform_settings',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('cle', sa.String(100), nullable=False, unique=True),
        sa.Column('valeur', sa.Text, nullable=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_platform_settings_cle', 'platform_settings', ['cle'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_platform_settings_cle', table_name='platform_settings')
    op.drop_table('platform_settings')
