from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Employe(Base):
    __tablename__ = "employes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    matricule: Mapped[str | None] = mapped_column(String(50))
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str | None] = mapped_column(String(100))
    poste: Mapped[str | None] = mapped_column(String(100))
    photo: Mapped[str | None] = mapped_column(Text)
    date_embauche: Mapped[datetime | None] = mapped_column(Date)
    type_contrat: Mapped[str] = mapped_column(String(20), server_default="CDI")
    date_debut_contrat: Mapped[datetime | None] = mapped_column(Date)
    date_fin_contrat: Mapped[datetime | None] = mapped_column(Date)
    salaire_base: Mapped[float] = mapped_column(Numeric(10, 2), server_default="0")
    telephone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    adresse: Mapped[str | None] = mapped_column(Text)
    statut: Mapped[str] = mapped_column(String(20), server_default="actif")
    code_qr_badge: Mapped[str | None] = mapped_column(String(100), unique=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_employes_entreprise_id", "entreprise_id"),
        Index("idx_employes_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_employes_nom_prenom", "nom", "prenom"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="employes", lazy="selectin")
    equipes_dirigees: Mapped[list["Equipe"]] = relationship("Equipe", back_populates="chef_equipe", lazy="selectin")
    membres_equipe: Mapped[list["MembreEquipe"]] = relationship("MembreEquipe", back_populates="employe", lazy="selectin")
    affectation_chantiers: Mapped[list["AffectationChantier"]] = relationship("AffectationChantier", back_populates="employe", lazy="selectin")
    pointages: Mapped[list["Pointage"]] = relationship("Pointage", back_populates="employe", lazy="selectin")
    heures_supplementaires: Mapped[list["HeureSupplementaire"]] = relationship("HeureSupplementaire", back_populates="employe", lazy="selectin")
    historique_postes: Mapped[list["HistoriquePoste"]] = relationship("HistoriquePoste", back_populates="employe", lazy="selectin")
