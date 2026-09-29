"""Modèle Conge (demandes de congés & absences, module RH)."""
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.employe import Employe


class Conge(Base):
    """Demande de congé d'un employé, avec workflow RH (validation)."""

    __tablename__ = "conges"

    TYPE_ANNUEL = "annuel"
    TYPE_MALADIE = "maladie"
    TYPE_MATERNITE = "maternite"
    TYPE_EXCEPTIONNEL = "exceptionnel"
    TYPE_SANS_SOLDE = "sans_solde"

    STATUT_EN_ATTENTE = "en_attente"
    STATUT_VALIDE = "valide"
    STATUT_REFUSE = "refuse"
    STATUT_ANNULE = "annule"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    employe_id: Mapped[int] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(30), server_default=TYPE_ANNUEL)
    date_debut: Mapped[date] = mapped_column(Date, nullable=False)
    date_fin: Mapped[date] = mapped_column(Date, nullable=False)
    nb_jours: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False)
    statut: Mapped[str] = mapped_column(String(20), server_default=STATUT_EN_ATTENTE)
    motif: Mapped[str | None] = mapped_column(Text)
    valide_par: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id", ondelete="SET NULL"))
    date_validation: Mapped[datetime | None] = mapped_column(DateTime)
    commentaire_refus: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    # --- Sync desktop (offline-first, web = maître) — voir app.core.sync_cols ---
    client_ref: Mapped[str | None] = mapped_column(Text)
    sync_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    sync_updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    sync_created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_conges_entreprise_id", "entreprise_id"),
        Index("idx_conges_employe_id", "employe_id"),
        Index("idx_conges_statut", "statut"),
        Index("idx_conges_client_ref", "client_ref"),
        Index("idx_conges_sync_updated_at", "sync_updated_at"),
    )

    employe: Mapped["Employe"] = relationship("Employe", back_populates="conges", lazy="selectin")
