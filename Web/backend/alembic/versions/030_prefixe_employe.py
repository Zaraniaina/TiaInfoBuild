"""Migration 030 - Prefixes de matricule employe configurables par entreprise.

Ajoute `prefixe_employe` (default 'EMP') et `prefixe_employe_journalier`
(default 'JRN') sur la table `entreprises`, dans la continuite des prefixes
devis/facture/contrat. Idempotent (verifie l'existence des colonnes).
"""
from alembic import op
import sqlalchemy as sa


revision = "030_prefixe_employe"
down_revision = "029_mail_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {c["name"] for c in inspector.get_columns("entreprises")}
    if "prefixe_employe" not in cols:
        op.add_column(
            "entreprises",
            sa.Column("prefixe_employe", sa.String(10), nullable=False, server_default="EMP"),
        )
    if "prefixe_employe_journalier" not in cols:
        op.add_column(
            "entreprises",
            sa.Column("prefixe_employe_journalier", sa.String(10), nullable=False, server_default="JRN"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {c["name"] for c in inspector.get_columns("entreprises")}
    if "prefixe_employe_journalier" in cols:
        op.drop_column("entreprises", "prefixe_employe_journalier")
    if "prefixe_employe" in cols:
        op.drop_column("entreprises", "prefixe_employe")
