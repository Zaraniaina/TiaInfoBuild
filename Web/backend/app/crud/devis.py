"""CRUD pour le modèle Devis."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.devis import Devis
from app.schemas.devis import DevisCreate, DevisUpdate
from app.crud.base import BaseCRUD


class DevisCRUD(BaseCRUD[Devis]):
    def __init__(self) -> None:
        super().__init__(Devis)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Devis], int]:
        query = select(Devis).where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Devis.id).where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())
