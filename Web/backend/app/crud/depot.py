"""CRUD pour le modèle Depot."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.depot import Depot
from app.crud.base import BaseCRUD


class DepotCRUD(BaseCRUD[Depot]):
    def __init__(self) -> None:
        super().__init__(Depot)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Depot], int]:
        query = select(Depot).where(Depot.entreprise_id == entreprise_id, Depot.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Depot.id).where(Depot.entreprise_id == entreprise_id, Depot.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())

    async def get_by_code(self, db: AsyncSession, code: str) -> Depot | None:
        result = await db.execute(select(Depot).where(Depot.code == code, Depot.is_deleted == False))
        return result.scalar_one_or_none()
