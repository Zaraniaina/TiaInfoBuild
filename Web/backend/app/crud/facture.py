"""CRUD pour le modèle Facture."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.facture import Facture
from app.schemas.facture import FactureCreate, FactureUpdate
from app.crud.base import BaseCRUD


class FactureCRUD(BaseCRUD[Facture]):
    def __init__(self) -> None:
        super().__init__(Facture)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Facture], int]:
        query = select(Facture).where(Facture.entreprise_id == entreprise_id, Facture.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Facture.id).where(Facture.entreprise_id == entreprise_id, Facture.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())
