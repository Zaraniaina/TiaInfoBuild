"""Schémas Pydantic pour les entités DemandeTravaux."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class DemandeTravauxCreate(BaseModel):
    """Corps de la requête pour créer une demande de travaux."""

    entreprise_id: int | None = None
    client_id: int | None = None
    commercial_id: int | None = None
    objet: str = Field(..., min_length=1, max_length=255)
    type_projet: str | None = Field(default=None, max_length=50)
    description: str | None = None
    localisation: str | None = Field(default=None, max_length=255)
    date_souhaitee: datetime | None = None
    documents_fournis: str | None = None
    plans_disponibles: bool = False
    observations: str | None = None
    statut: str | None = "nouvelle"

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"nouvelle", "en_etude", "traitee", "annulee"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class DemandeTravauxUpdate(BaseModel):
    """Corps de la requête pour modifier une demande de travaux."""

    objet: str | None = Field(default=None, min_length=1, max_length=255)
    type_projet: str | None = None
    description: str | None = None
    localisation: str | None = None
    date_souhaitee: datetime | None = None
    documents_fournis: str | None = None
    plans_disponibles: bool | None = None
    observations: str | None = None
    statut: str | None = None
    client_id: int | None = None
    commercial_id: int | None = None

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"nouvelle", "en_etude", "traitee", "annulee"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class DemandeTravauxResponse(BaseModel):
    """Schéma de réponse pour une demande de travaux."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    commercial_id: int | None = None
    numero: str | None = None
    objet: str
    type_projet: str | None = None
    description: str | None = None
    localisation: str | None = None
    date_demande: datetime | None = None
    date_souhaitee: datetime | None = None
    documents_fournis: str | None = None
    plans_disponibles: bool | None = None
    observations: str | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DemandeTravauxList(BaseModel):
    """Schéma de réponse pour la liste paginée des demandes."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    numero: str | None = None
    objet: str
    type_projet: str | None = None
    localisation: str | None = None
    date_demande: datetime | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
