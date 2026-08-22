from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Numeric, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Depense(Base):
    __tablename__ = "depenses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    montant: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    date_depense: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    categorie: Mapped[str | None] = mapped_column(String(100))
    statut: Mapped[str] = mapped_column(String(20), server_default="en_attente")
    fournisseur: Mapped[str | None] = mapped_column(String(255))
    taux_tva: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    numero_facture: Mapped[str | None] = mapped_column(String(100))
    mode_paiement: Mapped[str | None] = mapped_column(String(50))
    validee_par: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_depenses_entreprise_id", "entreprise_id"),
        Index("idx_depenses_chantier_id", "chantier_id"),
        Index("idx_depenses_date_depense", "date_depense"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="depenses", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="depenses", lazy="selectin")
    valide_par: Mapped["Utilisateur | None"] = relationship("Utilisateur", back_populates="depenses_validees", lazy="selectin")
