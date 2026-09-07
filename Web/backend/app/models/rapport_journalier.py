"""Modele SQLAlchemy pour le rapport journalier de l'employe terrain."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Integer, Date, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RapportJournalier(Base):
    __tablename__ = "rapports_journaliers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    employe_id: Mapped[int | None] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    date_rapport: Mapped[datetime | None] = mapped_column(Date)
    travaux_realises: Mapped[str | None] = mapped_column(Text)
    quantites: Mapped[str | None] = mapped_column(Text)
    personnel_present: Mapped[str | None] = mapped_column(String(255))
    materiel_utilise: Mapped[str | None] = mapped_column(Text)
    materiaux_utilises: Mapped[str | None] = mapped_column(Text)
    incidents: Mapped[str | None] = mapped_column(Text)
    difficultes: Mapped[str | None] = mapped_column(Text)
    observations: Mapped[str | None] = mapped_column(Text)
    nb_photos: Mapped[int] = mapped_column(Integer, server_default="0")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_rapports_journaliers_employe_id", "employe_id"),
        Index("idx_rapports_journaliers_chantier_id", "chantier_id"),
    )

    employe: Mapped["Employe | None"] = relationship("Employe", back_populates="rapports_journaliers", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="rapports_journaliers", lazy="selectin")