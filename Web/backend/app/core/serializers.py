"""Helpers de sérialisation pour les réponses API."""
from typing import Any


def model_to_dict(obj: Any) -> dict[str, Any]:
    """Convertit un objet SQLAlchemy en dict de ses colonnes (sans relations)."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}