from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LigneFacture(Base):
    __tablename__ = "lignes_factures"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    facture_id: Mapped[int] = mapped_column(ForeignKey("factures.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(20), server_default="article")
    article_id: Mapped[int | None] = mapped_column(ForeignKey("articles.id"))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    categorie: Mapped[str | None] = mapped_column(String(50))
    quantite: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    unite: Mapped[str | None] = mapped_column(String(20))
    prix_unitaire: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    remise: Mapped[float] = mapped_column(Numeric(5, 2), server_default="0")
    taux_tva: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    total_ht: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    total_ttc: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    ordre: Mapped[int] = mapped_column(server_default="0")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_lignes_factures_facture_id", "facture_id"),
        Index("idx_lignes_factures_article_id", "article_id"),
    )

    facture: Mapped["Facture"] = relationship("Facture", back_populates="lignes_factures", lazy="selectin")
    article: Mapped["Article | None"] = relationship("Article", lazy="selectin")
