"""Core: numérotation automatique des documents (devis, factures, contrats)."""
import re
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.devis import Devis
from app.models.facture import Facture
from app.models.contrat import Contrat

__all__ = ["generate_numero"]


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
