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


# ============================================================
# Plans (CRUD Super Admin)
# ============================================================

@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(payload: SuperAdmin, db: DbSession):
    """Liste tous les plans d'abonnement."""
    result = await db.execute(select(Plan).where(Plan.is_deleted == False).order_by(Plan.prix_mensuel.asc()))
    return result.scalars().all()


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
    """Crée un abonnement pour une entreprise."""
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
    """Liste publique des plans actifs (pour la page tarifs)."""
    result = await db.execute(select(Plan).where(Plan.actif == True, Plan.is_deleted == False).order_by(Plan.prix_mensuel.asc()))
    return result.scalars().all()


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
    await db.flush()
    await db.refresh(sub)
    return sub
