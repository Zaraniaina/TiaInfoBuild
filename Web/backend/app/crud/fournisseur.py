"""CRUD pour le modèle Fournisseur."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fournisseur import Fournisseur
from app.schemas.fournisseur import FournisseurCreate, FournisseurUpdate
from app.crud.base import BaseCRUD


class FournisseurCRUD(BaseCRUD[Fournisseur]):
    def __init__(self) -> None:
        super().__init__(Fournisseur)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Fournisseur], int]:
        query = select(Fournisseur).where(Fournisseur.entreprise_id == entreprise_id, Fournisseur.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Fournisseur.id).where(Fournisseur.entreprise_id == entreprise_id, Fournisseur.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())
