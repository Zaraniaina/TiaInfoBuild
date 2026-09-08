"""Modèle SQLAlchemy pour la demande de travaux."""
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


class DemandeTravaux(Base):
    """Demande de travaux exprimée par un client."""

    __tablename__ = "demandes_travaux"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entreprise_id = Column(BigInteger, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True)
    client_id = Column(BigInteger, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    commercial_id = Column(BigInteger, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)

    numero = Column(String(50), unique=True, nullable=True)
    objet = Column(String(255), nullable=False)
    type_projet = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    localisation = Column(String(255), nullable=True)
    date_demande = Column(DateTime, default=datetime.utcnow)
    date_souhaitee = Column(DateTime, nullable=True)
    documents_fournis = Column(Text, nullable=True)
    plans_disponibles = Column(Boolean, default=False)
    observations = Column(Text, nullable=True)
    statut = Column(String(20), default="nouvelle")

    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    client = relationship("Client", back_populates="demandes")
    projet = relationship("Projet", back_populates="demande", uselist=False)
