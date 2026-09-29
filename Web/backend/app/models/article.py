from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, UniqueConstraint, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    reference: Mapped[str | None] = mapped_column(String(100), unique=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    categorie: Mapped[str | None] = mapped_column(String(100))
    unite: Mapped[str] = mapped_column(String(20), server_default="unite")
    stock_actuel: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    seuil_alerte: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    stock_mini: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    prix_achat: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    prix_vente: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    marge: Mapped[float] = mapped_column(Numeric(5, 2), server_default="0")
    tva: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    poids: Mapped[float | None] = mapped_column(Numeric(10, 2))
    fournisseur_id: Mapped[int | None] = mapped_column(ForeignKey("fournisseurs.id"))
    code_barre: Mapped[str | None] = mapped_column(String(100))
    emplacement: Mapped[str | None] = mapped_column(String(100))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    # --- Sync desktop (offline-first, web = maître) — voir app.core.sync_cols ---
    client_ref: Mapped[str | None] = mapped_column(Text)
    sync_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    sync_updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    sync_created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("reference", name="uq_articles_reference"),
        Index("idx_articles_entreprise_id", "entreprise_id"),
        Index("idx_articles_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_articles_categorie", "categorie"),
        Index("idx_articles_client_ref", "client_ref"),
        Index("idx_articles_sync_updated_at", "sync_updated_at"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="articles", lazy="selectin")
    fournisseur: Mapped["Fournisseur | None"] = relationship("Fournisseur", back_populates="articles", lazy="selectin")
    lignes_devis: Mapped[list["LigneDevis"]] = relationship("LigneDevis", back_populates="article", lazy="selectin")
    mouvements_stock: Mapped[list["MouvementStock"]] = relationship("MouvementStock", back_populates="article", lazy="selectin")
