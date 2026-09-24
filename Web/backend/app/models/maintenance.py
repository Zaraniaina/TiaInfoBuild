from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Maintenance(Base):
    __tablename__ = "maintenances"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    materiel_id: Mapped[int] = mapped_column(ForeignKey("materiaux.id", ondelete="CASCADE"))
    date_maintenance: Mapped[datetime] = mapped_column(Date, nullable=False)
    type: Mapped[str | None] = mapped_column(String(50))
    cout: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    description: Mapped[str | None] = mapped_column(Text)
    prochaine_date_echeance: Mapped[datetime | None] = mapped_column(Date)
    technicien: Mapped[str | None] = mapped_column(String(255))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # --- Sync desktop (offline-first, web = maître) — voir app.core.sync_cols ---
    client_ref: Mapped[str | None] = mapped_column(Text)
    sync_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    sync_updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    sync_created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_maintenances_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_maintenances_materiel_id", "materiel_id"),
        Index("idx_maintenances_client_ref", "client_ref"),
        Index("idx_maintenances_sync_updated_at", "sync_updated_at"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="maintenances", lazy="selectin")
    materiel: Mapped["Materiel"] = relationship("Materiel", back_populates="maintenances", lazy="selectin")
