from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import BaseCRUD
from app.models.avenant import Avenant


class AvenantCRUD(BaseCRUD):
    """CRUD pour les avenants."""

    def __init__(self) -> None:
        super().__init__(Avenant)

    async def get_by_contrat(self, db: AsyncSession, contrat_id: int, skip: int = 0, limit: int = 100):
        stmt = (
            select(Avenant)
            .where(Avenant.contrat_id == contrat_id, Avenant.is_deleted == False)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return result.scalars().all(), None

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100):
        stmt = (
            select(Avenant)
            .where(Avenant.entreprise_id == entreprise_id, Avenant.is_deleted == False)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return result.scalars().all(), None
