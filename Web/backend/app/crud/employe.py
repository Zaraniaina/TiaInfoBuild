"""CRUD pour le modèle Employe."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employe import Employe
from app.schemas.employe import EmployeCreate, EmployeUpdate
from app.crud.base import BaseCRUD


class EmployeCRUD(BaseCRUD[Employe]):
    def __init__(self) -> None:
        super().__init__(Employe)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Employe], int]:
        query = select(Employe).where(Employe.entreprise_id == entreprise_id, Employe.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Employe.id).where(Employe.entreprise_id == entreprise_id, Employe.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())

    async def get_by_poste(self, db: AsyncSession, poste: str) -> list[Employe]:
        result = await db.execute(select(Employe).where(Employe.poste == poste, Employe.is_deleted == False))
        return list(result.scalars().all())
