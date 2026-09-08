"""Router pour la gestion des ressources humaines (employés, pointages, équipes, heures sup)."""
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func

from app.crud.employe import EmployeCRUD
from app.crud.pointage import PointageCRUD
from app.crud.equipe import EquipeCRUD
from app.crud.base import BaseCRUD
from app.models.employe import Employe
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
    await db.refresh(updated)
    return EmployeResponse.model_validate(updated)


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

    return {
        "id": employe.id,
        "matricule": employe.matricule or f"EMP-{employe.id:04d}",
        "nom": employe.nom,
        "prenom": employe.prenom,
        "poste": employe.poste,
        "photo": employe.photo,
        "code_qr_badge": employe.code_qr_badge,
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

    return {
        "id": employe.id,
        "matricule": employe.matricule or f"EMP-{employe.id:04d}",
        "nom": employe.nom,
        "prenom": employe.prenom,
        "poste": employe.poste,
        "photo": employe.photo,
        "code_qr_badge": employe.code_qr_badge,
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
