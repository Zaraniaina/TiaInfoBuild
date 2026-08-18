from datetime import datetime

from sqlalchemy import String, Text, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    chantier_id: Mapped[int] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    declare_par: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    date_incident: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    gravite: Mapped[str] = mapped_column(String(20), server_default="moyenne")
    statut: Mapped[str] = mapped_column(String(20), server_default="signale")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_incidents_chantier_id", "chantier_id"),
    )

    chantier: Mapped["Chantier"] = relationship("Chantier", back_populates="incidents", lazy="selectin")
    declare_par_user: Mapped["Utilisateur | None"] = relationship("Utilisateur", back_populates="incidents", lazy="selectin")
