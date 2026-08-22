from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Contrat(Base):
    __tablename__ = "contrats"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    reference: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    type_contrat: Mapped[str | None] = mapped_column(String(50))
    montant: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    date_debut: Mapped[datetime | None] = mapped_column(Date)
    date_fin: Mapped[datetime | None] = mapped_column(Date)
    statut: Mapped[str] = mapped_column(String(20), server_default="en_cours")
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    devis_id: Mapped[int | None] = mapped_column(ForeignKey("devis.id"))
    objet: Mapped[str | None] = mapped_column(Text)
    conditions_paiement: Mapped[str | None] = mapped_column(Text)
    date_signature: Mapped[datetime | None] = mapped_column(Date)
    garantie_mois: Mapped[int] = mapped_column(server_default="12")
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("reference", name="uq_contrats_reference"),
        Index("idx_contrats_entreprise_id", "entreprise_id"),
        Index("idx_contrats_client_id", "client_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="contrats", lazy="selectin")
    client: Mapped["Client"] = relationship("Client", back_populates="contrats", lazy="selectin")
    factures: Mapped[list["Facture"]] = relationship("Facture", back_populates="contrat", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="contrats", lazy="selectin")
    devis: Mapped["Devis | None"] = relationship("Devis", back_populates="contrat", lazy="selectin")
