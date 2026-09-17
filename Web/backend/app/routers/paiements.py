"""Paiement des abonnements via Papi.mg.

- Entreprise : initie un paiement (lien Papi) et consulte son statut.
- Webhook PUBLIC signé (X-Papi-Signature) : vérification HMAC-SHA256 stricte
  (t.v1, tolérance 300 s, comparaison temps constante) + notificationToken,
  puis activation idempotente de l'abonnement.

Référence marchand : `SUB-{subscription_id}` — idempotente côté Papi tant que
le lien est vivant ; on ajoute un suffixe de ronde `-r{ts}` à chaque nouvelle
tentative après expiration.
"""
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from typing_extensions import Annotated

from app.database import get_db
from app.security import get_current_user
from app.models.parametre_paiement import ParametrePaiement
from app.models.subscription import Subscription
from app.models.plan import Plan
from app.models.entreprise import Entreprise

router = APIRouter(tags=["paiements"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
DbDep = Annotated[Any, Depends(get_db)]

PAPI_BASE_URL = "https://app.papi.mg/engine/api"
SIGNATURE_TOLERANCE_S = 300  # doc Papi : rejet si |now - t| > 300 s


async def get_papi_config(db) -> ParametrePaiement | None:
    """Renvoie la config Papi active, ou None si non configurée."""
    cfg = (await db.execute(select(ParametrePaiement).where(ParametrePaiement.id == 1))).scalar_one_or_none()
    if not cfg or cfg.is_deleted or not cfg.api_key:
        return None
    return cfg


def _reference_pour(sub: Subscription) -> str:
    """Référence marchande idempotente : SUB-{id}-{ronde}.

    Ronde = compteur basé sur la date de début : permet de recréer un lien
    propre si le précédent a expiré (Papi exige une référence unique pour un
    lien vivant).
    """
    ronde = int(sub.date_debut.timestamp()) if sub.date_debut else int(time.time())
    return f"SUB-{sub.id}-{ronde}"


def _verifier_signature(secret: str, raw_body: bytes, header: str | None) -> bool:
    """Vérifie X-Papi-Signature: t=<unix>,v1=<hex> — HMAC-SHA256(secret, t + '.' + body)."""
    if not header or not secret:
        return False
    parts: dict[str, str] = {}
    for item in header.split(","):
        key, *rest = item.strip().split("=", 1)
        parts[key] = rest[0] if rest else ""
    t, v1 = parts.get("t", ""), parts.get("v1", "")
    if not t.isdigit() or len(v1) != 64:
        return False
    try:
        if abs(time.time() - int(t)) > SIGNATURE_TOLERANCE_S:
            return False
    except ValueError:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{t}.".encode("utf-8") + raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, v1)


# ==================== ENTREPRISE ====================

@router.post("/abonnement/initier")
async def initier_paiement_abonnement(payload: CurrentUser, db: DbDep, data: dict):
    """Crée (ou retourne) le lien de paiement Papi pour souscrire un plan.

    Body : { plan_id, periode: 'mensuel'|'annuel' }
    Réponse : { payment_link, reference, expires_at } ou 503 si Papi non configuré.
    """
    if payload.get("role_code") == "super_admin":
        raise HTTPException(status_code=403, detail="Le super admin ne souscrit pas d'abonnement.")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=403, detail="Compte sans entreprise.")

    cfg = await get_papi_config(db)
    if not cfg:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "paiement_non_configure",
                "message": "La passerelle de paiement n'est pas encore configurée. "
                "L'abonnement reste activable manuellement par l'équipe TIA Info.",
            },
        )

    plan_id = data.get("plan_id")
    periode = data.get("periode", "mensuel")
    if periode not in ("mensuel", "annuel"):
        raise HTTPException(status_code=422, detail="Période invalide (mensuel|annuel).")
    plan = (await db.execute(select(Plan).where(Plan.id == plan_id, Plan.is_deleted == False, Plan.actif == True))).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan non trouvé ou inactif.")
    if plan.prix_mensuel <= 0:
        raise HTTPException(status_code=422, detail="Ce plan est gratuit : sélectionnez-le directement, sans paiement.")

    entreprise = (await db.execute(select(Entreprise).where(Entreprise.id == entreprise_id))).scalar_one_or_none()
    montant = float(plan.prix_annuel if periode == "annuel" else plan.prix_mensuel)

    # 1) Créer/réutiliser la subscription locale (statut 'en_attente_paiement')
    now = datetime.now()
    sub = Subscription(
        entreprise_id=int(entreprise_id),
        plan_id=plan.id,
        date_debut=now,
        date_fin=now + (timedelta(days=365) if periode == "annuel" else timedelta(days=30)),
        statut="en_attente_paiement",
        mode_paiement="papi",
        prix_paye=montant,
        periode=periode,
    )
    db.add(sub)
    await db.flush()
    reference = _reference_pour(sub)

    # 2) Créer le lien Papi
    import httpx

    body: dict[str, Any] = {
        "amount": max(300, int(montant)),
        "reference": reference,
        "clientName": (entreprise.nom if entreprise else f"Entreprise #{entreprise_id}"),
        "description": f"Abonnement {plan.nom} — {periode}",
        "isTestMode": bool(cfg.is_test_mode),
    }
    if cfg.notification_url:
        body["notificationUrl"] = cfg.notification_url
    if cfg.success_url and cfg.failure_url:
        body["successUrl"] = cfg.success_url
        body["failureUrl"] = cfg.failure_url
    providers = [p for p in (cfg.providers_actifs or "").split(",") if p]
    if len(providers) == 1:
        body["provider"] = providers[0]  # page Papi directe sur ce provider

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{PAPI_BASE_URL}/payment-links",
                headers={"Token": cfg.api_key, "Content-Type": "application/json"},
                json=body,
            )
    except httpx.HTTPError:
        sub.statut = "echec_paiement"
        await db.commit()
        raise HTTPException(status_code=502, detail="Passerelle Papi injoignable. Réessayez.")

    if resp.status_code == 409:
        # Conflit idempotence : référence vivante avec montant différent — très improbable
        sub.statut = "echec_paiement"
        await db.commit()
        raise HTTPException(status_code=409, detail="Un paiement est déjà en cours pour cette souscription.")
    if resp.status_code != 200:
        sub.statut = "echec_paiement"
        await db.commit()
        raise HTTPException(status_code=502, detail="Papi a refusé la création du paiement. Contactez le support.")

    data_papi = (resp.json() or {}).get("data") or {}
    link = data_papi.get("paymentLink")
    if not link:
        sub.statut = "echec_paiement"
        await db.commit()
        raise HTTPException(status_code=502, detail="Réponse Papi incomplète.")

    await db.commit()
    return {
        "payment_link": link,
        "short_link": data_papi.get("shortLink"),
        "reference": reference,
        "subscription_id": sub.id,
        "notification_token": data_papi.get("notificationToken"),
    }


@router.get("/abonnement/{reference}/statut")
async def statut_paiement(reference: str, payload: CurrentUser, db: DbDep):
    """Interroge Papi pour connaître le statut d'un paiement (polling front)."""
    if payload.get("role_code") == "super_admin":
        raise HTTPException(status_code=403, detail="Réservé aux entreprises.")
    cfg = await get_papi_config(db)
    if not cfg:
        raise HTTPException(status_code=503, detail="Passerelle non configurée.")

    import httpx

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{PAPI_BASE_URL}/payment-links/{reference}",
            headers={"Token": cfg.api_key},
        )
    if resp.status_code == 404:
        return {"link_status": "INTROUVABLE", "payment_status": None}
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Papi injoignable.")
    data = (resp.json() or {}).get("data") or {}

    # Si payé : activer immédiatement (le webhook peut avoir été manqué)
    if data.get("linkStatus") == "PAID" and data.get("paymentStatus") == "SUCCESS":
        await _activer_abonnement_depuis_reference(db, reference, data)
    return {
        "link_status": data.get("linkStatus"),
        "payment_status": data.get("paymentStatus"),
        "payment_method": data.get("paymentMethod"),
        "amount": data.get("amount"),
    }


# ==================== ACTIVATION ====================

async def _activer_abonnement_depuis_reference(db, reference: str, data_papi: dict) -> bool:
    """Active la subscription 'en_attente_paiement' correspondant à la référence.

    Idempotent : si déjà activée, ne fait rien. Renvoie True si activation effectuée.
    """
    # reference = SUB-{sub_id}-{ronde}
    parts = reference.split("-")
    if len(parts) < 3 or parts[0] != "SUB":
        return False
    try:
        sub_id = int(parts[1])
    except ValueError:
        return False

    sub = (await db.execute(select(Subscription).where(Subscription.id == sub_id))).scalar_one_or_none()
    if not sub or sub.statut not in ("en_attente_paiement", "echec_paiement"):
        return False  # déjà activée ou inconnue

    # Renseigne la traçabilité et active
    sub.statut = "actif"
    sub.mode_paiement = "papi"
    sub.prix_paye = float(data_papi.get("amount") or sub.prix_paye or 0)
    plan = (await db.execute(select(Plan).where(Plan.id == sub.plan_id))).scalar_one_or_none()
    duree = timedelta(days=365) if (sub.periode == "annuel") else timedelta(days=30)
    sub.date_debut = datetime.now()
    sub.date_fin = datetime.now() + duree
    sub.date_prochain_renouvellement = sub.date_fin
    # Met à jour le libellé d'abonnement de l'entreprise
    ent = (await db.execute(select(Entreprise).where(Entreprise.id == sub.entreprise_id))).scalar_one_or_none()
    if ent and plan:
        ent.abonnement = plan.code
    await db.commit()
    return True


# ==================== WEBHOOK PUBLIC SIGNÉ ====================

@router.post("/webhooks/papi", include_in_schema=True)
async def webhook_papi(request: Request, db: DbDep):
    """Webhook Papi (public, signé). Vérifie :
    1. X-Papi-Signature : HMAC-SHA256(secret, '{t}.' + raw_body), tolérance 300 s
    2. notificationToken identique à celui renvoyé à la création
    Puis active l'abonnement si linkStatus=PAID / paymentStatus=SUCCESS.
    """
    raw = await request.body()
    signature = request.headers.get("X-Papi-Signature")
    cfg = await get_papi_config(db)
    if not cfg or not cfg.webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook non configuré.")
    if not _verifier_signature(cfg.webhook_secret, raw, signature):
        raise HTTPException(status_code=401, detail="Signature invalide.")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Corps invalide.")

    reference = payload.get("merchantPaymentReference") or ""
    notification_token = payload.get("notificationToken") or ""

    # Lecture de rattrapage Papi (source de vérité) pour confirmer le statut
    import httpx

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{PAPI_BASE_URL}/payment-links/{reference}",
            headers={"Token": cfg.api_key},
        )
    if resp.status_code != 200:
        return {"received": True, "processed": False, "reason": "reference_non_trouvee"}
    data = (resp.json() or {}).get("data") or {}
    if data.get("notificationToken") and notification_token and data["notificationToken"] != notification_token:
        raise HTTPException(status_code=401, detail="notificationToken invalide.")

    activated = False
    if data.get("linkStatus") == "PAID" and data.get("paymentStatus") == "SUCCESS":
        activated = await _activer_abonnement_depuis_reference(db, reference, data)

    return {"received": True, "processed": activated}
