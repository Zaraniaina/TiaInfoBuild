from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Materiel(Base):
    __tablename__ = "materiaux"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(255))
    type: Mapped[str | None] = mapped_column(String(100))
    marque: Mapped[str | None] = mapped_column(String(100))
    modele: Mapped[str | None] = mapped_column(String(100))
    numero_serie: Mapped[str | None] = mapped_column(String(100))
    date_acquisition: Mapped[datetime | None] = mapped_column(Date)
    valeur_achat: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    description: Mapped[str | None] = mapped_column(Text)
    statut: Mapped[str] = mapped_column(String(20), server_default="disponible")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    photo_url: Mapped[str | None] = mapped_column(String(500))
    manuel_url: Mapped[str | None] = mapped_column(String(500))
    normes: Mapped[str | None] = mapped_column(Text)
    categorie_btp: Mapped[str | None] = mapped_column(String(100), server_default="engin_lourd")
    immatriculation: Mapped[str | None] = mapped_column(String(50))
    heures_moteur: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    kilometrage: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    frequence_entretien_heures: Mapped[float | None] = mapped_column(Numeric(10, 2))
    statut_vgp: Mapped[str] = mapped_column(String(30), server_default="conforme")
    date_derniere_vgp: Mapped[datetime | None] = mapped_column(Date)
    date_prochaine_vgp: Mapped[datetime | None] = mapped_column(Date)
    organisme_vgp: Mapped[str | None] = mapped_column(String(100))
    certificat_vgp_url: Mapped[str | None] = mapped_column(String(500))
    qr_code_key: Mapped[str | None] = mapped_column(String(100))

    __table_args__ = (
        Index("idx_materiaux_entreprise_id", "entreprise_id"),
        Index("idx_materiaux_statut", "statut"),
        Index("idx_materiaux_statut_vgp", "statut_vgp"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="materiaux", lazy="selectin")
    affectation_materiaux: Mapped[list["AffectationMateriel"]] = relationship("AffectationMateriel", back_populates="materiel", lazy="selectin")
    maintenances: Mapped[list["Maintenance"]] = relationship("Maintenance", back_populates="materiel", lazy="selectin")
    alertes_materiel: Mapped[list["AlerteMateriel"]] = relationship("AlerteMateriel", back_populates="materiel", lazy="selectin")
    mouvements: Mapped[list["MouvementMateriel"]] = relationship("MouvementMateriel", back_populates="materiel", lazy="selectin")

