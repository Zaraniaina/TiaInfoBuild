"""second migration: add chantiers, phases, incidents

Revision ID: 002_chantiers_schema
Revises: 001_initial_schema
Create Date: 2026-08-18 11:31:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "002_chantiers_schema"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("chantiers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id")),
        sa.Column("chef_chantier_id", sa.Integer, sa.ForeignKey("utilisateurs.id")),
        sa.Column("numero", sa.String(50)),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("adresse", sa.Text),
        sa.Column("code_postal", sa.String(20)),
        sa.Column("ville", sa.String(100)),
        sa.Column("date_debut", sa.Date),
        sa.Column("date_fin_prevue", sa.Date),
        sa.Column("date_fin_reelle", sa.Date),
        sa.Column("budget_prevu", sa.Numeric(12, 2), server_default="0"),
        sa.Column("budget_previsionnel", sa.Numeric(12, 2), server_default="0"),
        sa.Column("budget_reel", sa.Numeric(12, 2), server_default="0"),
        sa.Column("marge_cible", sa.Numeric(5, 2), server_default="0"),
        sa.Column("tva", sa.Numeric(5, 2), server_default="20.00"),
        sa.Column("statut", sa.String(20), server_default="planification"),
        sa.Column("description", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("phases",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id", ondelete="CASCADE")),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("date_debut", sa.Date),
        sa.Column("date_fin", sa.Date),
        sa.Column("budget", sa.Numeric(12, 2), server_default="0"),
        sa.Column("avancement_pct", sa.Integer, server_default="0"),
        sa.Column("statut", sa.String(20), server_default="non_commencee"),
        sa.Column("ordre", sa.Integer, server_default="0"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("incidents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id", ondelete="CASCADE")),
        sa.Column("declare_par", sa.Integer, sa.ForeignKey("utilisateurs.id")),
        sa.Column("titre", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("date_incident", sa.Date, server_default=sa.func.current_date()),
        sa.Column("gravite", sa.String(20), server_default="moyenne"),
        sa.Column("statut", sa.String(20), server_default="signale"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("affectation_ressources",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id", ondelete="CASCADE")),
        sa.Column("type_ressource", sa.String(20), nullable=False),
        sa.Column("ressource_id", sa.Integer, nullable=False),
        sa.Column("date_debut", sa.Date),
        sa.Column("date_fin", sa.Date),
        sa.Column("role", sa.String(100)),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_index("idx_chantiers_entreprise", "chantiers", ["entreprise_id"])
    op.create_index("idx_chantiers_client", "chantiers", ["client_id"])
    op.create_index("idx_chantiers_chef", "chantiers", ["chef_chantier_id"])


def downgrade() -> None:
    op.drop_index("idx_chantiers_chef", table_name="chantiers")
    op.drop_index("idx_chantiers_client", table_name="chantiers")
    op.drop_index("idx_chantiers_entreprise", table_name="chantiers")
    op.drop_table("affectation_ressources")
    op.drop_table("incidents")
    op.drop_table("phases")
    op.drop_table("chantiers")
