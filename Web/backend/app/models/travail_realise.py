"""Modele SQLAlchemy pour une declaration de travaux realises par un employe."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, Date, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TravailRealise(Base):
    __tablename__ = "travaux_realises"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    employe_id: Mapped[int | None] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    tache_id: Mapped[int | None] = mapped_column(ForeignKey("taches.id", ondelete="SET NULL"))
    date_travail: Mapped[datetime | None] = mapped_column(Date)
    ouvrage: Mapped[str | None] = mapped_column(String(255))
    travail: Mapped[str] = mapped_column(String(255), nullable=False)
    quantite: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    unite: Mapped[str | None] = mapped_column(String(20))
    duree_heures: Mapped[float] = mapped_column(Numeric(5, 2), server_default="0")
    observations: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_travaux_realises_employe_id", "employe_id"),
        Index("idx_travaux_realises_chantier_id", "chantier_id"),
    )

    employe: Mapped["Employe | None"] = relationship("Employe", back_populates="travaux_realises", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="travaux_realises", lazy="selectin")
    tache: Mapped["Tache | None"] = relationship("Tache", back_populates="travaux_realises", lazy="selectin")