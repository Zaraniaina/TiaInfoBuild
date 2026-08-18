"""Schémas Pydantic pour l'entité Dépense."""
from datetime import date, datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class DepenseValidationRequest(BaseModel):
    """Corps de la requête pour valider une dépense."""

    validee_par: int = Field(..., ge=1)


class DepenseCreate(BaseModel):
    """Corps de la requête pour créer une dépense."""

    entreprise_id: int | None = None
    chantier_id: int | None = None
    description: str = Field(..., min_length=1)
    montant: float = Field(..., gt=0)
    date_depense: date | None = None
    categorie: str | None = Field(default=None, max_length=100)
    statut: str | None = Field(default="en_attente", max_length=20)
    fournisseur: str | None = Field(default=None, max_length=255)
    taux_tva: float | None = Field(default=20.0)
    numero_facture: str | None = Field(default=None, max_length=100)
    mode_paiement: str | None = None
    validee_par: int | None = None
    notes: str | None = None

    @field_validator("montant")
    @classmethod
    def validate_montant(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Le montant de la dépense doit être positif")
        return v

    @field_validator("taux_tva")
    @classmethod
    def validate_tva(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("La TVA doit être comprise entre 0 et 100")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"en_attente", "validee", "refusee", "payee"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class DepenseUpdate(BaseModel):
    """Corps de la requête pour modifier une dépense."""

    chantier_id: int | None = None
    description: str | None = None
    montant: float | None = None
    date_depense: date | None = None
    categorie: str | None = Field(default=None, max_length=100)
    statut: str | None = None
    fournisseur: str | None = None
    taux_tva: float | None = None
    numero_facture: str | None = None
    mode_paiement: str | None = None
    validee_par: int | None = None
    notes: str | None = None

    @field_validator("montant")
    @classmethod
    def validate_montant(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le montant ne peut pas être négatif")
        return v

    @field_validator("taux_tva")
    @classmethod
    def validate_tva(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("La TVA doit être comprise entre 0 et 100")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"en_attente", "validee", "refusee", "payee"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class DepenseResponse(BaseModel):
    """Schéma de réponse pour une dépense (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    chantier_id: int | None = None
    description: str
    montant: float
    date_depense: date | None = None
    categorie: str | None = None
    statut: str | None = None
    fournisseur: str | None = None
    taux_tva: float | None = None
    numero_facture: str | None = None
    mode_paiement: str | None = None
    validee_par: int | None = None
    notes: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DepenseList(BaseModel):
    """Schéma de réponse pour la liste paginée des dépenses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    chantier_id: int | None = None
    description: str
    montant: float
    date_depense: date | None = None
    categorie: str | None = None
    statut: str | None = None
    fournisseur: str | None = None
    mode_paiement: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
