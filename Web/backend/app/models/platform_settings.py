"""Paramètres de la plateforme (super admin)."""
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PlatformSettings(Base):
    """Stockage clé/valeur des paramètres de la plateforme SaaS."""
    __tablename__ = "platform_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    cle: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    valeur: Mapped[str] = mapped_column(Text, nullable=True)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
