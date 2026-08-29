"""Schémas Pydantic pour l'authentification et la gestion des utilisateurs."""
from datetime import datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


class LoginRequest(BaseModel):
    """Corps de la requête pour la connexion."""

    email: EmailStr
    password: str = Field(..., min_length=1)

    model_config = ConfigDict(str_strip_whitespace=True)


class RegisterRequest(BaseModel):
    """Corps de la requête pour l'inscription d'un utilisateur."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    nom: str = Field(..., min_length=1, max_length=100)
    prenom: str | None = Field(default=None, max_length=100)
    entreprise_id: int | None = None
    role_id: int | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, v: str) -> str:
        """Valide la politique de mot de passe (majuscule, minuscule, chiffre, spécial)."""
        import re

        if not re.search(r"[A-Z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not re.search(r"[a-z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not re.search(r"[0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return v


class RefreshRequest(BaseModel):
    """Corps de la requête pour rafraîchir un token."""

    refresh_token: str = Field(..., min_length=1)


class Token(BaseModel):
    """Réponse d'authentification contenant les tokens JWT."""

    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user: dict[str, Any] | None = None


class TokenPayload(BaseModel):
    """Payload décodé du JWT."""

    sub: str | None = None
    type: str | None = None
    exp: int | None = None
    iat: int | None = None
    role_code: str | None = None
    entreprise_id: int | None = None
    permissions: list[str] | None = None


class ChangePasswordRequest(BaseModel):
    """Corps de la requête pour changer le mot de passe."""

    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @model_validator(mode="after")
    def check_passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Les mots de passe ne correspondent pas")
        return self

    @field_validator("new_password")
    @classmethod
    def validate_new_password_policy(cls, v: str) -> str:
        """Valide la politique de mot de passe."""
        import re

        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not re.search(r"[a-z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not re.search(r"[0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return v


class PermissionResponse(BaseModel):
    """Permissions et rôle de l'utilisateur courant."""

    model_config = ConfigDict(from_attributes=True)

    role: str
    permissions: dict[str, Any]


class UserResponse(BaseModel):
    """Schéma de réponse pour un utilisateur (utilisé dans Token)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str
    prenom: str | None = None
    email: EmailStr
    role_code: str | None = None
    entreprise_id: int | None = None
    statut: str | None = None
    must_change_password: bool | None = None
    date_creation: datetime | None = None
    derniere_connexion: datetime | None = None


class RegisterEntrepriseRequest(BaseModel):
    """Corps de la requête pour créer une entreprise + admin."""

    nom_entreprise: str = Field(..., min_length=1, max_length=255)
    entreprise_email: EmailStr | None = None
    adresse: str | None = None
    telephone: str | None = None
    admin_prenom: str = Field(..., min_length=1, max_length=100)
    admin_nom: str = Field(..., min_length=1, max_length=100)
    admin_email: EmailStr
    password: str = Field(..., min_length=8)
    password_confirm: str = Field(..., min_length=8)

    @field_validator("entreprise_email", mode="before")
    @classmethod
    def coerce_empty_email(cls, v: object) -> object:
        # Défense en profondeur : le frontend peut envoyer une chaîne vide pour un email optionnel.
        # On la normalise en None pour éviter une erreur de validation EmailStr (422).
        if v is not None and str(v).strip() == "":
            return None
        return v

    @model_validator(mode="after")
    def check_passwords_match(self) -> "RegisterEntrepriseRequest":
        if self.password != self.password_confirm:
            raise ValueError("Les mots de passe ne correspondent pas")
        return self

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, v: str) -> str:
        import re
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not re.search(r"[a-z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not re.search(r"[0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial")
        return v


class RegisterEntrepriseResponse(BaseModel):
    """Réponse après création d'une entreprise + admin."""

    entreprise_id: int
    utilisateur_id: int
    email: str
    role_code: str
    message: str
