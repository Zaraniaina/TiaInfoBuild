"""Schémas Pydantic pour l'entité Alerte et actions associées."""
from datetime import datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class AlerteCreate(BaseModel):
    """Corps de la requête pour créer une alerte."""

    entreprise_id: int | None = None
    titre: str = Field(..., min_length=1, max_length=255)
    message: str | None = None
    type_entite: str | None = Field(default=None, max_length=50)
    entite_id: int | None = None
    niveau_gravite: str | None = Field(default="info", max_length=20)
    statut: str | None = Field(default="non_lue", max_length=20)
    lue: bool | None = False

    @field_validator("niveau_gravite")
    @classmethod
    def validate_gravite(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"info", "basse", "moyenne", "elevee", "critique"}
            if v not in allowed:
                raise ValueError(f"Niveau de gravité invalide. Valeurs autorisées: {allowed}")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"non_lue", "lue", "traite", "archivée"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class AlerteResponse(BaseModel):
    """Schéma de réponse pour une alerte."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    titre: str
    message: str | None = None
    type_entite: str | None = None
    entite_id: int | None = None
    niveau_gravite: str | None = None
    statut: str | None = None
    lue: bool | None = None
    date_lecture: datetime | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AlerteList(BaseModel):
    """Schéma de réponse pour la liste des alertes."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    titre: str
    type_entite: str | None = None
    entite_id: int | None = None
    niveau_gravite: str | None = None
    statut: str | None = None
    lue: bool | None = None
    created_at: datetime | None = None


class AlerteMarquerLue(BaseModel):
    """Corps de la requête pour marquer une ou plusieurs alertes comme lues."""

    ids: list[int] = Field(default_factory=list)
