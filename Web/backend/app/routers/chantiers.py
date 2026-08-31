"""Router pour la gestion des chantiers et leurs sous-ressources."""
from datetime import date, datetime
from typing import Any
from typing_extensions import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.security import CurrentUserPayload, DbDep
from app.crud.chantier import ChantierCRUD
from app.models.chantier import Chantier
from app.models.phase import Phase
from app.models.incident import Incident
from app.models.affectation_chantier import AffectationChantier
from app.schemas.chantier import (
    ChantierCreate,
    ChantierUpdate,
    ChantierResponse,
    ChantierList,
    ChantierStatutUpdate,
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


class PhaseCreate(BaseModel):
    nom: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    date_debut: date | None = None
    date_fin: date | None = None
    budget: float = Field(default=0.0, ge=0)
    avancement_pct: int = Field(default=0, ge=0, le=100)
    statut: str = Field(default="non_commencee", max_length=20)
    ordre: int = Field(default=0, ge=0)


class IncidentCreate(BaseModel):
    titre: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    gravite: str = Field(default="moyenne", max_length=20)
    statut: str = Field(default="signale", max_length=20)


@router.get("")
@router.get("/", response_model=dict)
async def list_chantiers(
    payload: CurrentUserPayload,
    db: DbDep,
    search: str | None = Query(default=None, description="Recherche par nom ou numéro"),
    statut: str | None = Query(default=None),
    client_id: int | None = Query(default=None),
    chef_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "chantiers:read")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    skip = (page - 1) * size

    query = select(Chantier).where(Chantier.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Chantier.entreprise_id == entreprise_id)
    if search:
        query = query.where(
            (Chantier.nom.ilike(f"%{search}%")) | (Chantier.numero.ilike(f"%{search}%"))
        )
    if statut:
        query = query.where(Chantier.statut == statut)
    if client_id:
        query = query.where(Chantier.client_id == client_id)
    if chef_id:
        query = query.where(Chantier.chef_chantier_id == chef_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [ChantierList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("")
@router.post("/", response_model=ChantierResponse, status_code=status.HTTP_201_CREATED)
async def create_chantier(
    payload: CurrentUserPayload,
    obj_in: ChantierCreate,
    db: DbDep,
):
    _require_permission(payload, "chantiers:write")
    entreprise_id = payload.get("entreprise_id")
    user = payload.get("user")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    if user and hasattr(user, "id") and not data.get("chef_chantier_id"):
        data["chef_chantier_id"] = user.id
    crud = ChantierCRUD()
    chantier = await crud.create(db, data)
    await db.refresh(chantier)
    return ChantierResponse.model_validate(chantier)


@router.get("/{id}", response_model=ChantierResponse)
async def get_chantier(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "chantiers:read")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    phases = (await db.execute(select(Phase).where(Phase.chantier_id == id, Phase.is_deleted == False))).scalars().all()
    incidents = (await db.execute(select(Incident).where(Incident.chantier_id == id, Incident.is_deleted == False))).scalars().all()
    affectations = (await db.execute(select(AffectationChantier).where(AffectationChantier.chantier_id == id, AffectationChantier.is_deleted == False))).scalars().all()

    response = ChantierResponse.model_validate(chantier)
    response.phases = [{c.name: getattr(p, c.name) for c in p.__table__.columns} for p in phases]
    response.incidents = [{c.name: getattr(i, c.name) for c in i.__table__.columns} for i in incidents]
    response.affectations = [{c.name: getattr(a, c.name) for c in a.__table__.columns} for a in affectations]
    return response


@router.put("/{id}", response_model=ChantierResponse)
async def update_chantier(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: ChantierUpdate,
):
    _require_permission(payload, "chantiers:write")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    data = obj_in.model_dump(exclude_unset=True)
    updated = await crud.update(db, chantier, data)
    await db.refresh(updated)
    return ChantierResponse.model_validate(updated)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chantier(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "chantiers:delete")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    chantier.is_deleted = True
    await db.flush()
    return None


@router.post("/{id}/phases", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_phase(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: PhaseCreate,
):
    _require_permission(payload, "chantiers:write")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    phase = Phase(
        chantier_id=id,
        **obj_in.model_dump(),
    )
    db.add(phase)
    await db.flush()
    await db.refresh(phase)
    return {"id": phase.id, "message": "Phase ajoutée"}


@router.post("/{id}/incidents", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_incident(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: IncidentCreate,
):
    _require_permission(payload, "chantiers:write")
    user = payload.get("user")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    incident = Incident(
        chantier_id=id,
        declare_par=user.id if user else None,
        **obj_in.model_dump(),
    )
    db.add(incident)
    await db.flush()
    await db.refresh(incident)
    return {"id": incident.id, "message": "Incident ajouté"}


@router.put("/{id}/statut", response_model=ChantierResponse)
async def update_chantier_statut(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: ChantierStatutUpdate,
):
    _require_permission(payload, "chantiers:write")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    chantier.statut = obj_in.statut
    await db.flush()
    await db.refresh(chantier)
    return ChantierResponse.model_validate(chantier)


# ============================================================
# QR CODE POINTAGE (Politique de pointage)
# ============================================================

import secrets
from datetime import date as date_type


class QRPointageResponse(BaseModel):
    qr_token: str
    chantier_id: int
    chantier_nom: str
    date_validite: str
    message: str


@router.post("/{id}/qr-pointage", response_model=QRPointageResponse, status_code=status.HTTP_201_CREATED)
async def generer_qr_pointage(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "chantiers:write")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    qr_token = secrets.token_urlsafe(32)
    aujourd_hui = date_type.today().isoformat()
    return QRPointageResponse(
        qr_token=qr_token,
        chantier_id=id,
        chantier_nom=chantier.nom,
        date_validite=aujourd_hui,
        message=f"QR Code généré pour le chantier {chantier.nom}. Valide pour la journée du {aujourd_hui}.",
    )


@router.get("/{id}/qr-pointage", response_model=QRPointageResponse)
async def get_qr_pointage(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "chantiers:read")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    qr_token = secrets.token_urlsafe(32)
    aujourd_hui = date_type.today().isoformat()
    return QRPointageResponse(
        qr_token=qr_token,
        chantier_id=id,
        chantier_nom=chantier.nom,
        date_validite=aujourd_hui,
        message=f"QR Code pour le chantier {chantier.nom}. Valide pour la journée du {aujourd_hui}.",
    )


# ============================================================
# AFFECTATIONS (Employés / Matériel aux chantiers)
# ============================================================

class AffectationChantierCreate(BaseModel):
    employe_id: int = Field(..., ge=1)
    date_debut: date | None = None
    date_fin: date | None = None
    role: str | None = Field(default=None, max_length=100)


class AffectationChantierList(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    employe_id: int
    chantier_id: int
    date_debut: str | None = None
    date_fin: str | None = None
    role: str | None = None
    is_deleted: bool = False
    created_at: str | None = None
    updated_at: str | None = None


@router.get("/{id}/affectations", response_model=list[AffectationChantierList])
async def list_affectations_chantier(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "chantiers:read")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    result = await db.execute(
        select(AffectationChantier).where(
            AffectationChantier.chantier_id == id,
            AffectationChantier.is_deleted == False,
        )
    )
    affectations = result.scalars().all()
    return [
        AffectationChantierList(
            id=a.id,
            employe_id=a.employe_id,
            chantier_id=a.chantier_id,
            date_debut=a.date_debut.isoformat() if a.date_debut else None,
            date_fin=a.date_fin.isoformat() if a.date_fin else None,
            role=a.role,
            is_deleted=a.is_deleted,
            created_at=a.created_at.isoformat() if a.created_at else None,
            updated_at=a.updated_at.isoformat() if a.updated_at else None,
        )
        for a in affectations
    ]


@router.post("/{id}/affectations", response_model=AffectationChantierList, status_code=status.HTTP_201_CREATED)
async def create_affectation_chantier(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: AffectationChantierCreate,
):
    _require_permission(payload, "chantiers:write")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    affectation = AffectationChantier(
        chantier_id=id,
        **obj_in.model_dump(exclude={"chantier_id"}),
    )
    db.add(affectation)
    await db.flush()
    await db.refresh(affectation)
    return AffectationChantierList(
        id=affectation.id,
        employe_id=affectation.employe_id,
        chantier_id=affectation.chantier_id,
        date_debut=affectation.date_debut.isoformat() if affectation.date_debut else None,
        date_fin=affectation.date_fin.isoformat() if affectation.date_fin else None,
        role=affectation.role,
        is_deleted=affectation.is_deleted,
        created_at=affectation.created_at.isoformat() if affectation.created_at else None,
        updated_at=affectation.updated_at.isoformat() if affectation.updated_at else None,
    )


@router.delete("/{id}/affectations/{aff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_affectation_chantier(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    aff_id: int,
):
    _require_permission(payload, "chantiers:write")
    entreprise_id = payload.get("entreprise_id")
    crud = ChantierCRUD()
    chantier = await crud.get(db, id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    result = await db.execute(
        select(AffectationChantier).where(
            AffectationChantier.id == aff_id,
            AffectationChantier.chantier_id == id,
            AffectationChantier.is_deleted == False,
        )
    )
    affectation = result.scalar_one_or_none()
    if not affectation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Affectation non trouvée")

    affectation.is_deleted = True
    await db.flush()
    return None
