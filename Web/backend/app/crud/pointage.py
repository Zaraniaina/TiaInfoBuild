"""CRUD pour le modèle Pointage."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.models.pointage import Pointage
from app.schemas.pointage import PointageCreate, PointageUpdate
from app.crud.base import BaseCRUD


class PointageCRUD(BaseCRUD[Pointage]):
    def __init__(self) -> None:
        super().__init__(Pointage)

    async def get_by_employe_and_date(self, db: AsyncSession, employe_id: int, date_jour: date) -> Pointage | None:
        result = await db.execute(
            select(Pointage).where(Pointage.employe_id == employe_id, Pointage.date_jour == date_jour, Pointage.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def get_by_entreprise_and_period(self, db: AsyncSession, entreprise_id: int, date_debut: date, date_fin: date) -> list[Pointage]:
        result = await db.execute(
            select(Pointage).where(
                Pointage.entreprise_id == entreprise_id,
                Pointage.date_jour >= date_debut,
                Pointage.date_jour <= date_fin,
                Pointage.is_deleted == False,
            )
        )
        return list(result.scalars().all())
