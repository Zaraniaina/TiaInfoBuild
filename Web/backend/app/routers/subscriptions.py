"""Router pour la gestion des plans d'abonnement et des abonnements."""
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import require_super_admin, CurrentUserPayload, get_current_user
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.entreprise import Entreprise
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse, SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse, SubscriptionWithPlan

router = APIRouter(tags=["subscriptions"])
SuperAdmin = Annotated[dict[str, Any], Depends(require_super_admin)]
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]

# Plans « système » : leur suppression/désactivation casserait l'essai automatique
# des nouvelles inscriptions (demarrer_essai cherchera plan code='essai') ou le
# fallback gratuit des entreprises sans abonnement.
CODES_PLAN_SYSTEME = ("essai", "gratuit")


def _assert_plan_non_systeme(plan: Plan, action: str) -> None:
    if plan.code in CODES_PLAN_SYSTEME:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "plan_systeme_protege",
                "message": f"Le plan « {plan.nom} » est un plan système : il ne peut pas être {action}.",
                "action": None,
            },
        )


# ============================================================
# Plans (CRUD Super Admin)
# ============================================================

@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(payload: SuperAdmin, db: DbSession):
    """Liste tous les plans d'abonnement, avec le nombre d'entreprises abonnées."""
    plans = (await db.execute(select(Plan).where(Plan.is_deleted == False).order_by(Plan.prix_mensuel.asc()))).scalars().all()
    counts = dict(
        (await db.execute(
            select(Subscription.plan_id, func.count(Subscription.id)).where(
                Subscription.is_deleted == False,
                Subscription.statut.in_(["actif", "essai"]),
            ).group_by(Subscription.plan_id)
        )).all()
    )
    out = []
    for plan in plans:
        data = PlanResponse.model_validate(plan)
        data.entreprises_actives = int(counts.get(plan.id, 0))
        out.append(data)
    return out


@router.post("/plans", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(payload: SuperAdmin, db: DbSession, plan_in: PlanCreate):
    """Crée un nouveau plan d'abonnement."""
    existing = await db.execute(select(Plan).where(Plan.code == plan_in.code, Plan.is_deleted == False))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Un plan avec ce code existe déjà.")

    plan = Plan(**plan_in.model_dump())
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


@router.put("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(payload: SuperAdmin, db: DbSession, plan_id: int, plan_in: PlanUpdate):
    """Met à jour un plan existant."""
    plan = await db.get(Plan, plan_id)
    if not plan or plan.is_deleted:
        raise HTTPException(status_code=404, detail="Plan non trouvé.")

    update_data = plan_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)

    await db.flush()
    await db.refresh(plan)
    return plan


@router.post("/plans/{plan_id}/toggle", response_model=PlanResponse)
async def toggle_plan(payload: SuperAdmin, db: DbSession, plan_id: int):
    """Active/désactive un plan."""
    plan = await db.get(Plan, plan_id)
    if not plan or plan.is_deleted:
        raise HTTPException(status_code=404, detail="Plan non trouvé.")
    # Désactiver « essai » tuerait l'essai automatique ; « gratuit » est le filet de
    # sécurité des entreprises sans abonnement.
    _assert_plan_non_systeme(plan, "désactivé")

    plan.actif = not plan.actif
    await db.flush()
    await db.refresh(plan)
    return plan


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(payload: SuperAdmin, db: DbSession, plan_id: int):
    """Supprime doucement un plan."""
    plan = await db.get(Plan, plan_id)
    if not plan or plan.is_deleted:
        raise HTTPException(status_code=404, detail="Plan non trouvé.")

    _assert_plan_non_systeme(plan, "supprimé")

    plan.is_deleted = True
    plan.actif = False
    await db.flush()


# ============================================================
# Subscriptions (CRUD Super Admin)
# ============================================================

@router.get("/subscriptions", response_model=list[SubscriptionWithPlan])
async def list_subscriptions(payload: SuperAdmin, db: DbSession, entreprise_id: int | None = None):
    """Liste les abonnements, optionnellement filtrés par entreprise."""
    stmt = (
        select(Subscription, Plan)
        .join(Plan, Subscription.plan_id == Plan.id)
        .where(Subscription.is_deleted == False)
        .order_by(Subscription.date_debut.desc())
    )
    if entreprise_id:
        stmt = stmt.where(Subscription.entreprise_id == entreprise_id)

    result = await db.execute(stmt)
    rows = result.all()
    subscriptions = []
    for sub, plan in rows:
        sub_data = SubscriptionResponse.model_validate(sub)
        plan_data = PlanResponse.model_validate(plan)
        subscriptions.append(SubscriptionWithPlan(**sub_data.model_dump(), plan=plan_data))
    return subscriptions


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(payload: SuperAdmin, db: DbSession, sub_in: SubscriptionCreate):
    """Crée un abonnement pour une entreprise (super-admin)."""
    if not sub_in.entreprise_id:
        raise HTTPException(status_code=422, detail="entreprise_id requis.")
    entreprise = await db.get(Entreprise, sub_in.entreprise_id)
    if not entreprise or entreprise.is_deleted:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée.")

    plan = await db.get(Plan, sub_in.plan_id)
    if not plan or plan.is_deleted or not plan.actif:
        raise HTTPException(status_code=404, detail="Plan non trouvé ou inactif.")

    now = datetime.now()
    date_debut = sub_in.date_debut or now
    date_fin = sub_in.date_fin
    if not date_fin:
        if sub_in.periode == "annuel":
            date_fin = now + timedelta(days=365)
        else:
            date_fin = now + timedelta(days=30)

    date_prochain = sub_in.date_prochain_renouvellement or date_fin

    sub = Subscription(
        entreprise_id=sub_in.entreprise_id,
        plan_id=sub_in.plan_id,
        date_debut=date_debut,
        date_fin=date_fin,
        date_prochain_renouvellement=date_prochain,
        statut=sub_in.statut or "actif",
        mode_paiement=sub_in.mode_paiement,
        prix_paye=sub_in.prix_paye,
        periode=sub_in.periode,
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return sub


@router.put("/subscriptions/{sub_id}", response_model=SubscriptionResponse)
async def update_subscription(payload: SuperAdmin, db: DbSession, sub_id: int, sub_in: SubscriptionUpdate):
    """Met à jour un abonnement existant."""
    sub = await db.get(Subscription, sub_id)
    if not sub or sub.is_deleted:
        raise HTTPException(status_code=404, detail="Abonnement non trouvé.")

    update_data = sub_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sub, field, value)

    await db.flush()
    await db.refresh(sub)
    return sub


@router.post("/subscriptions/{sub_id}/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(payload: SuperAdmin, db: DbSession, sub_id: int):
    """Annule un abonnement."""
    sub = await db.get(Subscription, sub_id)
    if not sub or sub.is_deleted:
        raise HTTPException(status_code=404, detail="Abonnement non trouvé.")

    sub.statut = "annule"
    sub.date_fin = datetime.now()
    await db.flush()
    await db.refresh(sub)
    return sub


# ============================================================
# Public / Entreprise
# ============================================================

@router.get("/public/plans", response_model=list[PlanResponse])
async def list_public_plans(db: DbSession):
    """Liste publique des plans actifs (pour la page tarifs).

    Le plan `essai` est exclu : c'est un mécanisme interne attribué
    automatiquement à l'inscription (30 jours), pas une formule souscribable —
    l'afficher créerait un doublon « Gratuit » trompeur sur /pricing.
    """
    result = await db.execute(
        select(Plan)
        .where(
            Plan.actif == True,
            Plan.is_deleted == False,
            Plan.code != "essai",
        )
        .order_by(Plan.prix_mensuel.asc())
    )
    return result.scalars().all()


@router.get("/entreprise/subscription/state")
async def get_my_subscription_state(payload: CurrentUser, db: DbSession):
    """État léger de l'abonnement de l'entreprise (essai/actif/expire/sans)
    + jours restants — pour la bannière de compte à rebours."""
    from app.services.subscription_state import get_entreprise_state
    return await get_entreprise_state(db, payload.get("entreprise_id"))


@router.get("/entreprise/subscription", response_model=SubscriptionWithPlan | None)
async def get_my_subscription(payload: CurrentUser, db: DbSession):
    """Récupère l'abonnement actif de l'entreprise de l'utilisateur connecté."""
    if not payload.get("entreprise_id"):
        return None

    sub = await db.get(Subscription, payload.get("subscription_id")) if payload.get("subscription_id") else None
    if not sub:
        from app.crud.subscription import SubscriptionCRUD
        sub = await SubscriptionCRUD().get_active_by_entreprise(db, payload["entreprise_id"])

    if not sub or sub.is_deleted:
        return None

    from app.crud.plan import PlanCRUD
    plan = await PlanCRUD().get(db, sub.plan_id)
    if not plan:
        return None

    sub_data = SubscriptionResponse.model_validate(sub)
    plan_data = PlanResponse.model_validate(plan)
    return SubscriptionWithPlan(**sub_data.model_dump(), plan=plan_data)


@router.post("/entreprise/subscription", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_my_subscription(payload: CurrentUser, db: DbSession, sub_in: SubscriptionCreate):
    """Crée ou remplace l'abonnement de l'entreprise connectée."""
    if not payload.get("entreprise_id"):
        raise HTTPException(status_code=400, detail="Utilisateur sans entreprise.")

    entreprise_id = payload["entreprise_id"]

    plan = await db.get(Plan, sub_in.plan_id)
    if not plan or plan.is_deleted or not plan.actif:
        raise HTTPException(status_code=404, detail="Plan non trouvé ou inactif.")

    # Anti-essai infini : un plan d'essai ne peut pas être (re)pris après consommation.
    from app.services.subscription_state import a_deja_fait_essai
    if plan.code == "essai" and await a_deja_fait_essai(db, entreprise_id):
        raise HTTPException(status_code=403, detail="L'essai gratuit a déjà été utilisé pour cette entreprise.")

    from app.crud.subscription import SubscriptionCRUD
    existing = await SubscriptionCRUD().get_active_by_entreprise(db, entreprise_id)
    if existing:
        existing.statut = "annule"
        existing.date_fin = datetime.now()
        await db.flush()

    now = datetime.now()
    date_debut = sub_in.date_debut or now
    if sub_in.periode == "annuel":
        date_fin = now + timedelta(days=365)
    else:
        date_fin = now + timedelta(days=30)
    date_prochain = sub_in.date_prochain_renouvellement or date_fin

    sub = Subscription(
        entreprise_id=entreprise_id,
        plan_id=sub_in.plan_id,
        date_debut=date_debut,
        date_fin=date_fin,
        date_prochain_renouvellement=date_prochain,
        statut=sub_in.statut or "actif",
        mode_paiement=sub_in.mode_paiement,
        prix_paye=sub_in.prix_paye,
        periode=sub_in.periode,
    )
    db.add(sub)

    # Synchronise le champ vitrine Entreprise.abonnement avec le vrai plan.
    entreprise = await db.get(Entreprise, entreprise_id)
    if entreprise:
        entreprise.abonnement = plan.code

    await db.flush()
    await db.refresh(sub)
    return sub
