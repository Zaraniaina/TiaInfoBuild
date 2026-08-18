"""Schémas Pydantic pour l'entité Entreprise (multi-tenant)."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class EntrepriseCreate(BaseModel):
    """Corps de la requête pour créer une entreprise."""

    nom: str = Field(..., min_length=1, max_length=255)
    nom_commercial: str | None = Field(default=None, max_length=255)
    adresse: str | None = None
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    telephone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    logo: str | None = None
    abonnement: str | None = Field(default="gratuit", max_length=50)
    devise: str | None = Field(default="MGA", max_length=10)
    siret: str | None = Field(default=None, max_length=50)
    numero_tva: str | None = Field(default=None, max_length=50)
    code_ape: str | None = Field(default=None, max_length=20)
    site_web: str | None = Field(default=None, max_length=255)
    prefixe_devis: str | None = Field(default="DEV", max_length=10)
    prefixe_facture: str | None = Field(default="FAC", max_length=10)
    prefixe_contrat: str | None = Field(default="CTR", max_length=10)
    tva_defaut: float | None = Field(default=20.0)
    delai_paiement_defaut: int | None = Field(default=30)
    validite_devis: int | None = Field(default=30)
    mentions_legales: str | None = None
    actif: bool | None = True

    @field_validator("tva_defaut")
    @classmethod
    def validate_tva(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("La TVA doit être comprise entre 0 et 100")
        return v

    @field_validator("delai_paiement_defaut")
    @classmethod
    def validate_delai(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("Le délai de paiement ne peut pas être négatif")
        return v


class EntrepriseUpdate(BaseModel):
    """Corps de la requête pour modifier une entreprise."""

    nom: str | None = Field(default=None, min_length=1, max_length=255)
    nom_commercial: str | None = Field(default=None, max_length=255)
    adresse: str | None = None
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    telephone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    logo: str | None = None
    abonnement: str | None = Field(default=None, max_length=50)
    devise: str | None = Field(default=None, max_length=10)
    siret: str | None = Field(default=None, max_length=50)
    numero_tva: str | None = Field(default=None, max_length=50)
    code_ape: str | None = Field(default=None, max_length=20)
    site_web: str | None = Field(default=None, max_length=255)
    prefixe_devis: str | None = Field(default=None, max_length=10)
    prefixe_facture: str | None = Field(default=None, max_length=10)
    prefixe_contrat: str | None = Field(default=None, max_length=10)
    tva_defaut: float | None = None
    delai_paiement_defaut: int | None = None
    validite_devis: int | None = None
    mentions_legales: str | None = None
    actif: bool | None = None


class EntrepriseResponse(BaseModel):
    """Schéma de réponse pour une entreprise."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str
    nom_commercial: str | None = None
    adresse: str | None = None
    code_postal: str | None = None
    ville: str | None = None
    telephone: str | None = None
    email: EmailStr | None = None
    logo: str | None = None
    abonnement: str | None = None
    devise: str | None = None
    siret: str | None = None
    numero_tva: str | None = None
    code_ape: str | None = None
    site_web: str | None = None
    prefixe_devis: str | None = None
    prefixe_facture: str | None = None
    prefixe_contrat: str | None = None
    tva_defaut: float | None = None
    delai_paiement_defaut: int | None = None
    validite_devis: int | None = None
    mentions_legales: str | None = None
    actif: bool | None = None
    date_creation: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
