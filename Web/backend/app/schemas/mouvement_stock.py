"""Schémas Pydantic pour l'entité MouvementStock."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class MouvementStockCreate(BaseModel):
    """Corps de la requête pour créer un mouvement de stock."""

    entreprise_id: int | None = None
    article_id: int = Field(..., ge=1)
    type_mouvement: str = Field(..., min_length=1, max_length=20)
    quantite: float = Field(..., gt=0)
    prix_unitaire: float | None = Field(default=0.0, ge=0)
    chantier_id: int | None = None
    fournisseur_id: int | None = None
    reference: str | None = None
    notes: str | None = None

    @field_validator("type_mouvement")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"entree", "sortie", "inventaire", "ajustement"}
        if v not in allowed:
            raise ValueError(f"Type de mouvement invalide. Valeurs autorisées: {allowed}")
        return v

    @field_validator("quantite")
    @classmethod
    def validate_quantite(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("La quantité doit être strictement positive")
        return v


class MouvementStockResponse(BaseModel):
    """Schéma de réponse pour un mouvement de stock."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    article_id: int | None = None
    type_mouvement: str
    date_mouvement: datetime | None = None
    quantite: float
    prix_unitaire: float | None = None
    chantier_id: int | None = None
    fournisseur_id: int | None = None
    reference: str | None = None
    notes: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MouvementStockList(BaseModel):
    """Schéma de réponse pour la liste des mouvements de stock."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    article_id: int | None = None
    type_mouvement: str
    date_mouvement: datetime | None = None
    quantite: float
    prix_unitaire: float | None = None
    chantier_id: int | None = None
    fournisseur_id: int | None = None
    reference: str | None = None
    is_deleted: bool | None = None
