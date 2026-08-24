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

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


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
