from datetime import datetime, date

from sqlalchemy import String, Numeric, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Paiement(Base):
    __tablename__ = "paiements"

    id: Mapped[int] = mapped_column(primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    facture_id: Mapped[int] = mapped_column(ForeignKey("factures.id", ondelete="CASCADE"))
    montant: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    date_paiement: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    mode_paiement: Mapped[str | None] = mapped_column(String(50))
    reference: Mapped[str | None] = mapped_column(String(100))
    banque: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(String(255))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_paiements_facture_id", "facture_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="paiements", lazy="selectin")
    facture: Mapped["Facture"] = relationship("Facture", back_populates="paiements", lazy="selectin")
