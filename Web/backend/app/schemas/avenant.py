from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AvenantCreate(BaseModel):
    """Corps de la requête pour créer un avenant."""

    entreprise_id: Optional[int] = None
    contrat_id: int = Field(..., ge=1)
    numero: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(default=None, max_length=255)
    impact_montant: float = Field(default=0.0)
    date_signature: Optional[date] = None
    statut: Optional[str] = Field(default="propose", max_length=20)
    fichier_url: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"propose", "signe"}:
            raise ValueError("Statut avenant invalide. Valeurs autorisées: propose, signe")
        return v


class AvenantUpdate(BaseModel):
    """Corps de la requête pour modifier un avenant."""

    numero: Optional[str] = Field(default=None, min_length=1, max_length=50)
    description: Optional[str] = Field(default=None, max_length=255)
    impact_montant: Optional[float] = Field(default=None)
    date_signature: Optional[date] = None
    statut: Optional[str] = Field(default=None, max_length=20)
    fichier_url: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"propose", "signe"}:
            raise ValueError("Statut avenant invalide. Valeurs autorisées: propose, signe")
        return v


class AvenantResponse(BaseModel):
    """Schéma de réponse pour un avenant."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: Optional[int] = None
    contrat_id: int
    numero: str
    description: Optional[str] = None
    impact_montant: Optional[float] = None
    date_signature: Optional[date] = None
    statut: Optional[str] = None
    fichier_url: Optional[str] = None
    notes: Optional[str] = None
    is_deleted: Optional[bool] = None
    created_at: Optional[date] = None
    updated_at: Optional[date] = None


class AvenantList(BaseModel):
    """Schéma de réponse pour la liste paginée des avenants."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: Optional[int] = None
    contrat_id: int
    numero: str
    description: Optional[str] = None
    impact_montant: Optional[float] = None
    date_signature: Optional[date] = None
    statut: Optional[str] = None
    is_deleted: Optional[bool] = None
    created_at: Optional[date] = None
