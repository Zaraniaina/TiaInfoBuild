"""Schémas Pydantic pour l'entité Employé et l'historique de poste."""
from datetime import date, datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class EmployeCreate(BaseModel):
    """Corps de la requête pour créer un employé."""

    entreprise_id: int | None = None
    matricule: str | None = Field(default=None, max_length=50)
    nom: str = Field(..., min_length=1, max_length=100)
    prenom: str | None = Field(default=None, max_length=100)
    poste: str | None = Field(default=None, max_length=100)
    photo: str | None = None
    date_embauche: date | None = None
    type_contrat: str | None = Field(default="CDI", max_length=20)
    date_debut_contrat: date | None = None
    date_fin_contrat: date | None = None
    salaire_base: float | None = Field(default=0.0)
    telephone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    adresse: str | None = None
    statut: str | None = Field(default="actif", max_length=20)

    @field_validator("salaire_base")
    @classmethod
    def validate_salaire(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le salaire ne peut pas être négatif")
        return v

    @field_validator("type_contrat")
    @classmethod
    def validate_type_contrat(cls, v: str | None) -> str | None:
        allowed = {"CDI", "CDD", "INTERIM", "STAGE", "TEMPS_PARTIEL"}
        if v is not None and v.upper() not in allowed:
            raise ValueError(f"Type de contrat invalide. Valeurs autorisées: {allowed}")
        return v

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str | None) -> str | None:
        allowed = {"actif", "inactif", "suspendu", "refuse"}
        if v is not None and v not in allowed:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {allowed}")
        return v


class EmployeUpdate(BaseModel):
    """Corps de la requête pour modifier un employé."""

    matricule: str | None = Field(default=None, max_length=50)
    nom: str | None = Field(default=None, min_length=1, max_length=100)
    prenom: str | None = Field(default=None, max_length=100)
    poste: str | None = Field(default=None, max_length=100)
    photo: str | None = None
    date_embauche: date | None = None
    type_contrat: str | None = Field(default=None, max_length=20)
    date_debut_contrat: date | None = None
    date_fin_contrat: date | None = None
    salaire_base: float | None = None
    telephone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    adresse: str | None = None
    statut: str | None = None

    @field_validator("salaire_base")
    @classmethod
    def validate_salaire(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Le salaire ne peut pas être négatif")
        return v


class ChangementPosteRequest(BaseModel):
    """Corps de la requête pour changer le poste d'un employé."""

    nouveau_poste: str = Field(..., min_length=1, max_length=100)
    type_contrat: str | None = Field(default=None, max_length=20)
    nouveau_salaire: float | None = Field(default=None, ge=0)
    date_debut: date
    motif: str | None = None


class EmployeResponse(BaseModel):
    """Schéma de réponse pour un employé (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    matricule: str | None = None
    nom: str
    prenom: str | None = None
    poste: str | None = None
    photo: str | None = None
    date_embauche: date | None = None
    type_contrat: str | None = None
    date_debut_contrat: date | None = None
    date_fin_contrat: date | None = None
    salaire_base: float | None = None
    telephone: str | None = None
    email: EmailStr | None = None
    adresse: str | None = None
    statut: str | None = None
    code_qr_badge: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    historique_postes: list[dict[str, object]] | None = None


class EmployeList(BaseModel):
    """Schéma de réponse pour la liste paginée des employés."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    matricule: str | None = None
    nom: str
    prenom: str | None = None
    poste: str | None = None
    date_embauche: date | None = None
    type_contrat: str | None = None
    salaire_base: float | None = None
    telephone: str | None = None
    email: EmailStr | None = None
    statut: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
