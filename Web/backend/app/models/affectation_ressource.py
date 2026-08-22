from datetime import datetime

from sqlalchemy import BigInteger, String, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AffectationRessource(Base):
    __tablename__ = "affectation_ressources"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    chantier_id: Mapped[int] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    type_ressource: Mapped[str] = mapped_column(String(20), nullable=False)
    ressource_id: Mapped[int] = mapped_column(nullable=False)
    date_debut: Mapped[datetime | None] = mapped_column(Date)
    date_fin: Mapped[datetime | None] = mapped_column(Date)
    role: Mapped[str | None] = mapped_column(String(100))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_affectation_ressources_chantier_id", "chantier_id"),
    )

    chantier: Mapped["Chantier"] = relationship("Chantier", back_populates="affectation_ressources", lazy="selectin")
