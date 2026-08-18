"""Schémas Pydantic pour l'entité Équipe et MembreEquipe."""
from datetime import date, datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class EquipeCreate(BaseModel):
    """Corps de la requête pour créer une équipe."""

    entreprise_id: int | None = None
    chef_equipe_id: int | None = None
    nom: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    specialite: str | None = Field(default=None, max_length=100)
    date_creation: date | None = None
    statut: str | None = Field(default="active", max_length=20)

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        allowed = {"active", "inactive", "suspendue"}
        if v is not None and v not in allowed:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class EquipeUpdate(BaseModel):
    """Corps de la requête pour modifier une équipe."""

    chef_equipe_id: int | None = None
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    specialite: str | None = Field(default=None, max_length=100)
    date_creation: date | None = None
    statut: str | None = None

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        allowed = {"active", "inactive", "suspendue"}
        if v is not None and v not in allowed:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class MembreEquipeCreate(BaseModel):
    """Corps de la requête pour ajouter un membre à une équipe."""

    equipe_id: int | None = None
    employe_id: int = Field(..., ge=1)
    date_debut: date | None = None
    date_fin: date | None = None
    role: str | None = Field(default=None, max_length=100)


class EquipeResponse(BaseModel):
    """Schéma de réponse pour une équipe (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    chef_equipe_id: int | None = None
    nom: str
    description: str | None = None
    specialite: str | None = None
    date_creation: date | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    membres: list[dict[str, Any]] | None = None
    chantiers_assignes: list[dict[str, Any]] | None = None


class EquipeList(BaseModel):
    """Schéma de réponse pour la liste paginée des équipes."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    chef_equipe_id: int | None = None
    nom: str
    specialite: str | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
