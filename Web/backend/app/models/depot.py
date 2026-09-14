"""Modèle SQLAlchemy pour les Dépôts / Zones de stockage BTP."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Depot(Base):
    """Représente un dépôt, magasin, zone extérieure ou armoire d'outillage.

    Types BTP courants :
    - magasin_principal   : entrepôt central de l'entreprise
    - depot_chantier      : dépôt tampon sur site de chantier
    - zone_exterieure     : aire de stockage vrac/agglomérats
    - armoire_outillage   : armoire sécurisée pour outillage portatif
    """

    __tablename__ = "depots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    adresse: Mapped[str | None] = mapped_column(Text)
    responsable: Mapped[str | None] = mapped_column(String(255))
    telephone: Mapped[str | None] = mapped_column(String(50))
    capacite_m2: Mapped[float | None] = mapped_column(Numeric(10, 2))
    type: Mapped[str] = mapped_column(String(50), server_default="magasin_principal")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_depots_entreprise_id", "entreprise_id"),
        Index("idx_depots_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_depots_code", "code"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="depots", lazy="selectin")
