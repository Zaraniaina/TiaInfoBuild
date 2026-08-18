"""Schémas Pydantic pour l'entité Rôle (RBAC)."""
from datetime import datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class RoleCreate(BaseModel):
    """Corps de la requête pour créer un rôle."""

    nom: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    code: str = Field(..., min_length=1, max_length=50)
    permissions: dict[str, Any] | None = None
    is_system: bool | None = False

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Normalise le code du rôle en minuscules."""
        return v.strip().lower()


class RoleUpdate(BaseModel):
    """Corps de la requête pour modifier un rôle."""

    nom: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    code: str | None = Field(default=None, min_length=1, max_length=50)
    permissions: dict[str, Any] | None = None
    is_system: bool | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is not None:
            return v.strip().lower()
        return v


class RoleResponse(BaseModel):
    """Schéma de réponse pour un rôle."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str
    description: str | None = None
    code: str
    permissions: dict[str, Any] | None = None
    is_system: bool | None = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
