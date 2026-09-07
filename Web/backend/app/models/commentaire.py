"""Modele SQLAlchemy pour un commentaire / message de communication terrain."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Commentaire(Base):
    __tablename__ = "commentaires"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id", ondelete="CASCADE"))
    employe_id: Mapped[int | None] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"))
    utilisateur_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id", ondelete="CASCADE"))
    objet_type: Mapped[str | None] = mapped_column(String(30))
    objet_id: Mapped[int | None] = mapped_column(BigInteger)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_commentaires_employe_id", "employe_id"),
        Index("idx_commentaires_objet", "objet_type", "objet_id"),
    )

    employe: Mapped["Employe | None"] = relationship("Employe", back_populates="commentaires", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="commentaires", lazy="selectin")