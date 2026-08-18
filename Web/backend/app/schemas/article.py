"""Schémas Pydantic pour l'entité Article et ajustement de stock."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class StockAdjustmentRequest(BaseModel):
    """Corps de la requête pour ajuster le stock d'un article."""

    quantite: float = Field(..., gt=0)
    type_mouvement: str = Field(..., min_length=1, max_length=20)
    prix_unitaire: float | None = Field(default=0.0, ge=0)
    fournisseur_id: int | None = None
    chantier_id: int | None = None
    reference: str | None = None
    notes: str | None = None

    @field_validator("type_mouvement")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"entree", "sortie", "inventaire", "ajustement"}
        if v not in allowed:
            raise ValueError(f"Type de mouvement invalide. Valeurs autorisées: {allowed}")
        return v


class ArticleCreate(BaseModel):
    """Corps de la requête pour créer un article."""

    entreprise_id: int | None = None
    reference: str | None = Field(default=None, max_length=100)
    nom: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    categorie: str | None = Field(default=None, max_length=100)
    unite: str | None = Field(default="unite", max_length=20)
    stock_actuel: float | None = Field(default=0.0)
    seuil_alerte: float | None = Field(default=0.0)
    stock_mini: float | None = Field(default=0.0)
    prix_achat: float | None = Field(default=0.0)
    prix_vente: float | None = Field(default=0.0)
    marge: float | None = Field(default=0.0)
    tva: float | None = Field(default=20.0)
    poids: float | None = None
    fournisseur_id: int | None = None
    code_barre: str | None = Field(default=None, max_length=100)
    emplacement: str | None = Field(default=None, max_length=100)

    @field_validator("stock_actuel", "seuil_alerte", "stock_mini", "prix_achat", "prix_vente", "poids")
    @classmethod
    def validate_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur ne peut pas être négative")
        return v

    @field_validator("tva", "marge")
    @classmethod
    def validate_percent(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Le pourcentage doit être compris entre 0 et 100")
        return v


class ArticleUpdate(BaseModel):
    """Corps de la requête pour modifier un article."""

    reference: str | None = Field(default=None, max_length=100)
    nom: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    categorie: str | None = Field(default=None, max_length=100)
    unite: str | None = None
    stock_actuel: float | None = None
    seuil_alerte: float | None = None
    stock_mini: float | None = None
    prix_achat: float | None = None
    prix_vente: float | None = None
    marge: float | None = None
    tva: float | None = None
    poids: float | None = None
    fournisseur_id: int | None = None
    code_barre: str | None = None
    emplacement: str | None = None

    @field_validator("stock_actuel", "seuil_alerte", "stock_mini", "prix_achat", "prix_vente", "poids")
    @classmethod
    def validate_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur ne peut pas être négative")
        return v

    @field_validator("tva", "marge")
    @classmethod
    def validate_percent(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Le pourcentage doit être compris entre 0 et 100")
        return v


class ArticleResponse(BaseModel):
    """Schéma de réponse pour un article (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    reference: str | None = None
    nom: str
    description: str | None = None
    categorie: str | None = None
    unite: str | None = None
    stock_actuel: float | None = None
    seuil_alerte: float | None = None
    stock_mini: float | None = None
    prix_achat: float | None = None
    prix_vente: float | None = None
    marge: float | None = None
    tva: float | None = None
    poids: float | None = None
    fournisseur_id: int | None = None
    code_barre: str | None = None
    emplacement: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ArticleList(BaseModel):
    """Schéma de réponse pour la liste paginée des articles."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    reference: str | None = None
    nom: str
    categorie: str | None = None
    unite: str | None = None
    stock_actuel: float | None = None
    seuil_alerte: float | None = None
    prix_achat: float | None = None
    prix_vente: float | None = None
    marge: float | None = None
    code_barre: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
