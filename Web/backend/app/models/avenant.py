from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Numeric, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Avenant(Base):
    __tablename__ = "avenants"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    contrat_id: Mapped[int] = mapped_column(ForeignKey("contrats.id", ondelete="CASCADE"))
    numero: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    impact_montant: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    date_signature: Mapped[datetime | None] = mapped_column(Date)
    statut: Mapped[str] = mapped_column(String(20), server_default="propose")
    fichier_url: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_avenants_entreprise_id", "entreprise_id"),
        Index("idx_avenants_contrat_id", "contrat_id"),
        Index("idx_avenants_numero", "numero"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="avenants", lazy="selectin")
    contrat: Mapped["Contrat"] = relationship("Contrat", back_populates="avenants", lazy="selectin")
