from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    role_id: Mapped[int | None] = mapped_column(ForeignKey("roles.id"))
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    telephone: Mapped[str | None] = mapped_column(String(50))
    mot_de_passe_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    statut: Mapped[str] = mapped_column(String(20), server_default="actif")
    date_creation: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    derniere_connexion: Mapped[datetime | None] = mapped_column(DateTime)
    must_change_password: Mapped[bool] = mapped_column(Boolean, server_default="0")
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("email", name="uq_utilisateurs_email"),
        Index("idx_utilisateurs_entreprise_id", "entreprise_id"),
        Index("idx_utilisateurs_role_id", "role_id"),
        Index("idx_utilisateurs_client_id", "client_id"),
    )

    entreprise: Mapped["Entreprise | None"] = relationship("Entreprise", back_populates="utilisateurs", lazy="selectin")
    role: Mapped["Role | None"] = relationship("Role", back_populates="utilisateurs", lazy="selectin")
    preference: Mapped["Preference | None"] = relationship("Preference", back_populates="utilisateur", lazy="selectin")
    historique_connexions: Mapped[list["HistoriqueConnexion"]] = relationship("HistoriqueConnexion", back_populates="utilisateur", lazy="selectin")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship("RefreshToken", back_populates="utilisateur", lazy="selectin")
    chantiers: Mapped[list["Chantier"]] = relationship("Chantier", back_populates="chef_chantier", lazy="selectin")
    clients: Mapped[list["Client"]] = relationship("Client", back_populates="commercial", foreign_keys="Client.commercial_id", lazy="selectin")
    client: Mapped["Client | None"] = relationship("Client", back_populates="utilisateur", foreign_keys=[client_id], lazy="selectin", uselist=False)
    incidents: Mapped[list["Incident"]] = relationship("Incident", back_populates="declare_par_user", lazy="selectin")
    depenses_validees: Mapped[list["Depense"]] = relationship("Depense", back_populates="valide_par", lazy="selectin")

    @property
    def role_code(self) -> str | None:
        return self.role.code if self.role else None

    @property
    def role_nom(self) -> str | None:
        return self.role.nom if self.role else None
