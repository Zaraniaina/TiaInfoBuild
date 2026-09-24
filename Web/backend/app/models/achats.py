"""Modèles du module Achats fournisseurs (cycle commande → réception → facture → paiement)."""
from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CommandeFournisseur(Base):
    __tablename__ = "commandes_fournisseur"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    fournisseur_id: Mapped[int] = mapped_column(ForeignKey("fournisseurs.id"))
    numero: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    date_commande: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    date_livraison_prevue: Mapped[datetime | None] = mapped_column(Date)
    # brouillon, envoyee, confirmee, partiellement_recue, recue, annulee
    statut: Mapped[str] = mapped_column(String(30), server_default="brouillon")
    montant_ht: Mapped[float] = mapped_column(Numeric(14, 2), server_default="0")
    taux_tva: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    montant_tva: Mapped[float] = mapped_column(Numeric(14, 2), server_default="0")
    montant_ttc: Mapped[float] = mapped_column(Numeric(14, 2), server_default="0")
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    # --- Sync desktop (offline-first, web = maître) — voir app.core.sync_cols ---
    client_ref: Mapped[str | None] = mapped_column(Text)
    sync_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    sync_updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())
    sync_created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_cf_entreprise_id", "entreprise_id"),
        Index("idx_cf_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_cf_fournisseur_id", "fournisseur_id"),
        Index("idx_cf_chantier_id", "chantier_id"),
        Index("idx_cf_statut", "statut"),
        Index("idx_cf_client_ref", "client_ref"),
        Index("idx_cf_sync_updated_at", "sync_updated_at"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", lazy="selectin")
    fournisseur: Mapped["Fournisseur"] = relationship("Fournisseur", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", lazy="selectin")
    lignes: Mapped[list["LigneCommandeFournisseur"]] = relationship(
        "LigneCommandeFournisseur", back_populates="commande", lazy="selectin", cascade="all, delete-orphan"
    )
    receptions: Mapped[list["ReceptionFournisseur"]] = relationship(
        "ReceptionFournisseur", back_populates="commande", lazy="selectin"
    )


class LigneCommandeFournisseur(Base):
    __tablename__ = "lignes_commande_fournisseur"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    commande_id: Mapped[int] = mapped_column(ForeignKey("commandes_fournisseur.id", ondelete="CASCADE"))
    article_id: Mapped[int | None] = mapped_column(ForeignKey("articles.id"))
    designation: Mapped[str] = mapped_column(String(255), nullable=False)
    quantite: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    quantite_recue: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    prix_unitaire: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    montant_ht: Mapped[float] = mapped_column(Numeric(14, 2), server_default="0")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_lcf_commande_id", "commande_id"),
        Index("idx_lcf_article_id", "article_id"),
    )

    commande: Mapped["CommandeFournisseur"] = relationship("CommandeFournisseur", back_populates="lignes")
    article: Mapped["Article | None"] = relationship("Article", lazy="selectin")


class ReceptionFournisseur(Base):
    __tablename__ = "receptions_fournisseur"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    commande_id: Mapped[int] = mapped_column(ForeignKey("commandes_fournisseur.id"))
    numero: Mapped[str | None] = mapped_column(String(50))
    date_reception: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    depot_id: Mapped[int | None] = mapped_column(ForeignKey("depots.id"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    complete: Mapped[bool] = mapped_column(Boolean, server_default="0")
    notes: Mapped[str | None] = mapped_column(Text)
    received_by: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_rf_commande_id", "commande_id"),
        Index("idx_rf_entreprise_id", "entreprise_id"),
    )

    commande: Mapped["CommandeFournisseur"] = relationship("CommandeFournisseur", back_populates="receptions")
    lignes: Mapped[list["LigneReceptionFournisseur"]] = relationship(
        "LigneReceptionFournisseur", back_populates="reception", lazy="selectin", cascade="all, delete-orphan"
    )


class LigneReceptionFournisseur(Base):
    __tablename__ = "lignes_reception_fournisseur"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    reception_id: Mapped[int] = mapped_column(ForeignKey("receptions_fournisseur.id", ondelete="CASCADE"))
    ligne_commande_id: Mapped[int] = mapped_column(ForeignKey("lignes_commande_fournisseur.id"))
    quantite_recue: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    conforme: Mapped[bool] = mapped_column(Boolean, server_default="1")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_lrf_reception_id", "reception_id"),
    )

    reception: Mapped["ReceptionFournisseur"] = relationship("ReceptionFournisseur", back_populates="lignes")
    ligne_commande: Mapped["LigneCommandeFournisseur"] = relationship("LigneCommandeFournisseur")


class FactureFournisseur(Base):
    __tablename__ = "factures_fournisseur"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    fournisseur_id: Mapped[int] = mapped_column(ForeignKey("fournisseurs.id"))
    commande_id: Mapped[int | None] = mapped_column(ForeignKey("commandes_fournisseur.id"))
    chantier_id: Mapped[int | None] = mapped_column(ForeignKey("chantiers.id"))
    numero: Mapped[str] = mapped_column(String(100), nullable=False)
    date_facture: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    date_echeance: Mapped[datetime | None] = mapped_column(Date)
    # a_payer, partiellement_payee, payee, litige, annulee
    statut: Mapped[str] = mapped_column(String(30), server_default="a_payer")
    montant_ht: Mapped[float] = mapped_column(Numeric(14, 2), server_default="0")
    taux_tva: Mapped[float] = mapped_column(Numeric(5, 2), server_default="20.00")
    montant_tva: Mapped[float] = mapped_column(Numeric(14, 2), server_default="0")
    montant_ttc: Mapped[float] = mapped_column(Numeric(14, 2), server_default="0")
    montant_paye: Mapped[float] = mapped_column(Numeric(14, 2), server_default="0")
    notes: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_ff_entreprise_id", "entreprise_id"),
        Index("idx_ff_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_ff_fournisseur_id", "fournisseur_id"),
        Index("idx_ff_statut", "statut"),
        Index("idx_ff_date_echeance", "date_echeance"),
    )

    entreprise: Mapped["Entreprise"] = relationship("Entreprise", lazy="selectin")
    fournisseur: Mapped["Fournisseur"] = relationship("Fournisseur", lazy="selectin")
    commande: Mapped["CommandeFournisseur | None"] = relationship("CommandeFournisseur", lazy="selectin")
    chantier: Mapped["Chantier | None"] = relationship("Chantier", lazy="selectin")
    paiements: Mapped[list["PaiementFournisseur"]] = relationship(
        "PaiementFournisseur", back_populates="facture", lazy="selectin"
    )


class PaiementFournisseur(Base):
    __tablename__ = "paiements_fournisseur"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    facture_id: Mapped[int] = mapped_column(ForeignKey("factures_fournisseur.id"))
    montant: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    date_paiement: Mapped[datetime] = mapped_column(Date, server_default=func.current_date())
    # virement, especes, cheque, mvola, orange_money, airtel_money
    mode_paiement: Mapped[str] = mapped_column(String(30), server_default="virement")
    reference: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_pf_facture_id", "facture_id"),
        Index("idx_pf_entreprise_id", "entreprise_id"),
    )

    facture: Mapped["FactureFournisseur"] = relationship("FactureFournisseur", back_populates="paiements")
