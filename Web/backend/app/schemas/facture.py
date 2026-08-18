"""Schémas Pydantic pour les entités Facture et Paiement."""
from datetime import date, datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class PaiementCreate(BaseModel):
    """Corps de la requête pour créer un paiement."""

    entreprise_id: int | None = None
    facture_id: int = Field(..., ge=1)
    montant: float = Field(..., gt=0)
    date_paiement: date | None = None
    mode_paiement: str | None = None
    reference: str | None = Field(default=None, max_length=100)
    banque: str | None = Field(default=None, max_length=100)
    notes: str | None = None

    @field_validator("montant")
    @classmethod
    def validate_montant(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Le montant du paiement doit être positif")
        return v


class PaiementUpdate(BaseModel):
    """Corps de la requête pour modifier un paiement."""

    facture_id: int | None = None
    montant: float | None = None
    date_paiement: date | None = None
    mode_paiement: str | None = None
    reference: str | None = None
    banque: str | None = None
    notes: str | None = None

    @field_validator("montant")
    @classmethod
    def validate_montant(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
        return v


class PaiementResponse(BaseModel):
    """Schéma de réponse pour un paiement."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    facture_id: int | None = None
    montant: float
    date_paiement: date | None = None
    mode_paiement: str | None = None
    reference: str | None = None
    banque: str | None = None
    notes: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class FactureCreate(BaseModel):
    """Corps de la requête pour créer une facture."""

    entreprise_id: int | None = None
    client_id: int = Field(..., ge=1)
    contrat_id: int | None = None
    numero: str | None = Field(default=None, max_length=50)
    type: str | None = Field(default="standard", max_length=20)
    montant_ht: float | None = Field(default=0.0)
    tva: float | None = Field(default=20.0)
    montant_ttc: float | None = Field(default=0.0)
    date_emission: date | None = None
    date_echeance: date | None = None
    statut: str | None = Field(default="emis", max_length=20)
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    notes: str | None = None
    montant_paye: float | None = Field(default=0.0)

    @field_validator("montant_ht", "montant_ttc", "montant_paye")
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

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"standard", "pro_format", "pro_forma"}
            if v not in allowed:
                raise ValueError(f"Type de facture invalide. Valeurs autorisées: {allowed}")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"emis", "partiellement_payee", "payee", "en_retard", "annulee"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class FactureUpdate(BaseModel):
    """Corps de la requête pour modifier une facture."""

    client_id: int | None = None
    contrat_id: int | None = None
    numero: str | None = None
    type: str | None = None
    montant_ht: float | None = None
    tva: float | None = None
    montant_ttc: float | None = None
    date_emission: date | None = None
    date_echeance: date | None = None
    statut: str | None = None
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    notes: str | None = None
    montant_paye: float | None = None

    @field_validator("montant_ht", "montant_ttc", "montant_paye")
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
            allowed = {"emis", "partiellement_payee", "payee", "en_retard", "annulee"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class FactureResponse(BaseModel):
    """Schéma de réponse pour une facture (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    contrat_id: int | None = None
    client_id: int | None = None
    numero: str | None = None
    type: str | None = None
    montant_ht: float | None = None
    tva: float | None = None
    montant_ttc: float | None = None
    date_creation: date | None = None
    date_emission: date | None = None
    date_echeance: date | None = None
    statut: str | None = None
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    notes: str | None = None
    montant_paye: float | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    lignes: list[dict[str, Any]] | None = None
    paiements: list[dict[str, Any]] | None = None


class FactureList(BaseModel):
    """Schéma de réponse pour la liste paginée des factures."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    numero: str | None = None
    type: str | None = None
    montant_ttc: float | None = None
    montant_paye: float | None = None
    date_echeance: date | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
