from datetime import datetime

from sqlalchemy import String, Text, Numeric, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Facture(Base):
    __tablename__ = "factures"

    id: Mapped[int] = mapped_column(primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    contrat_id: Mapped[int | None] = mapped_column(ForeignKey("contrats.id"))
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    numero: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String(20), server_default="standard")
    montant_ht: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    tva: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    montant_ttc: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    date_creation: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    date_emission: Mapped[datetime | None] = mapped_column(Date)
    date_echeance: Mapped[datetime | None] = mapped_column(Date)
    statut: Mapped[str] = mapped_column(String(20), server_default="emis")
    conditions_paiement: Mapped[str | None] = mapped_column(Text)
    mode_paiement: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    montant_paye: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_factures_entreprise_id", "entreprise_id"),
        Index("idx_factures_client_id", "client_id"),
        Index("idx_factures_numero", "numero"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="factures", lazy="selectin")
    client: Mapped["Client"] = relationship("Client", back_populates="factures", lazy="selectin")
    contrat: Mapped["Contrat | None"] = relationship("Contrat", back_populates="factures", lazy="selectin")
    paiements: Mapped[list["Paiement"]] = relationship("Paiement", back_populates="facture", lazy="selectin")
