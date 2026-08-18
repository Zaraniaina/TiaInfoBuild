"""Schémas Pydantic pour l'entité Fournisseur."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
)


class FournisseurCreate(BaseModel):
    """Corps de la requête pour créer un fournisseur."""

    entreprise_id: int | None = None
    nom: str = Field(..., min_length=1, max_length=255)
    contact: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    telephone: str | None = Field(default=None, max_length=50)
    adresse: str | None = None
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    pays: str | None = Field(default="Madagascar", max_length=100)
    siret: str | None = Field(default=None, max_length=50)
    conditions_paiement: str | None = None
    notes: str | None = None


class FournisseurUpdate(BaseModel):
    """Corps de la requête pour modifier un fournisseur."""

    nom: str | None = Field(default=None, min_length=1, max_length=255)
    contact: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    telephone: str | None = Field(default=None, max_length=50)
    adresse: str | None = None
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    pays: str | None = Field(default=None, max_length=100)
    siret: str | None = Field(default=None, max_length=50)
    conditions_paiement: str | None = None
    notes: str | None = None


class FournisseurResponse(BaseModel):
    """Schéma de réponse pour un fournisseur (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    nom: str
    contact: str | None = None
    email: EmailStr | None = None
    telephone: str | None = None
    adresse: str | None = None
    code_postal: str | None = None
    ville: str | None = None
    pays: str | None = None
    siret: str | None = None
    conditions_paiement: str | None = None
    notes: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class FournisseurList(BaseModel):
    """Schéma de réponse pour la liste paginée des fournisseurs."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    nom: str
    contact: str | None = None
    email: EmailStr | None = None
    telephone: str | None = None
    ville: str | None = None
    pays: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
