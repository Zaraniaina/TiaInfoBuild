from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, Date, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    # Tenant : requis par le scoping du moteur sync (_trouve_ligne / sync_pull).
    # Nullable : les incidents historiques et ceux créés par le chantier
    # add_incident() sont backfillés / renseignés côté client.
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    declare_par: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    date_incident: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    # Aléa climatique (Madagascar : cyclones, inondations, route coupée...) —
    # NULL = incident générique non climatique.
    type_alea: Mapped[str | None] = mapped_column(String(30))
    date_fin: Mapped[datetime | None] = mapped_column(Date)
    gravite: Mapped[str] = mapped_column(String(20), server_default="moyenne")
    statut: Mapped[str] = mapped_column(String(20), server_default="signale")
    # Nombre de jours d'arrêt de chantier documentés pour cet aléa.
    impact_arret_jours: Mapped[int | None] = mapped_column(Integer)
    # Imputabilité du retard : 'climatique' (négociable), 'entreprise',
    # 'client', 'indetermine' — distingue retard négociable de retard
    # imputable à l'entreprise (pénalités de retard contractuelles).
    imputabilite: Mapped[str | None] = mapped_column(String(20))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # --- Sync desktop (offline-first, web = maître) — voir app.core.sync_cols ---
    client_ref: Mapped[str | None] = mapped_column(Text)
    sync_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    sync_updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    sync_created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_incidents_chantier_id", "chantier_id"),
        Index("idx_incidents_entreprise_id", "entreprise_id"),
        Index("idx_incidents_client_ref", "client_ref"),
        Index("idx_incidents_sync_updated_at", "sync_updated_at"),
    )

    chantier: Mapped["Chantier"] = relationship("Chantier", back_populates="incidents", lazy="selectin")
    declare_par_user: Mapped["Utilisateur | None"] = relationship("Utilisateur", back_populates="incidents", lazy="selectin")
