"""vingtieme migration: rh - conges, journaliers, cnaps/ostie, documents rh

Revision ID: 020_rh_conges_employe
Revises: 019_add_platform_settings_table
Create Date: 2026-09-11

- table conges : demandes de conges avec workflow de validation RH
- employes + : mode_remuneration, taux_journalier, taux_horaire, prix_tache,
  numero_cnaps, numero_ostie, statut_declaration, solde_conges_annuel
- documents + : employe_id (rattachement documents RH: contrat, cnaps, ostie...)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "020_rh_conges_employe"
down_revision: Union[str, None] = "019_add_platform_settings_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(insp, name: str) -> bool:
    try:
        return name in insp.get_table_names()
    except Exception:
        return False


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. table conges
    if not _table_exists(insp, "conges"):
        op.create_table(
            "conges",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("employe_id", sa.Integer(), sa.ForeignKey("employes.id", ondelete="CASCADE"), nullable=False),
            sa.Column("type", sa.String(30), server_default="annuel"),
            sa.Column("date_debut", sa.Date(), nullable=False),
            sa.Column("date_fin", sa.Date(), nullable=False),
            sa.Column("nb_jours", sa.Numeric(5, 1), nullable=False),
            sa.Column("statut", sa.String(20), server_default="en_attente"),
            sa.Column("motif", sa.Text(), nullable=True),
            sa.Column("valide_par", sa.Integer(), sa.ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True),
            sa.Column("date_validation", sa.DateTime(), nullable=True),
            sa.Column("commentaire_refus", sa.Text(), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("idx_conges_entreprise_id", "conges", ["entreprise_id"])
        op.create_index("idx_conges_employe_id", "conges", ["employe_id"])
        op.create_index("idx_conges_statut", "conges", ["statut"])

    # 2. colonnes employes (journaliers, cnaps/ostie, solde conges)
    cols_emp = {c["name"] for c in insp.get_columns("employes")}
    new_emp = {
        "mode_remuneration": sa.Column("mode_remuneration", sa.String(20), server_default="mensuel"),
        "taux_journalier": sa.Column("taux_journalier", sa.Numeric(12, 2), nullable=True),
        "taux_horaire": sa.Column("taux_horaire", sa.Numeric(12, 2), nullable=True),
        "prix_tache": sa.Column("prix_tache", sa.Numeric(12, 2), nullable=True),
        "numero_cnaps": sa.Column("numero_cnaps", sa.String(50), nullable=True),
        "numero_ostie": sa.Column("numero_ostie", sa.String(50), nullable=True),
        "statut_declaration": sa.Column("statut_declaration", sa.String(20), server_default="non_declare"),
        "solde_conges_annuel": sa.Column("solde_conges_annuel", sa.Numeric(5, 1), server_default="30"),
    }
    for name, col in new_emp.items():
        if name not in cols_emp:
            op.add_column("employes", col)

    # 3. documents -> employe (documents RH)
    # NB: employes.id est int(11) dans MySQL -> colonne Integer pour FK conforme (errno 150)
    if _table_exists(insp, "documents"):
        cols_doc = {c["name"] for c in insp.get_columns("documents")}
        if "employe_id" not in cols_doc:
            op.add_column("documents", sa.Column("employe_id", sa.Integer(), nullable=True))
            op.create_foreign_key("fk_documents_employe", "documents", "employes", ["employe_id"], ["id"], ondelete="CASCADE")
            op.create_index("idx_documents_employe_id", "documents", ["employe_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if _table_exists(insp, "documents"):
        cols_doc = {c["name"] for c in insp.get_columns("documents")}
        if "employe_id" in cols_doc:
            op.drop_index("idx_documents_employe_id", table_name="documents")
            op.drop_constraint("fk_documents_employe", "documents", type_="foreignkey")
            op.drop_column("documents", "employe_id")

    if _table_exists(insp, "employes"):
        cols_emp = {c["name"] for c in insp.get_columns("employes")}
        for col in ("solde_conges_annuel", "statut_declaration", "numero_ostie", "numero_cnaps",
                    "prix_tache", "taux_horaire", "taux_journalier", "mode_remuneration"):
            if col in cols_emp:
                op.drop_column("employes", col)

    if _table_exists(insp, "conges"):
        op.drop_table("conges")
