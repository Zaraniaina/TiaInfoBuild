"""Schémas Pydantic pour l'entité Utilisateur (RBAC, multi-tenant)."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class UtilisateurCreate(BaseModel):
    """Corps de la requête pour créer un utilisateur."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    nom: str = Field(..., min_length=1, max_length=100)
    prenom: str | None = Field(default=None, max_length=100)
    telephone: str | None = Field(default=None, max_length=50)
    entreprise_id: int | None = None
    role_id: int | None = None
    role_code: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        import re

        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not re.search(r"[a-z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not re.search(r"[0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return v


class UtilisateurUpdate(BaseModel):
    """Corps de la requête pour modifier un utilisateur."""

    nom: str | None = Field(default=None, min_length=1, max_length=100)
    prenom: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = Field(default=None)
    telephone: str | None = Field(default=None, max_length=50)
    photo: str | None = Field(default=None)
    role_id: int | None = None
    role_code: str | None = None
    entreprise_id: int | None = None
    statut: str | None = Field(default=None, max_length=20)

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        allowed = {"actif", "inactif", "invite", "suspendu"}
        if v is not None and v not in allowed:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class UtilisateurRoleUpdate(BaseModel):
    """Corps de la requête pour changer le rôle d'un utilisateur."""

    role_id: int = Field(..., ge=1)


class RoleSimpleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    nom: str


class UtilisateurResponse(BaseModel):
    """Schéma de réponse pour un utilisateur (détail)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    role_id: int | None = None
    role_code: str | None = None
    role_nom: str | None = None
    role: RoleSimpleResponse | None = None
    nom: str
    prenom: str | None = None
    email: EmailStr
    telephone: str | None = None
    photo: str | None = None
    statut: str | None = None
    date_creation: datetime | None = None
    derniere_connexion: datetime | None = None
    must_change_password: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UtilisateurList(BaseModel):
    """Schéma de réponse pour la liste paginée des utilisateurs."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str
    prenom: str | None = None
    email: EmailStr
    telephone: str | None = None
    role_id: int | None = None
    role_code: str | None = None
    role_nom: str | None = None
    role: RoleSimpleResponse | None = None
    statut: str | None = None
    entreprise_id: int | None = None
    date_creation: datetime | None = None
