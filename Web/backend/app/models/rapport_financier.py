from datetime import datetime

from sqlalchemy import String, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RapportFinancier(Base):
    __tablename__ = "rapports_financiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    periode: Mapped[str | None] = mapped_column(String(20))
    chiffre_affaires: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    depenses_total: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    marge: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    date_generation: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_rapports_entreprise_id", "entreprise_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="rapports_financiers", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="rapports_financiers", lazy="selectin")
