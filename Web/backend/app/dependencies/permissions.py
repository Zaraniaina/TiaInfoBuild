"""Dépendances FastAPI: permissions RBAC."""
from functools import wraps
from typing import Callable

from fastapi import Depends, HTTPException, status

from app.security import get_current_user
from app.core.permissions import PERMISSION_MAP, Role

__all__ = ["require_permission"]


def require_permission(permission_code: str) -> Callable:
    """Décorateur de dépendance pour vérifier une permission RBAC."""
    def dependency(
        payload=Depends(get_current_user),
    ) -> dict:
        role_code = payload.get("role_code", "")
        permissions = PERMISSION_MAP.get(role_code, [])
        if permission_code not in permissions and "*" not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission requise: {permission_code}",
            )
        return payload
    return dependency


def require_any_permission(*permission_codes: str) -> Callable:
    """Vérifie que l'utilisateur a au moins une des permissions."""
    def dependency(
        payload=Depends(get_current_user),
    ) -> dict:
        role_code = payload.get("role_code", "")
        permissions = PERMISSION_MAP.get(role_code, [])
        if not any(p in permissions or "*" in permissions for p in permission_codes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission requise: {', '.join(permission_codes)}",
            )
        return payload
    return dependency
