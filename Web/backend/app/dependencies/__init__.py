"""Dépendances partagées: auth, database, permissions."""
from app.database import get_db
from app.security import get_current_user, require_super_admin

__all__ = ["get_db", "get_current_user", "require_super_admin"]
