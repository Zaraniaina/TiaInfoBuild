from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Numeric, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Phase(Base):
    __tablename__ = "phases"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    chantier_id: Mapped[int] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    date_debut: Mapped[datetime | None] = mapped_column(Date)
    date_fin: Mapped[datetime | None] = mapped_column(Date)
    budget: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    avancement_pct: Mapped[int] = mapped_column(server_default="0")
    statut: Mapped[str] = mapped_column(String(20), server_default="non_commencee")
    ordre: Mapped[int] = mapped_column(server_default="0")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_phases_chantier_id", "chantier_id"),
    )

    chantier: Mapped["Chantier"] = relationship("Chantier", back_populates="phases", lazy="selectin")
