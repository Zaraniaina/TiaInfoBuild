"""CRUD pour le modèle Entreprise."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entreprise import Entreprise
from app.schemas.entreprise import EntrepriseCreate, EntrepriseUpdate
from app.crud.base import BaseCRUD


class EntrepriseCRUD(BaseCRUD[Entreprise]):
    def __init__(self) -> None:
        super().__init__(Entreprise)

    async def get_by_nom(self, db: AsyncSession, nom: str) -> Entreprise | None:
        result = await db.execute(select(Entreprise).where(Entreprise.nom == nom))
        return result.scalar_one_or_none()
