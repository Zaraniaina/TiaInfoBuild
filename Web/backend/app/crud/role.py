"""CRUD pour le modèle Role."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role
from app.schemas.role import RoleCreate, RoleUpdate
from app.crud.base import BaseCRUD


class RoleCRUD(BaseCRUD[Role]):
    def __init__(self) -> None:
        super().__init__(Role)

    async def get_by_code(self, db: AsyncSession, code: str) -> Role | None:
        result = await db.execute(select(Role).where(Role.code == code))
        return result.scalar_one_or_none()

    async def get_system_roles(self, db: AsyncSession) -> list[Role]:
        result = await db.execute(select(Role).where(Role.is_system == True))
        return list(result.scalars().all())
