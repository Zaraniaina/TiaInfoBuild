"""Modele SQLAlchemy pour une photo transmise depuis le chantier."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PhotoChantier(Base):
    __tablename__ = "photos_chantier"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    employe_id: Mapped[int | None] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    tache_id: Mapped[int | None] = mapped_column(ForeignKey("taches.id", ondelete="SET NULL"))
    fichier_url: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    zone: Mapped[str | None] = mapped_column(String(255))
    date_prise: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_photos_chantier_employe_id", "employe_id"),
        Index("idx_photos_chantier_chantier_id", "chantier_id"),
    )

    employe: Mapped["Employe | None"] = relationship("Employe", back_populates="photos")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="photos")