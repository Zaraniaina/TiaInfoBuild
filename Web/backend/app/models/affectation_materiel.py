from datetime import datetime

from sqlalchemy import String, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AffectationMateriel(Base):
    __tablename__ = "affectation_materiaux"

    id: Mapped[int] = mapped_column(primary_key=True)
    materiel_id: Mapped[int] = mapped_column(ForeignKey("materiaux.id", ondelete="CASCADE"))
    chantier_id: Mapped[int] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    date_debut: Mapped[datetime | None] = mapped_column(Date)
    date_fin: Mapped[datetime | None] = mapped_column(Date)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_affectation_materiaux_materiel_id", "materiel_id"),
        Index("idx_affectation_materiaux_chantier_id", "chantier_id"),
    )

    materiel: Mapped["Materiel"] = relationship("Materiel", back_populates="affectation_materiaux", lazy="selectin")
    chantier: Mapped["Chantier"] = relationship("Chantier", back_populates="affectation_materiaux", lazy="selectin")
