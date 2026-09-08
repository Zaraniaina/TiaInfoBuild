"""Schémas Pydantic pour les entités Facture, LigneFacture et Paiement."""
from datetime import date, datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class LigneFactureCreate(BaseModel):
    """Corps de la requête pour une ligne de facture."""

    facture_id: int | None = None
    type: str | None = Field(default="article", max_length=20)
    article_id: int | None = None
    description: str = Field(..., min_length=1)
    categorie: str | None = Field(default=None, max_length=50)
    quantite: float | None = Field(default=0.0)
    unite: str | None = None
    prix_unitaire: float | None = Field(default=0.0)
    remise: float | None = Field(default=0.0)
    taux_tva: float | None = Field(default=20.0)
    total_ht: float | None = Field(default=0.0)
    total_ttc: float | None = Field(default=0.0)
    ordre: int | None = Field(default=0)

    @field_validator("categorie")
    @classmethod
    def validate_categorie(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {
                "materiaux",
                "main-d_œuvre",
                "materiel_et_engins",
                "prestations",
                "sous_traitance",
                "autres_frais",
            }
            if v not in allowed:
                raise ValueError(f"Catégorie invalide. Valeurs autorisées: {allowed}")
        return v

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


class LigneFactureResponse(BaseModel):
    """Schéma de réponse pour une ligne de facture."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    facture_id: int | None = None
    type: str | None = None
    article_id: int | None = None
    description: str
    categorie: str | None = None
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
    lignes: list[LigneFactureCreate] | None = None

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
            allowed = {"standard", "pro_format", "pro_forma", "acompte", "solde", "avoir"}
            if v not in allowed:
                raise ValueError(f"Type de facture invalide. Valeurs autorisées: {allowed}")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"emis", "envoye", "payee", "partiellement_payee", "en_retard", "annulee"}
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
            allowed = {"emis", "envoye", "payee", "partiellement_payee", "en_retard", "annulee"}
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
    montant_tva: float | None = None
    montant_ttc: float | None = None
    montant_acompte_deduit: float | None = None
    montant_paye: float | None = None
    reste_a_payer: float | None = None
    date_creation: date | None = None
    date_emission: date | None = None
    date_echeance: date | None = None
    statut: str | None = None
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    notes: str | None = None
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
    reste_a_payer: float | None = None
    date_echeance: date | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
