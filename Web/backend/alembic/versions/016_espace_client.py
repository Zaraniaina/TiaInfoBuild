"""seizieme migration: espace client

Revision ID: 016_espace_client
Revises: 015_fix_pointages_columns
Create Date: 2026-09-05

- utilisateurs.client_id : lie le compte utilisateur a sa fiche client
  (backfill automatique par correspondance d'email)
- devis.reponse_le / reponse_par_id / reponse_motif : tracabilite de la
  reponse du client a un devis (acceptation / refus en ligne)
- table documents : documents accessibles au client (Espace Client)
- table notifications : notifications client (application + email)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "016_espace_client"
down_revision: Union[str, None] = "015_fix_pointages_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. utilisateurs.client_id
    cols_users = {c["name"] for c in insp.get_columns("utilisateurs")}
    if "client_id" not in cols_users:
        op.add_column("utilisateurs", sa.Column("client_id", sa.Integer(), nullable=True))
        op.create_index("idx_utilisateurs_client_id", "utilisateurs", ["client_id"])
        op.create_foreign_key(
            "fk_utilisateurs_client_id", "utilisateurs", "clients", ["client_id"], ["id"], ondelete="SET NULL"
        )
    conn.execute(sa.text(
        "UPDATE utilisateurs u JOIN clients c ON c.email = u.email "
        "SET u.client_id = c.id WHERE u.client_id IS NULL"
    ))

    # 2. devis : tracabilite de la reponse client
    cols_devis = {c["name"] for c in insp.get_columns("devis")}
    if "reponse_le" not in cols_devis:
        op.add_column("devis", sa.Column("reponse_le", sa.DateTime(), nullable=True))
    if "reponse_par_id" not in cols_devis:
        op.add_column("devis", sa.Column("reponse_par_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_devis_reponse_par_id", "devis", "utilisateurs", ["reponse_par_id"], ["id"], ondelete="SET NULL"
        )
    if "reponse_motif" not in cols_devis:
        op.add_column("devis", sa.Column("reponse_motif", sa.Text(), nullable=True))

    # 3. table documents
    if "documents" not in insp.get_table_names():
        op.create_table(
            "documents",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=True),
            sa.Column("chantier_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True),
            sa.Column("projet_id", sa.Integer(), sa.ForeignKey("projets.id", ondelete="CASCADE"), nullable=True),
            sa.Column("categorie", sa.String(50), server_default="autre"),
            sa.Column("nom", sa.String(255), nullable=False),
            sa.Column("fichier_url", sa.String(500), nullable=True),
            sa.Column("mime_type", sa.String(100), nullable=True),
            sa.Column("taille_octets", sa.BigInteger(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("idx_documents_entreprise_id", "documents", ["entreprise_id"])
        op.create_index("idx_documents_client_id", "documents", ["client_id"])

    # 4. table notifications
    if "notifications" not in insp.get_table_names():
        op.create_table(
            "notifications",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("utilisateur_id", sa.Integer(), sa.ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=True),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=True),
            sa.Column("type", sa.String(50), server_default="info"),
            sa.Column("titre", sa.String(255), nullable=False),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("entite_type", sa.String(50), nullable=True),
            sa.Column("entite_id", sa.Integer(), nullable=True),
            sa.Column("canal", sa.String(20), server_default="application"),
            sa.Column("envoye_email", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("lu", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index("idx_notifications_utilisateur_id", "notifications", ["utilisateur_id"])
        op.create_index("idx_notifications_client_id", "notifications", ["client_id"])
        op.create_index("idx_notifications_lu", "notifications", ["lu"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()
    if "notifications" in tables:
        op.drop_table("notifications")
    if "documents" in tables:
        op.drop_table("documents")
    cols_devis = {c["name"] for c in insp.get_columns("devis")}
    if "reponse_motif" in cols_devis:
        op.drop_column("devis", "reponse_motif")
    if "reponse_par_id" in cols_devis:
        op.drop_column("devis", "reponse_par_id")
    if "reponse_le" in cols_devis:
        op.drop_column("devis", "reponse_le")
    cols_users = {c["name"] for c in insp.get_columns("utilisateurs")}
    if "client_id" in cols_users:
        op.drop_index("idx_utilisateurs_client_id", table_name="utilisateurs")
        op.drop_constraint("fk_utilisateurs_client_id", "utilisateurs", type_="foreignkey")
        op.drop_column("utilisateurs", "client_id")
