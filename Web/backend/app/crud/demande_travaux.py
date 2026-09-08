"""CRUD operations for DemandeTravaux."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import BaseCRUD
from app.models.demande_travaux import DemandeTravaux
from app.schemas.demande_travaux import DemandeTravauxCreate, DemandeTravauxUpdate


class DemandeTravauxCRUD(BaseCRUD[DemandeTravaux]):
    """CRUD operations for DemandeTravaux."""

    def __init__(self):
        super().__init__(DemandeTravaux)

    async def get_by_entreprise(
        self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100
    ) -> list[DemandeTravaux]:
        """Get all demandes for an entreprise."""
        result = await db.execute(
            select(DemandeTravaux)
            .where(
                DemandeTravaux.entreprise_id == entreprise_id,
                DemandeTravaux.is_deleted == False,
            )
            .offset(skip)
            .limit(limit)
            .order_by(DemandeTravaux.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_client(
        self, db: AsyncSession, client_id: int
    ) -> list[DemandeTravaux]:
        """Get all demandes for a client."""
        result = await db.execute(
            select(DemandeTravaux)
            .where(
                DemandeTravaux.client_id == client_id,
                DemandeTravaux.is_deleted == False,
            )
            .order_by(DemandeTravaux.created_at.desc())
        )
        return list(result.scalars().all())

    async def generate_numero(self, db: AsyncSession) -> str:
        """Generate a unique demande number."""
        result = await db.execute(
            select(DemandeTravaux)
            .where(DemandeTravaux.numero.isnot(None))
            .order_by(DemandeTravaux.id.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()
        if last and last.numero:
            try:
                num = int(last.numero.replace("DEM-", "")) + 1
            except (ValueError, AttributeError):
                num = 1
        else:
            num = 1
        return f"DEM-{num:05d}"


demande_travaux_crud = DemandeTravauxCRUD()
