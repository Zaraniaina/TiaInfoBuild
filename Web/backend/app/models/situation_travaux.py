"""Modèle SQLAlchemy pour la situation de travaux."""
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class SituationTravaux(Base):
    """Situation de travaux : constat des ouvrages réalisés."""

    __tablename__ = "situations_travaux"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entreprise_id = Column(BigInteger, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True)
    chantier_id = Column(BigInteger, ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True)
    contrat_id = Column(BigInteger, ForeignKey("contrats.id", ondelete="SET NULL"), nullable=True)

    numero = Column(String(50), nullable=True)
    periode = Column(String(50), nullable=True)
    date_etablissement = Column(DateTime, default=datetime.utcnow)
    avancement = Column(Numeric(5, 2), default=0)
    montant = Column(Numeric(15, 2), default=0)
    observations = Column(Text, nullable=True)
    statut = Column(String(20), default="brouillon")

    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    chantier = relationship("Chantier", back_populates="situations")
    lignes = relationship("LigneSituation", back_populates="situation", cascade="all, delete-orphan")
    facture = relationship("Facture", back_populates="situation", uselist=False)


class LigneSituation(Base):
    """Ligne de situation : ouvrage réalisé avec quantités."""

    __tablename__ = "lignes_situation"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    situation_id = Column(BigInteger, ForeignKey("situations_travaux.id", ondelete="CASCADE"), nullable=True)

    ouvrage = Column(String(255), nullable=False)
    quantite_periode = Column(Numeric(12, 2), default=0)
    quantite_cumulee = Column(Numeric(12, 2), default=0)
    unite = Column(String(20), nullable=True)
    prix_unitaire = Column(Numeric(15, 2), default=0)
    montant = Column(Numeric(15, 2), default=0)
    observations = Column(Text, nullable=True)

    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    situation = relationship("SituationTravaux", back_populates="lignes")
