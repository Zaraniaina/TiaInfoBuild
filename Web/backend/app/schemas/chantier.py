"""Schémas Pydantic pour l'entité Chantier et ses sous-ressources."""
from datetime import date, datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class ChantierStatutUpdate(BaseModel):
    """Corps de la requête pour changer le statut d'un chantier."""

    statut: str = Field(..., min_length=1, max_length=20)


class ChantierCreate(BaseModel):
    """Corps de la requête pour créer un chantier."""

    entreprise_id: int | None = None
    client_id: int | None = None
    chef_chantier_id: int | None = None
    numero: str | None = Field(default=None, max_length=50)
    nom: str = Field(..., min_length=1, max_length=255)
    adresse: str | None = None
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    date_debut: date | None = None
    date_fin_prevue: date | None = None
    date_fin_reelle: date | None = None
    budget_prevu: float | None = Field(default=0.0)
    budget_previsionnel: float | None = Field(default=0.0)
    budget_reel: float | None = Field(default=0.0)
    marge_cible: float | None = Field(default=0.0)
    tva: float | None = Field(default=20.0)
    statut: str | None = Field(default="planification", max_length=20)
    description: str | None = None
    region: str | None = Field(default=None, max_length=80)

    @field_validator("budget_prevu", "budget_previsionnel", "budget_reel", "marge_cible")
    @classmethod
    def validate_budget_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur budgétaire ne peut pas être négative")
        return v

    @field_validator("tva")
    @classmethod
    def validate_tva(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("La TVA doit être comprise entre 0 et 100")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        allowed = {"planification", "en_cours", "termine", "annule", "suspendu"}
        if v is not None and v not in allowed:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class ChantierUpdate(BaseModel):
    """Corps de la requête pour modifier un chantier."""

    numero: str | None = Field(default=None, max_length=50)
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    adresse: str | None = None
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    date_debut: date | None = None
    date_fin_prevue: date | None = None
    date_fin_reelle: date | None = None
    budget_prevu: float | None = None
    budget_previsionnel: float | None = None
    budget_reel: float | None = None
    marge_cible: float | None = None
    tva: float | None = None
    statut: str | None = None
    description: str | None = None
    region: str | None = Field(default=None, max_length=80)
    client_id: int | None = None
    chef_chantier_id: int | None = None

    @field_validator("budget_prevu", "budget_previsionnel", "budget_reel", "marge_cible")
    @classmethod
    def validate_budget_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur budgétaire ne peut pas être négative")
        return v

    @field_validator("tva")
    @classmethod
    def validate_tva(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("La TVA doit être comprise entre 0 et 100")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        allowed = {"planification", "en_cours", "termine", "annule", "suspendu"}
        if v is not None and v not in allowed:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class ChantierResponse(BaseModel):
    """Schéma de réponse pour un chantier (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    chef_chantier_id: int | None = None
    projet_id: int | None = None
    numero: str | None = None
    nom: str
    adresse: str | None = None
    code_postal: str | None = None
    ville: str | None = None
    date_debut: date | None = None
    date_fin_prevue: date | None = None
    date_fin_reelle: date | None = None
    budget_prevu: float | None = None
    budget_previsionnel: float | None = None
    budget_reel: float | None = None
    marge_cible: float | None = None
    tva: float | None = None
    statut: str | None = None
    description: str | None = None
    region: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    phases: list[dict[str, Any]] | None = None
    incidents: list[dict[str, Any]] | None = None
    affectations: list[dict[str, Any]] | None = None
    # Impact climatique (aléas documentés) : jours d'arrêt climatiques,
    # retard brut et retard net — voir app/routers/aleas_climatiques.py.
    impact_climatique: dict[str, Any] | None = None


class ChantierList(BaseModel):
    """Schéma de réponse pour la liste paginée des chantiers."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    chef_chantier_id: int | None = None
    projet_id: int | None = None
    numero: str | None = None
    nom: str
    ville: str | None = None
    date_debut: date | None = None
    date_fin_prevue: date | None = None
    budget_prevu: float | None = None
    budget_reel: float | None = None
    marge_cible: float | None = None
    statut: str | None = None
    region: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
