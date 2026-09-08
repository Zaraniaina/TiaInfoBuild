from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, Time, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Pointage(Base):
    __tablename__ = "pointages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    employe_id: Mapped[int] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    date_jour: Mapped[datetime] = mapped_column(Date, nullable=False)
    heure_debut: Mapped[datetime | None] = mapped_column(Time)
    heure_fin: Mapped[datetime | None] = mapped_column(Time)
    heure_pause_debut: Mapped[datetime | None] = mapped_column(Time)
    heure_pause_fin: Mapped[datetime | None] = mapped_column(Time)
    heures_total: Mapped[float] = mapped_column(Numeric(4, 2), server_default="0")
    type: Mapped[str] = mapped_column(String(20), server_default="present")
    methode_pointage: Mapped[str] = mapped_column(String(50), server_default="manuel")
    scanne_par_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8))
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8))
    statut_validation: Mapped[str] = mapped_column(String(20), server_default="valide")
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("employe_id", "date_jour", name="uq_pointages_employe_date_jour"),
        Index("idx_pointages_employe_id", "employe_id"),
        Index("idx_pointages_date_jour", "date_jour"),
        Index("idx_pointages_chantier_id", "chantier_id"),
        Index("idx_pointages_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="pointages", lazy="selectin")
    employe: Mapped["Employe"] = relationship("Employe", back_populates="pointages", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="pointages", lazy="selectin")
