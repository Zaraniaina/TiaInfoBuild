"""fifth migration: finance, alertes, sync_queue tables + paiements table

Revision ID: 005_finance_alertes_sync
Revises: 004_remaining_modules
Create Date: 2026-08-18 11:34:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "005_finance_alertes_sync"
down_revision: Union[str, None] = "004_remaining_modules"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Paiements table (created here because it depends on factures from migration 004)
    op.create_table("paiements",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("facture_id", sa.Integer, sa.ForeignKey("factures.id", ondelete="CASCADE")),
        sa.Column("montant", sa.Numeric(12, 2), nullable=False),
        sa.Column("date_paiement", sa.Date, server_default=sa.func.current_date()),
        sa.Column("mode_paiement", sa.String(50)),
        sa.Column("reference", sa.String(100)),
        sa.Column("banque", sa.String(100)),
        sa.Column("notes", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Finance tables
    op.create_table("depenses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id")),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("montant", sa.Numeric(12, 2), nullable=False),
        sa.Column("date_depense", sa.Date, server_default=sa.func.current_date()),
        sa.Column("categorie", sa.String(100)),
        sa.Column("statut", sa.String(20), server_default="en_attente"),
        sa.Column("fournisseur", sa.String(255)),
        sa.Column("taux_tva", sa.Numeric(5, 2), server_default="20.00"),
        sa.Column("numero_facture", sa.String(100)),
        sa.Column("mode_paiement", sa.String(50)),
        sa.Column("validee_par", sa.Integer, sa.ForeignKey("utilisateurs.id")),
        sa.Column("notes", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("rapports_financiers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id")),
        sa.Column("periode", sa.String(20)),
        sa.Column("chiffre_affaires", sa.Numeric(12, 2), server_default="0"),
        sa.Column("depenses_total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("marge", sa.Numeric(12, 2), server_default="0"),
        sa.Column("date_generation", sa.DateTime, server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Alertes tables
    op.create_table("alertes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("titre", sa.String(255), nullable=False),
        sa.Column("message", sa.Text),
        sa.Column("type_entite", sa.String(50)),
        sa.Column("entite_id", sa.Integer),
        sa.Column("niveau_gravite", sa.String(20), server_default="info"),
        sa.Column("statut", sa.String(20), server_default="non_lue"),
        sa.Column("lue", sa.Boolean, server_default="0"),
        sa.Column("date_lecture", sa.DateTime),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Sync queue table
    op.create_table("sync_queue",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("table_name", sa.String(100), nullable=False),
        sa.Column("record_id", sa.Integer, nullable=False),
        sa.Column("server_id", sa.Integer),
        sa.Column("operation", sa.String(20), nullable=False),
        sa.Column("payload", sa.JSON),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("retry_count", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Finance indexes
    op.create_index("idx_paiements_facture", "paiements", ["facture_id"])
    op.create_index("idx_depenses_entreprise", "depenses", ["entreprise_id"])
    op.create_index("idx_depenses_chantier", "depenses", ["chantier_id"])
    op.create_index("idx_depenses_categorie", "depenses", ["categorie"])
    op.create_index("idx_depenses_date", "depenses", ["date_depense"])
    op.create_index("idx_depenses_validee_par", "depenses", ["validee_par"])
    op.create_index("idx_depenses_statut", "depenses", ["statut"])

    # Alertes indexes
    op.create_index("idx_alertes_entreprise", "alertes", ["entreprise_id"])
    op.create_index("idx_alertes_statut", "alertes", ["statut"])
    op.create_index("idx_alertes_lue", "alertes", ["lue"])
    op.create_index("idx_alertes_gravite", "alertes", ["niveau_gravite"])
    op.create_index("idx_alertes_type_entite", "alertes", ["type_entite"])

    # Sync queue indexes
    op.create_index("idx_sync_queue_status", "sync_queue", ["status"])
    op.create_index("idx_sync_queue_table_record", "sync_queue", ["table_name", "record_id"])
    op.create_index("idx_sync_queue_created", "sync_queue", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_paiements_facture", table_name="paiements")
    op.drop_index("idx_sync_queue_created", table_name="sync_queue")
    op.drop_index("idx_sync_queue_table_record", table_name="sync_queue")
    op.drop_index("idx_sync_queue_status", table_name="sync_queue")
    op.drop_index("idx_alertes_type_entite", table_name="alertes")
    op.drop_index("idx_alertes_gravite", table_name="alertes")
    op.drop_index("idx_alertes_lue", table_name="alertes")
    op.drop_index("idx_alertes_statut", table_name="alertes")
    op.drop_index("idx_alertes_entreprise", table_name="alertes")
    op.drop_index("idx_depenses_statut", table_name="depenses")
    op.drop_index("idx_depenses_validee_par", table_name="depenses")
    op.drop_index("idx_depenses_date", table_name="depenses")
    op.drop_index("idx_depenses_categorie", table_name="depenses")
    op.drop_index("idx_depenses_chantier", table_name="depenses")
    op.drop_index("idx_depenses_entreprise", table_name="depenses")

    op.drop_table("sync_queue")
    op.drop_table("alertes")
    op.drop_table("rapports_financiers")
    op.drop_table("depenses")
    op.drop_table("paiements")
