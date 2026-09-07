"""Modele SQLAlchemy pour un signalement envoye depuis le terrain."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Signalement(Base):
    __tablename__ = "signalements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    employe_id: Mapped[int | None] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    zone: Mapped[str | None] = mapped_column(String(255))
    priorite: Mapped[str] = mapped_column(String(10), server_default="normale")
    photo_url: Mapped[str | None] = mapped_column(String(500))
    statut: Mapped[str] = mapped_column(String(20), server_default="signale")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_signalements_employe_id", "employe_id"),
        Index("idx_signalements_chantier_id", "chantier_id"),
    )

    employe: Mapped["Employe | None"] = relationship("Employe", back_populates="signalements")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="signalements")