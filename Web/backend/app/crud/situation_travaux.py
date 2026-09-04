"""CRUD operations for SituationTravaux and LigneSituation."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import BaseCRUD
from app.models.situation_travaux import SituationTravaux, LigneSituation
from app.schemas.situation_travaux import SituationTravauxCreate, SituationTravauxUpdate, LigneSituationCreate


class SituationTravauxCRUD(BaseCRUD[SituationTravaux]):
    """CRUD operations for SituationTravaux."""

    def __init__(self):
        super().__init__(SituationTravaux)

    async def get_by_chantier(
        self, db: AsyncSession, chantier_id: int
    ) -> list[SituationTravaux]:
        """Get all situations for a chantier."""
        result = await db.execute(
            select(SituationTravaux)
            .where(
                SituationTravaux.chantier_id == chantier_id,
                SituationTravaux.is_deleted == False,
            )
            .order_by(SituationTravaux.date_etablissement.desc())
        )
        return list(result.scalars().all())

    async def get_by_entreprise(
        self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100
    ) -> list[SituationTravaux]:
        """Get all situations for an entreprise."""
        result = await db.execute(
            select(SituationTravaux)
            .where(
                SituationTravaux.entreprise_id == entreprise_id,
                SituationTravaux.is_deleted == False,
            )
            .offset(skip)
            .limit(limit)
            .order_by(SituationTravaux.created_at.desc())
        )
        return list(result.scalars().all())

    async def generate_numero(self, db: AsyncSession) -> str:
        """Generate a unique situation number."""
        result = await db.execute(
            select(SituationTravaux)
            .where(SituationTravaux.numero.isnot(None))
            .order_by(SituationTravaux.id.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()
        if last and last.numero:
            try:
                num = int(last.numero.replace("SIT-", "")) + 1
            except (ValueError, AttributeError):
                num = 1
        else:
            num = 1
        return f"SIT-{num:05d}"


class LigneSituationCRUD(BaseCRUD[LigneSituation]):
    """CRUD operations for LigneSituation."""

    def __init__(self):
        super().__init__(LigneSituation)

    async def get_by_situation(
        self, db: AsyncSession, situation_id: int
    ) -> list[LigneSituation]:
        """Get all lignes for a situation."""
        result = await db.execute(
            select(LigneSituation)
            .where(
                LigneSituation.situation_id == situation_id,
                LigneSituation.is_deleted == False,
            )
        )
        return list(result.scalars().all())


situation_travaux_crud = SituationTravauxCRUD()
ligne_situation_crud = LigneSituationCRUD()
