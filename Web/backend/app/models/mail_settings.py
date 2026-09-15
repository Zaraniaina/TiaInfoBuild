"""Paramètres SMTP dédiés (super admin) — interface de mise en production.

Table dédiée (pas de JSON générique) pour permettre au super admin de
configurer le SMTP à chaud sans toucher au .env / redéployer.
"""
from datetime import datetime

from sqlalchemy import BigInteger, String, Integer, Boolean, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MailSettings(Base):
    """Configuration SMTP effective de la plateforme (singleton id=1)."""

    __tablename__ = "mail_settings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="custom")
    smtp_host: Mapped[str] = mapped_column(String(255), nullable=False, default="localhost")
    smtp_port: Mapped[int] = mapped_column(Integer, nullable=False, default=1025)
    smtp_user: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    smtp_password_encrypted: Mapped[str] = mapped_column(Text, nullable=True, default="")
    smtp_tls: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    smtp_ssl: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    smtp_from_email: Mapped[str] = mapped_column(String(255), nullable=False, default="no-reply@tiainfobuild.com")
    smtp_from_name: Mapped[str] = mapped_column(String(255), nullable=False, default="TIA INFO BUILD")
    frontend_url: Mapped[str] = mapped_column(String(255), nullable=False, default="http://localhost:5173")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_test_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_test_status: Mapped[str] = mapped_column(String(20), nullable=True, default=None)
    last_test_message: Mapped[str] = mapped_column(String(500), nullable=True, default=None)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
