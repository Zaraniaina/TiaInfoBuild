"""CRUD pour le modèle Alerte."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerte import Alerte
from app.schemas.alerte import AlerteCreate
from app.crud.base import BaseCRUD


class AlerteCRUD(BaseCRUD[Alerte]):
    def __init__(self) -> None:
        super().__init__(Alerte)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Alerte], int]:
        query = select(Alerte).where(Alerte.entreprise_id == entreprise_id, Alerte.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Alerte.id).where(Alerte.entreprise_id == entreprise_id, Alerte.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())
