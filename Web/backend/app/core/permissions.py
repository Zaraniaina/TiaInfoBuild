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
    ],
    Role.CHEF_CHANTIER: [
        "chantiers:read", "chantiers:write",
        "rh:read", "rh:write",
        "materiels:read", "stocks:read",
    ],
    Role.CHEF_PROJET: [
        "chantiers:read", "chantiers:write",
        "dashboard:read",
    ],
    Role.COMPTABLE: [
        "finance:read", "finance:write",
        "commercial:read",
    ],
    Role.RH: [
        "rh:read", "rh:write", "rh:delete",
    ],
    Role.MATERIEL: [
        "materiels:read", "materiels:write", "materiels:delete",
        "alertes:read",
    ],
    Role.MAGASINIER: [
        "stocks:read", "stocks:write", "stocks:delete",
    ],
    Role.COMMERCIAL: [
        "commercial:read", "commercial:write", "commercial:delete",
    ],
    Role.EMPLOYE: [
        "rh:read",
        "chantiers:read",
    ],
    Role.CLIENT: [
        "commercial:read",
    ],
}
