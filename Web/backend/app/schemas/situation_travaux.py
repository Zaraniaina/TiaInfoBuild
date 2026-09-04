"""Schémas Pydantic pour les entités SituationTravaux et LigneSituation."""
from datetime import datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class LigneSituationCreate(BaseModel):
    """Corps de la requête pour une ligne de situation."""

    situation_id: int | None = None
    ouvrage: str = Field(..., min_length=1, max_length=255)
    quantite_periode: float | None = 0
    quantite_cumulee: float | None = 0
    unite: str | None = Field(default=None, max_length=20)
    prix_unitaire: float | None = 0
    montant: float | None = 0
    observations: str | None = None

    @field_validator("quantite_periode", "quantite_cumulee", "prix_unitaire", "montant")
    @classmethod
    def validate_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur ne peut pas être négative")
        return v


class LigneSituationResponse(BaseModel):
    """Schéma de réponse pour une ligne de situation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    situation_id: int | None = None
    ouvrage: str
    quantite_periode: float | None = None
    quantite_cumulee: float | None = None
    unite: str | None = None
    prix_unitaire: float | None = None
    montant: float | None = None
    observations: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SituationTravauxCreate(BaseModel):
    """Corps de la requête pour créer une situation de travaux."""

    entreprise_id: int | None = None
    chantier_id: int | None = None
    contrat_id: int | None = None
    periode: str | None = Field(default=None, max_length=50)
    date_etablissement: datetime | None = None
    avancement: float | None = 0
    montant: float | None = 0
    observations: str | None = None
    statut: str | None = "brouillon"

    @field_validator("avancement")
    @classmethod
    def validate_avancement(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("L'avancement doit être compris entre 0 et 100")
        return v

    @field_validator("montant")
    @classmethod
    def validate_montant(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"brouillon", "soumise", "validee", "rejetee"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class SituationTravauxUpdate(BaseModel):
    """Corps de la requête pour modifier une situation de travaux."""

    periode: str | None = None
    date_etablissement: datetime | None = None
    avancement: float | None = None
    montant: float | None = None
    observations: str | None = None
    statut: str | None = None
    chantier_id: int | None = None
    contrat_id: int | None = None

    @field_validator("avancement")
    @classmethod
    def validate_avancement(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("L'avancement doit être compris entre 0 et 100")
        return v

    @field_validator("montant")
    @classmethod
    def validate_montant(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"brouillon", "soumise", "validee", "rejetee"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class SituationTravauxResponse(BaseModel):
    """Schéma de réponse pour une situation de travaux."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    chantier_id: int | None = None
    contrat_id: int | None = None
    numero: str | None = None
    periode: str | None = None
    date_etablissement: datetime | None = None
    avancement: float | None = None
    montant: float | None = None
    observations: str | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SituationTravauxList(BaseModel):
    """Schéma de réponse pour la liste paginée des situations."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    chantier_id: int | None = None
    contrat_id: int | None = None
    numero: str | None = None
    periode: str | None = None
    date_etablissement: datetime | None = None
    avancement: float | None = None
    montant: float | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
