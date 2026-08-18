from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AffectationChantier(Base):
    __tablename__ = "affectation_chantiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    employe_id: Mapped[int] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    chantier_id: Mapped[int] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    date_debut: Mapped[datetime | None] = mapped_column(Date)
    date_fin: Mapped[datetime | None] = mapped_column(Date)
    role: Mapped[str | None] = mapped_column(String(100))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_affectation_chantiers_employe_id", "employe_id"),
        Index("idx_affectation_chantiers_chantier_id", "chantier_id"),
    )

    employe: Mapped["Employe"] = relationship("Employe", back_populates="affectation_chantiers", lazy="selectin")
    chantier: Mapped["Chantier"] = relationship("Chantier", back_populates="affectation_chantiers", lazy="selectin")
