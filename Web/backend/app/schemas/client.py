"""Schémas Pydantic pour les entités Client et ClientAdresse."""
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class ClientAdresseCreate(BaseModel):
    """Corps de la requête pour créer une adresse client."""

    client_id: int | None = None
    type: str = Field(..., min_length=1, max_length=20)
    defaut: bool | None = False
    ligne1: str = Field(..., min_length=1, max_length=255)
    ligne2: str | None = Field(default=None, max_length=255)
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    pays: str | None = Field(default="Madagascar", max_length=100)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"fac", "liv", "fact", "siege", "autre"}
        if v not in allowed:
            raise ValueError(f"Type d'adresse invalide. Valeurs autorisées: {allowed}")
        return v


class ClientAdresseResponse(BaseModel):
    """Schéma de réponse pour une adresse client."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int | None = None
    type: str
    defaut: bool | None = None
    ligne1: str
    ligne2: str | None = None
    code_postal: str | None = None
    ville: str | None = None
    pays: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ClientAdresseUpdate(BaseModel):
    """Corps de la requête pour modifier une adresse client."""

    type: str | None = Field(default=None, max_length=20)
    defaut: bool | None = None
    ligne1: str | None = Field(default=None, min_length=1, max_length=255)
    ligne2: str | None = Field(default=None, max_length=255)
    code_postal: str | None = None
    ville: str | None = None
    pays: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"fac", "liv", "fact", "siege", "autre"}
            if v not in allowed:
                raise ValueError(f"Type d'adresse invalide. Valeurs autorisées: {allowed}")
        return v


class ClientCreate(BaseModel):
    """Corps de la requête pour créer un client."""

    entreprise_id: int | None = None
    type: str | None = Field(default="particulier", max_length=20)
    civilite: str | None = Field(default=None, max_length=20)
    nom: str = Field(..., min_length=1, max_length=255)
    prenom: str | None = Field(default=None, max_length=100)
    entreprise: str | None = Field(default=None, max_length=255)
    siret: str | None = Field(default=None, max_length=50)
    numero_tva: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    telephone: str | None = Field(default=None, max_length=50)
    portable: str | None = Field(default=None, max_length=50)
    site_web: str | None = Field(default=None, max_length=255)
    adresse: str | None = None
    adresse_complement: str | None = None
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    pays: str | None = Field(default="Madagascar", max_length=100)
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    encours_max: float | None = Field(default=0.0)
    commercial_id: int | None = None
    origine: str | None = Field(default=None, max_length=100)
    rib: str | None = None
    notes: str | None = None
    adresses: list[ClientAdresseCreate] | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        allowed = {"particulier", "entreprise", "administration"}
        if v is not None and v not in allowed:
            raise ValueError(f"Type client invalide. Valeurs autorisées: {allowed}")
        return v

    @field_validator("civilite")
    @classmethod
    def validate_civilite(cls, v: str | None) -> str | None:
        allowed = {"M", "Mme", "Mx", None}
        if v is not None and v not in allowed:
            raise ValueError(f"Civilité invalide. Valeurs autorisées: M, Mme, Mx")
        return v

    @field_validator("encours_max")
    @classmethod
    def validate_encours(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("L'encours maximum ne peut pas être négatif")
        return v


class ClientUpdate(BaseModel):
    """Corps de la requête pour modifier un client."""

    nom: str | None = Field(default=None, min_length=1, max_length=255)
    prenom: str | None = Field(default=None, max_length=100)
    entreprise: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    telephone: str | None = Field(default=None, max_length=50)
    portable: str | None = Field(default=None, max_length=50)
    adresse: str | None = None
    adresse_complement: str | None = None
    code_postal: str | None = Field(default=None, max_length=20)
    ville: str | None = Field(default=None, max_length=100)
    pays: str | None = None
    mode_paiement: str | None = None
    encours_max: float | None = None
    commercial_id: int | None = None
    siret: str | None = Field(default=None, max_length=50)
    numero_tva: str | None = Field(default=None, max_length=50)
    conditions_paiement: str | None = None
    site_web: str | None = Field(default=None, max_length=255)
    rib: str | None = None
    notes: str | None = None
    civilite: str | None = None
    type: str | None = None
    origine: str | None = None

    @field_validator("encours_max")
    @classmethod
    def validate_encours(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("L'encours maximum ne peut pas être négatif")
        return v


class ClientResponse(BaseModel):
    """Schéma de réponse pour un client (détail complet)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    type: str | None = None
    civilite: str | None = None
    nom: str
    prenom: str | None = None
    entreprise: str | None = None
    siret: str | None = None
    numero_tva: str | None = None
    email: EmailStr | None = None
    telephone: str | None = None
    portable: str | None = None
    site_web: str | None = None
    adresse: str | None = None
    adresse_complement: str | None = None
    code_postal: str | None = None
    ville: str | None = None
    pays: str | None = None
    conditions_paiement: str | None = None
    mode_paiement: str | None = None
    encours_max: float | None = None
    encours_actuel: float | None = None
    commercial_id: int | None = None
    origine: str | None = None
    rib: str | None = None
    notes: str | None = None
    ca_total: float | None = None
    dernier_contact: datetime | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    adresses: list[ClientAdresseResponse] | None = None


class ClientList(BaseModel):
    """Schéma de réponse pour la liste paginée des clients."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    type: str | None = None
    nom: str
    prenom: str | None = None
    entreprise: str | None = None
    email: EmailStr | None = None
    telephone: str | None = None
    ville: str | None = None
    pays: str | None = None
    ca_total: float | None = None
    encours_actuel: float | None = None
    encours_max: float | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
