"""Modèle SQLAlchemy pour le métré (quantités ouvrages)."""
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


class Metre(Base):
    """Métré d'un projet : calcul des quantités d'ouvrages."""

    __tablename__ = "metres"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entreprise_id = Column(BigInteger, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True)
    projet_id = Column(BigInteger, ForeignKey("projets.id", ondelete="CASCADE"), nullable=True)

    ouvrage = Column(String(255), nullable=False)
    designation = Column(String(255), nullable=True)
    formule = Column(String(255), nullable=True)
    dimensions = Column(Text, nullable=True)
    unite = Column(String(20), nullable=True)
    quantite = Column(Numeric(12, 2), default=0)
    observations = Column(Text, nullable=True)
    document_reference = Column(String(255), nullable=True)
    ordre = Column(Integer, default=0)

    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    projet = relationship("Projet", back_populates="metres")
