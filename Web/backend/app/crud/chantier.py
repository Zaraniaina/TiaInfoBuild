"""CRUD pour le modèle Chantier."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chantier import Chantier
from app.schemas.chantier import ChantierCreate, ChantierUpdate
from app.crud.base import BaseCRUD


class ChantierCRUD(BaseCRUD[Chantier]):
    def __init__(self) -> None:
        super().__init__(Chantier)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, statut: str | None = None, skip: int = 0, limit: int = 100) -> tuple[list[Chantier], int]:
        query = select(Chantier).where(Chantier.entreprise_id == entreprise_id, Chantier.is_deleted == False)
        if statut:
            query = query.where(Chantier.statut == statut)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(func.count(Chantier.id)).where(Chantier.entreprise_id == entreprise_id, Chantier.is_deleted == False)
        if statut:
            count_query = count_query.where(Chantier.statut == statut)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), count_result.scalar_one_or_none() or 0
