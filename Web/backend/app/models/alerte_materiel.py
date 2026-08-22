from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AlerteMateriel(Base):
    __tablename__ = "alertes_materiel"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    materiel_id: Mapped[int] = mapped_column(ForeignKey("materiaux.id"))
    type: Mapped[str | None] = mapped_column(String(50))
    message: Mapped[str | None] = mapped_column(Text)
    date_alerte: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    statut: Mapped[str] = mapped_column(String(20), server_default="ouverte")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_alertes_materiel_entreprise_id", "entreprise_id"),
        Index("idx_alertes_materiel_materiel_id", "materiel_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="alertes_materiel", lazy="selectin")
    materiel: Mapped["Materiel"] = relationship("Materiel", back_populates="alertes_materiel", lazy="selectin")
