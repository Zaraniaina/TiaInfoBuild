"""Routers pour le module materiels: liste, detail, CRUD, maintenance, export CSV."""
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import file_storage
from app.crud.base import BaseCRUD
from app.crud.materiel import MaterielCRUD
from app.database import get_db
from app.models.materiel import Materiel
from app.models.maintenance import Maintenance
from app.models.mouvement_materiel import MouvementMateriel
from app.schemas.materiel import (
    MaterielCreate,
    MaterielUpdate,
    MaterielResponse,
    MaterielList,
    MaintenanceCreate,
    MaintenanceResponse,
    HorametreUpdate,
    MouvementMaterielCreate,
    MouvementMaterielResponse,
)
import uuid
from app.core.export import export_csv

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


@router.get("", response_model=list[MaterielList])
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


@router.post("", response_model=MaterielResponse, status_code=status.HTTP_201_CREATED)
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


# ==================== UPLOADS PHOTO / MANUEL ====================


async def _get_materiel_entreprise(db, id: int, entreprise_id: int | None) -> Materiel:
    materiel = await materiel_crud.get(db, id)
    if not materiel or materiel.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel non trouvé")
    if entreprise_id is not None and materiel.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel non trouvé")
    return materiel


@router.post("/{id}/upload-photo")
async def upload_photo(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    fichier: UploadFile = File(...),
):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, id, entreprise_id)
    try:
        url = await file_storage.save_upload(
            fichier, "materiel-photos", file_storage.ALLOWED_PHOTO_EXT, file_storage.MAX_PHOTO_MB
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    # Supprime l'ancienne photo si présente
    if materiel.photo_url:
        await file_storage.delete_upload(materiel.photo_url)
    materiel.photo_url = url
    await db.flush()
    await db.refresh(materiel)
    return {"photo_url": url}


@router.post("/{id}/upload-manuel")
async def upload_manuel(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    fichier: UploadFile = File(...),
):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, id, entreprise_id)
    try:
        url = await file_storage.save_upload(
            fichier, "materiels-manuels", file_storage.ALLOWED_MANUEL_EXT, file_storage.MAX_MANUEL_MB
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if materiel.manuel_url:
        await file_storage.delete_upload(materiel.manuel_url)
    materiel.manuel_url = url
    await db.flush()
    await db.refresh(materiel)
    return {"manuel_url": url}


@router.delete("/{id}/photo")
async def delete_photo(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, id, entreprise_id)
    if materiel.photo_url:
        await file_storage.delete_upload(materiel.photo_url)
    materiel.photo_url = None
    await db.flush()
    await db.refresh(materiel)
    return {"photo_url": None}


@router.delete("/{id}/manuel")
async def delete_manuel(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, id, entreprise_id)
    if materiel.manuel_url:
        await file_storage.delete_upload(materiel.manuel_url)
    materiel.manuel_url = None
    await db.flush()
    await db.refresh(materiel)
    return {"manuel_url": None}


# ==================== VGP & CONFORMITÉ BTP ====================


@router.post("/{id}/upload-vgp")
async def upload_vgp(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    fichier: UploadFile = File(...),
):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, id, entreprise_id)
    try:
        url = await file_storage.save_upload(
            fichier, "materiels-vgp", file_storage.ALLOWED_MANUEL_EXT, file_storage.MAX_MANUEL_MB
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if materiel.certificat_vgp_url:
        await file_storage.delete_upload(materiel.certificat_vgp_url)
    materiel.certificat_vgp_url = url
    await db.flush()
    await db.refresh(materiel)
    return {"certificat_vgp_url": url}


@router.delete("/{id}/vgp")
async def delete_vgp(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, id, entreprise_id)
    if materiel.certificat_vgp_url:
        await file_storage.delete_upload(materiel.certificat_vgp_url)
    materiel.certificat_vgp_url = None
    await db.flush()
    await db.refresh(materiel)
    return {"certificat_vgp_url": None}


# ==================== CARNET DE BORD & HORAMÈTRE ====================


@router.post("/{id}/horametre", response_model=MaterielResponse)
async def update_horametre(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: HorametreUpdate,
):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, id, entreprise_id)
    if data.heures_moteur is not None:
        materiel.heures_moteur = data.heures_moteur
    if data.kilometrage is not None:
        materiel.kilometrage = data.kilometrage
    await db.flush()
    await db.refresh(materiel)
    return materiel


# ==================== BONS DE TRANSFERT / MOUVEMENTS ====================


@router.get("/transferts", response_model=list[MouvementMaterielResponse])
async def list_transferts(
    payload: CurrentUserPayload,
    db: DbDep,
    materiel_id: int | None = Query(default=None),
):
    _require_permission(payload, "materiels:read")
    entreprise_id = _get_entreprise_id(payload)
    q = select(MouvementMateriel).where(MouvementMateriel.is_deleted == False)
    if entreprise_id:
        q = q.where(MouvementMateriel.entreprise_id == entreprise_id)
    if materiel_id:
        q = q.where(MouvementMateriel.materiel_id == materiel_id)
    result = await db.execute(q.order_by(MouvementMateriel.created_at.desc()))
    return list(result.scalars().all())


@router.post("/transferts", response_model=MouvementMaterielResponse, status_code=status.HTTP_201_CREATED)
async def create_transfert(
    payload: CurrentUserPayload,
    db: DbDep,
    data: MouvementMaterielCreate,
):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, data.materiel_id, entreprise_id)
    
    mouvement = MouvementMateriel(
        entreprise_id=entreprise_id,
        materiel_id=data.materiel_id,
        chantier_origine_id=data.chantier_origine_id,
        chantier_destination_id=data.chantier_destination_id,
        transporteur=data.transporteur,
        notes=data.notes,
        statut="en_transit",
        date_depart=datetime.now(),
    )
    db.add(mouvement)
    materiel.statut = "en_utilisation"
    await db.flush()
    await db.refresh(mouvement)
    return mouvement


@router.put("/transferts/{id}/valider", response_model=MouvementMaterielResponse)
async def valider_transfert(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "materiels:write")
    entreprise_id = _get_entreprise_id(payload)
    q = select(MouvementMateriel).where(MouvementMateriel.id == id, MouvementMateriel.is_deleted == False)
    if entreprise_id:
        q = q.where(MouvementMateriel.entreprise_id == entreprise_id)
    res = await db.execute(q)
    mouvement = res.scalar_one_or_none()
    if not mouvement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfert non trouvé")
    
    mouvement.statut = "livre"
    mouvement.date_reception = datetime.now()
    await db.flush()
    await db.refresh(mouvement)
    return mouvement


# ==================== TRAÇABILITÉ & QR CODE ====================


@router.get("/{id}/qr-code")
async def get_qr_code(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "materiels:read")
    entreprise_id = _get_entreprise_id(payload)
    materiel = await _get_materiel_entreprise(db, id, entreprise_id)
    if not materiel.qr_code_key:
        materiel.qr_code_key = f"MAT-{materiel.id}-{uuid.uuid4().hex[:8].upper()}"
        await db.flush()
        await db.refresh(materiel)
    return {
        "materiel_id": materiel.id,
        "nom": materiel.nom,
        "numero_serie": materiel.numero_serie,
        "qr_code_key": materiel.qr_code_key,
        "statut_vgp": materiel.statut_vgp,
        "statut": materiel.statut,
    }