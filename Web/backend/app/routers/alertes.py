"""Router pour les alertes."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated
from datetime import datetime

from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.crud.alerte import AlerteCRUD
from app.models.alerte import Alerte
from app.schemas.alerte import AlerteCreate, AlerteResponse, AlerteList, AlerteMarquerLue
from app.security import CurrentUserPayload, DbDep
from app.core.permissions import PERMISSION_MAP

router = APIRouter(tags=["alertes"])


def _require_permission(payload: dict[str, Any], permission: str) -> None:
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' required",
        )


@router.get("", response_model=list[AlerteList])
@router.get("/", response_model=list[AlerteList])
async def list_alertes(
    payload: CurrentUserPayload,
    db: DbDep,
    non_lues: bool | None = Query(default=None),
    gravite: str | None = Query(default=None),
    type_entite: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "alertes:read")
    entreprise_id = payload.get("entreprise_id")
    crud = AlerteCRUD()
    query = select(Alerte).where(Alerte.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Alerte.entreprise_id == entreprise_id)
    if non_lues is not None:
        query = query.where(Alerte.lue == (not non_lues))
    if gravite:
        query = query.where(Alerte.niveau_gravite == gravite)
    if type_entite:
        query = query.where(Alerte.type_entite == type_entite)
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    return list(result.scalars().all())


@router.post("/", response_model=AlerteResponse, status_code=status.HTTP_201_CREATED)
async def create_alerte(payload: CurrentUserPayload, db: DbDep, data: AlerteCreate):
    _require_permission(payload, "alertes:write")
    entreprise_id = payload.get("entreprise_id")
    obj_in = data.model_dump()
    if entreprise_id is not None and not obj_in.get("entreprise_id"):
        obj_in["entreprise_id"] = entreprise_id
    alerte = Alerte(**obj_in)
    db.add(alerte)
    await db.flush()
    await db.refresh(alerte)
    return alerte


@router.post("/{id}/lue")
async def marquer_lue(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "alertes:write")
    result = await db.execute(select(Alerte).where(Alerte.id == id, Alerte.is_deleted == False))
    alerte = result.scalar_one_or_none()
    if not alerte:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerte non trouvée")
    alerte.lue = True
    alerte.date_lecture = datetime.now()
    await db.commit()
    return {"message": "Alerte marquée comme lue"}


@router.post("/marquer-toutes-lues")
async def marquer_toutes_lues(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "alertes:write")
    entreprise_id = payload.get("entreprise_id")
    await db.execute(
        Alerte.__table__.update()
        .where(Alerte.entreprise_id == entreprise_id, Alerte.lue == False, Alerte.is_deleted == False)
        .values(lue=True, date_lecture=datetime.now())
    )
    await db.commit()
    return {"message": "Toutes les alertes ont été marquées comme lues"}
