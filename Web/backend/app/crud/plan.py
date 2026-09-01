"""CRUD pour le modèle Plan."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan import Plan
from app.schemas.plan import PlanCreate, PlanUpdate
from app.crud.base import BaseCRUD


class PlanCRUD(BaseCRUD[Plan]):
    def __init__(self) -> None:
        super().__init__(Plan)

    async def get_by_code(self, db: AsyncSession, code: str) -> Plan | None:
        result = await db.execute(select(Plan).where(Plan.code == code, Plan.is_deleted == False))
        return result.scalar_one_or_none()

    async def get_all_active(self, db: AsyncSession) -> list[Plan]:
        result = await db.execute(select(Plan).where(Plan.actif == True, Plan.is_deleted == False))
        return result.scalars().all()
