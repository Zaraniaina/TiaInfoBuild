"""Schémas Pydantic pour l'entité Depot (dépôt / zone de stockage BTP)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


TYPES_DEPOT_VALIDES = {"magasin_principal", "depot_chantier", "zone_exterieure", "armoire_outillage"}


class DepotCreate(BaseModel):
    """Corps de la requête pour créer un dépôt."""

    entreprise_id: int | None = None
    code: str | None = Field(default=None, max_length=50)
    nom: str = Field(..., min_length=1, max_length=255)
    adresse: str | None = None
    responsable: str | None = Field(default=None, max_length=255)
    telephone: str | None = Field(default=None, max_length=50)
    capacite_m2: float | None = None
    type: str = Field(default="magasin_principal", max_length=50)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in TYPES_DEPOT_VALIDES:
            raise ValueError(f"Type de dépôt invalide. Valeurs autorisées: {TYPES_DEPOT_VALIDES}")
        return v

    @field_validator("capacite_m2")
    @classmethod
    def validate_capacite(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La capacité ne peut pas être négative")
        return v


class DepotUpdate(BaseModel):
    """Corps de la requête pour modifier un dépôt."""

    code: str | None = Field(default=None, max_length=50)
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    adresse: str | None = None
    responsable: str | None = None
    telephone: str | None = None
    capacite_m2: float | None = None
    type: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None and v not in TYPES_DEPOT_VALIDES:
            raise ValueError(f"Type de dépôt invalide. Valeurs autorisées: {TYPES_DEPOT_VALIDES}")
        return v

    @field_validator("capacite_m2")
    @classmethod
    def validate_capacite(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La capacité ne peut pas être négative")
        return v


class DepotResponse(BaseModel):
    """Schéma de réponse complète pour un dépôt."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    code: str | None = None
    nom: str
    adresse: str | None = None
    responsable: str | None = None
    telephone: str | None = None
    capacite_m2: float | None = None
    type: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DepotList(BaseModel):
    """Schéma de réponse pour la liste paginée des dépôts."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    code: str | None = None
    nom: str
    adresse: str | None = None
    responsable: str | None = None
    telephone: str | None = None
    capacite_m2: float | None = None
    type: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
