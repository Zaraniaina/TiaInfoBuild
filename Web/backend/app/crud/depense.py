"""CRUD pour le modèle Depense."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.depense import Depense
from app.schemas.depense import DepenseCreate, DepenseUpdate
from app.crud.base import BaseCRUD


class DepenseCRUD(BaseCRUD[Depense]):
    def __init__(self) -> None:
        super().__init__(Depense)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Depense], int]:
        query = select(Depense).where(Depense.entreprise_id == entreprise_id, Depense.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Depense.id).where(Depense.entreprise_id == entreprise_id, Depense.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())
