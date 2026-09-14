"""Schémas Pydantic pour les congés (module RH)."""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TYPES_VALIDES = {"annuel", "maladie", "maternite", "exceptionnel", "sans_solde"}


class CongeCreate(BaseModel):
    """Corps de la requête pour créer une demande de congé."""

    employe_id: int = Field(..., ge=1)
    type: str = Field(default="annuel", max_length=30)
    date_debut: date
    date_fin: date
    nb_jours: float = Field(..., gt=0)
    motif: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in TYPES_VALIDES:
            raise ValueError(f"Type de congé invalide. Valeurs autorisées: {sorted(TYPES_VALIDES)}")
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        if self.date_fin < self.date_debut:
            raise ValueError("date_fin doit être postérieure ou égale à date_debut")
        return self


class CongeDecision(BaseModel):
    """Corps de la requête pour valider/refuser un congé."""

    commentaire: str | None = None


class CongeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    employe_id: int
    type: str
    date_debut: date
    date_fin: date
    nb_jours: float
    statut: str
    motif: str | None = None
    valide_par: int | None = None
    date_validation: datetime | None = None
    commentaire_refus: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    employe_nom: str | None = None
    employe_prenom: str | None = None


class CongeList(BaseModel):
    """Liste paginée des congés."""

    items: list[CongeResponse]
    total: int
    page: int
    size: int
