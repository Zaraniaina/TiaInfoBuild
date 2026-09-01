from datetime import datetime, timedelta
from typing import List

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"), nullable=False)
    date_debut: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    date_fin: Mapped[datetime | None] = mapped_column(DateTime)
    date_prochain_renouvellement: Mapped[datetime | None] = mapped_column(DateTime)
    statut: Mapped[str] = mapped_column(String(20), server_default="actif")
    mode_paiement: Mapped[str | None] = mapped_column(String(50))
    prix_paye: Mapped[float | None] = mapped_column(Numeric(10, 2))
    periode: Mapped[str | None] = mapped_column(String(20))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_subscription_entreprise", "entreprise_id"),
        Index("idx_subscription_plan", "plan_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="subscriptions", lazy="selectin")
    plan: Mapped["Plan"] = relationship("Plan", back_populates="subscriptions", lazy="selectin")
