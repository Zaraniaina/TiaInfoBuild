from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Chantier(Base):
    __tablename__ = "chantiers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"))
    chef_chantier_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    projet_id: Mapped[int | None] = mapped_column(ForeignKey("projets.id", ondelete="SET NULL"))
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
    # Zone géographique du chantier (ex: "Côte Est", "Antananarivo", "Sud") —
    # sert à croiser avec les périodes à risque climatique.
    region: Mapped[str | None] = mapped_column(String(80))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    # --- Sync desktop (offline-first, web = maître) — voir app.core.sync_cols ---
    client_ref: Mapped[str | None] = mapped_column(Text)
    sync_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    sync_updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    sync_created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_chantiers_entreprise_id", "entreprise_id"),
        Index("idx_chantiers_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_chantiers_client_id", "client_id"),
        Index("idx_chantiers_chef_chantier_id", "chef_chantier_id"),
        Index("idx_chantiers_projet_id", "projet_id"),
        Index("idx_chantiers_client_ref", "client_ref"),
        Index("idx_chantiers_sync_updated_at", "sync_updated_at"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="chantiers", lazy="selectin")
    client: Mapped["Client | None"] = relationship("Client", back_populates="chantiers", lazy="selectin")
    chef_chantier: Mapped["Utilisateur | None"] = relationship("Utilisateur", back_populates="chantiers", lazy="selectin")
    projet: Mapped["Projet | None"] = relationship("Projet", backref="chantiers_lies")
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
    mouvements_stock: Mapped[list["MouvementStock"]] = relationship("MouvementStock", back_populates="chantier", lazy="selectin")
    situations: Mapped[list["SituationTravaux"]] = relationship("SituationTravaux", back_populates="chantier", lazy="selectin")

    # Espace terrain : taches, travaux, rapports, photos, signalements, commentaires
    taches: Mapped[list["Tache"]] = relationship("Tache", back_populates="chantier")
    travaux_realises: Mapped[list["TravailRealise"]] = relationship("TravailRealise", back_populates="chantier")
    rapports_journaliers: Mapped[list["RapportJournalier"]] = relationship("RapportJournalier", back_populates="chantier")
    photos: Mapped[list["PhotoChantier"]] = relationship("PhotoChantier", back_populates="chantier")
    signalements: Mapped[list["Signalement"]] = relationship("Signalement", back_populates="chantier")
    commentaires: Mapped[list["Commentaire"]] = relationship("Commentaire", back_populates="chantier")
