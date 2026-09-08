from datetime import datetime

from sqlalchemy import BigInteger, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Preference(Base):
    __tablename__ = "preferences"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("utilisateurs.id", ondelete="CASCADE"), unique=True)
    theme: Mapped[str] = mapped_column(String(20), server_default="light")
    langue: Mapped[str] = mapped_column(String(10), server_default="fr")
    date_format: Mapped[str] = mapped_column(String(20), server_default="DD/MM/YYYY")
    devise: Mapped[str] = mapped_column(String(10), server_default="MGA")
    notif_email: Mapped[bool] = mapped_column(Boolean, server_default="1")
    notif_push: Mapped[bool] = mapped_column(Boolean, server_default="1")
    notif_factures_retard: Mapped[bool] = mapped_column(Boolean, server_default="1")
    notif_stock_bas: Mapped[bool] = mapped_column(Boolean, server_default="1")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_preferences_user_id"),
        Index("idx_preferences_user_id", "user_id"),
    )

    utilisateur: Mapped["Utilisateur"] = relationship("Utilisateur", back_populates="preference", lazy="selectin")
