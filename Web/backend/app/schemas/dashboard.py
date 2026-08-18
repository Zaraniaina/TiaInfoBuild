"""Schémas Pydantic pour les réponses du dashboard et statistiques."""
from datetime import date
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class CaEvolutionResponse(BaseModel):
    """Un point d'évolution du chiffre d'affaires sur une période."""

    model_config = ConfigDict(from_attributes=True)

    mois: str
    ca: float | None = Field(default=0.0)
    depenses: float | None = Field(default=0.0)

    @field_validator("ca", "depenses")
    @classmethod
    def validate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur ne peut pas être négative")
        return v


class TopChantierResponse(BaseModel):
    """Un chantier dans le top CA / marges."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    nom: str
    numero: str | None = None
    ville: str | None = None
    ca: float | None = Field(default=0.0)
    marge: float | None = Field(default=0.0)
    taux_marge: float | None = None

    @field_validator("ca", "marge")
    @classmethod
    def validate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur ne peut pas être négative")
        return v

    @field_validator("taux_marge")
    @classmethod
    def validate_taux_marge(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Le taux de marge doit être compris entre 0 et 100")
        return v


class DepensesParCategorieResponse(BaseModel):
    """Agrégation des dépenses par catégorie."""

    model_config = ConfigDict(from_attributes=True)

    categorie: str
    montant: float | None = Field(default=0.0)

    @field_validator("montant")
    @classmethod
    def validate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
        return v


class FactureRetardResponse(BaseModel):
    """Une facture en retard de paiement."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    numero: str | None = None
    client_id: int | None = None
    montant_ttc: float | None = None
    montant_paye: float | None = None
    date_echeance: date | None = None
    jours_retard: int | None = None


class CaEvolution(BaseModel):
    """Alias pour un point de CA (pour liste)."""

    mois: str
    ca: float
    depenses: float


class DashboardStats(BaseModel):
    """Corps de requête pour les stats du dashboard."""

    mois: str | None = Field(default=None, description="Format YYYY-MM, ex: 2026-08")
    entreprise_id: int | None = None


class DashboardStatsResponse(BaseModel):
    """Réponse agrégée du dashboard entreprise."""

    model_config = ConfigDict(from_attributes=True)

    ca_mois: float | None = Field(default=0.0)
    depenses_mois: float | None = Field(default=0.0)
    factures_en_retard: int | None = None
    nb_chantiers_actifs: int | None = None
    nb_employes: int | None = None
    nb_articles: int | None = None
    nb_clients: int | None = None
    nb_devis: int | None = None
    nb_materiels: int | None = None
    top_chantiers: list[dict[str, Any]] | None = None
    ca_evolution: list[dict[str, Any]] | None = None
    alertes_recentes: list[dict[str, Any]] | None = None

    @field_validator("ca_mois", "depenses_mois")
    @classmethod
    def validate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur ne peut pas être négative")
        return v


class SuperAdminStatsResponse(BaseModel):
    """Réponse des statistiques pour le super administrateur."""

    model_config = ConfigDict(from_attributes=True)

    total_entreprises: int
    total_utilisateurs: int
    total_chantiers: int
    ca_total: float | None = None
    entreprises_actives: int | None = None
    abonnements: dict[str, int] | None = None
