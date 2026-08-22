from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Numeric, Boolean, DateTime, Date, ForeignKey, Index, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Alerte(Base):
    __tablename__ = "alertes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    type_entite: Mapped[str | None] = mapped_column(String(50))
    entite_id: Mapped[int | None] = mapped_column(Integer)
    niveau_gravite: Mapped[str] = mapped_column(String(20), server_default="info")
    statut: Mapped[str] = mapped_column(String(20), server_default="non_lue")
    lue: Mapped[bool] = mapped_column(Boolean, server_default="0")
    date_lecture: Mapped[datetime | None] = mapped_column(DateTime)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_alertes_entreprise_id", "entreprise_id"),
        Index("idx_alertes_statut", "statut"),
        Index("idx_alertes_lue", "lue"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="alertes", lazy="selectin")
