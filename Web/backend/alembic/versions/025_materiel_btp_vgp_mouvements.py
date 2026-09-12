"""vingt-cinquieme migration: materiel BTP, VGP, horametre et mouvements

Revision ID: 025_materiel_btp_vgp_mouvements
Revises: 024_merge_heads
Create Date: 2026-09-11

- materiaux + : categorie_btp, immatriculation, heures_moteur, kilometrage, frequence_entretien_heures, statut_vgp, date_derniere_vgp, date_prochaine_vgp, organisme_vgp, certificat_vgp_url, qr_code_key
- nouvelle table mouvements_materiel
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "025_materiel_btp_vgp_mouvements"
down_revision: Union[str, None] = "021_materiel_photo_manuel_normes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    cols_mat = {c["name"] for c in insp.get_columns("materiaux")}
    if "categorie_btp" not in cols_mat:
        op.add_column("materiaux", sa.Column("categorie_btp", sa.String(100), server_default="engin_lourd", nullable=True))
    if "immatriculation" not in cols_mat:
        op.add_column("materiaux", sa.Column("immatriculation", sa.String(50), nullable=True))
    if "heures_moteur" not in cols_mat:
        op.add_column("materiaux", sa.Column("heures_moteur", sa.Numeric(10, 2), server_default="0", nullable=True))
    if "kilometrage" not in cols_mat:
        op.add_column("materiaux", sa.Column("kilometrage", sa.Numeric(12, 2), server_default="0", nullable=True))
    if "frequence_entretien_heures" not in cols_mat:
        op.add_column("materiaux", sa.Column("frequence_entretien_heures", sa.Numeric(10, 2), nullable=True))
    if "statut_vgp" not in cols_mat:
        op.add_column("materiaux", sa.Column("statut_vgp", sa.String(30), server_default="conforme", nullable=True))
    if "date_derniere_vgp" not in cols_mat:
        op.add_column("materiaux", sa.Column("date_derniere_vgp", sa.Date(), nullable=True))
    if "date_prochaine_vgp" not in cols_mat:
        op.add_column("materiaux", sa.Column("date_prochaine_vgp", sa.Date(), nullable=True))
    if "organisme_vgp" not in cols_mat:
        op.add_column("materiaux", sa.Column("organisme_vgp", sa.String(100), nullable=True))
    if "certificat_vgp_url" not in cols_mat:
        op.add_column("materiaux", sa.Column("certificat_vgp_url", sa.String(500), nullable=True))
    if "qr_code_key" not in cols_mat:
        op.add_column("materiaux", sa.Column("qr_code_key", sa.String(100), nullable=True))

    tables = set(insp.get_table_names())
    if "mouvements_materiel" not in tables:
        op.create_table(
            "mouvements_materiel",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False),
            sa.Column("materiel_id", sa.Integer(), sa.ForeignKey("materiaux.id", ondelete="CASCADE"), nullable=False),
            sa.Column("chantier_origine_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="SET NULL"), nullable=True),
            sa.Column("chantier_destination_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="SET NULL"), nullable=True),
            sa.Column("date_depart", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("date_reception", sa.DateTime(), nullable=True),
            sa.Column("transporteur", sa.String(255), nullable=True),
            sa.Column("statut", sa.String(30), server_default="en_transit", nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default="0", nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())
    if "mouvements_materiel" in tables:
        op.drop_table("mouvements_materiel")
