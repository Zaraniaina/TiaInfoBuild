"""État d'abonnement par entreprise : essai 30j, actif, expiré, sans.

- Source de vérité SERVEUR : une Subscription (statut actif/essai) est « expirée »
  dès que sa date_fin est passée, même si le champ statut n'a pas encore été mis
  à jour en base (le marquage au boot + middleware couvrent les cas courants).
- Entreprise SANS subscription (données existantes / démo) : état `sans` = tout
  autorisé. On ne casse jamais un compte qui fonctionnait avant.
- Les écritures sont bloquées uniquement en état `expire` (lecture seule).
"""
from datetime import datetime, timedelta

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan import Plan
from app.models.subscription import Subscription

# État renvoyé par get_entreprise_state
ETAT_ESSAI = "essai"
ETAT_ACTIF = "actif"
ETAT_EXPIRE = "expire"
ETAT_SANS = "sans"

# Rôle super_admin : pas d'entreprise, jamais soumis à l'abonnement
ROLE_SUPER_ADMIN = "super_admin"


async def get_entreprise_state(db: AsyncSession, entreprise_id: int | None) -> dict:
    """Renvoie {state, days_remaining, date_fin, plan_code, plan_nom}.

    days_remaining peut être négatif (expiré depuis N jours).
    """
    base = {"state": ETAT_SANS, "days_remaining": None, "date_fin": None, "plan_code": None, "plan_nom": None}
    if not entreprise_id:
        return base

    result = await db.execute(
        select(Subscription, Plan)
        .join(Plan, Subscription.plan_id == Plan.id)
        .where(
            Subscription.entreprise_id == entreprise_id,
            Subscription.statut.in_(["actif", "essai"]),
            Subscription.is_deleted == False,
        )
        # Portable (MariaDB n'a pas NULLS LAST) : les sans-échéance passent en dernier
        .order_by(func.coalesce(Subscription.date_fin, datetime(9999, 12, 31)).desc(), Subscription.date_debut.desc())
        .limit(1)
    )
    row = result.first()
    if not row:
        return base

    sub, plan = row
    if sub.date_fin is None:
        # Sans échéance = actif à vie (ex: plan assigné manuellement)
        return {"state": ETAT_ACTIF, "days_remaining": None, "date_fin": None, "plan_code": plan.code, "plan_nom": plan.nom}

    now = datetime.now()
    days_remaining = (sub.date_fin - now).days
    state = ETAT_EXPIRE if now >= sub.date_fin else (ETAT_ESSAI if sub.statut == "essai" else ETAT_ACTIF)
    return {
        "state": state,
        "days_remaining": days_remaining,
        "date_fin": sub.date_fin.isoformat(),
        "plan_code": plan.code,
        "plan_nom": plan.nom,
    }


async def _is_expired(db: AsyncSession, entreprise_id: int) -> bool:
    state = await get_entreprise_state(db, entreprise_id)
    return state["state"] == ETAT_EXPIRE


async def assert_can_write(db: AsyncSession, payload: dict) -> None:
    """Lève 403 si l'entreprise est en lecture seule (abonnement expiré).

    - super_admin et comptes sans entreprise : toujours autorisés.
    - état `sans` ou `essai`/`actif` : autorisé.
    """
    if payload.get("role_code") == ROLE_SUPER_ADMIN:
        return
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        return
    if await _is_expired(db, int(entreprise_id)):
        raise _expired_error()


def _expired_error():
    from fastapi import HTTPException, status

    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "subscription_expired",
            "message": "Votre abonnement a expiré. L'accès est en lecture seule : "
            "consultez les formules pour réactiver l'écriture.",
            "action": "pricing",
        },
    )


def _quota_error(ressource: str, limite: int, plan_nom: str | None):
    from fastapi import HTTPException, status

    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "subscription_quota",
            "message": f"Limite du plan {plan_nom or 'actuel'} atteinte ({limite} {ressource}). "
            "Passez à une formule supérieure pour en ajouter davantage.",
            "action": "pricing",
            "ressource": ressource,
            "limite": limite,
        },
    )


async def assert_quota_utilisateurs(db: AsyncSession, payload: dict) -> None:
    """Vérifie la limite d'EMPLOYÉS actifs du plan à la création d'un employé.

    Métrique choisie : le personnel de l'entreprise (les clients portail sont
    toujours illimités). utilisateurs_max = None signifie ILLIMITÉ.
    """
    if payload.get("role_code") == ROLE_SUPER_ADMIN:
        return
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        return

    state = await get_entreprise_state(db, int(entreprise_id))
    if state["state"] == ETAT_EXPIRE:
        raise _expired_error()
    if state["state"] == ETAT_SANS or not state["plan_code"]:
        return  # pas de plan : pas de quota appliqué

    plan = (await db.execute(select(Plan).where(Plan.code == state["plan_code"]))).scalar_one_or_none()
    if not plan:
        return

    nb = (
        await db.execute(
            text(
                "SELECT COUNT(*) FROM employes "
                "WHERE entreprise_id = :eid AND is_deleted = 0"
            ),
            {"eid": int(entreprise_id)},
        )
    ).scalar_one()
    if plan.utilisateurs_max is not None and nb >= int(plan.utilisateurs_max):
        raise _quota_error("employés", int(plan.utilisateurs_max), state["plan_nom"])


async def assert_quota_chantiers(db: AsyncSession, payload: dict) -> None:
    """Vérifie chantiers_max du plan à la création d'un chantier (None = illimité)."""
    if payload.get("role_code") == ROLE_SUPER_ADMIN:
        return
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        return

    state = await get_entreprise_state(db, int(entreprise_id))
    if state["state"] == ETAT_EXPIRE:
        raise _expired_error()
    if state["state"] == ETAT_SANS or not state["plan_code"]:
        return

    plan = (await db.execute(select(Plan).where(Plan.code == state["plan_code"]))).scalar_one_or_none()
    if not plan:
        return

    nb = (
        await db.execute(
            text(
                "SELECT COUNT(*) FROM chantiers "
                "WHERE entreprise_id = :eid AND is_deleted = 0 "
                "AND statut NOT IN ('termine', 'annule', 'suspendu')"
            ),
            {"eid": int(entreprise_id)},
        )
    ).scalar_one()
    if plan.chantiers_max is not None and nb >= int(plan.chantiers_max):
        raise _quota_error("chantiers", int(plan.chantiers_max), state["plan_nom"])


async def a_deja_fait_essai(db: AsyncSession, entreprise_id: int) -> bool:
    """True si l'entreprise a déjà eu (ou a) une subscription de statut `essai`."""
    result = await db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.entreprise_id == entreprise_id,
            Subscription.statut == "essai",
            Subscription.is_deleted == False,
        )
    )
    return (result.scalar_one() or 0) > 0


async def demarrer_essai(db: AsyncSession, entreprise_id: int) -> Subscription | None:
    """Crée l'essai gratuit 30 jours (plan `essai`) si l'entreprise n'y a pas droit.

    Renvoie la Subscription créée, ou None si déjà consommé/plan absent.
    À appeler DANS la transaction du register-entreprise (flush suffit,
    le commit est fait par l'appelant).
    """
    if await a_deja_fait_essai(db, entreprise_id):
        return None

    plan = (await db.execute(select(Plan).where(Plan.code == "essai", Plan.is_deleted == False))).scalar_one_or_none()
    if not plan:
        return None

    now = datetime.now()
    sub = Subscription(
        entreprise_id=entreprise_id,
        plan_id=plan.id,
        date_debut=now,
        date_fin=now + timedelta(days=plan.duree_essai_jours or 30),
        date_prochain_renouvellement=now + timedelta(days=plan.duree_essai_jours or 30),
        statut="essai",
        periode="essai",
        prix_paye=0,
    )
    db.add(sub)
    await db.flush()
    return sub


async def marquer_expirations(db: AsyncSession) -> int:
    """Marque statut='expire' les subscriptions actives dont date_fin est passée.

    Appelé au démarrage de l'API (lifespan). Renvoie le nombre de lignes.
    """
    now = datetime.now()
    result = await db.execute(
        select(Subscription).where(
            Subscription.statut.in_(["actif", "essai"]),
            Subscription.is_deleted == False,
            Subscription.date_fin.isnot(None),
            Subscription.date_fin < now,
        )
    )
    subs = result.scalars().all()
    for sub in subs:
        sub.statut = "expire"
    if subs:
        await db.commit()
    return len(subs)
