"""Router pour la gestion des ressources humaines (employés, pointages, équipes, heures sup)."""
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import csv
import io

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func

from app.core import file_storage
from app.crud.employe import EmployeCRUD
from app.crud.pointage import PointageCRUD
from app.crud.equipe import EquipeCRUD
from app.crud.base import BaseCRUD
from app.models.employe import Employe
from app.models.entreprise import Entreprise
from app.models.utilisateur import Utilisateur
from app.models.pointage import Pointage
from app.models.equipe import Equipe
from app.models.membre_equipe import MembreEquipe
from app.models.heure_supplementaire import HeureSupplementaire
from app.models.historique_poste import HistoriquePoste
from app.schemas.employe import (
    EmployeCreate,
    EmployeUpdate,
    EmployeResponse,
    EmployeList,
    ChangementPosteRequest,
)
from app.schemas.pointage import (
    PointageCreate,
    PointageUpdate,
    PointageResponse,
    PointageList,
)
from app.schemas.equipe import (
    EquipeCreate,
    EquipeUpdate,
    EquipeResponse,
    EquipeList,
    MembreEquipeCreate,
)
from app.security import CurrentUserPayload, DbDep
from app.core.permissions import Role, PERMISSION_MAP
from app.crud.conge import CongeCRUD
from app.models.conge import Conge
from app.models.notification import Notification
from app.models.utilisateur import Utilisateur
from app.models.document import Document
from app.schemas.conge import (
    CongeCreate,
    CongeDecision,
    CongeResponse,
    CongeList,
)

router = APIRouter()


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    from app.core.permissions import PERMISSION_MAP
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


class HeureSupplementaireCreate(BaseModel):
    employe_id: int = Field(..., ge=1)
    chantier_id: int | None = None
    date_hs: date
    nb_heures: float = Field(..., gt=0)
    taux_majoration: float = Field(default=1.5, gt=0)
    motif: str | None = None
    statut: str = Field(default="en_attente", max_length=20)
    type_compensation: str = Field(default="paiement", max_length=20)


class HeureSupplementaireUpdate(BaseModel):
    nb_heures: float | None = None
    taux_majoration: float | None = None
    motif: str | None = None
    statut: str | None = None
    type_compensation: str | None = None


class HeureSupplementaireResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    entreprise_id: int | None = None
    employe_id: int | None = None
    chantier_id: int | None = None
    date_hs: date | None = None
    nb_heures: float | None = None
    taux_majoration: float | None = None
    motif: str | None = None
    statut: str | None = None
    type_compensation: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class HeureSupplementaireList(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    employe_id: int | None = None
    chantier_id: int | None = None
    date_hs: date | None = None
    nb_heures: float | None = None
    taux_majoration: float | None = None
    statut: str | None = None
    type_compensation: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None


# --- Employés ---

@router.get("/employes", response_model=dict)
async def list_employes(
    payload: CurrentUserPayload,
    db: DbDep,
    search: str | None = Query(default=None, description="Recherche par nom ou prénom"),
    poste: str | None = Query(default=None),
    statut: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    crud = EmployeCRUD()
    skip = (page - 1) * size

    query = select(Employe).where(Employe.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Employe.entreprise_id == entreprise_id)
    if search:
        query = query.where(
            (Employe.nom.ilike(f"%{search}%")) | (Employe.prenom.ilike(f"%{search}%"))
        )
    if poste:
        query = query.where(Employe.poste == poste)
    if statut:
        query = query.where(Employe.statut == statut)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [EmployeList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


async def _sync_employe_user_photo(db, employe: Employe):
    if employe and employe.email and employe.entreprise_id:
        res = await db.execute(
            select(Utilisateur).where(
                func.lower(Utilisateur.email) == employe.email.strip().lower(),
                Utilisateur.entreprise_id == employe.entreprise_id
            )
        )
        user = res.scalar_one_or_none()
        if user:
            user.photo = employe.photo
            await db.flush()


@router.post("/employes", response_model=EmployeResponse, status_code=status.HTTP_201_CREATED)
async def create_employe(
    payload: CurrentUserPayload,
    obj_in: EmployeCreate,
    db: DbDep,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    crud = EmployeCRUD()
    employe = await crud.create(db, data)
    await _sync_employe_user_photo(db, employe)
    await db.refresh(employe)
    return EmployeResponse.model_validate(employe)


@router.get("/employes/{id}", response_model=EmployeResponse)
async def get_employe(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    crud = EmployeCRUD()
    employe = await crud.get(db, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    historique = (await db.execute(select(HistoriquePoste).where(HistoriquePoste.employe_id == id, HistoriquePoste.is_deleted == False))).scalars().all()
    response = EmployeResponse.model_validate(employe)
    response.historique_postes = [{c.name: getattr(h, c.name) for c in h.__table__.columns} for h in historique]
    return response


@router.put("/employes/{id}", response_model=EmployeResponse)
async def update_employe(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: EmployeUpdate,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    crud = EmployeCRUD()
    employe = await crud.get(db, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    data = obj_in.model_dump(exclude_unset=True)
    updated = await crud.update(db, employe, data)
    await _sync_employe_user_photo(db, updated)
    await db.refresh(updated)
    return EmployeResponse.model_validate(updated)


@router.post("/employes/{id}/photo", response_model=dict)
async def upload_employe_photo(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    fichier: UploadFile = File(...)
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    employe = await db.get(Employe, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    try:
        url = await file_storage.save_upload(
            fichier, "badge-photos", file_storage.ALLOWED_PHOTO_EXT, file_storage.MAX_PHOTO_MB
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if employe.photo and employe.photo.startswith("/api/uploads/"):
        await file_storage.delete_upload(employe.photo)

    employe.photo = url
    await _sync_employe_user_photo(db, employe)
    await db.flush()
    return {"photo": url}


@router.delete("/employes/{id}/photo", response_model=dict)
async def delete_employe_photo(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    employe = await db.get(Employe, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    if employe.photo and employe.photo.startswith("/api/uploads/"):
        await file_storage.delete_upload(employe.photo)

    employe.photo = None
    await _sync_employe_user_photo(db, employe)
    await db.flush()
    return {"photo": None}


@router.delete("/employes/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employe(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "rh:delete")
    entreprise_id = payload.get("entreprise_id")
    crud = EmployeCRUD()
    employe = await crud.get(db, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    employe.is_deleted = True
    await db.flush()
    return None


@router.post("/employes/{id}/changer-poste", response_model=EmployeResponse)
async def changer_poste(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: ChangementPosteRequest,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    user = payload.get("user")
    crud = EmployeCRUD()
    employe = await crud.get(db, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    old_poste = employe.poste
    old_contrat = employe.type_contrat
    old_salaire = employe.salaire_base

    employe.poste = obj_in.nouveau_poste
    if obj_in.type_contrat:
        employe.type_contrat = obj_in.type_contrat
    if obj_in.nouveau_salaire is not None:
        employe.salaire_base = obj_in.nouveau_salaire

    historique = HistoriquePoste(
        entreprise_id=entreprise_id or 0,
        employe_id=id,
        poste=obj_in.nouveau_poste,
        type_contrat=obj_in.type_contrat or old_contrat,
        salaire_base=obj_in.nouveau_salaire if obj_in.nouveau_salaire is not None else old_salaire,
        date_debut=obj_in.date_debut or obj_in.date_effet or date.today(),
        motif_changement=obj_in.motif,
    )
    db.add(historique)
    await db.flush()
    await db.refresh(employe)
    return EmployeResponse.model_validate(employe)


# --- Pointages ---

@router.get("/pointages", response_model=dict)
async def list_pointages(
    payload: CurrentUserPayload,
    db: DbDep,
    employe_id: int | None = Query(default=None),
    date_debut: date | None = Query(default=None),
    date_fin: date | None = Query(default=None),
    type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    crud = PointageCRUD()
    skip = (page - 1) * size

    query = select(Pointage).where(Pointage.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Pointage.entreprise_id == entreprise_id)
    if employe_id:
        query = query.where(Pointage.employe_id == employe_id)
    if date_debut:
        query = query.where(Pointage.date_jour >= date_debut)
    if date_fin:
        query = query.where(Pointage.date_jour <= date_fin)
    if type:
        query = query.where(Pointage.type == type)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [PointageList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


async def _entreprise_infos(db: DbDep, entreprise_id: int | None) -> dict:
    """Nom + logo de l'entreprise (affichés sur le badge QR de l'employé)."""
    if entreprise_id is None:
        return {"entreprise_nom": None, "entreprise_logo": None}
    ent = await db.get(Entreprise, entreprise_id)
    if not ent:
        return {"entreprise_nom": None, "entreprise_logo": None}
    return {"entreprise_nom": ent.nom, "entreprise_logo": ent.logo}


@router.get("/employes/{id}/badge-qr", response_model=dict)
async def get_employe_badge_qr(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    employe = await db.get(Employe, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    if not employe.code_qr_badge:
        import uuid
        employe.code_qr_badge = f"TIA-EMP-{employe.entreprise_id or 1}-{employe.id}-{uuid.uuid4().hex[:8].upper()}"
        await db.flush()

    ent_infos = await _entreprise_infos(db, employe.entreprise_id)
    return {
        "id": employe.id,
        "matricule": employe.matricule or f"EMP-{employe.id:04d}",
        "nom": employe.nom,
        "prenom": employe.prenom,
        "poste": employe.poste,
        "photo": employe.photo,
        "code_qr_badge": employe.code_qr_badge,
        **ent_infos,
        "date_generation": datetime.now().isoformat(),
    }


@router.get("/mon-badge", response_model=dict)
async def get_mon_badge(payload: CurrentUserPayload, db: DbDep):
    """Badge QR de l'employe rattache au compte connecte (resolution par email)."""
    _require_permission(payload, "rh:read")
    user = payload.get("user")
    email = (getattr(user, "email", None) or "").strip().lower()
    entreprise_id = payload.get("entreprise_id")
    query = select(Employe).where(Employe.is_deleted == False)
    if email:
        query = query.where(func.lower(Employe.email) == email)
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucune fiche employe rattachee a votre compte")
    if entreprise_id is not None:
        query = query.where(Employe.entreprise_id == entreprise_id)
    employe = (await db.execute(query)).scalar_one_or_none()
    if not employe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucune fiche employe rattachee a votre compte")

    if not employe.code_qr_badge:
        import uuid
        employe.code_qr_badge = f"TIA-EMP-{employe.entreprise_id or 1}-{employe.id}-{uuid.uuid4().hex[:8].upper()}"
        await db.flush()

    ent_infos = await _entreprise_infos(db, employe.entreprise_id)
    return {
        "id": employe.id,
        "matricule": employe.matricule or f"EMP-{employe.id:04d}",
        "nom": employe.nom,
        "prenom": employe.prenom,
        "poste": employe.poste,
        "photo": employe.photo,
        "code_qr_badge": employe.code_qr_badge,
        **ent_infos,
        "date_generation": datetime.now().isoformat(),
    }


class ScanBadgeRequest(BaseModel):
    code_qr_badge: str
    chantier_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


@router.post("/pointages/scan-badge", response_model=dict, status_code=status.HTTP_200_OK)
async def scan_badge_pointage(
    payload: CurrentUserPayload,
    obj_in: ScanBadgeRequest,
    db: DbDep,
):
    # Autoriser si le rôle possède la permission `rh:write` ou si c'est un `admin_entreprise`
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and "rh:write" not in permissions and role_code != Role.ADMIN_ENTREPRISE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission 'rh:write' requise")
    entreprise_id = payload.get("entreprise_id")
    user_id = payload.get("sub") or payload.get("id")

    stmt = select(Employe).where(
        Employe.code_qr_badge == obj_in.code_qr_badge,
        Employe.is_deleted == False
    )
    if entreprise_id is not None:
        stmt = stmt.where(Employe.entreprise_id == entreprise_id)
    
    result = await db.execute(stmt)
    employe = result.scalar_one_or_none()

    if not employe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Badge QR invalide ou employé inconnu"
        )

    today = date.today()
    now_time = datetime.now().time()

    pointage_stmt = select(Pointage).where(
        Pointage.employe_id == employe.id,
        Pointage.date_jour == today,
        Pointage.is_deleted == False
    )
    pt_result = await db.execute(pointage_stmt)
    existing_pt = pt_result.scalar_one_or_none()

    if not existing_pt:
        new_pt = Pointage(
            entreprise_id=employe.entreprise_id,
            employe_id=employe.id,
            chantier_id=obj_in.chantier_id,
            date_jour=today,
            heure_debut=now_time,
            heures_total=0.0,
            type="present",
            methode_pointage="scan_badge_par_chef",
            scanne_par_id=int(user_id) if user_id and str(user_id).isdigit() else None,
            latitude=obj_in.latitude,
            longitude=obj_in.longitude,
            statut_validation="valide",
            notes=obj_in.notes or "Entrée enregistrée par scan de badge QR"
        )
        db.add(new_pt)
        await db.flush()
        await db.refresh(new_pt)
        return {
            "status": "entree_enregistree",
            "message": f"Entrée validée à {now_time.strftime('%H:%M')} pour {employe.prenom or ''} {employe.nom}",
            "employe": {
                "id": employe.id,
                "nom": employe.nom,
                "prenom": employe.prenom,
                "poste": employe.poste,
                "matricule": employe.matricule,
            },
            "pointage_id": new_pt.id,
            "heure_debut": now_time.strftime("%H:%M:%S"),
            "heure_fin": None,
        }
    else:
        existing_pt.heure_fin = now_time
        if existing_pt.heure_debut:
            h_start = existing_pt.heure_debut.hour + existing_pt.heure_debut.minute / 60.0
            h_end = now_time.hour + now_time.minute / 60.0
            existing_pt.heures_total = max(0.0, round(h_end - h_start, 2))
        else:
            existing_pt.heures_total = 8.0
        existing_pt.notes = (existing_pt.notes or "") + f" | Sortie enregistrée par scan badge à {now_time.strftime('%H:%M')}"
        await db.flush()
        return {
            "status": "sortie_enregistree",
            "message": f"Sortie validée à {now_time.strftime('%H:%M')} pour {employe.prenom or ''} {employe.nom} ({existing_pt.heures_total}h)",
            "employe": {
                "id": employe.id,
                "nom": employe.nom,
                "prenom": employe.prenom,
                "poste": employe.poste,
                "matricule": employe.matricule,
            },
            "pointage_id": existing_pt.id,
            "heure_debut": existing_pt.heure_debut.strftime("%H:%M:%S") if existing_pt.heure_debut else None,
            "heure_fin": now_time.strftime("%H:%M:%S"),
            "heures_total": existing_pt.heures_total,
        }


class QRPointageCheckinRequest(BaseModel):
    employe_id: int
    chantier_id: int | None = None
    qr_code_token: str
    latitude: float | None = None
    longitude: float | None = None
    mode: str = Field(default="qr_scan", description="qr_scan | gps_auto | fixed_qr")


@router.post("/pointages/qr-checkin", response_model=PointageResponse, status_code=status.HTTP_201_CREATED)
async def qr_pointage_checkin(
    payload: CurrentUserPayload,
    obj_in: QRPointageCheckinRequest,
    db: DbDep,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    pointage_data = {
        "entreprise_id": entreprise_id,
        "employe_id": obj_in.employe_id,
        "chantier_id": obj_in.chantier_id,
        "date_jour": date.today(),
        "heure_debut": datetime.now().time(),
        "heures_total": 8.0,
        "type": "present",
        "methode_pointage": obj_in.mode,
        "latitude": obj_in.latitude,
        "longitude": obj_in.longitude,
        "notes": f"Pointage {obj_in.mode} (Token: {obj_in.qr_code_token[:10]}... Lat: {obj_in.latitude or 'N/A'}, Lon: {obj_in.longitude or 'N/A'})",
    }
    crud = PointageCRUD()
    pointage = await crud.create(db, pointage_data)
    await db.refresh(pointage)
    return PointageResponse.model_validate(pointage)


@router.post("/pointages", response_model=PointageResponse, status_code=status.HTTP_201_CREATED)
async def create_pointage(
    payload: CurrentUserPayload,
    obj_in: PointageCreate,
    db: DbDep,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    crud = PointageCRUD()
    pointage = await crud.create(db, data)
    await db.refresh(pointage)
    return PointageResponse.model_validate(pointage)


# --- Équipes ---

@router.get("/equipes", response_model=dict)
async def list_equipes(
    payload: CurrentUserPayload,
    db: DbDep,
    search: str | None = Query(default=None, description="Recherche par nom"),
    statut: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    crud = EquipeCRUD()
    skip = (page - 1) * size

    query = select(Equipe).where(Equipe.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Equipe.entreprise_id == entreprise_id)
    if search:
        query = query.where(Equipe.nom.ilike(f"%{search}%"))
    if statut:
        query = query.where(Equipe.statut == statut)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [EquipeList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/equipes", response_model=EquipeResponse, status_code=status.HTTP_201_CREATED)
async def create_equipe(
    payload: CurrentUserPayload,
    obj_in: EquipeCreate,
    db: DbDep,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    crud = EquipeCRUD()
    equipe = await crud.create(db, data)
    await db.refresh(equipe)
    return EquipeResponse.model_validate(equipe)


@router.get("/equipes/{id}", response_model=EquipeResponse)
async def get_equipe(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    crud = EquipeCRUD()
    equipe = await crud.get(db, id)
    if not equipe or equipe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Équipe non trouvée")
    if entreprise_id is not None and equipe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    membres = (await db.execute(select(MembreEquipe).where(MembreEquipe.equipe_id == id, MembreEquipe.is_deleted == False))).scalars().all()
    response = EquipeResponse.model_validate(equipe)
    response.membres = [{c.name: getattr(m, c.name) for c in m.__table__.columns} for m in membres]
    return response


@router.post("/equipes/{id}/membres", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_membre(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: MembreEquipeCreate,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    crud = EquipeCRUD()
    equipe = await crud.get(db, id)
    if not equipe or equipe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Équipe non trouvée")
    if entreprise_id is not None and equipe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    membre = MembreEquipe(
        equipe_id=id,
        **obj_in.model_dump(exclude={"equipe_id"}),
    )
    db.add(membre)
    await db.flush()
    await db.refresh(membre)
    return {"id": membre.id, "message": "Membre ajouté"}


@router.delete("/equipes/{id}/membres/{membre_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_membre(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    membre_id: int,
):
    _require_permission(payload, "rh:delete")
    entreprise_id = payload.get("entreprise_id")
    crud = EquipeCRUD()
    equipe = await crud.get(db, id)
    if not equipe or equipe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Équipe non trouvée")
    if entreprise_id is not None and equipe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    membre = await db.get(MembreEquipe, membre_id)
    if not membre or membre.is_deleted or membre.equipe_id != id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre non trouvé")

    membre.is_deleted = True
    await db.flush()
    return None


# --- Heures supplémentaires ---

@router.get("/heures-sup", response_model=dict)
async def list_heures_sup(
    payload: CurrentUserPayload,
    db: DbDep,
    employe_id: int | None = Query(default=None),
    chantier_id: int | None = Query(default=None),
    date_debut: date | None = Query(default=None),
    date_fin: date | None = Query(default=None),
    statut: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    crud = BaseCRUD(HeureSupplementaire)
    skip = (page - 1) * size

    query = select(HeureSupplementaire).where(HeureSupplementaire.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(HeureSupplementaire.entreprise_id == entreprise_id)
    if employe_id:
        query = query.where(HeureSupplementaire.employe_id == employe_id)
    if chantier_id:
        query = query.where(HeureSupplementaire.chantier_id == chantier_id)
    if date_debut:
        query = query.where(HeureSupplementaire.date_hs >= date_debut)
    if date_fin:
        query = query.where(HeureSupplementaire.date_hs <= date_fin)
    if statut:
        query = query.where(HeureSupplementaire.statut == statut)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [HeureSupplementaireList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/heures-sup", response_model=HeureSupplementaireResponse, status_code=status.HTTP_201_CREATED)
async def create_heure_sup(
    payload: CurrentUserPayload,
    obj_in: HeureSupplementaireCreate,
    db: DbDep,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    crud = BaseCRUD(HeureSupplementaire)
    hs = await crud.create(db, data)
    await db.refresh(hs)
    return HeureSupplementaireResponse.model_validate(hs)


@router.put("/heures-sup/{id}/statut", response_model=HeureSupplementaireResponse)
async def update_heure_sup_statut(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: HeureSupplementaireUpdate,
):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    crud = BaseCRUD(HeureSupplementaire)
    hs = await crud.get(db, id)
    if not hs or hs.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Heure supplémentaire non trouvée")
    if entreprise_id is not None and hs.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    data = obj_in.model_dump(exclude_unset=True)
    updated = await crud.update(db, hs, data)
    await db.refresh(updated)
    return HeureSupplementaireResponse.model_validate(updated)


# --- Congés ---


async def _get_employe_rh(db: DbDep, id: int, entreprise_id: int | None) -> Employe:
    employe = await EmployeCRUD().get(db, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    return employe


def _conge_response(c: Conge) -> CongeResponse:
    resp = CongeResponse.model_validate(c)
    if c.employe is not None:
        resp.employe_nom = c.employe.nom
        resp.employe_prenom = c.employe.prenom
    return resp


@router.post("/conges", response_model=CongeResponse, status_code=status.HTTP_201_CREATED)
async def create_conge(payload: CurrentUserPayload, obj_in: CongeCreate, db: DbDep):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    employe = await _get_employe_rh(db, obj_in.employe_id, entreprise_id)
    crud = CongeCRUD()
    conge = await crud.create(db, {
        "entreprise_id": entreprise_id,
        "employe_id": employe.id,
        "type": obj_in.type,
        "date_debut": obj_in.date_debut,
        "date_fin": obj_in.date_fin,
        "nb_jours": obj_in.nb_jours,
        "motif": obj_in.motif,
        "statut": Conge.STATUT_EN_ATTENTE,
    })
    await db.refresh(conge)
    return _conge_response(conge)


@router.get("/conges", response_model=CongeList)
async def list_conges(
    payload: CurrentUserPayload,
    db: DbDep,
    statut: str | None = Query(default=None),
    employe_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    if entreprise_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Entreprise requise")
    items, total = await CongeCRUD().list_for_entreprise(
        db, entreprise_id, statut=statut, employe_id=employe_id, page=page, size=size
    )
    return {"items": [_conge_response(c) for c in items], "total": total, "page": page, "size": size}


async def _decide_conge(payload: CurrentUserPayload, db: DbDep, id: int, statut: str, decision: CongeDecision) -> CongeResponse:
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    conge = await CongeCRUD().get(db, id)
    if not conge or conge.is_deleted or (entreprise_id is not None and conge.entreprise_id != entreprise_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Congé non trouvé")
    user = payload.get("user")
    valide_par = getattr(user, "id", None)
    conge = await CongeCRUD().decide(db, conge, statut=statut, valide_par=valide_par,
                                     commentaire=decision.commentaire)
    # Notification in-app : cible le compte utilisateur de l'employé (via email)
    utilisateur_id = None
    if conge.employe is not None and conge.employe.email:
        u = (await db.execute(
            select(Utilisateur).where(Utilisateur.email == conge.employe.email,
                                      Utilisateur.is_deleted == False)
        )).scalar_one_or_none()
        if u is not None:
            utilisateur_id = u.id
    libelle = "validé" if statut == Conge.STATUT_VALIDE else "refusé"
    db.add(Notification(
        utilisateur_id=utilisateur_id,
        entreprise_id=entreprise_id,
        type="conge",
        titre=f"Congé {libelle}",
        message=f"Votre congé du {conge.date_debut} au {conge.date_fin} a été {libelle}.",
        entite_type="conge",
        entite_id=conge.id,
    ))
    await db.flush()
    return _conge_response(conge)


@router.post("/conges/{id}/valider", response_model=CongeResponse)
async def valider_conge(payload: CurrentUserPayload, db: DbDep, id: int, decision: CongeDecision | None = None):
    return await _decide_conge(payload, db, id, Conge.STATUT_VALIDE, decision or CongeDecision())


@router.post("/conges/{id}/refuser", response_model=CongeResponse)
async def refuser_conge(payload: CurrentUserPayload, db: DbDep, id: int, decision: CongeDecision | None = None):
    return await _decide_conge(payload, db, id, Conge.STATUT_REFUSE, decision or CongeDecision())


@router.get("/conges/{employe_id}/solde")
async def get_solde_conges(payload: CurrentUserPayload, db: DbDep, employe_id: int):
    _require_permission(payload, "rh:read")
    employe = await _get_employe_rh(db, employe_id, payload.get("entreprise_id"))
    solde = await CongeCRUD().solde_restant(db, employe)
    return {"solde_restant": solde, "solde_annuel": float(employe.solde_conges_annuel or 30)}


# --- Documents RH ---

CATEGORIES_DOCUMENTS_RH = {
    "contrat_travail", "cnaps", "ostie", "certificat", "autre",
    # Dossiers administratifs d'embauche
    "cv", "lettre_motivation", "diplome", "cni",
}


class DocumentRHCreate(BaseModel):
    """Corps de la requête pour attacher un document à un employé."""

    nom: str = Field(..., min_length=1, max_length=255)
    categorie: str = Field(default="autre", max_length=50)
    fichier_url: str | None = None
    description: str | None = None

    @field_validator("categorie")
    @classmethod
    def validate_categorie(cls, v: str) -> str:
        if v not in CATEGORIES_DOCUMENTS_RH:
            raise ValueError(f"Catégorie invalide. Valeurs autorisées: {sorted(CATEGORIES_DOCUMENTS_RH)}")
        return v


class DocumentRHResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    employe_id: int | None = None
    categorie: str
    nom: str
    fichier_url: str | None = None
    description: str | None = None
    created_at: datetime | None = None
    is_deleted: bool | None = None


@router.get("/employes/{employe_id}/documents")
async def list_documents_rh(payload: CurrentUserPayload, db: DbDep, employe_id: int):
    _require_permission(payload, "rh:read")
    employe = await _get_employe_rh(db, employe_id, payload.get("entreprise_id"))
    query = select(Document).where(
        Document.employe_id == employe.id,
        Document.is_deleted == False,
    ).order_by(Document.created_at.desc())
    result = await db.execute(query)
    documents = result.scalars().all()
    return {"items": [DocumentRHResponse.model_validate(d) for d in documents]}


@router.post("/employes/{employe_id}/documents", response_model=DocumentRHResponse, status_code=status.HTTP_201_CREATED)
async def create_document_rh(
    payload: CurrentUserPayload,
    db: DbDep,
    employe_id: int,
    obj_in: DocumentRHCreate,
):
    _require_permission(payload, "rh:write")
    employe = await _get_employe_rh(db, employe_id, payload.get("entreprise_id"))
    doc = Document(
        entreprise_id=employe.entreprise_id,
        employe_id=employe.id,
        nom=obj_in.nom,
        categorie=obj_in.categorie,
        fichier_url=obj_in.fichier_url,
        description=obj_in.description,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return DocumentRHResponse.model_validate(doc)


@router.post("/employes/{employe_id}/documents/upload", response_model=DocumentRHResponse, status_code=status.HTTP_201_CREATED)
async def upload_document_rh(
    payload: CurrentUserPayload,
    db: DbDep,
    employe_id: int,
    fichier: UploadFile = File(...),
    nom: str | None = Form(default=None),
    categorie: str = Form(default="autre"),
    description: str | None = Form(default=None),
):
    """Upload d'un document administratif (CV, lettre de motivation, diplôme, CNI...).

    Le fichier est stocké sur disque via file_storage ; la fiche Document
    référence l'URL relative servie par l'API (/api/uploads/documents-rh/...).
    """
    _require_permission(payload, "rh:write")
    if categorie not in CATEGORIES_DOCUMENTS_RH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Catégorie invalide. Valeurs autorisées: {sorted(CATEGORIES_DOCUMENTS_RH)}",
        )
    employe = await _get_employe_rh(db, employe_id, payload.get("entreprise_id"))

    try:
        url = await file_storage.save_upload(
            fichier, "documents-rh", file_storage.ALLOWED_DOC_EXT, file_storage.MAX_DOC_MB
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    doc = Document(
        entreprise_id=employe.entreprise_id,
        employe_id=employe.id,
        nom=(nom or "").strip() or fichier.filename or f"Document {categorie}",
        categorie=categorie,
        fichier_url=url,
        description=description,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return DocumentRHResponse.model_validate(doc)


# --- Paie ---


def _heures_du_pointage(pt: Pointage) -> float:
    """Heures travaillées d'un pointage (fin - début - pauses), borné à 0."""
    if not pt.heure_debut or not pt.heure_fin:
        return 0.0
    delta = (datetime.combine(date.min, pt.heure_fin)
             - datetime.combine(date.min, pt.heure_debut)).total_seconds() / 3600
    pauses = 0.0
    if pt.heure_pause_debut and pt.heure_pause_fin:
        pauses = max(
            (datetime.combine(date.min, pt.heure_pause_fin)
             - datetime.combine(date.min, pt.heure_pause_debut)).total_seconds() / 3600,
            0.0,
        )
    return max(delta - pauses, 0.0)


@router.get("/paie")
async def rapport_paie(
    payload: CurrentUserPayload,
    db: DbDep,
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2000, le=2100),
    employe_id: int | None = Query(default=None),
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    if entreprise_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Entreprise requise")

    debut = date(annee, mois, 1)
    fin_exclu = date(annee + 1, 1, 1) if mois == 12 else date(annee, mois + 1, 1)

    q_emp = select(Employe).where(Employe.is_deleted == False, Employe.entreprise_id == entreprise_id)
    if employe_id:
        q_emp = q_emp.where(Employe.id == employe_id)
    employes = (await db.execute(q_emp)).scalars().all()

    q_pt = select(Pointage).where(
        Pointage.is_deleted == False,
        Pointage.entreprise_id == entreprise_id,
        Pointage.date_jour >= debut,
        Pointage.date_jour < fin_exclu,
    )
    pointages = (await db.execute(q_pt)).scalars().all()

    q_hs = select(HeureSupplementaire).where(
        HeureSupplementaire.is_deleted == False,
        HeureSupplementaire.statut == "validee",
        HeureSupplementaire.date_hs >= debut,
        HeureSupplementaire.date_hs < fin_exclu,
    )
    heures_sup = (await db.execute(q_hs)).scalars().all()

    # Indexation des pointages par employé
    jours_par_emp: dict[int, set] = {}
    heures_par_emp: dict[int, float] = {}
    for pt in pointages:
        if pt.statut_validation == "refuse":
            continue
        if pt.date_jour is not None:
            jours_par_emp.setdefault(pt.employe_id, set()).add(pt.date_jour)
        heures_par_emp[pt.employe_id] = heures_par_emp.get(pt.employe_id, 0.0) + _heures_du_pointage(pt)

    hs_par_emp: dict[int, float] = {}
    for hs in heures_sup:
        if hs.employe_id:
            hs_par_emp[hs.employe_id] = hs_par_emp.get(hs.employe_id, 0.0) + (hs.nb_heures or 0) * (hs.taux_majoration or 1.5)

    lignes = []
    total = 0.0
    for emp in employes:
        mode = emp.mode_remuneration or "mensuel"
        jours_valides = float(len(jours_par_emp.get(emp.id, set())))
        h_sup = hs_par_emp.get(emp.id, 0.0)
        if mode == "journalier":
            brut = jours_valides * float(emp.taux_journalier or 0)
        elif mode == "horaire":
            brut = heures_par_emp.get(emp.id, 0.0) * float(emp.taux_horaire or 0)
        elif mode == "a_la_tache":
            brut = 0.0  # v1 : calcul par tâche reporté en v2
        else:  # mensuel : plein si pas de pointage ou mois complet, sinon proraté sur 26 jours
            brut = float(emp.salaire_base or 0)
            if jours_valides != 0 and jours_valides < 26:
                brut = round(float(emp.salaire_base or 0) * jours_valides / 26, 2)
            brut += h_sup
        lignes.append({
            "employe_id": emp.id, "nom": emp.nom, "prenom": emp.prenom,
            "mode_remuneration": mode, "jours_valides": jours_valides,
            "heures_sup": round(h_sup, 2), "brut": round(brut, 2),
        })
        total += brut

    return {"mois": mois, "annee": annee, "lignes": lignes, "total": round(total, 2)}


@router.get("/paie/export")
async def export_paie_csv(
    payload: CurrentUserPayload,
    db: DbDep,
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2000, le=2100),
):
    _require_permission(payload, "rh:read")
    rapport = await rapport_paie(payload, db, mois=mois, annee=annee, employe_id=None)
    buf = io.StringIO()
    buf.write("\ufeff")  # BOM pour Excel
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["Employe ID", "Nom", "Prenom", "Mode", "Jours valides", "Heures sup", "Brut (Ar)"])
    for l in rapport["lignes"]:
        writer.writerow([l["employe_id"], l["nom"], l["prenom"], l["mode_remuneration"],
                         str(l["jours_valides"]).replace(".", ","),
                         str(l["heures_sup"]).replace(".", ","),
                         str(l["brut"]).replace(".", ",")])
    writer.writerow(["", "", "", "", "", "TOTAL", str(rapport["total"]).replace(".", ",")])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=paie_{annee}_{mois:02d}.csv"})
