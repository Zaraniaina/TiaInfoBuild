"""Router pour le dashboard et les statistiques."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import CurrentUserPayload, DbDep
from app.crud.dashboard import DashboardCRUD
from app.schemas.dashboard import DashboardStatsResponse

router = APIRouter(tags=["dashboard"])


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    from app.core.permissions import PERMISSION_MAP
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_stats(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "dashboard:read")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    crud = DashboardCRUD()
    stats = await crud.get_stats(db, entreprise_id, payload)
    return DashboardStatsResponse(**stats)


@router.get("/ca-evolution")
async def get_ca_evolution(
    payload: CurrentUserPayload,
    db: DbDep,
    mois: int = Query(default=6, ge=1, le=24),
):
    _require_permission(payload, "dashboard:read")
    return {"evolution": []}


@router.get("/top-chantiers")
async def get_top_chantiers(
    payload: CurrentUserPayload,
    db: DbDep,
    limit: int = Query(default=5, ge=1, le=20),
):
    _require_permission(payload, "dashboard:read")
    return {"top_chantiers": []}


@router.get("/validations")
async def list_validations(payload: CurrentUserPayload, db: DbDep):
    from app.models.devis import Devis
    from app.models.chantier import Chantier

    role_code = payload.get("role_code", "")
    entreprise_id = payload.get("entreprise_id")

    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")

    validations = []

    if role_code in ("directeur", "admin_entreprise", "super_admin"):
        result = await db.execute(
            select(Devis.id, Devis.numero, Devis.montant_ttc, Devis.statut, Devis.date_creation)
            .where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False, Devis.statut == "brouillon")
            .order_by(Devis.montant_ttc.desc())
            .limit(20)
        )
        for row in result.all():
            validations.append({
                "id": row.id,
                "type": "devis",
                "numero": row.numero,
                "montant": float(row.montant_ttc or 0),
                "statut": row.statut,
                "date": row.date_creation.isoformat() if row.date_creation else None,
            })

        result = await db.execute(
            select(Chantier.id, Chantier.nom, Chantier.budget_prevu, Chantier.budget_previsionnel, Chantier.statut)
            .where(Chantier.entreprise_id == entreprise_id, Chantier.is_deleted == False, Chantier.statut == "planification")
            .order_by(Chantier.budget_prevu.desc())
            .limit(20)
        )
        for row in result.all():
            validations.append({
                "id": row.id,
                "type": "budget_chantier",
                "numero": row.nom,
                "montant": float(row.budget_prevu or 0),
                "statut": row.statut,
                "date": None,
            })

    validations.sort(key=lambda x: x.get("date") or "", reverse=True)
    return {"validations": validations}


@router.post("/validations/{validation_id}/approve")
async def approve_validation(payload: CurrentUserPayload, db: DbDep, validation_id: int):
    from app.models.devis import Devis
    from app.models.chantier import Chantier

    role_code = payload.get("role_code", "")
    entreprise_id = payload.get("entreprise_id")

    if role_code not in ("directeur", "admin_entreprise", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission refusée")

    devis = await db.execute(select(Devis).where(Devis.id == validation_id, Devis.is_deleted == False))
    devis_obj = devis.scalar_one_or_none()
    if devis_obj:
        if devis_obj.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        devis_obj.statut = "envoye"
        await db.commit()
        return {"message": "Devis approuvé et envoyé au client"}

    chantier = await db.execute(select(Chantier).where(Chantier.id == validation_id, Chantier.is_deleted == False))
    chantier_obj = chantier.scalar_one_or_none()
    if chantier_obj:
        if chantier_obj.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        chantier_obj.statut = "en_cours"
        await db.commit()
        return {"message": "Budget de chantier approuvé, chantier lancé"}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Élément de validation non trouvé")


@router.post("/validations/{validation_id}/reject")
async def reject_validation(payload: CurrentUserPayload, db: DbDep, validation_id: int):
    from app.models.devis import Devis
    from app.models.chantier import Chantier

    role_code = payload.get("role_code", "")
    entreprise_id = payload.get("entreprise_id")

    if role_code not in ("directeur", "admin_entreprise", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission refusée")

    devis = await db.execute(select(Devis).where(Devis.id == validation_id, Devis.is_deleted == False))
    devis_obj = devis.scalar_one_or_none()
    if devis_obj:
        if devis_obj.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        devis_obj.statut = "refuse"
        await db.commit()
        return {"message": "Devis refusé"}

    chantier = await db.execute(select(Chantier).where(Chantier.id == validation_id, Chantier.is_deleted == False))
    chantier_obj = chantier.scalar_one_or_none()
    if chantier_obj:
        if chantier_obj.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        chantier_obj.statut = "annule"
        await db.commit()
        return {"message": "Budget de chantier refusé, projet annulé"}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Élément de validation non trouvé")


@router.get("/rentabilite")
async def get_rentabilite(payload: CurrentUserPayload, db: DbDep):
    from app.models.chantier import Chantier
    from app.models.facture import Facture
    from app.models.depense import Depense

    _require_permission(payload, "dashboard:read")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")

    ca_subq = (
        select(Facture.chantier_id, func.coalesce(func.sum(Facture.montant_ttc), 0).label("ca"))
        .where(Facture.is_deleted == False)
        .group_by(Facture.chantier_id)
        .subquery()
    )
    depense_subq = (
        select(Depense.chantier_id, func.coalesce(func.sum(Depense.montant), 0).label("depenses"))
        .where(Depense.is_deleted == False)
        .group_by(Depense.chantier_id)
        .subquery()
    )

    result = await db.execute(
        select(
            Chantier.id,
            Chantier.nom,
            Chantier.numero,
            Chantier.statut,
            Chantier.budget_prevu,
            Chantier.budget_reel,
            func.coalesce(ca_subq.c.ca, 0).label("ca"),
            func.coalesce(depense_subq.c.depenses, 0).label("depenses"),
        )
        .outerjoin(ca_subq, ca_subq.c.chantier_id == Chantier.id)
        .outerjoin(depense_subq, depense_subq.c.chantier_id == Chantier.id)
        .where(Chantier.entreprise_id == entreprise_id, Chantier.is_deleted == False)
    )

    chantiers = []
    for row in result.all():
        ca = float(row.ca or 0.0)
        depenses = float(row.depenses or 0.0)
        budget_prevu = float(row.budget_prevu or 0.0)
        budget_reel = float(row.budget_reel or 0.0)
        marge = ca - depenses
        taux_marge = (marge / ca * 100) if ca > 0 else 0.0
        ecart_budget = budget_prevu - budget_reel if budget_prevu > 0 else 0.0
        taux_avancement = (budget_reel / budget_prevu * 100) if budget_prevu > 0 else 0.0

        chantiers.append({
            "id": row.id,
            "nom": row.nom,
            "numero": row.numero,
            "statut": row.statut,
            "ca": ca,
            "depenses": depenses,
            "marge": marge,
            "taux_marge": round(taux_marge, 1),
            "budget_prevu": budget_prevu,
            "budget_reel": budget_reel,
            "ecart_budget": round(ecart_budget, 2),
            "taux_avancement": round(taux_avancement, 1),
        })

    return {"rentabilite": chantiers}
