"""Router pour le dashboard et les statistiques."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.crud.dashboard import DashboardCRUD
from app.schemas.dashboard import DashboardStatsResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_active_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_stats(payload: CurrentUser, db: DbSession):
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    crud = DashboardCRUD()
    stats = await crud.get_stats(db, entreprise_id)
    return DashboardStatsResponse(**stats)


@router.get("/ca-evolution")
async def get_ca_evolution(
    payload: CurrentUser,
    db: DbSession,
    mois: int = Query(default=6, ge=1, le=24),
):
    return {"evolution": []}


@router.get("/top-chantiers")
async def get_top_chantiers(
    payload: CurrentUser,
    db: DbSession,
    limit: int = Query(default=5, ge=1, le=20),
):
    return {"top_chantiers": []}
