from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HistoriquePoste(Base):
    __tablename__ = "historique_postes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    employe_id: Mapped[int] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    poste: Mapped[str] = mapped_column(String(100), nullable=False)
    type_contrat: Mapped[str | None] = mapped_column(String(20))
    salaire_base: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    date_debut: Mapped[datetime] = mapped_column(Date, nullable=False)
    date_fin: Mapped[datetime | None] = mapped_column(Date)
    motif_changement: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_historique_postes_employe_id", "employe_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="historique_postes", lazy="selectin")
    employe: Mapped["Employe"] = relationship("Employe", back_populates="historique_postes", lazy="selectin")
