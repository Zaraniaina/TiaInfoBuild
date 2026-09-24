"""Router pour la gestion des chantiers et leurs sous-ressources."""
from datetime import date, datetime
from typing import Any
from typing_extensions import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.security import CurrentUserPayload, DbDep
from app.crud.chantier import ChantierCRUD
from app.models.chantier import Chantier
from app.models.phase import Phase
from app.models.incident import Incident
from app.models.affectation_chantier import AffectationChantier
from app.models.projet import Projet
from app.models.devis import Devis
from app.models.contrat import Contrat
from app.models.rapport_journalier import RapportJournalier
from app.models.periode_risque_climatique import PeriodeRisqueClimatique
from app.routers.aleas_climatiques import calculer_impact_climatique, notifier_alea_climatique
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


TYPES_ALEA = {
    "cyclone",
    "inondation",
    "pluies_intenses",
    "secheresse",
    "route_coupee",
    "coupure_electricite",
    "autre",
}
IMPUTABILITES = {"climatique", "entreprise", "client", "indetermine"}


class IncidentCreate(BaseModel):
    titre: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    gravite: str = Field(default="moyenne", max_length=20)
    statut: str = Field(default="signale", max_length=20)
    # Aléa climatique (optionnel)
    type_alea: str | None = Field(default=None, max_length=30)
    date_fin: date | None = None
    impact_arret_jours: int | None = Field(default=None, ge=0)
    imputabilite: str | None = Field(default=None, max_length=20)

    @field_validator("type_alea", "imputabilite")
    @classmethod
    def validate_alea_fields(cls, v: str | None, info) -> str | None:
        if v is None or v == "":
            return None
        v = v.strip()
        if info.field_name == "type_alea" and v not in TYPES_ALEA:
            raise ValueError(f"Type d'aléa invalide. Valeurs autorisées: {sorted(TYPES_ALEA)}")
        if info.field_name == "imputabilite" and v not in IMPUTABILITES:
            raise ValueError(f"Imputabilité invalide. Valeurs autorisées: {sorted(IMPUTABILITES)}")
        return v


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
    from app.services.subscription_state import assert_quota_chantiers
    await assert_quota_chantiers(db, payload)
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


@router.get("/projets-transformables")
async def list_projets_transformables(
    payload: CurrentUserPayload,
    db: DbDep,
):
    """Projets disposant d'un contrat actif et pas encore transformes en chantier."""
    _require_permission(payload, "chantiers:create")
    entreprise_id = payload.get("entreprise_id")

    query = (
        select(Projet, Contrat)
        .join(Devis, Devis.projet_id == Projet.id)
        .join(Contrat, Contrat.devis_id == Devis.id)
        .where(
            Projet.is_deleted == False,
            Contrat.is_deleted == False,
            Contrat.statut.notin_(["annule", "resilie"]),
        )
    )
    if entreprise_id is not None:
        query = query.where(Projet.entreprise_id == entreprise_id)
    rows = (await db.execute(query.order_by(Projet.id.desc()))).all()

    transformes = (
        await db.execute(
            select(Chantier.projet_id).where(
                Chantier.projet_id.isnot(None),
                Chantier.is_deleted == False,
            )
        )
    ).scalars().all()
    exclus = set(transformes)

    items = []
    for projet, contrat in rows:
        if projet.id in exclus:
            continue
        items.append({
            "projet_id": projet.id,
            "reference": projet.reference,
            "nom": projet.nom,
            "client_id": projet.client_id,
            "localisation": projet.localisation,
            "montant_contrat": float(contrat.montant) if contrat.montant is not None else 0.0,
            "contrat_reference": contrat.reference,
        })
    return {"items": items, "total": len(items)}


@router.post("/from-projet/{projet_id}", response_model=ChantierResponse, status_code=status.HTTP_201_CREATED)
async def create_chantier_from_projet(
    payload: CurrentUserPayload,
    db: DbDep,
    projet_id: int,
):
    """Ouvre un chantier a partir d'un projet contractualise (contrat actif)."""
    _require_permission(payload, "chantiers:create")
    entreprise_id = payload.get("entreprise_id")

    projet = (
        await db.execute(
            select(Projet).where(Projet.id == projet_id, Projet.is_deleted == False)
        )
    ).scalar_one_or_none()
    if not projet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet non trouvé")
    if entreprise_id is not None and projet.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    contrat = (
        await db.execute(
            select(Contrat)
            .join(Devis, Contrat.devis_id == Devis.id)
            .where(
                Devis.projet_id == projet_id,
                Contrat.is_deleted == False,
                Contrat.statut.notin_(["annule", "resilie"]),
            )
            .order_by(Contrat.id.desc())
        )
    ).scalars().first()
    if not contrat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun contrat actif lie a ce projet. Le devis doit d'abord etre accepte puis transforme en contrat.",
        )

    existant = (
        await db.execute(
            select(Chantier).where(
                Chantier.projet_id == projet_id,
                Chantier.is_deleted == False,
            )
        )
    ).scalar_one_or_none()
    if existant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un chantier ({existant.numero or existant.nom}) est deja lie a ce projet",
        )

    # Numero auto : CHANT-<annee>-<seq> unique
    annee = datetime.now().year
    seq = 1
    while True:
        numero = f"CHANT-{annee}-{seq:04d}"
        prise = (
            await db.execute(select(Chantier).where(Chantier.numero == numero))
        ).scalar_one_or_none()
        if not prise:
            break
        seq += 1
        if seq > 9999:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Impossible de generer un numero de chantier")

    montant = float(contrat.montant) if contrat.montant is not None else 0.0
    chantier = Chantier(
        entreprise_id=projet.entreprise_id or entreprise_id,
        client_id=projet.client_id,
        projet_id=projet.id,
        numero=numero,
        nom=projet.nom,
        adresse=projet.adresse,
        budget_prevu=montant,
        budget_previsionnel=montant,
        statut="planification",
        description=f"Chantier issu du projet {projet.reference or projet.id} (contrat {contrat.reference})",
    )
    db.add(chantier)
    await db.flush()
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

    # Impact climatique : jours d'arrêt documentés + retard net (négociable vs
    # imputable à l'entreprise).
    response.impact_climatique = calculer_impact_climatique(
        list(incidents),
        chantier.date_debut,
        chantier.date_fin_prevue,
        chantier.date_fin_reelle,
        date.today(),
    )
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
    # Aléa climatique critique -> alerte plateforme (best effort, ne fait jamais
    # échouer le signalement).
    if incident.type_alea and incident.gravite == "critique":
        await notifier_alea_climatique(db, chantier, incident)
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


class RapportJournalierCreate(BaseModel):
    date_rapport: date | None = None
    travaux_realises: str | None = None
    quantites: str | None = None
    personnel_present: str | None = None
    materiel_utilise: str | None = None
    materiaux_utilises: str | None = None
    incidents: str | None = None
    difficultes: str | None = None
    observations: str | None = None


@router.get("/{id}/rapports")
async def list_rapports_chantier(
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
        select(RapportJournalier)
        .where(RapportJournalier.chantier_id == id, RapportJournalier.is_deleted == False)
        .order_by(RapportJournalier.date_rapport.desc())
    )
    rapports = result.scalars().all()
    return {"items": rapports}


@router.post("/{id}/rapports", status_code=status.HTTP_201_CREATED)
async def create_rapport_chantier(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: RapportJournalierCreate,
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

    rapport = RapportJournalier(
        chantier_id=id,
        employe_id=user.id if user else None,
        date_rapport=obj_in.date_rapport or date.today(),
        **obj_in.model_dump(exclude={"date_rapport"}),
    )
    db.add(rapport)
    await db.flush()
    await db.refresh(rapport)
    return {"id": rapport.id, "message": "Rapport journalier enregistré", "rapport": rapport}

