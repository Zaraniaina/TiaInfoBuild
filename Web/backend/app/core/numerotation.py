"""Core: numérotation automatique des documents (devis, factures, contrats)."""
import re
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.devis import Devis
from app.models.facture import Facture
from app.models.contrat import Contrat

__all__ = ["generate_numero", "generate_code"]


async def generate_numero(
    db: AsyncSession,
    prefix: str,
    model_cls,
    numero_field: str = "numero",
) -> str:
    """Génère un numéro unique du type PREFIX-YYYY-NNNNN."""
    year = datetime.now().year
    pattern = f"{prefix}-{year}-%"

    result = await db.execute(
        select(func.max(getattr(model_cls, numero_field)))
        .where(getattr(model_cls, numero_field).like(pattern))
    )
    last = result.scalar_one_or_none()

    if last:
        match = re.search(r"(\d+)$", last)
        next_num = int(match.group(1)) + 1 if match else 1
    else:
        next_num = 1

    return f"{prefix}-{year}-{next_num:05d}"


async def generate_code(
    db: AsyncSession,
    model_cls,
    field: str,
    prefix: str,
    padding: int = 4,
) -> str:
    """Génère un code séquentiel unique PREFIX-NNNN (zéro saisie utilisateur).

    Pour les identifiants sans année (articles, dépôts) : MAX existant + 1,
    avec vérification d'unicité et retry anti-collision (les lignes en
    soft-delete restent dans la table et comptent).
    """
    col = getattr(model_cls, field)
    result = await db.execute(select(func.max(col)).where(col.like(f"{prefix}-%")))
    last = result.scalar_one_or_none()
    match = re.search(r"-(\d+)$", last) if last else None
    n = int(match.group(1)) if match else 0

    candidate = f"{prefix}-{n + 1:0{padding}d}"
    while (
        await db.execute(select(func.count()).select_from(model_cls).where(col == candidate))
    ).scalar_one():
        n += 1
        candidate = f"{prefix}-{n + 1:0{padding}d}"
    return candidate
