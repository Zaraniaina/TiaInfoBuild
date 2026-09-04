"""Schémas Pydantic pour l'entité Metre."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class MetreCreate(BaseModel):
    """Corps de la requête pour créer un métré."""

    entreprise_id: int | None = None
    projet_id: int | None = None
    ouvrage: str = Field(..., min_length=1, max_length=255)
    designation: str | None = Field(default=None, max_length=255)
    formule: str | None = Field(default=None, max_length=255)
    dimensions: str | None = None
    unite: str | None = Field(default=None, max_length=20)
    quantite: float | None = 0
    observations: str | None = None
    document_reference: str | None = Field(default=None, max_length=255)
    ordre: int | None = 0

    @field_validator("quantite")
    @classmethod
    def validate_quantite(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La quantité ne peut pas être négative")
        return v


class MetreUpdate(BaseModel):
    """Corps de la requête pour modifier un métré."""

    ouvrage: str | None = Field(default=None, min_length=1, max_length=255)
    designation: str | None = None
    formule: str | None = None
    dimensions: str | None = None
    unite: str | None = None
    quantite: float | None = None
    observations: str | None = None
    document_reference: str | None = None
    ordre: int | None = None

    @field_validator("quantite")
    @classmethod
    def validate_quantite(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La quantité ne peut pas être négative")
        return v


class MetreResponse(BaseModel):
    """Schéma de réponse pour un métré."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    projet_id: int | None = None
    ouvrage: str
    designation: str | None = None
    formule: str | None = None
    dimensions: str | None = None
    unite: str | None = None
    quantite: float | None = None
    observations: str | None = None
    document_reference: str | None = None
    ordre: int | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MetreList(BaseModel):
    """Schéma de réponse pour la liste paginée des métrés."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    projet_id: int | None = None
    ouvrage: str
    unite: str | None = None
    quantite: float | None = None
    ordre: int | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
