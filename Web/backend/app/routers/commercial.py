"""Routers pour le module commercial: clients, devis, contrats, factures, paiements."""
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.numerotation import generate_numero
from app.crud.base import BaseCRUD
from app.crud.client import ClientCRUD
from app.crud.devis import DevisCRUD
from app.crud.facture import FactureCRUD
from app.database import get_db
from app.models.client import Client
from app.models.devis import Devis
from app.models.facture import Facture
from app.models.contrat import Contrat
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, ClientList
from app.schemas.devis import (
    DevisCreate,
    DevisUpdate,
    DevisResponse,
    DevisList,
    DevisStatutUpdate,
)
from app.schemas.facture import (
    FactureCreate,
    FactureUpdate,
    FactureResponse,
    FactureList,
    PaiementCreate,
    PaiementResponse,
)
from app.schemas.contrat import ContratCreate, ContratUpdate, ContratResponse, ContratList
from app.security import CurrentUserPayload, DbDep

router = APIRouter(prefix="/commercial", tags=["commercial"])

_permission_map = None


def _get_permission_map():
    global _permission_map
    if _permission_map is None:
        from app.core.permissions import PERMISSION_MAP
        _permission_map = PERMISSION_MAP
    return _permission_map


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    role_code = payload.get("role_code")
    perm_map = _get_permission_map()
    permissions = perm_map.get(role_code, [])
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


# ==================== CLIENTS ====================

client_crud = ClientCRUD()


@router.get("/clients", response_model=list[ClientList])
async def list_clients(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    clients, _ = await client_crud.get_by_entreprise(db, entreprise_id, skip=skip, limit=limit)
    return clients


@router.post("/clients", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: CurrentUserPayload,
    db: DbDep,
    data: ClientCreate,
):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    return await client_crud.create(db, obj_in)


@router.get("/clients/{id}", response_model=ClientResponse)
async def get_client(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:read")
    client = await client_crud.get(db, id)
    if not client or client.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client non trouvé")
    return client


@router.put("/clients/{id}", response_model=ClientResponse)
async def update_client(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: ClientUpdate,
):
    _require_permission(payload, "commercial:write")
    client = await client_crud.get(db, id)
    if not client or client.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client non trouvé")
    obj_in = data.model_dump(exclude_unset=True)
    return await client_crud.update(db, client, obj_in)


@router.delete("/clients/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:delete")
    client = await client_crud.get(db, id)
    if not client or client.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client non trouvé")
    client.is_deleted = True
    await db.flush()
    await db.refresh(client)
    return None


# ==================== DEVIS ====================

devis_crud = DevisCRUD()


@router.get("/devis", response_model=list[DevisList])
async def list_devis(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    devis_list, _ = await devis_crud.get_by_entreprise(db, entreprise_id, skip=skip, limit=limit)
    return devis_list


@router.post("/devis", response_model=DevisResponse, status_code=status.HTTP_201_CREATED)
async def create_devis(
    payload: CurrentUserPayload,
    db: DbDep,
    data: DevisCreate,
):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    if not obj_in.get("numero"):
        obj_in["numero"] = await generate_numero(db, "DEV", Devis, "numero")
    return await devis_crud.create(db, obj_in)


@router.get("/devis/{id}", response_model=DevisResponse)
async def get_devis(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:read")
    devis = await devis_crud.get(db, id)
    if not devis or devis.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis non trouvé")
    return devis


@router.put("/devis/{id}", response_model=DevisResponse)
async def update_devis(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: DevisUpdate,
):
    _require_permission(payload, "commercial:write")
    devis = await devis_crud.get(db, id)
    if not devis or devis.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis non trouvé")
    obj_in = data.model_dump(exclude_unset=True)
    return await devis_crud.update(db, devis, obj_in)


@router.post("/devis/{id}/statut", response_model=DevisResponse)
async def update_devis_statut(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: DevisStatutUpdate,
):
    _require_permission(payload, "commercial:write")
    devis = await devis_crud.get(db, id)
    if not devis or devis.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis non trouvé")
    devis.statut = data.statut
    await db.flush()
    await db.refresh(devis)
    return devis


@router.post("/devis/{id}/transformer-contrat", response_model=ContratResponse, status_code=status.HTTP_201_CREATED)
async def transformer_devis_en_contrat(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:write")
    devis = await devis_crud.get(db, id)
    if not devis or devis.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis non trouvé")
    if devis.statut != "accepte":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seul un devis accepté peut être transformé en contrat",
        )

    existing_contrat = await db.execute(
        select(Contrat).where(Contrat.devis_id == id, Contrat.is_deleted == False)
    )
    if existing_contrat.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce devis est déjà transformé en contrat",
        )

    reference = await generate_numero(db, "CTR", Contrat, "reference")
    contrat = Contrat(
        entreprise_id=devis.entreprise_id,
        client_id=devis.client_id,
        reference=reference,
        montant=devis.montant_ttc or 0,
        date_debut=datetime.now().date(),
        statut="en_cours",
        devis_id=devis.id,
        objet=devis.objet,
        conditions_paiement=devis.conditions_paiement,
        notes=devis.notes,
    )
    db.add(contrat)
    await db.flush()
    await db.refresh(contrat)
    return contrat


# ==================== CONTRATS ====================


@router.get("/contrats", response_model=list[ContratList])
async def list_contrats(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    result = await db.execute(
        select(Contrat)
        .where(Contrat.entreprise_id == entreprise_id, Contrat.is_deleted == False)
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


@router.post("/contrats", response_model=ContratResponse, status_code=status.HTTP_201_CREATED)
async def create_contrat(
    payload: CurrentUserPayload,
    db: DbDep,
    data: ContratCreate,
):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    contrat = Contrat(**obj_in)
    db.add(contrat)
    await db.flush()
    await db.refresh(contrat)
    return contrat


@router.get("/contrats/{id}", response_model=ContratResponse)
async def get_contrat(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:read")
    result = await db.execute(
        select(Contrat).where(Contrat.id == id, Contrat.is_deleted == False)
    )
    contrat = result.scalar_one_or_none()
    if not contrat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrat non trouvé")
    return contrat


@router.put("/contrats/{id}", response_model=ContratResponse)
async def update_contrat(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: ContratUpdate,
):
    _require_permission(payload, "commercial:write")
    result = await db.execute(
        select(Contrat).where(Contrat.id == id, Contrat.is_deleted == False)
    )
    contrat = result.scalar_one_or_none()
    if not contrat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrat non trouvé")
    obj_in = data.model_dump(exclude_unset=True)
    for field, value in obj_in.items():
        setattr(contrat, field, value)
    await db.flush()
    await db.refresh(contrat)
    return contrat


@router.delete("/contrats/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contrat(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:delete")
    result = await db.execute(
        select(Contrat).where(Contrat.id == id, Contrat.is_deleted == False)
    )
    contrat = result.scalar_one_or_none()
    if not contrat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrat non trouvé")
    contrat.is_deleted = True
    await db.flush()
    return None


# ==================== FACTURES ====================

facture_crud = FactureCRUD()


@router.get("/factures", response_model=list[FactureList])
async def list_factures(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    factures, _ = await facture_crud.get_by_entreprise(db, entreprise_id, skip=skip, limit=limit)
    return factures


@router.post("/factures", response_model=FactureResponse, status_code=status.HTTP_201_CREATED)
async def create_facture(
    payload: CurrentUserPayload,
    db: DbDep,
    data: FactureCreate,
):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    if not obj_in.get("numero"):
        obj_in["numero"] = await generate_numero(db, "FAC", Facture, "numero")
    return await facture_crud.create(db, obj_in)


@router.get("/factures/{id}", response_model=FactureResponse)
async def get_facture(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:read")
    facture = await facture_crud.get(db, id)
    if not facture or facture.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture non trouvée")
    return facture


@router.put("/factures/{id}", response_model=FactureResponse)
async def update_facture(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: FactureUpdate,
):
    _require_permission(payload, "commercial:write")
    facture = await facture_crud.get(db, id)
    if not facture or facture.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture non trouvée")
    obj_in = data.model_dump(exclude_unset=True)
    return await facture_crud.update(db, facture, obj_in)


# ==================== PAIEMENTS ====================

@router.get("/paiements", response_model=list[PaiementResponse])
async def list_paiements(
    payload: CurrentUserPayload,
    db: DbDep,
    skip: int = 0,
    limit: int = 100,
):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    from app.models.paiement import Paiement
    result = await db.execute(
        select(Paiement)
        .where(Paiement.entreprise_id == entreprise_id, Paiement.is_deleted == False)
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


@router.post("/paiements", response_model=PaiementResponse, status_code=status.HTTP_201_CREATED)
async def create_paiement(
    payload: CurrentUserPayload,
    db: DbDep,
    data: PaiementCreate,
):
    _require_permission(payload, "commercial:write")
    from app.models.paiement import Paiement
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    if not obj_in.get("date_paiement"):
        obj_in["date_paiement"] = date.today()
    paiement = Paiement(**obj_in)
    db.add(paiement)
    await db.flush()
    await db.refresh(paiement)

    facture = await facture_crud.get(db, data.facture_id)
    if facture:
        montant_paye = (facture.montant_paye or 0) + data.montant
        facture.montant_paye = montant_paye
        if facture.montant_ttc and montant_paye >= facture.montant_ttc:
            facture.statut = "payee"
        elif montant_paye > 0:
            facture.statut = "partiellement_payee"
        await db.flush()
        await db.refresh(facture)

    return paiement


@router.post("/factures/{id}/paiements", response_model=PaiementResponse, status_code=status.HTTP_201_CREATED)
async def add_paiement_to_facture(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: PaiementCreate,
):
    _require_permission(payload, "commercial:write")
    facture = await facture_crud.get(db, id)
    if not facture or facture.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture non trouvée")
    from app.models.paiement import Paiement
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    obj_in["facture_id"] = id
    if not obj_in.get("date_paiement"):
        obj_in["date_paiement"] = date.today()
    paiement = Paiement(**obj_in)
    db.add(paiement)
    await db.flush()
    await db.refresh(paiement)

    montant_paye = (facture.montant_paye or 0) + data.montant
    facture.montant_paye = montant_paye
    if facture.montant_ttc and montant_paye >= facture.montant_ttc:
        facture.statut = "payee"
    elif montant_paye > 0:
        facture.statut = "partiellement_payee"
    await db.flush()
    await db.refresh(facture)

    return paiement


@router.post("/factures/{id}/dupliquer", response_model=FactureResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_facture(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:write")
    facture = await facture_crud.get(db, id)
    if not facture or facture.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture non trouvée")
    entreprise_id = _get_entreprise_id(payload)
    nouveau_numero = await generate_numero(db, "FAC", Facture, "numero")
    nouvelle_facture = Facture(
        entreprise_id=entreprise_id,
        client_id=facture.client_id,
        contrat_id=facture.contrat_id,
        numero=nouveau_numero,
        type=facture.type,
        montant_ht=facture.montant_ht,
        tva=facture.tva,
        montant_ttc=facture.montant_ttc,
        date_emission=date.today(),
        date_echeance=date.today(),
        statut="emis",
        conditions_paiement=facture.conditions_paiement,
        mode_paiement=facture.mode_paiement,
        notes=facture.notes,
        montant_paye=0.0,
    )
    db.add(nouvelle_facture)
    await db.flush()
    await db.refresh(nouvelle_facture)
    return nouvelle_facture


# ============================================================
# VALIDATION DEVIS (Direction Générale)
# ============================================================

class DevisValidationRequest(BaseModel):
    avis: str = Field(..., min_length=1, max_length=255)
    approuve: bool = True


@router.post("/devis/{id}/valider", response_model=DevisResponse)
async def valider_devis(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: DevisValidationRequest,
):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    devis = await devis_crud.get(db, id)
    if not devis or devis.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis non trouvé")
    if devis.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    devis.statut = "accepte" if data.approuve else "refuse"
    devis.notes = f"{devis.notes or ''}\n[VALIDATION DG] {data.avis}".strip()
    await db.flush()
    await db.refresh(devis)
    return devis