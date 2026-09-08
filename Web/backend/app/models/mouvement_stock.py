from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MouvementStock(Base):
    __tablename__ = "mouvements_stock"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    article_id: Mapped[int] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"))
    type_mouvement: Mapped[str] = mapped_column(String(20), nullable=False)
    date_mouvement: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    quantite: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    prix_unitaire: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    fournisseur_id: Mapped[int | None] = mapped_column(ForeignKey("fournisseurs.id"))
    reference: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_mouvements_stock_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_mouvements_stock_article_id", "article_id"),
        Index("idx_mouvements_stock_date_mouvement", "date_mouvement"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="mouvements_stock", lazy="selectin")
    article: Mapped["Article"] = relationship("Article", back_populates="mouvements_stock", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", back_populates="mouvements_stock", lazy="selectin")
    fournisseur: Mapped["Fournisseur | None"] = relationship("Fournisseur", back_populates="mouvements_stock", lazy="selectin")
