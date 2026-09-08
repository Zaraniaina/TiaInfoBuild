"""CRUD pour le modèle Subscription."""
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import Subscription
from app.schemas.plan import SubscriptionCreate, SubscriptionUpdate
from app.crud.base import BaseCRUD


class SubscriptionCRUD(BaseCRUD[Subscription]):
    def __init__(self) -> None:
        super().__init__(Subscription)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int) -> Subscription | None:
        result = await db.execute(
            select(Subscription)
            .where(Subscription.entreprise_id == entreprise_id, Subscription.is_deleted == False)
            .order_by(Subscription.date_debut.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_active_by_entreprise(self, db: AsyncSession, entreprise_id: int) -> Subscription | None:
        result = await db.execute(
            select(Subscription)
            .where(
                Subscription.entreprise_id == entreprise_id,
                Subscription.statut.in_(["actif", "essai"]),
                Subscription.is_deleted == False,
            )
            .order_by(Subscription.date_debut.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_expiring_soon(self, db: AsyncSession, days: int = 7) -> list[Subscription]:
        cutoff = datetime.now() + timedelta(days=days)
        result = await db.execute(
            select(Subscription)
            .where(
                Subscription.statut == "actif",
                Subscription.date_prochain_renouvellement <= cutoff,
                Subscription.is_deleted == False,
            )
        )
        return result.scalars().all()
