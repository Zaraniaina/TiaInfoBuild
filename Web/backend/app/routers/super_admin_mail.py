"""Endpoints dédiés à la configuration SMTP (super admin).

Interface de mise en production : le super admin choisit un fournisseur,
teste l'envoi réel (éventuellement AVANT sauvegarde) puis enregistre. La
configuration devient effective à chaud via la table `mail_settings`, sans
redéploiement ni édition du `.env`.

Ordre de résolution : base de données (si active) > `.env` (fallback).
Sécurité : le mot de passe SMTP est chiffré en base et n'est JAMAIS renvoyé
au frontend (seul le booléen `has_password` est exposé).
"""
import asyncio
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.config import settings as app_settings
from app.database import get_db
from app.models.mail_settings import MailSettings
from app.schemas.mail_settings import (
    MAIL_PROVIDERS_PRESETS,
    MailDiagnosticsResponse,
    MailDraftTestRequest,
    MailSettingsResponse,
    MailSettingsUpdate,
    MailTestRequest,
    MailTestResponse,
)
from app.security import require_super_admin
from app.services.email import _send_via_config, build_test_email_content
from app.services.mail_config import (
    encrypt_password,
    get_effective_smtp_config,
    resolve_draft_config,
)

router = APIRouter(tags=["super-admin-mail"])
CurrentUser = Annotated[dict[str, Any], Depends(require_super_admin)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


def _to_response(row: MailSettings | None, source: str = "database") -> MailSettingsResponse:
    """Sérialise la ligne en masquant le mot de passe (has_password uniquement)."""
    if row is None:
        return MailSettingsResponse(
            id=None,
            provider="custom",
            smtp_host=app_settings.smtp_host,
            smtp_port=app_settings.smtp_port,
            smtp_user=app_settings.smtp_user,
            has_password=bool(app_settings.smtp_password),
            smtp_tls=app_settings.smtp_tls,
            smtp_ssl=app_settings.smtp_port == 465,
            smtp_from_email=app_settings.smtp_from_email,
            smtp_from_name=app_settings.smtp_from_name,
            frontend_url=app_settings.frontend_url,
            is_active=True,
            effective_source="env",
        )
    return MailSettingsResponse(
        id=row.id,
        provider=row.provider or "custom",
        smtp_host=row.smtp_host or "",
        smtp_port=int(row.smtp_port or 1025),
        smtp_user=row.smtp_user or "",
        has_password=bool(row.smtp_password_encrypted),
        smtp_tls=bool(row.smtp_tls),
        smtp_ssl=bool(row.smtp_ssl),
        smtp_from_email=row.smtp_from_email or "",
        smtp_from_name=row.smtp_from_name or "",
        frontend_url=row.frontend_url or "",
        is_active=bool(row.is_active),
        last_test_at=row.last_test_at.isoformat() if row.last_test_at else None,
        last_test_status=row.last_test_status,
        last_test_message=row.last_test_message,
        effective_source=source,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


async def _get_latest_row(db: AsyncSession) -> MailSettings | None:
    """Dernière config enregistrée, active ou non (pour préremplir le formulaire)."""
    result = await db.execute(select(MailSettings).order_by(MailSettings.id.desc()).limit(1))
    return result.scalar_one_or_none()


async def _get_active_row(db: AsyncSession) -> MailSettings | None:
    """Config réellement appliquée aux envois d'emails (is_active = True)."""
    result = await db.execute(
        select(MailSettings).where(MailSettings.is_active == True).order_by(MailSettings.id.desc()).limit(1)  # noqa: E712
    )
    return result.scalar_one_or_none()


async def _record_test(db: AsyncSession, success: bool, message: str) -> None:
    """Historise le dernier test d'envoi (affiché dans l'interface dédiée)."""
    row = await _get_latest_row(db)
    if row is None:
        return
    row.last_test_at = datetime.now()
    row.last_test_status = "success" if success else "error"
    row.last_test_message = (message or "")[:500]
    await db.flush()


@router.get("/mail-settings/providers")
async def list_mail_providers(payload: CurrentUser):
    """Presets SMTP par fournisseur (hôte, port, chiffrement)."""
    return {
        "providers": MAIL_PROVIDERS_PRESETS,
        "labels": {
            "gmail": "Gmail / Google Workspace",
            "outlook": "Outlook / Microsoft 365",
            "yahoo": "Yahoo Mail",
            "mailpit": "Mailpit (dev local)",
            "custom": "SMTP personnalisé",
        },
    }


@router.get("/mail-settings/status")
async def mail_settings_status(payload: CurrentUser, db: DbSession):
    """Config effective résumée (source BDD/.env) — badge de supervision."""
    cfg = await get_effective_smtp_config(db)
    return {
        "effective_source": cfg.source,
        "provider": cfg.provider,
        "host": cfg.host,
        "port": cfg.port,
        "tls": cfg.use_tls,
        "ssl": cfg.use_ssl,
        "from_email": cfg.from_email,
        "from_name": cfg.from_name,
        "frontend_url": cfg.frontend_url,
        "auth_configured": bool(cfg.user and cfg.password),
        "env_fallback": {
            "host": app_settings.smtp_host,
            "port": app_settings.smtp_port,
            "from_email": app_settings.smtp_from_email,
        },
    }


@router.get("/mail-settings/diagnostics", response_model=MailDiagnosticsResponse)
async def mail_settings_diagnostics(payload: CurrentUser, db: DbSession):
    """Checklist de mise en production : ce qui est prêt / ce qui bloque."""
    cfg = await get_effective_smtp_config(db)
    row = await _get_active_row(db)
    last_ok = bool(row and row.last_test_status == "success")

    checks = [
        {
            "code": "smtp_host",
            "label": "Serveur SMTP renseigné",
            "ok": bool(cfg.host),
            "required": True,
            "hint": "Ex. smtp.gmail.com, smtp.office365.com",
        },
        {
            "code": "smtp_port",
            "label": "Port SMTP cohérent",
            "ok": cfg.port in (25, 465, 587, 1025, 2525),
            "required": True,
            "hint": "587 = STARTTLS, 465 = SSL, 1025 = Mailpit (dev)",
        },
        {
            "code": "auth",
            "label": "Identifiants SMTP (utilisateur + mot de passe)",
            "ok": bool(cfg.user and cfg.password),
            "required": False,
            "hint": "Requis par Gmail/Outlook : mot de passe d'application",
        },
        {
            "code": "encryption",
            "label": "Chiffrement TLS ou SSL activé",
            "ok": bool(cfg.use_tls or cfg.use_ssl),
            "required": cfg.host not in ("localhost", "127.0.0.1"),
            "hint": "Obligatoire chez les fournisseurs publics",
        },
        {
            "code": "from_email",
            "label": "Adresse expéditrice valide",
            "ok": "@" in (cfg.from_email or ""),
            "required": True,
            "hint": "Doit être autorisée par le SMTP (alias expéditeur)",
        },
        {
            "code": "frontend_url",
            "label": "URL frontend publique (liens des emails)",
            "ok": (cfg.frontend_url or "").startswith("http") and "localhost" not in (cfg.frontend_url or ""),
            "required": True,
            "hint": "Ex. https://app.tiainfobuild.com — vérification email & mot de passe",
        },
        {
            "code": "source",
            "label": "Configuration enregistrée en base (effective sans redéploiement)",
            "ok": cfg.source == "database",
            "required": True,
            "hint": "« Enregistrer et activer » bascule du .env vers la base de données",
        },
        {
            "code": "last_test",
            "label": "Dernier test d'envoi réussi",
            "ok": last_ok,
            "required": False,
            "hint": "Lancez un test vers votre adresse pour confirmer",
        },
    ]
    return MailDiagnosticsResponse(
        ready=all(c["ok"] for c in checks if c["required"]),
        effective_source=cfg.source,
        provider=cfg.provider,
        checks=checks,
    )


@router.get("/mail-settings", response_model=MailSettingsResponse)
async def get_mail_settings(payload: CurrentUser, db: DbSession):
    """Config enregistrée (préremplissage du formulaire) ou valeurs du .env."""
    row = await _get_latest_row(db)
    return _to_response(row, source="database" if row and row.is_active else "env")


@router.put("/mail-settings", response_model=MailSettingsResponse)
async def update_mail_settings(payload: CurrentUser, db: DbSession, body: MailSettingsUpdate):
    """Enregistre la config SMTP : elle devient effective immédiatement."""
    data = body.model_dump(exclude_unset=True)
    provider = data.get("provider")
    if provider and provider in MAIL_PROVIDERS_PRESETS:
        # Les presets ne complètent que les champs non saisis par l'admin.
        for key, value in MAIL_PROVIDERS_PRESETS[provider].items():
            data.setdefault(key, value)

    row = await _get_active_row(db) or await _get_latest_row(db)
    is_new = row is None
    if row is None:
        row = MailSettings()
        db.add(row)

    # Première configuration : les champs essentiels doivent être saisis
    # explicitement (jamais d'activation silencieuse des défauts localhost).
    if is_new and (not data.get("smtp_host") or not data.get("smtp_from_email")):
        raise HTTPException(
            status_code=422,
            detail="Première configuration : le serveur SMTP et l'adresse expéditrice sont obligatoires.",
        )

    if data.get("provider"):
        row.provider = data["provider"]
    if data.get("smtp_host"):
        row.smtp_host = str(data["smtp_host"])
    if data.get("smtp_port"):
        row.smtp_port = int(data["smtp_port"])
    if data.get("smtp_user") is not None:
        row.smtp_user = data["smtp_user"]
    if data.get("smtp_password"):
        row.smtp_password_encrypted = encrypt_password(data["smtp_password"])
    if data.get("smtp_ssl") is not None:
        row.smtp_ssl = bool(data["smtp_ssl"])
    if data.get("smtp_tls") is not None:
        row.smtp_tls = bool(data["smtp_tls"])
    if row.smtp_ssl:
        # SSL (port 465) et STARTTLS sont mutuellement exclusifs.
        row.smtp_tls = False
    if data.get("smtp_from_email"):
        row.smtp_from_email = str(data["smtp_from_email"])
    if data.get("smtp_from_name"):
        row.smtp_from_name = data["smtp_from_name"]
    if data.get("frontend_url"):
        row.frontend_url = str(data["frontend_url"]).rstrip("/")
    row.is_active = bool(data.get("is_active", True))

    if not row.smtp_host or not row.smtp_from_email:
        raise HTTPException(
            status_code=422,
            detail="Le serveur SMTP et l'adresse expéditrice sont obligatoires.",
        )

    await db.flush()
    await db.refresh(row)
    return _to_response(row, source="database")


@router.post("/mail-settings/test-draft", response_model=MailTestResponse)
async def test_mail_settings_draft(payload: CurrentUser, db: DbSession, body: MailDraftTestRequest):
    """Teste les valeurs SAISIES dans le formulaire, avant enregistrement.

    Le mot de passe déjà stocké est réutilisé s'il n'est pas ressaisi : le super
    admin valide ainsi sa mise en production sans l'activer ni la sauvegarder.
    """
    data = body.model_dump(exclude_unset=True, exclude={"to_email"})
    cfg = await resolve_draft_config(db, data)
    subject, html_content, text_content = build_test_email_content(cfg.from_name)
    tested_at = datetime.now().isoformat()
    try:
        await asyncio.to_thread(
            _send_via_config, cfg, str(body.to_email), subject, html_content, text_content
        )
    except Exception as exc:
        detail = str(exc)[:500]
        raise HTTPException(
            status_code=502,
            detail=f"Échec du test ({cfg.host}:{cfg.port}, valeurs non enregistrées) : {detail}",
        )
    return MailTestResponse(
        success=True,
        message=(
            f"Test réussi : email envoyé à {body.to_email} via {cfg.host}:{cfg.port} "
            "(valeurs du formulaire, non enregistrées)."
        ),
        detail=None,
        tested_at=tested_at,
    )


@router.post("/mail-settings/test", response_model=MailTestResponse)
async def test_mail_settings(payload: CurrentUser, db: DbSession, body: MailTestRequest):
    """Teste la configuration EFFECTIVE (base ou .env) et historise le résultat."""
    cfg = await get_effective_smtp_config(db)
    if not cfg.host:
        raise HTTPException(
            status_code=422,
            detail="Aucun serveur SMTP configuré : renseignez le formulaire puis enregistrez.",
        )
    subject, html_content, text_content = build_test_email_content(cfg.from_name)
    tested_at = datetime.now().isoformat()
    try:
        await asyncio.to_thread(
            _send_via_config, cfg, str(body.to_email), subject, html_content, text_content
        )
    except Exception as exc:
        detail = str(exc)[:500]
        await _record_test(db, False, detail)
        raise HTTPException(
            status_code=502,
            detail=f"Échec du test SMTP ({cfg.host}:{cfg.port}, source={cfg.source}) : {detail}",
        )
    message = f"Email de test envoyé à {body.to_email} via {cfg.host}:{cfg.port} (source={cfg.source})."
    await _record_test(db, True, message)
    return MailTestResponse(success=True, message=message, detail=None, tested_at=tested_at)


@router.post("/mail-settings/reset", response_model=MailSettingsResponse)
async def reset_mail_settings(payload: CurrentUser, db: DbSession):
    """Désactive la config en base : retour immédiat au SMTP du `.env`.

    Les valeurs restent enregistrées (is_active = False) et sont réactivables
    en un clic : sécurité de mise en production en cas d'incident.
    """
    result = await db.execute(select(MailSettings).where(MailSettings.is_active == True))  # noqa: E712
    for row in result.scalars().all():
        row.is_active = False
    await db.flush()
    return _to_response(None, source="env")