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
    "chantiers:read", "chantiers:write", "chantiers:delete",
    "rh:read", "rh:write", "rh:delete",
    "stocks:read", "stocks:write", "stocks:delete",
    "commercial:read", "commercial:write", "commercial:delete",
    "finance:read", "finance:write", "finance:delete",
    "materiels:read", "materiels:write", "materiels:delete",
    "alertes:read", "alertes:write",
    "parametres:read", "parametres:write",
    "super_admin:read", "super_admin:write",
]

PERMISSION_MAP: Final[dict[str, list[str]]] = {
    Role.SUPER_ADMIN: ["*"],
    Role.ADMIN_ENTREPRISE: ALL_PERMISSIONS,
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
    ],
    Role.CHEF_PROJET: [
        "dashboard:read",
        "chantiers:read", "chantiers:write", "chantiers:delete",
        "rh:read", "rh:write",
        "materiels:read", "materiels:write", "materiels:delete",
        "stocks:read",
        "finance:read",
        "alertes:read",
    ],
    Role.COMPTABLE: [
        "dashboard:read",
        "finance:read", "finance:write", "finance:delete",
        "commercial:read",
        "chantiers:read",
        "rh:read",
        "alertes:read",
    ],
    Role.RH: [
        "dashboard:read",
        "rh:read", "rh:write", "rh:delete",
        "chantiers:read",
        "alertes:read",
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
    ],
    Role.COMMERCIAL: [
        "dashboard:read",
        "commercial:read", "commercial:write", "commercial:delete",
        "chantiers:read",
        "finance:read",
        "alertes:read",
    ],
    Role.EMPLOYE: [
        "dashboard:read",
        "rh:read",
        "chantiers:read",
        "materiels:read",
        "stocks:read", "stocks:write",
    ],
    Role.CLIENT: [
        "dashboard:read",
        "commercial:read",
        "chantiers:read",
    ],
}
