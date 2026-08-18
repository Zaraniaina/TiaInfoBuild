"""CRUD pour le modèle Client."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate
from app.crud.base import BaseCRUD


class ClientCRUD(BaseCRUD[Client]):
    def __init__(self) -> None:
        super().__init__(Client)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Client], int]:
        query = select(Client).where(Client.entreprise_id == entreprise_id, Client.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Client.id).where(Client.entreprise_id == entreprise_id, Client.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())
