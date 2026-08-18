"""CRUD pour le modèle Materiel."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.materiel import Materiel
from app.schemas.materiel import MaterielCreate, MaterielUpdate
from app.crud.base import BaseCRUD


class MaterielCRUD(BaseCRUD[Materiel]):
    def __init__(self) -> None:
        super().__init__(Materiel)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Materiel], int]:
        query = select(Materiel).where(Materiel.entreprise_id == entreprise_id, Materiel.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Materiel.id).where(Materiel.entreprise_id == entreprise_id, Materiel.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())
