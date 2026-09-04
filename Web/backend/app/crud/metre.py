"""CRUD operations for Metre."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import BaseCRUD
from app.models.metre import Metre
from app.schemas.metre import MetreCreate, MetreUpdate


class MetreCRUD(BaseCRUD[Metre]):
    """CRUD operations for Metre."""

    def __init__(self):
        super().__init__(Metre)

    async def get_by_projet(
        self, db: AsyncSession, projet_id: int
    ) -> list[Metre]:
        """Get all metres for a projet."""
        result = await db.execute(
            select(Metre)
            .where(
                Metre.projet_id == projet_id,
                Metre.is_deleted == False,
            )
            .order_by(Metre.ordre.asc())
        )
        return list(result.scalars().all())

    async def get_by_entreprise(
        self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100
    ) -> list[Metre]:
        """Get all metres for an entreprise."""
        result = await db.execute(
            select(Metre)
            .where(
                Metre.entreprise_id == entreprise_id,
                Metre.is_deleted == False,
            )
            .offset(skip)
            .limit(limit)
            .order_by(Metre.created_at.desc())
        )
        return list(result.scalars().all())


metre_crud = MetreCRUD()
