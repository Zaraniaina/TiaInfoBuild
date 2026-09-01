"""Schémas Pydantic pour les entités Plan et Subscription."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PlanBase(BaseModel):
    nom: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    prix_mensuel: float = Field(..., ge=0)
    prix_annuel: float = Field(..., ge=0)
    utilisateurs_max: int = Field(default=5, ge=1)
    chantiers_max: int = Field(default=3, ge=1)
    stockage_go: int = Field(default=5, ge=1)
    duree_essai_jours: int = Field(default=30, ge=0)
    actif: bool = True


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    prix_mensuel: float | None = Field(default=None, ge=0)
    prix_annuel: float | None = Field(default=None, ge=0)
    utilisateurs_max: int | None = Field(default=None, ge=1)
    chantiers_max: int | None = Field(default=None, ge=1)
    stockage_go: int | None = Field(default=None, ge=1)
    duree_essai_jours: int | None = Field(default=None, ge=0)
    actif: bool | None = None


class PlanResponse(PlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SubscriptionBase(BaseModel):
    entreprise_id: int = Field(..., gt=0)
    plan_id: int = Field(..., gt=0)
    statut: str | None = "actif"
    mode_paiement: str | None = None
    prix_paye: float | None = Field(default=None, gt=0)
    periode: str | None = None


class SubscriptionCreate(SubscriptionBase):
    date_debut: datetime | None = None
    date_fin: datetime | None = None
    date_prochain_renouvellement: datetime | None = None

    @field_validator("periode")
    @classmethod
    def validate_periode(cls, v: str | None) -> str | None:
        if v is not None and v not in ("mensuel", "annuel"):
            raise ValueError("La période doit être 'mensuel' ou 'annuel'")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None and v not in ("actif", "expire", "suspendu", "annule", "essai"):
            raise ValueError("Statut d'abonnement invalide")
        return v


class SubscriptionUpdate(BaseModel):
    plan_id: int | None = Field(default=None, gt=0)
    date_fin: datetime | None = None
    date_prochain_renouvellement: datetime | None = None
    statut: str | None = None
    mode_paiement: str | None = None
    prix_paye: float | None = Field(default=None, gt=0)
    periode: str | None = None

    @field_validator("periode")
    @classmethod
    def validate_periode(cls, v: str | None) -> str | None:
        if v is not None and v not in ("mensuel", "annuel"):
            raise ValueError("La période doit être 'mensuel' ou 'annuel'")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None and v not in ("actif", "expire", "suspendu", "annule", "essai"):
            raise ValueError("Statut d'abonnement invalide")
        return v


class SubscriptionResponse(SubscriptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_debut: datetime | None = None
    date_fin: datetime | None = None
    date_prochain_renouvellement: datetime | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SubscriptionWithPlan(SubscriptionResponse):
    model_config = ConfigDict(from_attributes=True)

    plan: PlanResponse | None = None
