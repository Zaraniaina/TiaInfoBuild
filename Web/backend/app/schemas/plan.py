"""Schémas Pydantic pour les entités Plan et Subscription."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PlanBase(BaseModel):
    nom: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    prix_mensuel: float = Field(..., ge=0)
    prix_annuel: float = Field(..., ge=0)
    # null = illimité (généreux par défaut) ; la métrique est le nombre d'EMPLOYÉS
    # (les clients portail sont toujours illimités)
    utilisateurs_max: int | None = Field(default=None, ge=1)
    chantiers_max: int = Field(default=3, ge=1)
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
    # null = illimité
    utilisateurs_max: int | None = Field(default=None, ge=1)
    chantiers_max: int | None = Field(default=None, ge=1)
    duree_essai_jours: int | None = Field(default=None, ge=0)
    actif: bool | None = None


class PlanResponse(PlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Nombre d'abonnements actifs/essai liés à ce plan (renseigné uniquement
    # sur l'endpoint super-admin GET /plans ; None ailleurs).
    entreprises_actives: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SubscriptionBase(BaseModel):
    # entreprise_id requis pour l'endpoint super-admin ; l'endpoint self-service
    # /entreprise/subscription le déduit du token (le rend optionnel évite un 422
    # côté entreprise qui ne doit JAMAIS pouvoir spécifier l'entreprise d'un autre).
    entreprise_id: int | None = Field(default=None, gt=0)
    plan_id: int = Field(..., gt=0)
    statut: str | None = "actif"
    mode_paiement: str | None = None
    # ge=0 (et non gt=0) : les essais et le plan gratuit ont prix_paye = 0
    prix_paye: float | None = Field(default=None, ge=0)
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
    prix_paye: float | None = Field(default=None, ge=0)
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
