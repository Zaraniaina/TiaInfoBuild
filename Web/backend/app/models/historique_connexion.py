from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HistoriqueConnexion(Base):
    __tablename__ = "historique_connexions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    utilisateur_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id", ondelete="SET NULL"))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
    reussi: Mapped[bool] = mapped_column(Boolean, server_default="1")
    date_connexion: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_historique_connexions_utilisateur_id", "utilisateur_id"),
    )

    utilisateur: Mapped["Utilisateur"] = relationship("Utilisateur", back_populates="historique_connexions", lazy="selectin")
