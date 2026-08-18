"""CRUD pour le modèle HistoriquePoste."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.historique_poste import HistoriquePoste
from app.crud.base import BaseCRUD


class HistoriquePosteCRUD(BaseCRUD[HistoriquePoste]):
    def __init__(self) -> None:
        super().__init__(HistoriquePoste)

    async def get_by_employe(self, db: AsyncSession, employe_id: int) -> list[HistoriquePoste]:
        result = await db.execute(
            select(HistoriquePoste).where(HistoriquePoste.employe_id == employe_id, HistoriquePoste.is_deleted == False)
        )
        return list(result.scalars().all())
