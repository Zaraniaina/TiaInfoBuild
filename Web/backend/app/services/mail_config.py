"""Service de résolution SMTP : DB (super admin) > .env (fallback).

Principe mise en production : le super admin configure le SMTP depuis
l'interface → stocké en table mail_settings → effectif à chaud, sans
redéploiement. Tant que la table est vide/inactive, on retombe sur .env.

Le mot de passe SMTP est chiffré avec Fernet (AES-128-CBC + HMAC-SHA256),
clé dérivée du SECRET_KEY de l'application.
"""
import base64
import hashlib
import logging
from dataclasses import dataclass

from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

FERNET_PREFIX = "fernet:"
LEGACY_PREFIX = "enc:"  # ancien chiffrement XOR (compat migration douce)


@dataclass
class EffectiveSmtpConfig:
    host: str
    port: int
    user: str
    password: str
    use_tls: bool
    use_ssl: bool
    from_email: str
    from_name: str
    frontend_url: str
    source: str  # "database" | "env"
    provider: str = "custom"


def _fernet() -> Fernet:
    """Clé Fernet dérivée du SECRET_KEY (changé → mots de passe à ressaisir)."""
    secret = (settings.secret_key or "").encode("utf-8")
    if not secret:
        raise RuntimeError("SECRET_KEY requis pour chiffrer le mot de passe SMTP")
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret).digest()))


def encrypt_password(raw: str) -> str:
    """Chiffrement authentifié du mot de passe SMTP (Fernet : AES + HMAC).

    Remplace l'ancien XOR : une donnée altérée est détectée au déchiffrement.
    Format stocké : « fernet:<token> ».
    """
    if not raw:
        return ""
    return FERNET_PREFIX + _fernet().encrypt(raw.encode("utf-8")).decode("ascii")


def decrypt_password(enc: str | None) -> str:
    """Déchiffre un mot de passe SMTP stocké (Fernet, legacy XOR ou clair)."""
    if not enc:
        return ""
    if enc.startswith(FERNET_PREFIX):
        try:
            raw = _fernet().decrypt(enc[len(FERNET_PREFIX):].encode("ascii"))
            return raw.decode("utf-8")
        except Exception:
            logger.warning(
                "Impossible de déchiffrer le mot de passe SMTP (SECRET_KEY changé ?) : "
                "ressaisissez-le dans Super Admin > Configuration Email / SMTP."
            )
            return ""
    if enc.startswith(LEGACY_PREFIX):
        # Compat : mots de passe chiffrés par l'ancien XOR, toujours lisibles.
        try:
            key = (settings.secret_key or "tia-mail-key").encode()
            data = base64.b64decode(enc[len(LEGACY_PREFIX):])
            return bytes(b ^ key[i % len(key)] for i, b in enumerate(data)).decode("utf-8")
        except Exception:
            logger.warning("Impossible de déchiffrer un mot de passe SMTP au format hérité")
            return ""
    # Compat : valeur historiquement stockée en clair.
    return enc


def config_from_values(
    *,
    host: str,
    port: int,
    user: str = "",
    password: str = "",
    use_tls: bool = False,
    use_ssl: bool = False,
    from_email: str = "",
    from_name: str = "",
    frontend_url: str = "",
    provider: str = "custom",
    source: str = "draft",
) -> EffectiveSmtpConfig:
    """Construit une config SMTP depuis des valeurs brutes (test à chaud).

    Les valeurs vides retombent sur le .env pour ne jamais produire une
    config incohérente ; SSL est prioritaire sur STARTTLS (jamais les deux).
    """
    return EffectiveSmtpConfig(
        host=(host or "").strip(),
        port=int(port or 587),
        user=(user or "").strip(),
        password=password or "",
        use_tls=bool(use_tls) and not bool(use_ssl),
        use_ssl=bool(use_ssl),
        from_email=(from_email or settings.smtp_from_email).strip(),
        from_name=(from_name or settings.smtp_from_name).strip(),
        frontend_url=(frontend_url or settings.frontend_url).rstrip("/"),
        source=source,
        provider=provider or "custom",
    )


async def resolve_draft_config(db: AsyncSession | None, data: dict) -> EffectiveSmtpConfig:
    """Config de test issue du formulaire, complétée par la config effective.

    Indispensable à la mise en production : le super admin teste ses valeurs
    saisies (sans les enregistrer) et le mot de passe déjà stocké est réutilisé
    s'il n'est pas ressaisi.
    """
    base = await get_effective_smtp_config(db)
    return config_from_values(
        host=data.get("smtp_host") or base.host,
        port=data.get("smtp_port") or base.port,
        user=data.get("smtp_user") if data.get("smtp_user") is not None else base.user,
        password=data.get("smtp_password") or base.password,
        use_tls=data.get("smtp_tls") if data.get("smtp_tls") is not None else base.use_tls,
        use_ssl=data.get("smtp_ssl") if data.get("smtp_ssl") is not None else base.use_ssl,
        from_email=data.get("smtp_from_email") or base.from_email,
        from_name=data.get("smtp_from_name") or base.from_name,
        frontend_url=data.get("frontend_url") or base.frontend_url,
        provider=data.get("provider") or base.provider,
        source="draft",
    )


async def get_effective_smtp_config(db: AsyncSession | None = None) -> EffectiveSmtpConfig:
    """Retourne la config SMTP effective (DB prioritaire, .env en fallback)."""
    if db is not None:
        try:
            from app.models.mail_settings import MailSettings

            result = await db.execute(
                select(MailSettings).where(MailSettings.is_active == True).order_by(MailSettings.id.desc()).limit(1)  # noqa: E712
            )
            row = result.scalar_one_or_none()
            if row and row.smtp_host:
                frontend = (row.frontend_url or settings.frontend_url or "").rstrip("/")
                return EffectiveSmtpConfig(
                    host=row.smtp_host,
                    port=int(row.smtp_port or 1025),
                    user=row.smtp_user or "",
                    password=decrypt_password(row.smtp_password_encrypted),
                    use_tls=bool(row.smtp_tls),
                    use_ssl=bool(row.smtp_ssl),
                    from_email=row.smtp_from_email or settings.smtp_from_email,
                    from_name=row.smtp_from_name or settings.smtp_from_name,
                    frontend_url=frontend or settings.frontend_url,
                    source="database",
                    provider=row.provider or "custom",
                )
        except Exception as exc:
            # Table absente (migration non jouée) → fallback .env silencieux
            logger.debug("Fallback SMTP .env (raison: %s)", exc)
    return EffectiveSmtpConfig(
        host=settings.smtp_host,
        port=settings.smtp_port,
        user=settings.smtp_user,
        password=settings.smtp_password,
        use_tls=settings.smtp_tls,
        use_ssl=False,
        from_email=settings.smtp_from_email,
        from_name=settings.smtp_from_name,
        frontend_url=settings.frontend_url,
        source="env",
    )
