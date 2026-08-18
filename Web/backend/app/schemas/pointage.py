"""Schémas Pydantic pour l'entité Pointage (présence employé)."""
from datetime import date, datetime, time

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class PointageCreate(BaseModel):
    """Corps de la requête pour créer un pointage."""

    entreprise_id: int | None = None
    employe_id: int = Field(..., ge=1)
    chantier_id: int | None = None
    date_jour: date
    heure_debut: time | None = None
    heure_fin: time | None = None
    heures_total: float | None = Field(default=0.0)
    type: str | None = Field(default="present", max_length=20)
    notes: str | None = None

    @field_validator("heures_total")
    @classmethod
    def validate_heures(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Les heures ne peuvent pas être négatives")
        return v

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        allowed = {"present", "absent", "retard", "congé", "maladie"}
        if v is not None and v not in allowed:
            raise ValueError(f"Type invalide. Valeurs autorisées: {allowed}")
        return v


class PointageUpdate(BaseModel):
    """Corps de la requête pour modifier un pointage."""

    employe_id: int | None = None
    chantier_id: int | None = None
    date_jour: date | None = None
    heure_debut: time | None = None
    heure_fin: time | None = None
    heures_total: float | None = None
    type: str | None = None
    notes: str | None = None

    @field_validator("heures_total")
    @classmethod
    def validate_heures(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Les heures ne peuvent pas être négatives")
        return v

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        allowed = {"present", "absent", "retard", "congé", "maladie"}
        if v is not None and v not in allowed:
            raise ValueError(f"Type invalide. Valeurs autorisées: {allowed}")
        return v


class PointageResponse(BaseModel):
    """Schéma de réponse pour un pointage."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    employe_id: int | None = None
    chantier_id: int | None = None
    date_jour: date
    heure_debut: time | None = None
    heure_fin: time | None = None
    heures_total: float | None = None
    type: str | None = None
    notes: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PointageList(BaseModel):
    """Schéma de réponse pour la liste des pointages."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    employe_id: int | None = None
    chantier_id: int | None = None
    date_jour: date
    heures_total: float | None = None
    type: str | None = None
