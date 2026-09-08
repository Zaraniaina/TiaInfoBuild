"""dix-huitieme migration: lien projet -> chantier

Revision ID: 018_chantiers_projet_id
Revises: 017_espace_terrain
Create Date: 2026-09-07

- chantiers.projet_id : lien optionnel vers le projet d'origine (workflow
  commercial -> etude -> contrat -> chantier). Nullable pour ne pas casser
  les chantiers existants (creation libre toujours possible).
- index idx_chantiers_projet_id
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "018_chantiers_projet_id"
down_revision: Union[str, None] = "017_espace_terrain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    cols = {c["name"] for c in insp.get_columns("chantiers")}
    if "projet_id" not in cols:
        op.add_column(
            "chantiers",
            sa.Column("projet_id", sa.Integer(), nullable=True),
        )

    # Type compatible avec projets.id (INT(11)) en base, sinon FK refusee (errno 150).
    # Si la colonne existait deja en bigint ( essai precedent echoue sur la FK ,
    # la convertir en INT avant de poser la contrainte.
    col_type = {c["name"]: str(c["type"]) for c in insp.get_columns("chantiers")}
    if "projet_id" in col_type and "BIGINT" in col_type["projet_id"].upper():
        op.alter_column("chantiers", "projet_id", type_=sa.Integer())

    fks = insp.get_foreign_keys("chantiers")
    has_fk = any(fk.get("referred_table") == "projets" for fk in fks)

    if not has_fk:
        op.create_foreign_key(
            "fk_chantiers_projet_id",
            "chantiers",
            "projets",
            ["projet_id"],
            ["id"],
            ondelete="SET NULL",
        )

    indexes = {i["name"] for i in insp.get_indexes("chantiers")}
    if "idx_chantiers_projet_id" not in indexes:

        op.create_index("idx_chantiers_projet_id", "chantiers", ["projet_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    indexes = {i["name"] for i in insp.get_indexes("chantiers")}
    if "idx_chantiers_projet_id" in indexes:
        op.drop_index("idx_chantiers_projet_id", table_name="chantiers")
    cols = {c["name"] for c in insp.get_columns("chantiers")}
    if "projet_id" in cols:
        op.drop_column("chantiers", "projet_id")
