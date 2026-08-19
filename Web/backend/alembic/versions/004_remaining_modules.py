"""fourth migration: remaining tables (RH, materiels, stocks, commercial)

Revision ID: 004_remaining_modules
Revises: 003_roles_and_historique_poste
Create Date: 2026-08-18 11:33:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "004_remaining_modules"
down_revision: Union[str, None] = "003_roles_and_historique_poste"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- RH Tables ---
    op.create_table("equipes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("chef_equipe_id", sa.Integer, sa.ForeignKey("employes.id")),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("specialite", sa.String(100)),
        sa.Column("date_creation", sa.Date, server_default=sa.func.current_date()),
        sa.Column("statut", sa.String(20), server_default="active"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("membres_equipe",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("equipe_id", sa.Integer, sa.ForeignKey("equipes.id", ondelete="CASCADE")),
        sa.Column("employe_id", sa.Integer, sa.ForeignKey("employes.id", ondelete="CASCADE")),
        sa.Column("date_debut", sa.Date, server_default=sa.func.current_date()),
        sa.Column("date_fin", sa.Date),
        sa.Column("role", sa.String(100)),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("equipe_id", "employe_id", "date_debut", name="uq_membre_equipe"),
    )

    op.create_table("affectation_chantiers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("employe_id", sa.Integer, sa.ForeignKey("employes.id", ondelete="CASCADE")),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id", ondelete="CASCADE")),
        sa.Column("date_debut", sa.Date),
        sa.Column("date_fin", sa.Date),
        sa.Column("role", sa.String(100)),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("pointages",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("employe_id", sa.Integer, sa.ForeignKey("employes.id", ondelete="CASCADE")),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id")),
        sa.Column("date_jour", sa.Date, nullable=False),
        sa.Column("heure_debut", sa.Time),
        sa.Column("heure_fin", sa.Time),
        sa.Column("heures_total", sa.Numeric(4, 2), server_default="0"),
        sa.Column("type", sa.String(20), server_default="present"),
        sa.Column("notes", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("employe_id", "date_jour", name="uq_pointage_unicte"),
    )

    op.create_table("heures_supplementaires",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("employe_id", sa.Integer, sa.ForeignKey("employes.id", ondelete="CASCADE")),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id")),
        sa.Column("date_hs", sa.Date, nullable=False),
        sa.Column("nb_heures", sa.Numeric(4, 2), server_default="0"),
        sa.Column("taux_majoration", sa.Numeric(4, 2), server_default="1.5"),
        sa.Column("motif", sa.Text),
        sa.Column("statut", sa.String(20), server_default="en_attente"),
        sa.Column("type_compensation", sa.String(20), server_default="paiement"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # --- Matériels Tables ---
    op.create_table("materiaux",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("designation", sa.String(255)),
        sa.Column("type", sa.String(100)),
        sa.Column("marque", sa.String(100)),
        sa.Column("modele", sa.String(100)),
        sa.Column("numero_serie", sa.String(100)),
        sa.Column("date_acquisition", sa.Date),
        sa.Column("valeur_achat", sa.Numeric(12, 2), server_default="0"),
        sa.Column("description", sa.Text),
        sa.Column("statut", sa.String(20), server_default="disponible"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("affectation_materiaux",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("materiel_id", sa.Integer, sa.ForeignKey("materiaux.id", ondelete="CASCADE")),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id", ondelete="CASCADE")),
        sa.Column("date_debut", sa.Date),
        sa.Column("date_fin", sa.Date),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("maintenances",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("materiel_id", sa.Integer, sa.ForeignKey("materiaux.id", ondelete="CASCADE")),
        sa.Column("date_maintenance", sa.Date, nullable=False),
        sa.Column("type", sa.String(50)),
        sa.Column("cout", sa.Numeric(10, 2), server_default="0"),
        sa.Column("description", sa.Text),
        sa.Column("prochaine_date_echeance", sa.Date),
        sa.Column("technicien", sa.String(255)),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("alertes_materiel",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("materiel_id", sa.Integer, sa.ForeignKey("materiaux.id")),
        sa.Column("type", sa.String(50)),
        sa.Column("message", sa.Text),
        sa.Column("date_alerte", sa.DateTime, server_default=sa.func.now()),
        sa.Column("statut", sa.String(20), server_default="ouverte"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # --- Stocks Tables ---
    op.create_table("fournisseurs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("contact", sa.String(255)),
        sa.Column("email", sa.String(255)),
        sa.Column("telephone", sa.String(50)),
        sa.Column("adresse", sa.Text),
        sa.Column("code_postal", sa.String(20)),
        sa.Column("ville", sa.String(100)),
        sa.Column("pays", sa.String(100), server_default="Madagascar"),
        sa.Column("siret", sa.String(50)),
        sa.Column("conditions_paiement", sa.Text),
        sa.Column("notes", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("articles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("reference", sa.String(100), nullable=False, unique=True),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("categorie", sa.String(100)),
        sa.Column("unite", sa.String(20), server_default="unite"),
        sa.Column("stock_actuel", sa.Numeric(10, 2), server_default="0"),
        sa.Column("seuil_alerte", sa.Numeric(10, 2), server_default="0"),
        sa.Column("stock_mini", sa.Numeric(10, 2), server_default="0"),
        sa.Column("prix_achat", sa.Numeric(10, 2), server_default="0"),
        sa.Column("prix_vente", sa.Numeric(10, 2), server_default="0"),
        sa.Column("marge", sa.Numeric(5, 2), server_default="0"),
        sa.Column("tva", sa.Numeric(5, 2), server_default="20.00"),
        sa.Column("poids", sa.Numeric(10, 2)),
        sa.Column("fournisseur_id", sa.Integer, sa.ForeignKey("fournisseurs.id")),
        sa.Column("code_barre", sa.String(100)),
        sa.Column("emplacement", sa.String(100)),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("mouvements_stock",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("article_id", sa.Integer, sa.ForeignKey("articles.id", ondelete="CASCADE")),
        sa.Column("type_mouvement", sa.String(20), nullable=False),
        sa.Column("date_mouvement", sa.DateTime, server_default=sa.func.now()),
        sa.Column("quantite", sa.Numeric(10, 2), nullable=False),
        sa.Column("prix_unitaire", sa.Numeric(10, 2), server_default="0"),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id")),
        sa.Column("fournisseur_id", sa.Integer, sa.ForeignKey("fournisseurs.id")),
        sa.Column("reference", sa.String(100)),
        sa.Column("notes", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # --- Commercial Tables ---
    op.create_table("client_adresses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE")),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("defaut", sa.Boolean, server_default="0"),
        sa.Column("ligne1", sa.String(255), nullable=False),
        sa.Column("ligne2", sa.String(255)),
        sa.Column("code_postal", sa.String(20)),
        sa.Column("ville", sa.String(100)),
        sa.Column("pays", sa.String(100), server_default="Madagascar"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("devis",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE")),
        sa.Column("numero", sa.String(50), nullable=False, unique=True),
        sa.Column("objet", sa.Text),
        sa.Column("montant_ht", sa.Numeric(12, 2), server_default="0"),
        sa.Column("tva", sa.Numeric(5, 2), server_default="20.00"),
        sa.Column("montant_ttc", sa.Numeric(12, 2), server_default="0"),
        sa.Column("date_creation", sa.Date, server_default=sa.func.current_date()),
        sa.Column("date_validite", sa.Date),
        sa.Column("statut", sa.String(20), server_default="brouillon"),
        sa.Column("conditions_paiement", sa.Text),
        sa.Column("mode_paiement", sa.String(50)),
        sa.Column("notes", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("lignes_devis",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("devis_id", sa.Integer, sa.ForeignKey("devis.id", ondelete="CASCADE")),
        sa.Column("type", sa.String(20), server_default="article"),
        sa.Column("article_id", sa.Integer, sa.ForeignKey("articles.id")),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("quantite", sa.Numeric(10, 2), server_default="0"),
        sa.Column("unite", sa.String(20)),
        sa.Column("prix_unitaire", sa.Numeric(10, 2), server_default="0"),
        sa.Column("remise", sa.Numeric(5, 2), server_default="0"),
        sa.Column("taux_tva", sa.Numeric(5, 2), server_default="20.00"),
        sa.Column("total_ht", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_ttc", sa.Numeric(12, 2), server_default="0"),
        sa.Column("ordre", sa.Integer, server_default="0"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("contrats",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE")),
        sa.Column("reference", sa.String(50), nullable=False, unique=True),
        sa.Column("type_contrat", sa.String(50)),
        sa.Column("montant", sa.Numeric(12, 2), server_default="0"),
        sa.Column("date_debut", sa.Date),
        sa.Column("date_fin", sa.Date),
        sa.Column("statut", sa.String(20), server_default="en_cours"),
        sa.Column("chantier_id", sa.Integer, sa.ForeignKey("chantiers.id")),
        sa.Column("devis_id", sa.Integer, sa.ForeignKey("devis.id")),
        sa.Column("objet", sa.Text),
        sa.Column("conditions_paiement", sa.Text),
        sa.Column("date_signature", sa.Date),
        sa.Column("garantie_mois", sa.Integer, server_default="12"),
        sa.Column("notes", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table("factures",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("contrat_id", sa.Integer, sa.ForeignKey("contrats.id")),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE")),
        sa.Column("numero", sa.String(50), nullable=False, unique=True),
        sa.Column("type", sa.String(20), server_default="standard"),
        sa.Column("montant_ht", sa.Numeric(12, 2), server_default="0"),
        sa.Column("tva", sa.Numeric(5, 2), server_default="20.00"),
        sa.Column("montant_ttc", sa.Numeric(12, 2), server_default="0"),
        sa.Column("date_creation", sa.Date, server_default=sa.func.current_date()),
        sa.Column("date_emission", sa.Date),
        sa.Column("date_echeance", sa.Date),
        sa.Column("statut", sa.String(20), server_default="emis"),
        sa.Column("conditions_paiement", sa.Text),
        sa.Column("mode_paiement", sa.String(50)),
        sa.Column("notes", sa.Text),
        sa.Column("montant_paye", sa.Numeric(12, 2), server_default="0"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Index RH
    op.create_index("idx_employes_nom", "employes", ["nom", "prenom"], if_not_exists=True)
    op.create_index("idx_pointages_employe", "pointages", ["employe_id"], if_not_exists=True)
    op.create_index("idx_pointages_date", "pointages", ["date_jour"], if_not_exists=True)
    op.create_index("idx_pointages_chantier", "pointages", ["chantier_id"], if_not_exists=True)
    op.create_index("idx_heures_sup_employe", "heures_supplementaires", ["employe_id"], if_not_exists=True)
    op.create_index("idx_historique_postes_employe", "historique_postes", ["employe_id"], if_not_exists=True)

    # Index Matériels
    op.create_index("idx_materiel_entreprise", "materiaux", ["entreprise_id"])
    op.create_index("idx_materiel_statut", "materiaux", ["statut"])
    op.create_index("idx_maintenances_materiel", "maintenances", ["materiel_id"])

    # Index Stocks
    op.create_index("idx_articles_entreprise", "articles", ["entreprise_id"])
    op.create_index("idx_articles_reference", "articles", ["reference"])
    op.create_index("idx_articles_categorie", "articles", ["categorie"])
    op.create_index("idx_mouvements_article", "mouvements_stock", ["article_id"])
    op.create_index("idx_mouvements_date", "mouvements_stock", ["date_mouvement"])
    op.create_index("idx_fournisseurs_entreprise", "fournisseurs", ["entreprise_id"])

    # Index Commercial
    op.create_index("idx_clients_entreprise", "clients", ["entreprise_id"])
    op.create_index("idx_clients_commercial", "clients", ["commercial_id"])
    op.create_index("idx_clients_type", "clients", ["type"])
    op.create_index("idx_devis_entreprise", "devis", ["entreprise_id"])
    op.create_index("idx_devis_numero", "devis", ["numero"])
    op.create_index("idx_devis_statut", "devis", ["statut"])
    op.create_index("idx_factures_entreprise", "factures", ["entreprise_id"])
    op.create_index("idx_factures_client", "factures", ["client_id"])
    op.create_index("idx_factures_date_echeance", "factures", ["date_echeance"])
    op.create_index("idx_factures_statut", "factures", ["statut"])


def downgrade() -> None:
    op.drop_index("idx_factures_statut", table_name="factures")
    op.drop_index("idx_factures_date_echeance", table_name="factures")
    op.drop_index("idx_factures_client", table_name="factures")
    op.drop_index("idx_factures_entreprise", table_name="factures")
    op.drop_index("idx_devis_statut", table_name="devis")
    op.drop_index("idx_devis_numero", table_name="devis")
    op.drop_index("idx_devis_entreprise", table_name="devis")
    op.drop_index("idx_clients_type", table_name="clients")
    op.drop_index("idx_clients_commercial", table_name="clients")
    op.drop_index("idx_clients_entreprise", table_name="clients")
    op.drop_index("idx_mouvements_date", table_name="mouvements_stock")
    op.drop_index("idx_mouvements_article", table_name="mouvements_stock")
    op.drop_index("idx_articles_categorie", table_name="articles")
    op.drop_index("idx_articles_reference", table_name="articles")
    op.drop_index("idx_articles_entreprise", table_name="articles")
    op.drop_index("idx_maintenances_materiel", table_name="maintenances")
    op.drop_index("idx_materiel_statut", table_name="materiaux")
    op.drop_index("idx_materiel_entreprise", table_name="materiaux")
    op.drop_index("idx_historique_postes_employe", table_name="historique_postes")
    op.drop_index("idx_heures_sup_employe", table_name="heures_supplementaires")
    op.drop_index("idx_pointages_chantier", table_name="pointages")
    op.drop_index("idx_pointages_date", table_name="pointages")
    op.drop_index("idx_pointages_employe", table_name="pointages")
    op.drop_index("idx_employes_nom", table_name="employes")

    op.drop_table("factures")
    op.drop_table("contrats")
    op.drop_table("lignes_devis")
    op.drop_table("devis")
    op.drop_table("client_adresses")
    op.drop_table("mouvements_stock")
    op.drop_table("articles")
    op.drop_table("fournisseurs")
    op.drop_table("alertes_materiel")
    op.drop_table("maintenances")
    op.drop_table("affectation_materiaux")
    op.drop_table("materiaux")
    op.drop_table("heures_supplementaires")
    op.drop_table("pointages")
    op.drop_table("affectation_chantiers")
    op.drop_table("membres_equipe")
    op.drop_table("equipes")
