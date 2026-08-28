"""Dépendances FastAPI: authentification et autorisation."""
from fastapi import Depends, HTTPException, status

from app.security import get_current_user, require_super_admin

__all__ = ["get_current_user", "require_super_admin", "get_current_active_user"]


async def get_current_active_user(
    payload=Depends(get_current_user),
) -> dict:
    user = payload.get("user")
    if not user or user.statut != "actif":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur inactif",
        )
    return payload
