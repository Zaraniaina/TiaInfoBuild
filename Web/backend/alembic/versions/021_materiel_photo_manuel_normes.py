"""vingt-et-unieme migration: materiel - photo, manuel, normes

Revision ID: 021_materiel_photo_manuel_normes
Revises: 020_rh_conges_employe
Create Date: 2026-09-11

- materiaux + : photo_url, manuel_url (fichiers uploades), normes (texte libre)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "021_materiel_photo_manuel_normes"
down_revision: Union[str, None] = "020_rh_conges_employe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    cols_mat = {c["name"] for c in insp.get_columns("materiaux")}
    if "photo_url" not in cols_mat:
        op.add_column("materiaux", sa.Column("photo_url", sa.String(500), nullable=True))
    if "manuel_url" not in cols_mat:
        op.add_column("materiaux", sa.Column("manuel_url", sa.String(500), nullable=True))
    if "normes" not in cols_mat:
        op.add_column("materiaux", sa.Column("normes", sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols_mat = {c["name"] for c in insp.get_columns("materiaux")}
    for col in ("normes", "manuel_url", "photo_url"):
        if col in cols_mat:
            op.drop_column("materiaux", col)
