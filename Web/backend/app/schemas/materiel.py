"""Schémas Pydantic pour les entités Materiel et Maintenance."""
from datetime import date, datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class MaintenanceCreate(BaseModel):
    """Corps de la requête pour créer une maintenance."""

    entreprise_id: int | None = None
    materiel_id: int = Field(..., ge=1)
    date_maintenance: date
    type: str | None = Field(default=None, max_length=50)
    cout: float | None = Field(default=0.0)
    description: str | None = None
    prochaine_date_echeance: date | None = None
    technicien: str | None = Field(default=None, max_length=255)

    @field_validator("cout")
    @classmethod
    def validate_cout(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le coût ne peut pas être négatif")
        return v


class MaintenanceResponse(BaseModel):
    """Schéma de réponse pour une maintenance."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    materiel_id: int | None = None
    date_maintenance: date
    type: str | None = None
    cout: float | None = None
    description: str | None = None
    prochaine_date_echeance: date | None = None
    technicien: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MaterielCreate(BaseModel):
    """Corps de la requête pour créer un matériel."""

    entreprise_id: int | None = None
    nom: str = Field(..., min_length=1, max_length=255)
    designation: str | None = Field(default=None, max_length=255)
    type: str | None = Field(default=None, max_length=100)
    marque: str | None = Field(default=None, max_length=100)
    modele: str | None = Field(default=None, max_length=100)
    numero_serie: str | None = Field(default=None, max_length=100)
    date_acquisition: date | None = None
    valeur_achat: float | None = Field(default=0.0)
    description: str | None = None
    photo_url: str | None = Field(default=None, max_length=500)
    manuel_url: str | None = Field(default=None, max_length=500)
    normes: str | None = None
    statut: str | None = Field(default="disponible", max_length=20)

    @field_validator("valeur_achat")
    @classmethod
    def validate_valeur(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur d'achat ne peut pas être négative")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"disponible", "en_panne", "en_maintenance", "hors_service", "perdu"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class MaterielUpdate(BaseModel):
    """Corps de la requête pour modifier un matériel."""

    nom: str | None = Field(default=None, min_length=1, max_length=255)
    designation: str | None = None
    type: str | None = None
    marque: str | None = None
    modele: str | None = None
    numero_serie: str | None = None
    date_acquisition: date | None = None
    valeur_achat: float | None = None
    description: str | None = None
    photo_url: str | None = Field(default=None, max_length=500)
    manuel_url: str | None = Field(default=None, max_length=500)
    normes: str | None = None
    statut: str | None = None

    @field_validator("valeur_achat")
    @classmethod
    def validate_valeur(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("La valeur d'achat ne peut pas être négative")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"disponible", "en_panne", "en_maintenance", "hors_service", "perdu"}
            if v not in allowed:
                raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class MaterielResponse(BaseModel):
    """Schéma de réponse pour un matériel (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    nom: str
    designation: str | None = None
    type: str | None = None
    marque: str | None = None
    modele: str | None = None
    numero_serie: str | None = None
    date_acquisition: date | None = None
    valeur_achat: float | None = None
    description: str | None = None
    photo_url: str | None = None
    manuel_url: str | None = None
    normes: str | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    maintenances: list[MaintenanceResponse] | None = None


class MaterielList(BaseModel):
    """Schéma de réponse pour la liste paginée des matériels."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    nom: str
    type: str | None = None
    marque: str | None = None
    numero_serie: str | None = None
    date_acquisition: date | None = None
    valeur_achat: float | None = None
    statut: str | None = None
    photo_url: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
