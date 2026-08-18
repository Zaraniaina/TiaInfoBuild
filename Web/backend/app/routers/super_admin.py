"""Router pour le Super Admin (propriétaire SaaS)."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import require_super_admin
from app.models.entreprise import Entreprise
from app.models.utilisateur import Utilisateur
from app.schemas.entreprise import EntrepriseCreate, EntrepriseUpdate, EntrepriseResponse
from app.schemas.utilisateur import UtilisateurResponse, UtilisateurList
from app.schemas.dashboard import SuperAdminStatsResponse

router = APIRouter(prefix="/super-admin", tags=["super-admin"])
CurrentUser = Annotated[dict[str, Any], Depends(require_super_admin)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/stats", response_model=SuperAdminStatsResponse)
async def get_stats(payload: CurrentUser, db: DbSession):
    total_entreprises = (await db.execute(select(func.count(Entreprise.id)))).scalar_one_or_none() or 0
    total_utilisateurs = (await db.execute(select(func.count(Utilisateur.id)))).scalar_one_or_none() or 0
    total_chantiers = 0
    from app.models.chantier import Chantier
    total_chantiers = (await db.execute(select(func.count(Chantier.id)))).scalar_one_or_none() or 0
    entreprises_actives = (await db.execute(select(func.count(Entreprise.id)).where(Entreprise.actif == True))).scalar_one_or_none() or 0
    abonnements_result = await db.execute(select(Entreprise.abonnement, func.count(Entreprise.id)).group_by(Entreprise.abonnement))
    abonnements = {row[0]: row[1] for row in abonnements_result.all()}
    return SuperAdminStatsResponse(
        total_entreprises=total_entreprises,
        total_utilisateurs=total_utilisateurs,
        total_chantiers=total_chantiers,
        ca_total=0.0,
        entreprises_actives=entreprises_actives,
        abonnements=abonnements,
    )


@router.get("/entreprises", response_model=list[EntrepriseResponse])
async def list_entreprises(
    payload: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    actif: bool | None = Query(default=None),
):
    query = select(Entreprise)
    if search:
        query = query.where(Entreprise.nom.ilike(f"%{search}%"))
    if actif is not None:
        query = query.where(Entreprise.actif == actif)
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    return list(result.scalars().all())


@router.post("/entreprises", response_model=EntrepriseResponse, status_code=status.HTTP_201_CREATED)
async def create_entreprise(payload: CurrentUser, db: DbSession, data: EntrepriseCreate):
    obj_in = data.model_dump()
    entreprise = Entreprise(**obj_in)
    db.add(entreprise)
    await db.flush()
    await db.refresh(entreprise)
    return entreprise


@router.put("/entreprises/{id}", response_model=EntrepriseResponse)
async def update_entreprise(payload: CurrentUser, db: DbSession, id: int, data: EntrepriseUpdate):
    result = await db.execute(select(Entreprise).where(Entreprise.id == id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    obj_in = data.model_dump(exclude_unset=True)
    for field, value in obj_in.items():
        setattr(entreprise, field, value)
    await db.flush()
    await db.refresh(entreprise)
    return entreprise


@router.post("/entreprises/{id}/desactiver", response_model=dict)
async def toggle_entreprise(payload: CurrentUser, db: DbSession, id: int):
    result = await db.execute(select(Entreprise).where(Entreprise.id == id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    entreprise.actif = not entreprise.actif
    await db.commit()
    return {"actif": entreprise.actif}


@router.get("/utilisateurs", response_model=list[UtilisateurList])
async def list_all_utilisateurs(
    payload: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
):
    query = select(Utilisateur).where(Utilisateur.is_deleted == False)
    if search:
        query = query.where((Utilisateur.nom.ilike(f"%{search}%")) | (Utilisateur.email.ilike(f"%{search}%")))
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    return list(result.scalars().all())
