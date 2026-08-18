"""CRUD pour le modèle MouvementStock."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.models.mouvement_stock import MouvementStock
from app.schemas.mouvement_stock import MouvementStockCreate
from app.crud.base import BaseCRUD


class MouvementStockCRUD(BaseCRUD[MouvementStock]):
    def __init__(self) -> None:
        super().__init__(MouvementStock)

    async def get_by_article(self, db: AsyncSession, article_id: int) -> list[MouvementStock]:
        result = await db.execute(
            select(MouvementStock).where(MouvementStock.article_id == article_id, MouvementStock.is_deleted == False)
        )
        return list(result.scalars().all())

    async def get_by_entreprise_and_period(self, db: AsyncSession, entreprise_id: int, date_debut: date, date_fin: date) -> list[MouvementStock]:
        result = await db.execute(
            select(MouvementStock).where(
                MouvementStock.entreprise_id == entreprise_id,
                MouvementStock.date_mouvement >= date_debut,
                MouvementStock.date_mouvement <= date_fin,
                MouvementStock.is_deleted == False,
            )
        )
        return list(result.scalars().all())
