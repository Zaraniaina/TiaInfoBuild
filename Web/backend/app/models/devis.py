from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Devis(Base):
    __tablename__ = "devis"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    numero: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    objet: Mapped[str | None] = mapped_column(Text)
    montant_ht: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    tva: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    montant_ttc: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    date_creation: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    date_validite: Mapped[datetime | None] = mapped_column(Date)
    statut: Mapped[str] = mapped_column(String(20), server_default="brouillon")
    conditions_paiement: Mapped[str | None] = mapped_column(Text)
    mode_paiement: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("numero", name="uq_devis_numero"),
        Index("idx_devis_entreprise_id", "entreprise_id"),
        Index("idx_devis_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_devis_statut", "statut"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="devis", lazy="selectin")
    client: Mapped["Client"] = relationship("Client", back_populates="devis", lazy="selectin")
    lignes_devis: Mapped[list["LigneDevis"]] = relationship("LigneDevis", back_populates="devis", lazy="selectin")
    contrat: Mapped["Contrat | None"] = relationship("Contrat", back_populates="devis", lazy="selectin")
