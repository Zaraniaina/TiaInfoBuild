"""Schémas Pydantic pour l'entité Contrat."""
from datetime import date, datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class ContratCreate(BaseModel):
    """Corps de la requête pour créer un contrat."""

    entreprise_id: int | None = None
    client_id: int = Field(..., ge=1)
    reference: str = Field(..., min_length=1, max_length=50)
    type_contrat: str | None = Field(default=None, max_length=50)
    montant: float | None = Field(default=0.0)
    date_debut: date | None = None
    date_fin: date | None = None
    statut: str | None = Field(default="en_cours", max_length=20)
    chantier_id: int | None = None
    devis_id: int | None = None
    objet: str | None = None
    conditions_paiement: str | None = None
    date_signature: date | None = None
    garantie_mois: int | None = Field(default=12)
    notes: str | None = None

    @field_validator("montant")
    @classmethod
    def validate_montant(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
        return v

    @field_validator("garantie_mois")
    @classmethod
    def validate_garantie(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("La garantie ne peut pas être négative")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"en_cours", "signe", "termine", "resilie", "annule"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class ContratUpdate(BaseModel):
    """Corps de la requête pour modifier un contrat."""

    reference: str | None = Field(default=None, min_length=1, max_length=50)
    type_contrat: str | None = None
    montant: float | None = None
    date_debut: date | None = None
    date_fin: date | None = None
    statut: str | None = None
    chantier_id: int | None = None
    devis_id: int | None = None
    objet: str | None = None
    conditions_paiement: str | None = None
    date_signature: date | None = None
    garantie_mois: int | None = None
    notes: str | None = None

    @field_validator("montant")
    @classmethod
    def validate_montant(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
        return v

    @field_validator("garantie_mois")
    @classmethod
    def validate_garantie(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("La garantie ne peut pas être négative")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"en_cours", "signe", "termine", "resilie", "annule"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class ContratResponse(BaseModel):
    """Schéma de réponse pour un contrat (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    reference: str
    type_contrat: str | None = None
    montant: float | None = None
    date_debut: date | None = None
    date_fin: date | None = None
    statut: str | None = None
    chantier_id: int | None = None
    devis_id: int | None = None
    objet: str | None = None
    conditions_paiement: str | None = None
    date_signature: date | None = None
    garantie_mois: int | None = None
    notes: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ContratList(BaseModel):
    """Schéma de réponse pour la liste paginée des contrats."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    client_id: int | None = None
    reference: str
    type_contrat: str | None = None
    montant: float | None = None
    date_debut: date | None = None
    date_fin: date | None = None
    statut: str | None = None
    chantier_id: int | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
