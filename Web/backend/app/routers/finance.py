"""Routers pour le module finance: depenses, rapports mensuels, alertes."""
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crud.alerte import AlerteCRUD
from app.crud.base import BaseCRUD
from app.crud.depense import DepenseCRUD
from app.database import get_db
from app.models.depense import Depense
from app.models.alerte import Alerte
from app.models.facture import Facture
from app.models.chantier import Chantier
from app.models.client import Client
from app.models.rapport_financier import RapportFinancier
from app.schemas.alerte import AlerteCreate, AlerteResponse, AlerteList
from app.schemas.depense import (
    DepenseCreate,
    DepenseUpdate,
    DepenseResponse,
    DepenseList,
    DepenseValidationRequest,
)
from app.security import CurrentUserPayload, DbDep

router = APIRouter(prefix="/finance", tags=["finance"])


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    from app.core.permissions import PERMISSION_MAP
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


def _get_entreprise_id(payload: CurrentUserPayload) -> int:
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entreprise ID manquant dans le token",
        )
    return entreprise_id


depense_crud = DepenseCRUD()
alerte_crud = AlerteCRUD()


# ==================== DEPENSES ====================


@router.get("/depenses", response_model=list[DepenseList])
async def list_depenses(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
    categorie: str | None = None,
    statut: str | None = None,
    chantier_id: int | None = None,
    date_debut: date | None = None,
    date_fin: date | None = None,
):
    _require_permission(payload, "finance:read")
    entreprise_id = _get_entreprise_id(payload)
    query = select(Depense).where(Depense.entreprise_id == entreprise_id, Depense.is_deleted == False)
    if categorie:
        query = query.where(Depense.categorie == categorie)
    if statut:
        query = query.where(Depense.statut == statut)
    if chantier_id:
        query = query.where(Depense.chantier_id == chantier_id)
    if date_debut:
        query = query.where(Depense.date_depense >= date_debut)
    if date_fin:
        query = query.where(Depense.date_depense <= date_fin)
    result = await db.execute(query.offset(skip).limit(limit))
    return list(result.scalars().all())


@router.post("/depenses", response_model=DepenseResponse, status_code=status.HTTP_201_CREATED)
async def create_depense(
    payload: CurrentUserPayload,
    db: DbDep,
    data: DepenseCreate,
):
    _require_permission(payload, "finance:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    if not obj_in.get("date_depense"):
        obj_in["date_depense"] = date.today()
    return await depense_crud.create(db, obj_in)


@router.get("/depenses/{id}", response_model=DepenseResponse)
async def get_depense(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "finance:read")
    depense = await depense_crud.get(db, id)
    if not depense or depense.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépense non trouvée")
    return depense


@router.put("/depenses/{id}", response_model=DepenseResponse)
async def update_depense(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: DepenseUpdate,
):
    _require_permission(payload, "finance:write")
    depense = await depense_crud.get(db, id)
    if not depense or depense.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépense non trouvée")
    obj_in = data.model_dump(exclude_unset=True)
    return await depense_crud.update(db, depense, obj_in)


@router.post("/depenses/{id}/valider", response_model=DepenseResponse)
async def validate_depense(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: DepenseValidationRequest,
):
    _require_permission(payload, "finance:write")
    depense = await depense_crud.get(db, id)
    if not depense or depense.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépense non trouvée")
    depense.statut = "validee"
    depense.validee_par = data.validee_par
    await db.flush()
    await db.refresh(depense)
    return depense


# ==================== RAPPORTS MENSUELS ====================


class RapportMensuelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mois: str
    annee: int
    total_recettes: float
    total_depenses: float
    solde: float
    nb_factures_emises: int
    nb_factures_payees: int
    montant_factures_payees: float
    depenses_par_categorie: dict[str, float]
    depenses_validees: float
    depenses_en_attente: float


@router.get("/rapports/mensuel", response_model=RapportMensuelResponse)
async def rapport_mensuel(
    payload: CurrentUserPayload,
    db: DbDep,
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2000, le=2100),
):
    _require_permission(payload, "finance:read")
    entreprise_id = _get_entreprise_id(payload)

    recettes_result = await db.execute(
        select(func.coalesce(func.sum(Facture.montant_paye), 0)).where(
            Facture.entreprise_id == entreprise_id,
            Facture.is_deleted == False,
            extract("year", Facture.date_emission) == annee,
            extract("month", Facture.date_emission) == mois,
        )
    )
    total_recettes = float(recettes_result.scalar_one_or_none() or 0.0)

    depenses_result = await db.execute(
        select(func.coalesce(func.sum(Depense.montant), 0)).where(
            Depense.entreprise_id == entreprise_id,
            Depense.is_deleted == False,
            extract("year", Depense.date_depense) == annee,
            extract("month", Depense.date_depense) == mois,
        )
    )
    total_depenses = float(depenses_result.scalar_one_or_none() or 0.0)

    nb_factures_emises_result = await db.execute(
        select(func.count(Facture.id)).where(
            Facture.entreprise_id == entreprise_id,
            Facture.is_deleted == False,
            extract("year", Facture.date_emission) == annee,
            extract("month", Facture.date_emission) == mois,
        )
    )
    nb_factures_emises = nb_factures_emises_result.scalar_one_or_none() or 0

    nb_factures_payees_result = await db.execute(
        select(func.count(Facture.id)).where(
            Facture.entreprise_id == entreprise_id,
            Facture.is_deleted == False,
            Facture.statut == "payee",
            extract("year", Facture.date_emission) == annee,
            extract("month", Facture.date_emission) == mois,
        )
    )
    nb_factures_payees = nb_factures_payees_result.scalar_one_or_none() or 0

    montant_payees_result = await db.execute(
        select(func.coalesce(func.sum(Facture.montant_paye), 0)).where(
            Facture.entreprise_id == entreprise_id,
            Facture.is_deleted == False,
            Facture.statut == "payee",
            extract("year", Facture.date_emission) == annee,
            extract("month", Facture.date_emission) == mois,
        )
    )
    montant_factures_payees = float(montant_payees_result.scalar_one_or_none() or 0.0)

    depenses_cat_result = await db.execute(
        select(Depense.categorie, func.sum(Depense.montant)).where(
            Depense.entreprise_id == entreprise_id,
            Depense.is_deleted == False,
            extract("year", Depense.date_depense) == annee,
            extract("month", Depense.date_depense) == mois,
        ).group_by(Depense.categorie)
    )
    depenses_par_categorie = {row[0] or "Autre": float(row[1] or 0) for row in depenses_cat_result.all()}

    depenses_validees_result = await db.execute(
        select(func.coalesce(func.sum(Depense.montant), 0)).where(
            Depense.entreprise_id == entreprise_id,
            Depense.is_deleted == False,
            Depense.statut == "validee",
            extract("year", Depense.date_depense) == annee,
            extract("month", Depense.date_depense) == mois,
        )
    )
    depenses_validees = float(depenses_validees_result.scalar_one_or_none() or 0.0)

    depenses_attente_result = await db.execute(
        select(func.coalesce(func.sum(Depense.montant), 0)).where(
            Depense.entreprise_id == entreprise_id,
            Depense.is_deleted == False,
            Depense.statut == "en_attente",
            extract("year", Depense.date_depense) == annee,
            extract("month", Depense.date_depense) == mois,
        )
    )
    depenses_en_attente = float(depenses_attente_result.scalar_one_or_none() or 0.0)

    return RapportMensuelResponse(
        mois=f"{mois:02d}",
        annee=annee,
        total_recettes=total_recettes,
        total_depenses=total_depenses,
        solde=total_recettes - total_depenses,
        nb_factures_emises=nb_factures_emises,
        nb_factures_payees=nb_factures_payees,
        montant_factures_payees=montant_factures_payees,
        depenses_par_categorie=depenses_par_categorie,
        depenses_validees=depenses_validees,
        depenses_en_attente=depenses_en_attente,
    )


# ==================== ALERTES ====================


@router.get("/alertes", response_model=list[AlerteList])
async def list_alertes(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
):
    _require_permission(payload, "alertes:read")
    entreprise_id = _get_entreprise_id(payload)
    alertes, _ = await alerte_crud.get_by_entreprise(db, entreprise_id, skip=skip, limit=limit)
    return alertes


@router.post("/alertes", response_model=AlerteResponse, status_code=status.HTTP_201_CREATED)
async def create_alerte(
    payload: CurrentUserPayload,
    db: DbDep,
    data: AlerteCreate,
):
    _require_permission(payload, "alertes:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    return await alerte_crud.create(db, obj_in)


# ==================== BUDGET OVERRUNS ====================


@router.get("/budget-overruns")
async def list_budget_overruns(
    payload: CurrentUserPayload,
    db: DbDep,
    limit: int = Query(default=50, le=100),
):
    _require_permission(payload, "finance:read")
    entreprise_id = _get_entreprise_id(payload)

    result = await db.execute(
        select(
            Chantier.id,
            Chantier.nom,
            Chantier.numero,
            Chantier.budget_prevu,
            Chantier.budget_reel,
            Chantier.statut,
        )
        .where(
            Chantier.entreprise_id == entreprise_id,
            Chantier.is_deleted == False,
            Chantier.budget_reel > Chantier.budget_prevu,
        )
        .order_by((Chantier.budget_reel - Chantier.budget_prevu).desc())
        .limit(limit)
    )

    overruns = []
    for row in result.all():
        budget_prevu = float(row.budget_prevu or 0.0)
        budget_reel = float(row.budget_reel or 0.0)
        depassement = budget_reel - budget_prevu
        taux_depassement = (depassement / budget_prevu * 100) if budget_prevu > 0 else 0.0
        overruns.append({
            "id": row.id,
            "nom": row.nom,
            "numero": row.numero,
            "budget_prevu": budget_prevu,
            "budget_reel": budget_reel,
            "depassement": depassement,
            "taux_depassement": round(taux_depassement, 1),
            "statut": row.statut,
        })

    return {"overruns": overruns}


# ==================== PAYMENT DELAYS ====================


@router.get("/payment-delays")
async def get_payment_delays(
    payload: CurrentUserPayload,
    db: DbDep,
    client_id: int | None = None,
):
    _require_permission(payload, "finance:read")
    entreprise_id = _get_entreprise_id(payload)

    query = select(Facture).where(
        Facture.entreprise_id == entreprise_id,
        Facture.is_deleted == False,
        Facture.statut == "payee",
        Facture.date_paiement.is_not(None),
        Facture.date_echeance.is_not(None),
    )

    if client_id:
        query = query.where(Facture.client_id == client_id)

    result = await db.execute(query)
    factures = result.scalars().all()

    delais = []
    for f in factures:
        if f.date_paiement and f.date_echeance:
            from datetime import date as date_type
            if isinstance(f.date_paiement, datetime):
                date_paiement = f.date_paiement.date()
            else:
                date_paiement = f.date_paiement
            if isinstance(f.date_echeance, datetime):
                date_echeance = f.date_echeance.date()
            else:
                date_echeance = f.date_echeance
            delai = (date_paiement - date_echeance).days
            delais.append({
                "facture_id": f.id,
                "numero": f.numero,
                "client_id": f.client_id,
                "montant": float(f.montant_ttc or 0),
                "date_echeance": date_echeance.isoformat(),
                "date_paiement": date_paiement.isoformat(),
                "delai_jours": delai,
                "en_retard": delai > 0,
            })

    delais.sort(key=lambda x: x["delai_jours"], reverse=True)

    moyenne = sum(d["delai_jours"] for d in delais) / len(delais) if delais else 0.0

    return {
        "delais": delais,
        "moyenne_jours": round(moyenne, 1),
        "nb_en_retard": sum(1 for d in delais if d["en_retard"]),
    }


# ==================== CLIENT OUTSTANDING ====================


@router.get("/client-outstanding")
async def get_client_outstanding(
    payload: CurrentUserPayload,
    db: DbDep,
):
    _require_permission(payload, "finance:read")
    entreprise_id = _get_entreprise_id(payload)

    result = await db.execute(
        select(
            Client.id,
            Client.nom,
            Client.entreprise,
            Client.encours_max,
            func.coalesce(func.sum(Facture.montant_ttc - Facture.montant_paye), 0).label("encours_actuel"),
            func.count(Facture.id).label("nb_factures_impayees"),
        )
        .outerjoin(Facture, Facture.client_id == Client.id)
        .where(
            Client.entreprise_id == entreprise_id,
            Client.is_deleted == False,
            Facture.is_deleted == False,
            Facture.statut.in_(["emis", "envoye", "partiellement_payee", "en_retard"]),
        )
        .group_by(Client.id, Client.nom, Client.entreprise, Client.encours_max)
    )

    clients = []
    for row in result.all():
        encours_max = float(row.encours_max or 0.0)
        encours_actuel = float(row.encours_actuel or 0.0)
        depassement = encours_actuel - encours_max if encours_max > 0 else 0.0
        clients.append({
            "client_id": row.id,
            "nom": row.nom,
            "entreprise": row.entreprise,
            "encours_max": encours_max,
            "encours_actuel": encours_actuel,
            "depassement": depassement,
            "nb_factures_impayees": row.nb_factures_impayees,
            "depasse_limite": depassement > 0,
        })

    clients.sort(key=lambda x: x["encours_actuel"], reverse=True)

    return {"clients": clients}


# ==================== RAPPORTS ====================


@router.get("/rapports")
async def list_rapports(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
):
    _require_permission(payload, "finance:read")
    entreprise_id = _get_entreprise_id(payload)
    result = await db.execute(
        select(RapportFinancier)
        .where(RapportFinancier.entreprise_id == entreprise_id, RapportFinancier.is_deleted == False)
        .order_by(RapportFinancier.date_generation.desc())
        .offset(skip)
        .limit(limit)
    )
    rapports = result.scalars().all()
    return [
        {
            "id": r.id,
            "periode": r.periode,
            "chiffre_affaires": float(r.chiffre_affaires or 0),
            "depenses_total": float(r.depenses_total or 0),
            "marge": float(r.marge or 0),
            "date_generation": r.date_generation.isoformat() if r.date_generation else None,
        }
        for r in rapports
    ]


@router.post("/rapports/generate", status_code=status.HTTP_201_CREATED)
async def generate_rapport(
    payload: CurrentUserPayload,
    db: DbDep,
    periode: str = Query(..., description="Format YYYY-MM"),
):
    _require_permission(payload, "finance:write")
    entreprise_id = _get_entreprise_id(payload)

    try:
        annee, mois = map(int, periode.split("-"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Format de période invalide. Utilisez YYYY-MM")

    from datetime import date as date_type

    total_recettes = float((
        await db.execute(
            select(func.coalesce(func.sum(Facture.montant_paye), 0)).where(
                Facture.entreprise_id == entreprise_id,
                Facture.is_deleted == False,
                extract("year", Facture.date_emission) == annee,
                extract("month", Facture.date_emission) == mois,
            )
        )
    ).scalar_one_or_none() or 0.0)

    total_depenses = float((
        await db.execute(
            select(func.coalesce(func.sum(Depense.montant), 0)).where(
                Depense.entreprise_id == entreprise_id,
                Depense.is_deleted == False,
                extract("year", Depense.date_depense) == annee,
                extract("month", Depense.date_depense) == mois,
            )
        )
    ).scalar_one_or_none() or 0.0)

    marge = total_recettes - total_depenses

    rapport = RapportFinancier(
        entreprise_id=entreprise_id,
        periode=periode,
        chiffre_affaires=total_recettes,
        depenses_total=total_depenses,
        marge=marge,
        date_generation=date_type.today(),
    )
    db.add(rapport)
    await db.flush()
    await db.refresh(rapport)

    return {
        "id": rapport.id,
        "periode": rapport.periode,
        "chiffre_affaires": total_recettes,
        "depenses_total": total_depenses,
        "marge": marge,
        "date_generation": rapport.date_generation.isoformat(),
    }