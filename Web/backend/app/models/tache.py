"""Modele SQLAlchemy pour une tache attribuee a un employe sur un chantier."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Date, DateTime, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Tache(Base):
    __tablename__ = "taches"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    employe_id: Mapped[int | None] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    ouvrage: Mapped[str | None] = mapped_column(String(255))
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    date_prevue: Mapped[datetime | None] = mapped_column(Date)
    priorite: Mapped[str] = mapped_column(String(20), server_default="normale")
    statut: Mapped[str] = mapped_column(String(20), server_default="a_faire")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # --- Sync desktop (offline-first, web = maître) — voir app.core.sync_cols ---
    client_ref: Mapped[str | None] = mapped_column(Text)
    sync_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    sync_updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    sync_created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_taches_employe_id", "employe_id"),
        Index("idx_taches_chantier_id", "chantier_id"),
        Index("idx_taches_entreprise_id", "entreprise_id"),
        Index("idx_taches_client_ref", "client_ref"),
        Index("idx_taches_sync_updated_at", "sync_updated_at"),
    )

    employe: Mapped["Employe | None"] = relationship("Employe", back_populates="taches")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="taches")
    travaux_realises: Mapped[list["TravailRealise"]] = relationship("TravailRealise", back_populates="tache")