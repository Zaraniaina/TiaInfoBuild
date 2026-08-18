"""CRUD pour le modèle Equipe."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.equipe import Equipe
from app.schemas.equipe import EquipeCreate, EquipeUpdate
from app.crud.base import BaseCRUD


class EquipeCRUD(BaseCRUD[Equipe]):
    def __init__(self) -> None:
        super().__init__(Equipe)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Equipe], int]:
        query = select(Equipe).where(Equipe.entreprise_id == entreprise_id, Equipe.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Equipe.id).where(Equipe.entreprise_id == entreprise_id, Equipe.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())
