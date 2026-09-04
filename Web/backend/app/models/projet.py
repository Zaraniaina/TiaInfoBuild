"""Modèle SQLAlchemy pour le projet (étude/métré)."""
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


class Projet(Base):
    """Projet de travaux issu d'une demande."""

    __tablename__ = "projets"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entreprise_id = Column(BigInteger, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True)
    client_id = Column(BigInteger, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    demande_id = Column(BigInteger, ForeignKey("demandes_travaux.id", ondelete="SET NULL"), nullable=True)
    responsable_id = Column(BigInteger, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)

    reference = Column(String(50), unique=True, nullable=True)
    nom = Column(String(255), nullable=False)
    type_projet = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    localisation = Column(String(255), nullable=True)
    adresse = Column(String(255), nullable=True)

    # Dimensions
    longueur = Column(Numeric(10, 2), nullable=True)
    largeur = Column(Numeric(10, 2), nullable=True)
    hauteur = Column(Numeric(10, 2), nullable=True)
    surface = Column(Numeric(10, 2), nullable=True)
    volume = Column(Numeric(10, 2), nullable=True)
    nombre_niveaux = Column(Integer, nullable=True)

    plans_documents = Column(Text, nullable=True)
    observations = Column(Text, nullable=True)
    statut = Column(String(20), default="en_etude")

    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    demande = relationship("DemandeTravaux", back_populates="projet")
    metres = relationship("Metre", back_populates="projet", cascade="all, delete-orphan")
    devis = relationship("Devis", back_populates="projet")
