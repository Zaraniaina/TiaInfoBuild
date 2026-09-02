from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(20), server_default="particulier")
    civilite: Mapped[str | None] = mapped_column(String(20))
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    prenom: Mapped[str | None] = mapped_column(String(100))
    entreprise: Mapped[str | None] = mapped_column(String(255))
    siret: Mapped[str | None] = mapped_column(String(50))
    numero_tva: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    telephone: Mapped[str | None] = mapped_column(String(50))
    portable: Mapped[str | None] = mapped_column(String(50))
    site_web: Mapped[str | None] = mapped_column(String(255))
    adresse: Mapped[str | None] = mapped_column(Text)
    adresse_complement: Mapped[str | None] = mapped_column(Text)
    code_postal: Mapped[str | None] = mapped_column(String(20))
    ville: Mapped[str | None] = mapped_column(String(100))
    pays: Mapped[str] = mapped_column(String(100), server_default="Madagascar")
    conditions_paiement: Mapped[str | None] = mapped_column(Text)
    mode_paiement: Mapped[str | None] = mapped_column(String(50))
    encours_max: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    encours_actuel: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    commercial_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"))
    origine: Mapped[str | None] = mapped_column(String(100))
    rib: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    ca_total: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    dernier_contact: Mapped[datetime | None] = mapped_column(DateTime)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_clients_entreprise_id", "entreprise_id"),
        Index("idx_clients_entreprise_id_is_deleted", "entreprise_id", "is_deleted"),
        Index("idx_clients_commercial_id", "commercial_id"),
        Index("idx_clients_type", "type"),
    )

    entreprise_rel: Mapped["Entreprise"] = relationship("Entreprise", back_populates="clients", lazy="selectin")
    commercial: Mapped["Utilisateur | None"] = relationship("Utilisateur", back_populates="clients", lazy="selectin")
    adresses: Mapped[list["ClientAdresse"]] = relationship("ClientAdresse", back_populates="client", lazy="selectin")
    devis: Mapped[list["Devis"]] = relationship("Devis", back_populates="client", lazy="selectin")
    factures: Mapped[list["Facture"]] = relationship("Facture", back_populates="client", lazy="selectin")
    contrats: Mapped[list["Contrat"]] = relationship("Contrat", back_populates="client", lazy="selectin")
    chantiers: Mapped[list["Chantier"]] = relationship("Chantier", back_populates="client", lazy="selectin")
