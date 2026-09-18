"""Configuration de la passerelle de paiement Papi.mg — Super Admin UNIQUEMENT.

L'admin d'entreprise ne peut ni lire ni modifier cette configuration (403).
Les secrets (api_key, webhook_secret) ne sont jamais renvoyés en clair :
masqués côté lecture, réécrits seulement via PUT.

Doc Papi : POST https://app.papi.mg/engine/api/payment-links (header "Token"),
webhook signé X-Papi-Signature: t=<unix>,v1=HMAC-SHA256(secret, t + "." + body).
"""
import httpx
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from typing_extensions import Annotated

from app.database import get_db
from app.security import require_super_admin
from app.models.parametre_paiement import ParametrePaiement
from app.models.subscription import Subscription
from app.models.plan import Plan

router = APIRouter(tags=["paiement-config"])
SuperAdmin = Annotated[dict[str, Any], Depends(require_super_admin)]
DbDep = Annotated[Any, Depends(get_db)]

PAPI_BASE_URL = "https://app.papi.mg/engine/api"
PROVIDERS_VALIDES = ("MVOLA", "ORANGE_MONEY", "AIRTEL_MONEY", "BRED")


def _masquer(secret: str | None) -> str | None:
    """Masque un secret : garde préfixe + 4 derniers caractères."""
    if not secret:
        return None
    if len(secret) <= 12:
        return "•" * len(secret)
    return f"{secret[:8]}••••••{secret[-4:]}"


async def _get_config(db) -> ParametrePaiement:
    cfg = (await db.execute(select(ParametrePaiement).where(ParametrePaiement.id == 1))).scalar_one_or_none()
    if not cfg:
        cfg = ParametrePaiement(id=1)
        db.add(cfg)
        await db.flush()
        # Recharge les valeurs générées par le serveur (environment, is_test_mode,
        # created_at...) : sans refresh, y accéder ensuite lève MissingGreenlet
        # (lazy-load synchrone interdit en async) => 500 sur la première ouverture
        # de la page quand la table est encore vide.
        await db.refresh(cfg)
    return cfg


class PaiementConfigUpdate(BaseModel):
    api_key: str | None = Field(default=None, max_length=255)
    webhook_secret: str | None = Field(default=None, max_length=255)
    environment: str | None = Field(default=None, pattern="^(sandbox|production)$")
    providers_actifs: list[str] | None = None
    notification_url: str | None = Field(default=None, max_length=500)
    success_url: str | None = Field(default=None, max_length=500)
    failure_url: str | None = Field(default=None, max_length=500)
    is_test_mode: bool | None = None


class PaiementConfigResponse(BaseModel):
    est_configure: bool
    api_key_masquee: str | None
    webhook_secret_masque: str | None
    environment: str
    providers_actifs: list[str]
    notification_url: str | None
    success_url: str | None
    failure_url: str | None
    is_test_mode: bool
    dernier_test_at: datetime | None
    dernier_test_ok: bool | None
    dernier_test_message: str | None


def _to_response(cfg: ParametrePaiement) -> PaiementConfigResponse:
    return PaiementConfigResponse(
        est_configure=bool(cfg.api_key),
        api_key_masquee=_masquer(cfg.api_key),
        webhook_secret_masque=_masquer(cfg.webhook_secret),
        environment=cfg.environment or "sandbox",
        providers_actifs=[p for p in (cfg.providers_actifs or "").split(",") if p],
        notification_url=cfg.notification_url,
        success_url=cfg.success_url,
        failure_url=cfg.failure_url,
        is_test_mode=bool(cfg.is_test_mode),
        dernier_test_at=cfg.dernier_test_at,
        dernier_test_ok=cfg.dernier_test_ok,
        dernier_test_message=cfg.dernier_test_message,
    )


@router.get("", response_model=PaiementConfigResponse)
async def lire_config(payload: SuperAdmin, db: DbDep):
    """Lit la configuration (secrets masqués)."""
    cfg = await _get_config(db)
    return _to_response(cfg)


@router.put("", response_model=PaiementConfigResponse)
async def maj_config(payload: SuperAdmin, db: DbDep, data: PaiementConfigUpdate):
    """Met à jour la configuration. Les champs laissés à None ne sont pas touchés
    (permet de modifier une URL sans re-saisir les clés)."""
    cfg = await _get_config(db)
    update = data.model_dump(exclude_unset=True, exclude_none=True)
    if "providers_actifs" in update:
        providers = update.pop("providers_actifs")
        invalides = [p for p in providers if p not in PROVIDERS_VALIDES]
        if invalides:
            raise HTTPException(status_code=422, detail=f"Providers invalides : {', '.join(invalides)}")
        cfg.providers_actifs = ",".join(providers)
    for field, value in update.items():
        setattr(cfg, field, value)
    await db.commit()
    await db.refresh(cfg)
    return _to_response(cfg)


@router.post("/test")
async def tester_connexion(payload: SuperAdmin, db: DbDep):
    """Teste réellement les clés auprès de Papi : crée un lien de paiement test
    de 300 Ar (minimum Papi) en mode test. Ne modifie aucune donnée métier."""
    cfg = await _get_config(db)
    if not cfg.api_key:
        cfg.dernier_test_at = datetime.now()
        cfg.dernier_test_ok = False
        cfg.dernier_test_message = "Clé API non renseignée."
        await db.commit()
        raise HTTPException(status_code=400, detail="Clé API non renseignée.")

    body = {
        "amount": 300,
        "reference": f"TEST-CONNEXION-{int(datetime.now().timestamp())}",
        "clientName": "Test connexion TIA Info",
        "description": "Vérification des clés API Papi (test connexion super admin)",
        "isTestMode": True,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{PAPI_BASE_URL}/payment-links",
                headers={"Token": cfg.api_key, "Content-Type": "application/json"},
                json=body,
            )
    except httpx.HTTPError as e:
        ok, message = False, f"Impossible de joindre Papi : {e.__class__.__name__}"
        cfg.dernier_test_at, cfg.dernier_test_ok, cfg.dernier_test_message = datetime.now(), ok, message
        await db.commit()
        return {"ok": ok, "message": message}

    if resp.status_code == 200:
        ok, message = True, "Connexion réussie : les clés sont valides."
    elif resp.status_code == 400:
        ok, message = False, "Clé API invalide (rejetée par Papi)."
    else:
        ok, message = False, f"Réponse inattendue de Papi : HTTP {resp.status_code}"
    cfg.dernier_test_at, cfg.dernier_test_ok, cfg.dernier_test_message = datetime.now(), ok, message
    await db.commit()
    return {"ok": ok, "message": message, "http_status": resp.status_code}


@router.get("/paiements")
async def journal_paiements(payload: SuperAdmin, db: DbDep, limit: int = 50):
    """Journal des abonnements payés via Papi (toutes entreprises)."""
    stmt = (
        select(Subscription, Plan)
        .join(Plan, Subscription.plan_id == Plan.id)
        .where(
            Subscription.is_deleted == False,
            Subscription.mode_paiement == "papi",
        )
        .order_by(Subscription.updated_at.desc())
        .limit(min(limit, 200))
    )
    result = await db.execute(stmt)
    rows = result.all()
    return {
        "items": [
            {
                "id": sub.id,
                "entreprise_id": sub.entreprise_id,
                "plan": plan.nom,
                "periode": sub.periode,
                "statut": sub.statut,
                "prix_paye": float(sub.prix_paye or 0),
                "date_debut": sub.date_debut.isoformat() if sub.date_debut else None,
                "date_fin": sub.date_fin.isoformat() if sub.date_fin else None,
            }
            for sub, plan in rows
        ]
    }
