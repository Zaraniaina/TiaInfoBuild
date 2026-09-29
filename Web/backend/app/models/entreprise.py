from datetime import datetime
from typing import List

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, Time, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Entreprise(Base):
    __tablename__ = "entreprises"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    nom_commercial: Mapped[str | None] = mapped_column(String(255))
    adresse: Mapped[str | None] = mapped_column(Text)
    code_postal: Mapped[str | None] = mapped_column(String(20))
    ville: Mapped[str | None] = mapped_column(String(100))
    telephone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    logo: Mapped[str | None] = mapped_column(Text)
    abonnement: Mapped[str] = mapped_column(String(50), server_default="gratuit")
    devise: Mapped[str] = mapped_column(String(10), server_default="MGA")
    siret: Mapped[str | None] = mapped_column(String(50))
    numero_tva: Mapped[str | None] = mapped_column(String(50))
    code_ape: Mapped[str | None] = mapped_column(String(20))
    site_web: Mapped[str | None] = mapped_column(String(255))
    prefixe_devis: Mapped[str] = mapped_column(String(10), server_default="DEV")
    prefixe_facture: Mapped[str] = mapped_column(String(10), server_default="FAC")
    prefixe_contrat: Mapped[str] = mapped_column(String(10), server_default="CTR")
    prefixe_employe: Mapped[str] = mapped_column(String(10), server_default="EMP")
    prefixe_employe_journalier: Mapped[str] = mapped_column(String(10), server_default="JRN")
    tva_defaut: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    delai_paiement_defaut: Mapped[int] = mapped_column(server_default="30")
    validite_devis: Mapped[int] = mapped_column(server_default="30")
    mentions_legales: Mapped[str | None] = mapped_column(Text)
    couleurs_roles: Mapped[str | None] = mapped_column(Text)
    entete_badge: Mapped[str | None] = mapped_column(String(255))
    actif: Mapped[bool] = mapped_column(Boolean, server_default="1")
    date_creation: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_entreprise_nom", "nom"),
    )

    utilisateurs: Mapped[list["Utilisateur"]] = relationship("Utilisateur", back_populates="entreprise", lazy="selectin")
    employes: Mapped[list["Employe"]] = relationship("Employe", back_populates="entreprise", lazy="selectin")
    equipes: Mapped[list["Equipe"]] = relationship("Equipe", back_populates="entreprise", lazy="selectin")
    chantiers: Mapped[list["Chantier"]] = relationship("Chantier", back_populates="entreprise", lazy="selectin")
    articles: Mapped[list["Article"]] = relationship("Article", back_populates="entreprise", lazy="selectin")
    fournisseurs: Mapped[list["Fournisseur"]] = relationship("Fournisseur", back_populates="entreprise", lazy="selectin")
    clients: Mapped[list["Client"]] = relationship("Client", back_populates="entreprise_rel", lazy="selectin")
    devis: Mapped[list["Devis"]] = relationship("Devis", back_populates="entreprise", lazy="selectin")
    contrats: Mapped[list["Contrat"]] = relationship("Contrat", back_populates="entreprise", lazy="selectin")
    factures: Mapped[list["Facture"]] = relationship("Facture", back_populates="entreprise", lazy="selectin")
    paiements: Mapped[list["Paiement"]] = relationship("Paiement", back_populates="entreprise", lazy="selectin")
    depenses: Mapped[list["Depense"]] = relationship("Depense", back_populates="entreprise", lazy="selectin")
    avenants: Mapped[list["Avenant"]] = relationship("Avenant", back_populates="entreprise", lazy="selectin")
    rapports_financiers: Mapped[list["RapportFinancier"]] = relationship("RapportFinancier", back_populates="entreprise", lazy="selectin")
    alertes: Mapped[list["Alerte"]] = relationship("Alerte", back_populates="entreprise", lazy="selectin")
    materiaux: Mapped[list["Materiel"]] = relationship("Materiel", back_populates="entreprise", lazy="selectin")
    maintenances: Mapped[list["Maintenance"]] = relationship("Maintenance", back_populates="entreprise", lazy="selectin")
    alertes_materiel: Mapped[list["AlerteMateriel"]] = relationship("AlerteMateriel", back_populates="entreprise", lazy="selectin")
    mouvements_stock: Mapped[list["MouvementStock"]] = relationship("MouvementStock", back_populates="entreprise", lazy="selectin")
    pointages: Mapped[list["Pointage"]] = relationship("Pointage", back_populates="entreprise", lazy="selectin")
    heures_supplementaires: Mapped[list["HeureSupplementaire"]] = relationship("HeureSupplementaire", back_populates="entreprise", lazy="selectin")
    historique_postes: Mapped[list["HistoriquePoste"]] = relationship("HistoriquePoste", back_populates="entreprise", lazy="selectin")
    subscriptions: Mapped[list["Subscription"]] = relationship("Subscription", back_populates="entreprise", lazy="selectin")
    depots: Mapped[list["Depot"]] = relationship("Depot", back_populates="entreprise", lazy="selectin")
