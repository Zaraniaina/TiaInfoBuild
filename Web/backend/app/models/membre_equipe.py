from datetime import datetime

from sqlalchemy import BigInteger, String, Boolean, DateTime, Date, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MembreEquipe(Base):
    __tablename__ = "membres_equipe"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    equipe_id: Mapped[int] = mapped_column(ForeignKey("equipes.id", ondelete="CASCADE"))
    employe_id: Mapped[int] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    date_debut: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    date_fin: Mapped[datetime | None] = mapped_column(Date)
    role: Mapped[str | None] = mapped_column(String(100))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("equipe_id", "employe_id", "date_debut", name="uq_membres_equipe"),
        Index("idx_membres_equipe_equipe_id", "equipe_id"),
        Index("idx_membres_equipe_employe_id", "employe_id"),
    )

    equipe: Mapped["Equipe"] = relationship("Equipe", back_populates="membres", lazy="selectin")
    employe: Mapped["Employe"] = relationship("Employe", back_populates="membres_equipe", lazy="selectin")
