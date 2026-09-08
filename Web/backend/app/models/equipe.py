from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Equipe(Base):
    __tablename__ = "equipes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chef_equipe_id: Mapped[int | None] = mapped_column(ForeignKey("employes.id"))
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    specialite: Mapped[str | None] = mapped_column(String(100))
    date_creation: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    statut: Mapped[str] = mapped_column(String(20), server_default="active")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_equipes_entreprise_id", "entreprise_id"),
        Index("idx_equipes_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="equipes", lazy="selectin")
    chef_equipe: Mapped["Employe | None"] = relationship("Employe", back_populates="equipes_dirigees", lazy="selectin")
    membres: Mapped[list["MembreEquipe"]] = relationship("MembreEquipe", back_populates="equipe", lazy="selectin")
