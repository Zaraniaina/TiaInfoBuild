"""thirteenth migration: add commercial cycle tables (demandes, projets, metres, situations)

Revision ID: 013_commercial_cycle
Revises: 012_add_avenants
Create Date: 2026-09-04 12:00:00.000000

Tables du cycle commercial complet :
CLIENT â†’ DEMANDE â†’ PROJET â†’ MÃ‰TRÃ‰ â†’ DEVIS â†’ CONTRAT â†’ CHANTIER â†’ SITUATION â†’ FACTURE â†’ PAIEMENT
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "013_commercial_cycle"
down_revision: Union[str, None] = "012_add_avenants"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Demandes de travaux
    op.create_table(
        "demandes_travaux",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("commercial_id", sa.Integer, sa.ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("numero", sa.String(50), nullable=True, unique=True),
        sa.Column("objet", sa.String(255), nullable=False),
        sa.Column("type_projet", sa.String(50), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("localisation", sa.String(255), nullable=True),
        sa.Column("date_demande", sa.DateTime, server_default=sa.func.now()),
        sa.Column("date_souhaitee", sa.DateTime, nullable=True),
        sa.Column("documents_fournis", sa.Text, nullable=True),
        sa.Column("plans_disponibles", sa.Boolean, server_default="0", nullable=True),
        sa.Column("observations", sa.Text, nullable=True),
        sa.Column("statut", sa.String(20), server_default="nouvelle", nullable=True),
        sa.Column("is_deleted", sa.Boolean, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("idx_demandes_entreprise_id", "demandes_travaux", ["entreprise_id"])
    op.create_index("idx_demandes_client_id", "demandes_travaux", ["client_id"])
    op.create_index("idx_demandes_numero", "demandes_travaux", ["numero"])

    # 2. Projets
    op.create_table(
        "projets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("demande_id", sa.Integer, sa.ForeignKey("demandes_travaux.id", ondelete="SET NULL"), nullable=True),
        sa.Column("responsable_id", sa.Integer, sa.ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reference", sa.String(50), nullable=True, unique=True),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("type_projet", sa.String(50), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("localisation", sa.String(255), nullable=True),
        sa.Column("adresse", sa.String(255), nullable=True),
        sa.Column("longueur", sa.Numeric(10, 2), nullable=True),
        sa.Column("largeur", sa.Numeric(10, 2), nullable=True),
        sa.Column("hauteur", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface", sa.Numeric(10, 2), nullable=True),
        sa.Column("volume", sa.Numeric(10, 2), nullable=True),
        sa.Column("nombre_niveaux", sa.Integer, nullable=True),
        sa.Column("plans_documents", sa.Text, nullable=True),
        sa.Column("observations", sa.Text, nullable=True),
        sa.Column("statut", sa.String(20), server_default="en_etude", nullable=True),
        sa.Column("is_deleted", sa.Boolean, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("idx_projets_entreprise_id", "projets", ["entreprise_id"])
    op.create_index("idx_projets_client_id", "projets", ["client_id"])
    op.create_index("idx_projets_demande_id", "projets", ["demande_id"])
    op.create_index("idx_projets_reference", "projets", ["reference"])

    # 3. MÃ©trÃ©s
    op.create_table(
        "metres",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
        sa.Column("projet_id", sa.Integer, sa.ForeignKey("projets.id", ondelete="CASCADE"), nullable=True),
        sa.Column("ouvrage", sa.String(255), nullable=False),
        sa.Column("designation", sa.String(255), nullable=True),
        sa.Column("formule", sa.String(255), nullable=True),
        sa.Column("dimensions", sa.Text, nullable=True),
        sa.Column("unite", sa.String(20), nullable=True),
        sa.Column("quantite", sa.Numeric(12, 2), server_default="0", nullable=True),
        sa.Column("observations", sa.Text, nullable=True),
        sa.Column("document_reference", sa.String(255), nullable=True),
        sa.Column("ordre", sa.Integer, server_default="0", nullable=True),
        sa.Column("is_deleted", sa.Boolean, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("idx_metres_entreprise_id", "metres", ["entreprise_id"])
    op.create_index("idx_metres_projet_id", "metres", ["projet_id"])

    # 4. Situations de travaux
    op.create_table(
        "situations_travaux",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True),
        sa.Column("contrat_id", sa.Integer, sa.ForeignKey("contrats.id", ondelete="SET NULL"), nullable=True),
        sa.Column("numero", sa.String(50), nullable=True),
        sa.Column("periode", sa.String(50), nullable=True),
        sa.Column("date_etablissement", sa.DateTime, server_default=sa.func.now()),
        sa.Column("avancement", sa.Numeric(5, 2), server_default="0", nullable=True),
        sa.Column("montant", sa.Numeric(15, 2), server_default="0", nullable=True),
        sa.Column("observations", sa.Text, nullable=True),
        sa.Column("statut", sa.String(20), server_default="brouillon", nullable=True),
        sa.Column("is_deleted", sa.Boolean, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("idx_situations_entreprise_id", "situations_travaux", ["entreprise_id"])
    op.create_index("idx_situations_chantier_id", "situations_travaux", ["chantier_id"])
    op.create_index("idx_situations_contrat_id", "situations_travaux", ["contrat_id"])
    op.create_index("idx_situations_numero", "situations_travaux", ["numero"])

    # 5. Lignes de situation
    op.create_table(
        "lignes_situation",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("situation_id", sa.Integer, sa.ForeignKey("situations_travaux.id", ondelete="CASCADE"), nullable=True),
        sa.Column("ouvrage", sa.String(255), nullable=False),
        sa.Column("quantite_periode", sa.Numeric(12, 2), server_default="0", nullable=True),
        sa.Column("quantite_cumulee", sa.Numeric(12, 2), server_default="0", nullable=True),
        sa.Column("unite", sa.String(20), nullable=True),
        sa.Column("prix_unitaire", sa.Numeric(15, 2), server_default="0", nullable=True),
        sa.Column("montant", sa.Numeric(15, 2), server_default="0", nullable=True),
        sa.Column("observations", sa.Text, nullable=True),
        sa.Column("is_deleted", sa.Boolean, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("idx_lignes_situation_id", "lignes_situation", ["situation_id"])


def downgrade() -> None:
    # 5. lignes_situation
    op.drop_index("idx_lignes_situation_id", table_name="lignes_situation")
    op.drop_table("lignes_situation")

    # 4. situations_travaux
    op.drop_index("idx_situations_numero", table_name="situations_travaux")
    op.drop_index("idx_situations_contrat_id", table_name="situations_travaux")
    op.drop_index("idx_situations_chantier_id", table_name="situations_travaux")
    op.drop_index("idx_situations_entreprise_id", table_name="situations_travaux")
    op.drop_table("situations_travaux")

    # 3. metres
    op.drop_index("idx_metres_projet_id", table_name="metres")
    op.drop_index("idx_metres_entreprise_id", table_name="metres")
    op.drop_table("metres")

    # 2. projets
    op.drop_index("idx_projets_reference", table_name="projets")
    op.drop_index("idx_projets_demande_id", table_name="projets")
    op.drop_index("idx_projets_client_id", table_name="projets")
    op.drop_index("idx_projets_entreprise_id", table_name="projets")
    op.drop_table("projets")

    # 1. demandes_travaux
    op.drop_index("idx_demandes_numero", table_name="demandes_travaux")
    op.drop_index("idx_demandes_client_id", table_name="demandes_travaux")
    op.drop_index("idx_demandes_entreprise_id", table_name="demandes_travaux")
    op.drop_table("demandes_travaux")
