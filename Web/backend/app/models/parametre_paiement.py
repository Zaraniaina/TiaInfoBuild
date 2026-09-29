"""Configuration de la passerelle de paiement Papi.mg (super admin uniquement).

Stocke les clés de la boutique Papi. Les secrets (api_key, webhook_secret)
ne sont JAMAIS renvoyés en clair par l'API : masqués côté lecture, réécrits
seulement via PUT. Une seule ligne (singleton id=1).
"""
from datetime import datetime

from sqlalchemy import BigInteger, String, Boolean, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ParametrePaiement(Base):
    __tablename__ = "parametres_paiement"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    api_key: Mapped[str | None] = mapped_column(String(255))            # header "Token" Papi
    webhook_secret: Mapped[str | None] = mapped_column(String(255))     # pwhsec_... (X-Papi-Signature)
    environment: Mapped[str] = mapped_column(String(20), server_default="sandbox")  # sandbox | production
    providers_actifs: Mapped[str | None] = mapped_column(String(255))   # "MVOLA,ORANGE_MONEY" (CSV)
    notification_url: Mapped[str | None] = mapped_column(String(500))   # https://…/api/webhooks/papi
    success_url: Mapped[str | None] = mapped_column(String(500))
    failure_url: Mapped[str | None] = mapped_column(String(500))
    is_test_mode: Mapped[bool] = mapped_column(Boolean, server_default="1")
    dernier_test_at: Mapped[datetime | None] = mapped_column(DateTime)
    dernier_test_ok: Mapped[bool | None] = mapped_column()
    dernier_test_message: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
