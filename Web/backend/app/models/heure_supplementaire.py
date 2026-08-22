from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HeureSupplementaire(Base):
    __tablename__ = "heures_supplementaires"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    employe_id: Mapped[int] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    date_hs: Mapped[datetime] = mapped_column(Date, nullable=False)
    nb_heures: Mapped[float] = mapped_column(Numeric(4, 2), server_default="0")
    taux_majoration: Mapped[float] = mapped_column(Numeric(4, 2), server_default="1.5")
    motif: Mapped[str | None] = mapped_column(Text)
    statut: Mapped[str] = mapped_column(String(20), server_default="en_attente")
    type_compensation: Mapped[str] = mapped_column(String(20), server_default="paiement")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_heures_supplementaires_employe_id", "employe_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="heures_supplementaires", lazy="selectin")
    employe: Mapped["Employe"] = relationship("Employe", back_populates="heures_supplementaires", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="heures_supplementaires", lazy="selectin")
