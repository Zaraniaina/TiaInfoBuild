"""Schémas Pydantic pour l'entité Projet."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class ProjetCreate(BaseModel):
    """Corps de la requête pour créer un projet."""

    entreprise_id: int | None = None
    client_id: int | None = None
    demande_id: int | None = None
    responsable_id: int | None = None
    nom: str = Field(..., min_length=1, max_length=255)
    type_projet: str | None = Field(default=None, max_length=50)
    description: str | None = None
    localisation: str | None = Field(default=None, max_length=255)
    adresse: str | None = Field(default=None, max_length=255)
    longueur: float | None = None
    largeur: float | None = None
    hauteur: float | None = None
    surface: float | None = None
    volume: float | None = None
    nombre_niveaux: int | None = None
    plans_documents: str | None = None
    observations: str | None = None
    statut: str | None = "en_etude"

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"en_etude", "valide", "en_cours", "termine", "annule"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class ProjetUpdate(BaseModel):
    """Corps de la requête pour modifier un projet."""

    nom: str | None = Field(default=None, min_length=1, max_length=255)
    type_projet: str | None = None
    description: str | None = None
    localisation: str | None = None
    adresse: str | None = None
    longueur: float | None = None
    largeur: float | None = None
    hauteur: float | None = None
    surface: float | None = None
    volume: float | None = None
    nombre_niveaux: int | None = None
    plans_documents: str | None = None
    observations: str | None = None
    statut: str | None = None
    client_id: int | None = None
    responsable_id: int | None = None

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"en_etude", "valide", "en_cours", "termine", "annule"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class ProjetResponse(BaseModel):
    """Schéma de réponse pour un projet."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    demande_id: int | None = None
    responsable_id: int | None = None
    reference: str | None = None
    nom: str
    type_projet: str | None = None
    description: str | None = None
    localisation: str | None = None
    adresse: str | None = None
    longueur: float | None = None
    largeur: float | None = None
    hauteur: float | None = None
    surface: float | None = None
    volume: float | None = None
    nombre_niveaux: int | None = None
    plans_documents: str | None = None
    observations: str | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjetList(BaseModel):
    """Schéma de réponse pour la liste paginée des projets."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    demande_id: int | None = None
    reference: str | None = None
    nom: str
    type_projet: str | None = None
    localisation: str | None = None
    surface: float | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
