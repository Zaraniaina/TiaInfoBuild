from datetime import datetime

from sqlalchemy import String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Chantier(Base):
    __tablename__ = "chantiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"))
    chef_chantier_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    numero: Mapped[str | None] = mapped_column(String(50))
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    adresse: Mapped[str | None] = mapped_column(Text)
    code_postal: Mapped[str | None] = mapped_column(String(20))
    ville: Mapped[str | None] = mapped_column(String(100))
    date_debut: Mapped[datetime | None] = mapped_column(Date)
    date_fin_prevue: Mapped[datetime | None] = mapped_column(Date)
    date_fin_reelle: Mapped[datetime | None] = mapped_column(Date)
    budget_prevu: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    budget_previsionnel: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    budget_reel: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    marge_cible: Mapped[float] = mapped_column(Numeric(5, 2), server_default="0")
    tva: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    statut: Mapped[str] = mapped_column(String(20), server_default="planification")
    description: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_chantiers_entreprise_id", "entreprise_id"),
        Index("idx_chantiers_client_id", "client_id"),
        Index("idx_chantiers_chef_chantier_id", "chef_chantier_id"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="chantiers", lazy="selectin")
    client: Mapped["Client | None"] = relationship("Client", back_populates="chantiers", lazy="selectin")
    chef_chantier: Mapped["Utilisateur | None"] = relationship("Utilisateur", back_populates="chantiers", lazy="selectin")
    phases: Mapped[list["Phase"]] = relationship("Phase", back_populates="chantier", lazy="selectin")
    incidents: Mapped[list["Incident"]] = relationship("Incident", back_populates="chantier", lazy="selectin")
    affectation_ressources: Mapped[list["AffectationRessource"]] = relationship("AffectationRessource", back_populates="chantier", lazy="selectin")
    affectation_chantiers: Mapped[list["AffectationChantier"]] = relationship("AffectationChantier", back_populates="chantier", lazy="selectin")
    affectation_materiaux: Mapped[list["AffectationMateriel"]] = relationship("AffectationMateriel", back_populates="chantier", lazy="selectin")
    pointages: Mapped[list["Pointage"]] = relationship("Pointage", back_populates="chantier", lazy="selectin")
    heures_supplementaires: Mapped[list["HeureSupplementaire"]] = relationship("HeureSupplementaire", back_populates="chantier", lazy="selectin")
    depenses: Mapped[list["Depense"]] = relationship("Depense", back_populates="chantier", lazy="selectin")
    rapports_financiers: Mapped[list["RapportFinancier"]] = relationship("RapportFinancier", back_populates="chantier", lazy="selectin")
    contrats: Mapped[list["Contrat"]] = relationship("Contrat", back_populates="chantier", lazy="selectin")
    devis: Mapped[list["Devis"]] = relationship("Devis", back_populates="chantier", lazy="selectin")
