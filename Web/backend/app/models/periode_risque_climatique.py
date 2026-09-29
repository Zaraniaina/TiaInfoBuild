from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PeriodeRisqueClimatique(Base):
    """Période à risque climatique pré-marquée pour une entreprise/région.

    Contexte Madagascar : saison cyclonique (déc.-mars), saison des pluies
    (nov.-mars), sécheresse au Sud. Permet d'anticiper les arrêts de chantier
    et de distinguer les retards « négociables » (aléa documenté) des retards
    imputables à l'entreprise dans les clauses de pénalités de retard.
    """

    __tablename__ = "periodes_risque_climatique"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    region: Mapped[str] = mapped_column(String(80), nullable=False)
    # Mêmes valeurs que incidents.type_alea : cyclone, inondation,
    # pluies_intenses, secheresse, route_coupee, coupure_electricite, autre.
    type_risque: Mapped[str] = mapped_column(String(30), nullable=False)
    date_debut: Mapped[datetime] = mapped_column(Date, nullable=False)
    date_fin: Mapped[datetime] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_prc_entreprise_id", "entreprise_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", lazy="selectin")
