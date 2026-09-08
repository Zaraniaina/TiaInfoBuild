from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Fournisseur(Base):
    __tablename__ = "fournisseurs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    contact: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    telephone: Mapped[str | None] = mapped_column(String(50))
    adresse: Mapped[str | None] = mapped_column(Text)
    code_postal: Mapped[str | None] = mapped_column(String(20))
    ville: Mapped[str | None] = mapped_column(String(100))
    pays: Mapped[str] = mapped_column(String(100), server_default="Madagascar")
    siret: Mapped[str | None] = mapped_column(String(50))
    conditions_paiement: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_fournisseurs_entreprise_id", "entreprise_id"),
        Index("idx_fournisseurs_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="fournisseurs", lazy="selectin")
    articles: Mapped[list["Article"]] = relationship("Article", back_populates="fournisseur", lazy="selectin")
    mouvements_stock: Mapped[list["MouvementStock"]] = relationship("MouvementStock", back_populates="fournisseur", lazy="selectin")
