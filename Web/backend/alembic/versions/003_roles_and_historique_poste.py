"""third migration: add roles seed, historique_poste, employes

Revision ID: 003_roles_and_historique_poste
Revises: 002_chantiers_schema
Create Date: 2026-08-18 11:32:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import json


revision: str = "003_roles_and_historique_poste"
down_revision: Union[str, None] = "002_chantiers_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLES_SEED = [
    {
        "nom": "Super Admin",
        "description": "Propriétaire de la plateforme SaaS - gère toutes les entreprises",
        "code": "super_admin",
        "permissions": {
            "entreprises": "*", "utilisateurs": "*", "chantiers": "*",
            "employes": "*", "pointages": "*", "equipes": "*",
            "heures_sup": "*", "articles": "*", "mouvements_stock": "*",
            "fournisseurs": "*", "clients": "*", "devis": "*",
            "contrats": "*", "factures": "*", "paiements": "*",
            "depenses": "*", "materiels": "*", "maintenances": "*",
            "alertes": "*", "rapports": "*", "parametres": "*"
        },
        "is_system": True,
    },
    {
        "nom": "Admin Entreprise",
        "description": "Administrateur d'une entreprise cliente",
        "code": "admin_entreprise",
        "permissions": {
            "entreprises": "read,write", "utilisateurs": "read,write,delete",
            "chantiers": "*", "phases": "*", "incidents": "*",
            "employes": "*", "pointages": "*", "heures_sup": "*",
            "equipes": "*", "historique_postes": "*",
            "materiels": "*", "maintenances": "*", "alertes_materiel": "*",
            "articles": "*", "mouvements_stock": "*", "fournisseurs": "*",
            "clients": "*", "client_adresses": "*", "devis": "*",
            "lignes_devis": "*", "contrats": "*", "factures": "*",
            "paiements": "*", "depenses": "*", "rapports": "*",
            "alertes": "*", "parametres": "read,write",
            "historique_connexions": "read", "dashboard": "*", "sync": "*"
        },
        "is_system": True,
    },
    {
        "nom": "Directeur",
        "description": "Direction générale - consultation et validation",
        "code": "directeur",
        "permissions": {
            "dashboard": "read", "chantiers": "read", "phases": "read",
            "incidents": "read", "employes": "read", "pointages": "read",
            "heures_sup": "read", "equipes": "read", "materiels": "read",
            "articles": "read", "clients": "read", "devis": "read",
            "contrats": "read", "factures": "read", "paiements": "read",
            "depenses": "read", "rapports": "read", "alertes": "read",
            "historique_connexions": "read"
        },
        "is_system": True,
    },
    {
        "nom": "Chef de Chantier",
        "description": "Gestion terrain et équipes",
        "code": "chef_chantier",
        "permissions": {
            "chantiers": "read,write", "phases": "read,write",
            "incidents": "read,write", "employes": "read",
            "pointages": "read,write", "heures_sup": "read,write",
            "equipes": "read", "materiels": "read", "affectations": "read,write",
            "articles": "read", "mouvements_stock": "read",
            "depenses": "read", "alertes": "read", "dashboard": "read"
        },
        "is_system": True,
    },
    {
        "nom": "Chef de Projet",
        "description": "Supervision projets multiples",
        "code": "chef_projet",
        "permissions": {
            "dashboard": "read", "chantiers": "read,write",
            "phases": "read,write", "incidents": "read,write",
            "employes": "read", "equipes": "read", "affectations": "read,write",
            "clients": "read", "devis": "read", "factures": "read",
            "paiements": "read", "depenses": "read", "rapports": "read"
        },
        "is_system": True,
    },
    {
        "nom": "Comptable",
        "description": "Gestion financière",
        "code": "comptable",
        "permissions": {
            "finance": "read,write", "factures": "read,write",
            "paiements": "read,write", "depenses": "read,write",
            "clients": "read", "fournisseurs": "read", "articles": "read",
            "mouvements_stock": "read", "rapports": "read",
            "alertes": "read", "dashboard": "read"
        },
        "is_system": True,
    },
    {
        "nom": "Responsable RH",
        "description": "Gestion ressources humaines",
        "code": "rh",
        "permissions": {
            "rh": "read,write", "employes": "read,write",
            "pointages": "read,write", "heures_sup": "read,write",
            "equipes": "read,write", "historique_postes": "read,write",
            "affectation_chantiers": "read,write", "membres_equipe": "read,write",
            "chantiers": "read", "alertes": "read", "dashboard": "read"
        },
        "is_system": True,
    },
    {
        "nom": "Responsable Matériel",
        "description": "Gestion matériels et maintenances",
        "code": "materiel",
        "permissions": {
            "materiels": "read,write", "maintenances": "read,write",
            "alertes_materiel": "read,write",
            "affectation_materiaux": "read,write", "chantiers": "read",
            "depenses": "read", "rapport_financier": "read",
            "alertes": "read", "dashboard": "read"
        },
        "is_system": True,
    },
    {
        "nom": "Magasinier",
        "description": "Gestion stocks",
        "code": "magasinier",
        "permissions": {
            "stocks": "read,write", "articles": "read,write",
            "mouvements_stock": "read,write", "fournisseurs": "read,write",
            "chantiers": "read", "clients": "read", "alertes": "read",
            "depenses": "read", "rapport_financier": "read", "dashboard": "read"
        },
        "is_system": True,
    },
    {
        "nom": "Commercial",
        "description": "Gestion commerciale",
        "code": "commercial",
        "permissions": {
            "commercial": "read,write", "clients": "read,write",
            "client_adresses": "read,write", "devis": "read,write",
            "lignes_devis": "read,write", "contrats": "read,write",
            "factures": "read,write", "paiements": "read,write",
            "chantiers": "read", "fournisseurs": "read", "articles": "read",
            "alertes": "read", "dashboard": "read"
        },
        "is_system": True,
    },
    {
        "nom": "Employé",
        "description": "Employé standard",
        "code": "employe",
        "permissions": {
            "rh": "read", "chantiers": "read",
            "pointages": "read,write", "heures_sup": "read,write"
        },
        "is_system": True,
    },
    {
        "nom": "Client",
        "description": "Accès lecture devis/factures",
        "code": "client",
        "permissions": {
            "commercial": "read", "devis": "read", "factures": "read"
        },
        "is_system": True,
    },
]


def upgrade() -> None:
    # Insert roles
    for role in ROLES_SEED:
        op.execute(
            sa.text(
                "INSERT INTO roles (nom, description, code, permissions, is_system, created_at, updated_at) "
                "VALUES (:nom, :description, :code, :permissions, :is_system, NOW(), NOW())"
            ),
            {
                "nom": role["nom"],
                "description": role["description"],
                "code": role["code"],
                "permissions": json.dumps(role["permissions"]),
                "is_system": role["is_system"],
            },
        )

    # Create employes table (depends on entreprises)
    op.create_table("employes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("matricule", sa.String(50)),
        sa.Column("nom", sa.String(100), nullable=False),
        sa.Column("prenom", sa.String(100)),
        sa.Column("poste", sa.String(100)),
        sa.Column("photo", sa.Text),
        sa.Column("date_embauche", sa.Date),
        sa.Column("type_contrat", sa.String(20), server_default="CDI"),
        sa.Column("date_debut_contrat", sa.Date),
        sa.Column("date_fin_contrat", sa.Date),
        sa.Column("salaire_base", sa.Numeric(10, 2), server_default="0"),
        sa.Column("telephone", sa.String(50)),
        sa.Column("email", sa.String(255)),
        sa.Column("adresse", sa.Text),
        sa.Column("statut", sa.String(20), server_default="actif"),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Create historique_postes table
    op.create_table("historique_postes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entreprise_id", sa.Integer, sa.ForeignKey("entreprises.id", ondelete="CASCADE")),
        sa.Column("employe_id", sa.Integer, sa.ForeignKey("employes.id", ondelete="CASCADE")),
        sa.Column("poste", sa.String(100), nullable=False),
        sa.Column("type_contrat", sa.String(20)),
        sa.Column("salaire_base", sa.Numeric(10, 2), server_default="0"),
        sa.Column("date_debut", sa.Date, nullable=False),
        sa.Column("date_fin", sa.Date),
        sa.Column("motif_changement", sa.Text),
        sa.Column("is_deleted", sa.Boolean, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_index("idx_employes_entreprise", "employes", ["entreprise_id"])
    op.create_index("idx_employes_nom", "employes", ["nom", "prenom"])
    op.create_index("idx_historique_postes_employe", "historique_postes", ["employe_id"])


def downgrade() -> None:
    for role in ROLES_SEED:
        op.execute(
            sa.text("DELETE FROM roles WHERE code = :code"),
            {"code": role["code"]},
        )

    op.drop_index("idx_historique_postes_employe", table_name="historique_postes")
    op.drop_index("idx_employes_nom", table_name="employes")
    op.drop_index("idx_employes_entreprise", table_name="employes")
    op.drop_table("historique_postes")
    op.drop_table("employes")
