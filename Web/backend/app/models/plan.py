from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    prix_mensuel: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    prix_annuel: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # null = illimité (métrique : employés actifs ; clients portail toujours illimités).
    # PAS de server_default : avec un default serveur, SQLAlchemy ignore un None
    # explicite à l'INSERT et laisse le serveur poser la valeur — le null ne persisterait jamais.
    utilisateurs_max: Mapped[int | None] = mapped_column(nullable=True)
    chantiers_max: Mapped[int | None] = mapped_column(nullable=True)
    # Conservé en base pour compat (colonnes existantes) mais retiré de la stratégie :
    # plus aucune UI ni logique métier ne le lit.
    stockage_go: Mapped[int | None] = mapped_column(server_default="5")
    duree_essai_jours: Mapped[int] = mapped_column(server_default="30")
    actif: Mapped[bool] = mapped_column(Boolean, server_default="1")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_plan_code", "code"),
    )

    subscriptions: Mapped[list["Subscription"]] = relationship("Subscription", back_populates="plan", lazy="selectin")
