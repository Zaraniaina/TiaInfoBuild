"""initial schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-08-18 11:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("entreprises",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("nom_commercial", sa.String(255)),
        sa.Column("adresse", sa.Text),
        sa.Column("code_postal", sa.String(20)),
        sa.Column("ville", sa.String(100)),
        sa.Column("telephone", sa.String(50)),
        sa.Column("email", sa.String(255)),
        sa.Column("logo", sa.Text),
        sa.Column("abonnement", sa.String(50), server_default="gratuit"),
        sa.Column("devise", sa.String(10), server_default="MGA"),
        sa.Column("siret", sa.String(50)),
        sa.Column("numero_tva", sa.String(50)),
        sa.Column("code_ape", sa.String(20)),
        sa.Column("site_web", sa.String(255)),
        sa.Column("prefixe_devis", sa.String(10), server_default="DEV"),
        sa.Column("prefixe_facture", sa.String(10), server_default="FAC"),
        sa.Column("prefixe_contrat", sa.String(10), server_default="CTR"),
        sa.Column("tva_defaut", sa.Numeric(5, 2), server_default="20.00"),
        sa.Column("delai_paiement_defaut", sa.Integer, server_default="30"),
        sa.Column("validite_devis", sa.Integer, server_default="30"),
        sa.Column("mentions_legales", sa.Text),
        sa.Column("actif", sa.Boolean, server_default="1"),
        sa.Column("date_creation", sa.DateTime, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("roles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nom", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("permissions", sa.JSON, server_default="{}"),
        sa.Column("is_system", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("utilisateurs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id")),
        sa.Column("nom", sa.String(100), nullable=False),
        sa.Column("prenom", sa.String(100)),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("telephone", sa.String(50)),
        sa.Column("mot_de_passe_hash", sa.String(255), nullable=False),
        sa.Column("statut", sa.String(20), server_default="actif"),
        sa.Column("date_creation", sa.DateTime, server_default=sa.func.now()),
        sa.Column("derniere_connexion", sa.DateTime),
        sa.Column("must_change_password", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("preferences",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("utilisateurs.id", ondelete="CASCADE"), unique=True),
        sa.Column("theme", sa.String(20), server_default="auto"),
        sa.Column("langue", sa.String(10), server_default="fr"),
        sa.Column("date_format", sa.String(20), server_default="DD/MM/YYYY"),
        sa.Column("devise", sa.String(10), server_default="MGA"),
        sa.Column("notif_email", sa.Boolean, server_default="1"),
        sa.Column("notif_push", sa.Boolean, server_default="1"),
        sa.Column("notif_factures_retard", sa.Boolean, server_default="1"),
        sa.Column("notif_stock_bas", sa.Boolean, server_default="1"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("historique_connexions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("utilisateur_id", sa.Integer, sa.ForeignKey("utilisateurs.id", ondelete="SET NULL")),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.Text),
        sa.Column("reussi", sa.Boolean, server_default="1"),
        sa.Column("date_connexion", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("refresh_tokens",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("utilisateur_id", sa.Integer, sa.ForeignKey("utilisateurs.id", ondelete="CASCADE")),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("revoked", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("clients",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("type", sa.String(20), server_default="particulier"),
        sa.Column("civilite", sa.String(20)),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("prenom", sa.String(100)),
        sa.Column("entreprise", sa.String(255)),
        sa.Column("siret", sa.String(50)),
        sa.Column("numero_tva", sa.String(50)),
        sa.Column("email", sa.String(255)),
        sa.Column("telephone", sa.String(50)),
        sa.Column("portable", sa.String(50)),
        sa.Column("site_web", sa.String(255)),
        sa.Column("adresse", sa.Text),
        sa.Column("adresse_complement", sa.Text),
        sa.Column("code_postal", sa.String(20)),
        sa.Column("ville", sa.String(100)),
        sa.Column("pays", sa.String(100), server_default="Madagascar"),
        sa.Column("conditions_paiement", sa.Text),
        sa.Column("mode_paiement", sa.String(50)),
        sa.Column("encours_max", sa.Numeric(12, 2), server_default="0"),
        sa.Column("encours_actuel", sa.Numeric(12, 2), server_default="0"),
        sa.Column("commercial_id", sa.Integer, sa.ForeignKey("utilisateurs.id")),
        sa.Column("origine", sa.String(100)),
        sa.Column("rib", sa.Text),
        sa.Column("notes", sa.Text),
        sa.Column("ca_total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("dernier_contact", sa.DateTime),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_index("idx_utilisateurs_entreprise", "utilisateurs", ["entreprise_id"])
    op.create_index("idx_utilisateurs_email", "utilisateurs", ["email"])
    op.create_index("idx_utilisateurs_role", "utilisateurs", ["role_id"])


def downgrade() -> None:
    op.drop_index("idx_utilisateurs_role", table_name="utilisateurs")
    op.drop_index("idx_utilisateurs_email", table_name="utilisateurs")
    op.drop_index("idx_utilisateurs_entreprise", table_name="utilisateurs")
    op.drop_table("clients")
    op.drop_table("refresh_tokens")
    op.drop_table("historique_connexions")
    op.drop_table("preferences")
    op.drop_table("utilisateurs")
    op.drop_table("roles")
    op.drop_table("entreprises")
