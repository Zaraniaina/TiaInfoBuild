from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MouvementMateriel(Base):
    __tablename__ = "mouvements_materiel"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    materiel_id: Mapped[int] = mapped_column(ForeignKey("materiaux.id", ondelete="CASCADE"))
    chantier_origine_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id", ondelete="SET NULL"))
    chantier_destination_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id", ondelete="SET NULL"))
    date_depart: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    date_reception: Mapped[datetime | None] = mapped_column(DateTime)
    transporteur: Mapped[str | None] = mapped_column(String(255))
    statut: Mapped[str] = mapped_column(String(30), server_default="en_transit") # demande, en_transit, livre, annule
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_mouvements_materiel_entreprise", "entreprise_id"),
        Index("idx_mouvements_materiel_materiel", "materiel_id"),
        Index("idx_mouvements_materiel_statut", "statut"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", lazy="selectin")
    materiel: Mapped["Materiel"] = relationship("Materiel", back_populates="mouvements", lazy="selectin")
    chantier_origine: Mapped["Chantier"] = relationship("Chantier", foreign_keys=[chantier_origine_id], lazy="selectin")
    chantier_destination: Mapped["Chantier"] = relationship("Chantier", foreign_keys=[chantier_destination_id], lazy="selectin")
