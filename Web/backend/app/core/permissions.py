"""Core: permissions RBAC (mapping rôles → permissions)."""
from typing import Final

__all__ = ["Role", "PERMISSION_MAP", "ROLE_NAMES"]


class Role:
    SUPER_ADMIN = "super_admin"
    ADMIN_ENTREPRISE = "admin_entreprise"
    DIRECTEUR = "directeur"
    CHEF_CHANTIER = "chef_chantier"
    CHEF_PROJET = "chef_projet"
    COMPTABLE = "comptable"
    RH = "rh"
    MATERIEL = "materiel"
    MAGASINIER = "magasinier"
    COMMERCIAL = "commercial"
    EMPLOYE = "employe"
    CLIENT = "client"


ROLE_NAMES: Final[dict[str, str]] = {
    Role.SUPER_ADMIN: "Super Admin",
    Role.ADMIN_ENTREPRISE: "Admin Entreprise",
    Role.DIRECTEUR: "Direction Générale",
    Role.CHEF_CHANTIER: "Chef de Chantier",
    Role.CHEF_PROJET: "Chef de Projet",
    Role.COMPTABLE: "Comptable",
    Role.RH: "Responsable RH",
    Role.MATERIEL: "Responsable Matériel",
    Role.MAGASINIER: "Magasinier",
    Role.COMMERCIAL: "Commercial",
    Role.EMPLOYE: "Employé",
    Role.CLIENT: "Client",
}

ALL_PERMISSIONS: Final[list[str]] = [
    "dashboard:read",
    "chantiers:read", "chantiers:write", "chantiers:delete", "chantiers:create",
    "rh:read", "rh:write", "rh:delete",
    "stocks:read", "stocks:write", "stocks:delete",
    "commercial:read", "commercial:write", "commercial:delete",
    "finance:read", "finance:write", "finance:delete",
    "materiels:read", "materiels:write", "materiels:delete",
    "alertes:read", "alertes:write",
    "parametres:read", "parametres:write",
    # Permissions fines pour les workflows terrain et abonnement
    "pointage:write", "taches:write", "consommation:write",
    "subscriptions:read", "subscriptions:write",
    "espace_client:read", "espace_client:write",
    "employe_terrain:read", "employe_terrain:write",
    "super_admin:read", "super_admin:write",
]

PERMISSION_MAP: Final[dict[str, list[str]]] = {
    Role.SUPER_ADMIN: ["*"],
    # Restreint selon roles_tia_builds/01_admin_entreprise.md :
    # accès uniquement à la lecture du dashboard et à la lecture/écriture
    # des paramètres (gestion utilisateurs, settings, audit logs).
    # Aucun accès aux modules métier (Finance, Chantiers, RH, Matériel,
    # Stocks, Commercial) — périmètre strictement administratif.
    Role.ADMIN_ENTREPRISE: [
        "dashboard:read",
        "parametres:read", "parametres:write",
        # gestion abonnement / offre du tenant
        "subscriptions:read",
        "subscriptions:write",
    ],
    Role.DIRECTEUR: [
        "dashboard:read",
        "chantiers:read",
        "finance:read",
        "commercial:read",
        "rh:read",
        "materiels:read",
        "stocks:read",
        "alertes:read",
    ],
    Role.CHEF_CHANTIER: [
        "dashboard:read",
        "chantiers:read", "chantiers:write",
        "rh:read", "rh:write",
        "materiels:read",
        "stocks:read", "stocks:write",
        "finance:read",
        "alertes:read",
        # pointage et déclarations terrain
        "pointage:write", "taches:write", "consommation:write",
    ],
    Role.CHEF_PROJET: [
        "dashboard:read",
        "chantiers:read", "chantiers:write", "chantiers:create",
        "rh:read", "rh:write",
        "materiels:read", "materiels:write",
        "stocks:read",
        "finance:read",
        "alertes:read",
        # validation / supervision des pointages et tâches de son périmètre
        "pointage:write", "taches:write",
    ],
    Role.COMPTABLE: [
        "dashboard:read",
        "finance:read", "finance:write",
        "commercial:read", "commercial:write",
        "chantiers:read",
        "rh:read",
        "alertes:read",
    ],
    Role.RH: [
        "dashboard:read",
        "rh:read", "rh:write", "rh:delete",
        "chantiers:read",
        "alertes:read",
        # validation des pointages et gestion des heures
        "pointage:write",
    ],
    Role.MATERIEL: [
        "dashboard:read",
        "materiels:read", "materiels:write", "materiels:delete",
        "chantiers:read",
        "alertes:read",
    ],
    Role.MAGASINIER: [
        "dashboard:read",
        "stocks:read", "stocks:write", "stocks:delete",
        "chantiers:read",
        "alertes:read",
        # pointage dépôt (QR code fixe) et déclarations de sortie
        "pointage:write", "consommation:write",
    ],
    Role.COMMERCIAL: [
        "dashboard:read",
        "commercial:read", "commercial:write", "commercial:delete",
        "chantiers:read",
        "finance:read",
        "alertes:read",
    ],
    Role.EMPLOYE: [
        "rh:read",
        "chantiers:read",
        "materiels:read",
        "stocks:read",
        "alertes:read",
        # actions limitées au niveau individuel : pointage, tâches, consommation
        "pointage:write", "taches:write", "consommation:write",
        # espace employe terrain : consultation + declarations
        "employe_terrain:read", "employe_terrain:write",
    ],
    Role.CLIENT: [
        # Espace Client : uniquement les donnees de sa propre fiche (router dedie).
        # PAS d'acces commercial:read / chantiers:read / dashboard:read
        # (donnees internes de l'entreprise / stats globales).
        "espace_client:read", "espace_client:write",
    ],
}
