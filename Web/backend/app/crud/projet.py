"""CRUD operations for Projet."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import BaseCRUD
from app.models.projet import Projet
from app.schemas.projet import ProjetCreate, ProjetUpdate


class ProjetCRUD(BaseCRUD[Projet]):
    """CRUD operations for Projet."""

    def __init__(self):
        super().__init__(Projet)

    async def get_by_entreprise(
        self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100
    ) -> list[Projet]:
        """Get all projets for an entreprise."""
        result = await db.execute(
            select(Projet)
            .where(
                Projet.entreprise_id == entreprise_id,
                Projet.is_deleted == False,
            )
            .offset(skip)
            .limit(limit)
            .order_by(Projet.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_client(
        self, db: AsyncSession, client_id: int
    ) -> list[Projet]:
        """Get all projets for a client."""
        result = await db.execute(
            select(Projet)
            .where(
                Projet.client_id == client_id,
                Projet.is_deleted == False,
            )
            .order_by(Projet.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_demande(
        self, db: AsyncSession, demande_id: int
    ) -> Projet | None:
        """Get projet by demande_id."""
        result = await db.execute(
            select(Projet)
            .where(
                Projet.demande_id == demande_id,
                Projet.is_deleted == False,
            )
        )
        return result.scalar_one_or_none()

    async def generate_reference(self, db: AsyncSession) -> str:
        """Generate a unique project reference."""
        result = await db.execute(
            select(Projet)
            .where(Projet.reference.isnot(None))
            .order_by(Projet.id.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()
        if last and last.reference:
            try:
                num = int(last.reference.replace("PRJ-", "")) + 1
            except (ValueError, AttributeError):
                num = 1
        else:
            num = 1
        return f"PRJ-{num:05d}"


projet_crud = ProjetCRUD()
