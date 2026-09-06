"""Modèle Notification de l'Espace Client."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Notification(Base):
    """Notification destinée au client (application et email)."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    utilisateur_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id", ondelete="CASCADE"))
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(50), server_default="info")
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    entite_type: Mapped[str | None] = mapped_column(String(50))
    entite_id: Mapped[int | None] = mapped_column(BigInteger)
    canal: Mapped[str] = mapped_column(String(20), server_default="application")
    envoye_email: Mapped[bool] = mapped_column(Boolean, server_default="0")
    lu: Mapped[bool] = mapped_column(Boolean, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_notifications_utilisateur_id", "utilisateur_id"),
        Index("idx_notifications_client_id", "client_id"),
        Index("idx_notifications_lu", "lu"),
    )
