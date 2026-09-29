from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func, Integer
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
    mode_remuneration: Mapped[str] = mapped_column(String(20), server_default="mensuel")
    taux_journalier: Mapped[float | None] = mapped_column(Numeric(12, 2))
    taux_horaire: Mapped[float | None] = mapped_column(Numeric(12, 2))
    prix_tache: Mapped[float | None] = mapped_column(Numeric(12, 2))
    numero_cnaps: Mapped[str | None] = mapped_column(String(50))
    numero_ostie: Mapped[str | None] = mapped_column(String(50))
    statut_declaration: Mapped[str] = mapped_column(String(20), server_default="non_declare")
    solde_conges_annuel: Mapped[float] = mapped_column(Numeric(5, 1), server_default="30")
    statut: Mapped[str] = mapped_column(String(20), server_default="actif")
    code_qr_badge: Mapped[str | None] = mapped_column(String(100), unique=True)
    badge_statut: Mapped[str] = mapped_column(String(20), server_default="actif")
    badge_date_creation: Mapped[datetime | None] = mapped_column(DateTime)
    badge_date_desactivation: Mapped[datetime | None] = mapped_column(DateTime)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    # --- Sync desktop (offline-first, web = maître) — voir app.core.sync_cols ---
    client_ref: Mapped[str | None] = mapped_column(Text)
    sync_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    sync_updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    sync_created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_employes_entreprise_id", "entreprise_id"),
        Index("idx_employes_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_employes_nom_prenom", "nom", "prenom"),
        Index("idx_employes_client_ref", "client_ref"),
        Index("idx_employes_sync_updated_at", "sync_updated_at"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", back_populates="employes", lazy="selectin")
    equipes_dirigees: Mapped[list["Equipe"]] = relationship("Equipe", back_populates="chef_equipe", lazy="selectin")
    membres_equipe: Mapped[list["MembreEquipe"]] = relationship("MembreEquipe", back_populates="employe", lazy="selectin")
    affectation_chantiers: Mapped[list["AffectationChantier"]] = relationship("AffectationChantier", back_populates="employe", lazy="selectin")
    pointages: Mapped[list["Pointage"]] = relationship("Pointage", back_populates="employe", lazy="selectin")
    heures_supplementaires: Mapped[list["HeureSupplementaire"]] = relationship("HeureSupplementaire", back_populates="employe", lazy="selectin")
    historique_postes: Mapped[list["HistoriquePoste"]] = relationship("HistoriquePoste", back_populates="employe", lazy="selectin")

    # Espace terrain : taches, travaux, rapports, photos, signalements, commentaires
    taches: Mapped[list["Tache"]] = relationship("Tache", back_populates="employe")
    travaux_realises: Mapped[list["TravailRealise"]] = relationship("TravailRealise", back_populates="employe")
    rapports_journaliers: Mapped[list["RapportJournalier"]] = relationship("RapportJournalier", back_populates="employe")
    photos: Mapped[list["PhotoChantier"]] = relationship("PhotoChantier", back_populates="employe")
    signalements: Mapped[list["Signalement"]] = relationship("Signalement", back_populates="employe")
    commentaires: Mapped[list["Commentaire"]] = relationship("Commentaire", back_populates="employe")
    conges: Mapped[list["Conge"]] = relationship("Conge", back_populates="employe", lazy="selectin")
