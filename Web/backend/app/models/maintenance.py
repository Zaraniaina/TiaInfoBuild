from datetime import datetime

from sqlalchemy import String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Maintenance(Base):
    __tablename__ = "maintenances"

    id: Mapped[int] = mapped_column(primary_key=True)
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

    __table_args__ = (
        Index("idx_maintenances_materiel_id", "materiel_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="maintenances", lazy="selectin")
    materiel: Mapped["Materiel"] = relationship("Materiel", back_populates="maintenances", lazy="selectin")
