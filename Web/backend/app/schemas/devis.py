"""Schémas Pydantic pour les entités Devis et LigneDevis."""
from datetime import date, datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class LigneDevisCreate(BaseModel):
    """Corps de la requête pour une ligne de devis."""

    devis_id: int | None = None
    type: str | None = Field(default="article", max_length=20)
    article_id: int | None = None
    description: str = Field(..., min_length=1)
    quantite: float | None = Field(default=0.0)
    unite: str | None = None
    prix_unitaire: float | None = Field(default=0.0)
    remise: float | None = Field(default=0.0)
    taux_tva: float | None = Field(default=20.0)
    total_ht: float | None = Field(default=0.0)
    total_ttc: float | None = Field(default=0.0)
    ordre: int | None = Field(default=0)

    @field_validator("quantite")
    @classmethod
    def validate_quantite(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La quantité ne peut pas être négative")
        return v

    @field_validator("prix_unitaire", "remise", "total_ht", "total_ttc")
    @classmethod
    def validate_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur ne peut pas être négative")
        return v

    @field_validator("taux_tva", "remise")
    @classmethod
    def validate_percent(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Le pourcentage doit être compris entre 0 et 100")
        return v


class LigneDevisResponse(BaseModel):
    """Schéma de réponse pour une ligne de devis."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    devis_id: int | None = None
    type: str | None = None
    article_id: int | None = None
    description: str
    quantite: float | None = None
    unite: str | None = None
    prix_unitaire: float | None = None
    remise: float | None = None
    taux_tva: float | None = None
    total_ht: float | None = None
    total_ttc: float | None = None
    ordre: int | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DevisStatutUpdate(BaseModel):
    """Corps de la requête pour changer le statut d'un devis."""

    statut: str

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str) -> str:
        allowed = {"brouillon", "envoye", "accepte", "refuse", "expire", "annule"}
        if v not in allowed:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class DevisCreate(BaseModel):
    """Corps de la requête pour créer un devis."""

    entreprise_id: int | None = None
    client_id: int = Field(..., ge=1)
    numero: str | None = Field(default=None, max_length=50)
    objet: str | None = None
    montant_ht: float | None = Field(default=0.0)
    tva: float | None = Field(default=20.0)
    montant_ttc: float | None = Field(default=0.0)
    date_validite: date | None = None
    statut: str | None = Field(default="brouillon", max_length=20)
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    notes: str | None = None
    lignes: list[LigneDevisCreate] | None = None

    @field_validator("montant_ht", "montant_ttc")
    @classmethod
    def validate_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
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
        if v is not None:
            allowed = {"brouillon", "envoye", "accepte", "refuse", "expire", "annule"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class DevisUpdate(BaseModel):
    """Corps de la requête pour modifier un devis."""

    numero: str | None = Field(default=None, max_length=50)
    objet: str | None = None
    montant_ht: float | None = None
    tva: float | None = None
    montant_ttc: float | None = None
    date_validite: date | None = None
    statut: str | None = None
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    notes: str | None = None

    @field_validator("montant_ht", "montant_ttc")
    @classmethod
    def validate_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
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
        if v is not None:
            allowed = {"brouillon", "envoye", "accepte", "refuse", "expire", "annule"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class DevisResponse(BaseModel):
    """Schéma de réponse pour un devis (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    numero: str | None = None
    objet: str | None = None
    montant_ht: float | None = None
    tva: float | None = None
    montant_ttc: float | None = None
    date_creation: date | None = None
    date_validite: date | None = None
    statut: str | None = None
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    notes: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    lignes: list[dict[str, Any]] | None = None


class DevisList(BaseModel):
    """Schéma de réponse pour la liste paginée des devis."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    numero: str | None = None
    montant_ht: float | None = None
    montant_ttc: float | None = None
    date_creation: date | None = None
    date_validite: date | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
