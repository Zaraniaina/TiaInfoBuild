"""Routers pour le module materiels: liste, detail, CRUD, maintenance, export CSV."""
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.export import export_csv
from app.crud.base import BaseCRUD
from app.crud.materiel import MaterielCRUD
from app.database import get_db
from app.models.materiel import Materiel
from app.models.maintenance import Maintenance
from app.schemas.materiel import (
    MaterielCreate,
    MaterielUpdate,
    MaterielResponse,
    MaterielList,
    MaintenanceCreate,
    MaintenanceResponse,
)
from app.security import CurrentUserPayload, DbDep

router = APIRouter(tags=["materiels"])


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    from app.core.permissions import PERMISSION_MAP
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


def _get_entreprise_id(payload: CurrentUserPayload) -> int | None:
    role_code = payload.get("role_code")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id and role_code != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entreprise ID manquant dans le token",
        )
    return entreprise_id


materiel_crud = MaterielCRUD()


# ==================== MATERIAUX ====================


@router.get("/", response_model=list[MaterielList])
async def list_materiaux(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
    type: str | None = None,
    statut: str | None = None,
    marque: str | None = None,
):
    _require_permission(payload, "materiels:read")
    entreprise_id = _get_entreprise_id(payload)
    query = select(Materiel).where(Materiel.is_deleted == False)
    if entreprise_id:
        query = query.where(Materiel.entreprise_id == entreprise_id)
    if type:
        query = query.where(Materiel.type == type)
    if statut:
        query = query.where(Materiel.statut == statut)
    if marque:
        query = query.where(Materiel.marque == marque)
    result = await db.execute(query.offset(skip).limit(limit))
    return list(result.scalars().all())


@router.post("/", response_model=MaterielResponse, status_code=status.HTTP_201_CREATED)
async def create_materiel(
    payload: CurrentUserPayload,
    db: DbDep,
    data: MaterielCreate,
):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    return await materiel_crud.create(db, obj_in)


@router.get("/{id}", response_model=MaterielResponse)
async def get_materiel(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "materiels:read")
    materiel = await materiel_crud.get(db, id)
    if not materiel or materiel.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel non trouvé")
    return materiel


@router.put("/{id}", response_model=MaterielResponse)
async def update_materiel(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: MaterielUpdate,
):
    _require_permission(payload, "materiels:write")
    materiel = await materiel_crud.get(db, id)
    if not materiel or materiel.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel non trouvé")
    obj_in = data.model_dump(exclude_unset=True)
    return await materiel_crud.update(db, materiel, obj_in)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_materiel(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "materiels:delete")
    materiel = await materiel_crud.get(db, id)
    if not materiel or materiel.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel non trouvé")
    materiel.is_deleted = True
    await db.flush()
    await db.refresh(materiel)
    return None


# ==================== MAINTENANCE ====================


@router.post("/{id}/maintenance", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
async def add_maintenance(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: MaintenanceCreate,
):
    _require_permission(payload, "materiels:write")
    materiel = await materiel_crud.get(db, id)
    if not materiel or materiel.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel non trouvé")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    obj_in["materiel_id"] = id
    maintenance = Maintenance(**obj_in)
    db.add(maintenance)
    await db.flush()
    await db.refresh(maintenance)

    materiel.statut = "en_maintenance"
    await db.flush()
    await db.refresh(materiel)

    return maintenance


@router.get("/maintenances", response_model=list[MaintenanceResponse])
async def list_maintenances(
    payload: CurrentUserPayload,
    db: DbDep,
    materiel_id: int | None = Query(default=None),
):
    _require_permission(payload, "materiels:read")
    entreprise_id = _get_entreprise_id(payload)
    q = select(Maintenance).where(Maintenance.is_deleted == False)
    if entreprise_id:
        q = q.where(Maintenance.entreprise_id == entreprise_id)
    if materiel_id:
        q = q.where(Maintenance.materiel_id == materiel_id)
    result = await db.execute(q.order_by(Maintenance.created_at.desc()))
    return list(result.scalars().all())


# ==================== EXPORT CSV ====================


@router.get("/export-csv")
async def export_materiaux_csv(
    payload: CurrentUserPayload,
    db: DbDep,
    type: str | None = Query(default=None),
    statut: str | None = Query(default=None),
):
    _require_permission(payload, "materiels:read")
    entreprise_id = _get_entreprise_id(payload)
    query = select(Materiel).where(Materiel.entreprise_id == entreprise_id, Materiel.is_deleted == False)
    if type:
        query = query.where(Materiel.type == type)
    if statut:
        query = query.where(Materiel.statut == statut)
    result = await db.execute(query)
    materiaux = result.scalars().all()

    headers = [
        "id",
        "nom",
        "designation",
        "type",
        "marque",
        "modele",
        "numero_serie",
        "date_acquisition",
        "valeur_achat",
        "statut",
        "created_at",
    ]
    rows = []
    for m in materiaux:
        rows.append({
            "id": m.id,
            "nom": m.nom,
            "designation": m.designation,
            "type": m.type,
            "marque": m.marque,
            "modele": m.modele,
            "numero_serie": m.numero_serie,
            "date_acquisition": m.date_acquisition.isoformat() if m.date_acquisition else "",
            "valeur_achat": m.valeur_achat,
            "statut": m.statut,
            "created_at": m.created_at.isoformat() if m.created_at else "",
        })

    csv_bytes = export_csv(headers, rows)
    from fastapi.responses import Response
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=materiaux.csv"},
    )