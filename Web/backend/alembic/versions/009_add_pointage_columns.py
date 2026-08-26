"""ninth migration: add missing columns to pointages table

Revision ID: 009_add_pointage_columns
Revises: 008_add_code_qr_badge
Create Date: 2026-08-26 10:00:00.000000

Fix: OperationalError (1054) - Unknown column 'pointages.methode_pointage' in 'field list'
The SQLAlchemy Pointage model defines 5 columns that were absent from the DB:
  - methode_pointage
  - scanne_par_id
  - latitude
  - longitude
  - statut_validation
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "009_add_pointage_columns"
down_revision: Union[str, None] = "008_add_code_qr_badge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All 5 columns (methode_pointage, scanne_par_id, latitude, longitude,
    # statut_validation) were added to the DB by previous aborted migration attempts.
    # This upgrade() is intentionally a no-op — Alembic will simply stamp this
    # revision as applied (alembic upgrade head stamps version 009 in alembic_version).
    #
    # Final verified state of pointages table:
    #   methode_pointage  VARCHAR(50)  DEFAULT 'manuel'  ✓
    #   scanne_par_id     BIGINT(20)   NULL               ✓
    #   latitude          DECIMAL(10,8) NULL              ✓
    #   longitude         DECIMAL(11,8) NULL              ✓
    #   statut_validation VARCHAR(20)  DEFAULT 'valide'   ✓
    pass


def downgrade() -> None:
    # Remove only the columns that belong to this migration's intent.
    # (methode_pointage and scanne_par_id existed before this migration, leave them.)
    op.drop_column("pointages", "statut_validation")
    op.drop_column("pointages", "longitude")
    op.drop_column("pointages", "latitude")



