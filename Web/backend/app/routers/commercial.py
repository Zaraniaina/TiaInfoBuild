"""Routers pour le module commercial: clients, devis, contrats, factures, paiements."""
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Response
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
from app.models.ligne_devis import LigneDevis
from app.models.ligne_facture import LigneFacture
from app.models.facture import Facture
from app.models.contrat import Contrat
from app.models.paiement import Paiement
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, ClientList
from app.schemas.devis import (
    DevisCreate,
    DevisUpdate,
    DevisResponse,
    DevisList,
    DevisStatutUpdate,
    LigneDevisCreate,
    LigneDevisResponse,
)
from app.schemas.facture import (
    FactureCreate,
    FactureUpdate,
    FactureResponse,
    FactureList,
    PaiementCreate,
    PaiementResponse,
    LigneFactureCreate,
    LigneFactureResponse,
)
from app.schemas.contrat import ContratCreate, ContratUpdate, ContratResponse, ContratList
from app.schemas.avenant import AvenantCreate, AvenantUpdate, AvenantResponse, AvenantList
from app.schemas.demande_travaux import DemandeTravauxCreate, DemandeTravauxUpdate, DemandeTravauxResponse, DemandeTravauxList
from app.schemas.projet import ProjetCreate, ProjetUpdate, ProjetResponse, ProjetList
from app.schemas.metre import MetreCreate, MetreUpdate, MetreResponse, MetreList
from app.schemas.situation_travaux import SituationTravauxCreate, SituationTravauxUpdate, SituationTravauxResponse, SituationTravauxList, LigneSituationCreate, LigneSituationResponse
from app.security import CurrentUserPayload, DbDep
from app.security import hash_password, generate_temp_password
from app.models.utilisateur import Utilisateur
from app.crud.avenant import AvenantCRUD
from app.crud.demande_travaux import demande_travaux_crud
from app.crud.projet import projet_crud
from app.crud.metre import metre_crud
from app.crud.situation_travaux import situation_travaux_crud, ligne_situation_crud

router = APIRouter(tags=["commercial"])

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


async def _recalculer_facture(db: AsyncSession, facture_id: int) -> None:
    result = await db.execute(select(Facture).where(Facture.id == facture_id, Facture.is_deleted == False))
    facture = result.scalar_one_or_none()
    if not facture:
        return

    lignes_result = await db.execute(select(LigneFacture).where(LigneFacture.facture_id == facture_id, LigneFacture.is_deleted == False))
    lignes = list(lignes_result.scalars().all())
    montant_ht = sum(float(l.total_ht or 0) for l in lignes)
    taux_tva = float(facture.tva or 0)
    montant_tva = montant_ht * taux_tva / 100
    montant_ttc = montant_ht + montant_tva

    paiements_result = await db.execute(select(Paiement).where(Paiement.facture_id == facture_id, Paiement.is_deleted == False))
    paiements = list(paiements_result.scalars().all())
    montant_paye = sum(float(p.montant or 0) for p in paiements)
    reste_a_payer = montant_ttc - float(facture.montant_acompte_deduit or 0) - montant_paye

    if montant_paye <= 0:
        nouveau_statut = "emis"
    elif montant_paye >= montant_ttc:
        nouveau_statut = "payee"
    else:
        nouveau_statut = "partiellement_payee"

    facture.montant_ht = montant_ht
    facture.montant_tva = montant_tva
    facture.montant_ttc = montant_ttc
    facture.montant_paye = montant_paye
    facture.reste_a_payer = reste_a_payer if reste_a_payer > 0 else 0
    facture.statut = nouveau_statut
    await db.flush()


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
    response: Response,
):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["entreprise_id"] = entreprise_id
    if obj_in.get("adresses") is None:
        obj_in["adresses"] = []
    client = await client_crud.create(db, obj_in)

    # Création automatique d'un compte utilisateur pour le client si email fourni
    try:
        if client and client.email:
            temp_pwd = generate_temp_password()
            user_obj = {
                "entreprise_id": entreprise_id,
                "email": client.email,
                "nom": client.nom or "",
                "prenom": client.prenom or "",
                "mot_de_passe_hash": hash_password(temp_pwd),
                "must_change_password": True,
            }
            user = Utilisateur(**user_obj)
            db.add(user)
            await db.flush()
            await db.refresh(user)
            # Exposer de façon temporaire l'id utilisateur et le mot de passe généré
            # via des en-têtes HTTP (usage immédiat par l'UI/admin). Attention: ces en-têtes
            # doivent être consommés immédiatement et ne sont pas conservés côté serveur.
            response.headers["X-Utilisateur-Cree"] = str(user.id)
            response.headers["X-Utilisateur-TempPwd"] = temp_pwd
            print(f"Compte utilisateur créé pour le client {client.email} (utilisateur_id={user.id})")
    except Exception as e:
        # Ne pas bloquer la création du client si la création du compte échoue
        print("Erreur création compte client automatique:", e)

    return client


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
    devis = await devis_crud.create(db, obj_in)

    # charger les lignes associées pour la réponse
    result = await db.execute(
        select(LigneDevis).where(LigneDevis.devis_id == devis.id, LigneDevis.is_deleted == False)
    )
    lignes = list(result.scalars().all())

    # Construire une réponse sérialisable attendue par DevisResponse
    return {
        "id": devis.id,
        "entreprise_id": devis.entreprise_id,
        "client_id": devis.client_id,
        "numero": devis.numero,
        "objet": devis.objet,
        "montant_ht": float(devis.montant_ht or 0),
        "tva": float(devis.tva or 0),
        "montant_ttc": float(devis.montant_ttc or 0),
        "date_creation": devis.date_creation,
        "date_validite": devis.date_validite,
        "statut": devis.statut,
        "conditions_paiement": devis.conditions_paiement,
        "mode_paiement": devis.mode_paiement,
        "notes": devis.notes,
        "is_deleted": devis.is_deleted,
        "created_at": devis.created_at,
        "updated_at": devis.updated_at,
        "lignes": [
            {
                "id": l.id,
                "devis_id": l.devis_id,
                "type": l.type,
                "article_id": l.article_id,
                "description": l.description,
                "quantite": float(l.quantite or 0),
                "unite": l.unite,
                "prix_unitaire": float(l.prix_unitaire or 0),
                "remise": float(l.remise or 0),
                "taux_tva": float(l.taux_tva or 0),
                "total_ht": float(l.total_ht or 0),
                "total_ttc": float(l.total_ttc or 0),
                "ordre": l.ordre,
                "is_deleted": l.is_deleted,
                "created_at": l.created_at,
                "updated_at": l.updated_at,
            }
            for l in lignes
        ],
    }


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
    result = await db.execute(
        select(LigneDevis).where(LigneDevis.devis_id == devis.id, LigneDevis.is_deleted == False)
    )
    lignes = list(result.scalars().all())
    return {
        "id": devis.id,
        "entreprise_id": devis.entreprise_id,
        "client_id": devis.client_id,
        "numero": devis.numero,
        "objet": devis.objet,
        "montant_ht": float(devis.montant_ht or 0),
        "tva": float(devis.tva or 0),
        "montant_ttc": float(devis.montant_ttc or 0),
        "date_creation": devis.date_creation,
        "date_validite": devis.date_validite,
        "statut": devis.statut,
        "conditions_paiement": devis.conditions_paiement,
        "mode_paiement": devis.mode_paiement,
        "notes": devis.notes,
        "is_deleted": devis.is_deleted,
        "created_at": devis.created_at,
        "updated_at": devis.updated_at,
        "lignes": [
            {
                "id": l.id,
                "devis_id": l.devis_id,
                "type": l.type,
                "article_id": l.article_id,
                "description": l.description,
                "quantite": float(l.quantite or 0),
                "unite": l.unite,
                "prix_unitaire": float(l.prix_unitaire or 0),
                "remise": float(l.remise or 0),
                "taux_tva": float(l.taux_tva or 0),
                "total_ht": float(l.total_ht or 0),
                "total_ttc": float(l.total_ttc or 0),
                "ordre": l.ordre,
                "is_deleted": l.is_deleted,
                "created_at": l.created_at,
                "updated_at": l.updated_at,
            }
            for l in lignes
        ],
    }


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


# ==================== LIGNES DEVIS ====================


@router.post("/devis/{devis_id}/lignes", response_model=LigneDevisResponse, status_code=status.HTTP_201_CREATED)
async def create_ligne_devis(
    payload: CurrentUserPayload,
    db: DbDep,
    devis_id: int,
    data: LigneDevisCreate,
):
    _require_permission(payload, "commercial:write")
    devis = await devis_crud.get(db, devis_id)
    if not devis or devis.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis non trouvé")

    obj_in = data.model_dump()
    obj_in["devis_id"] = devis_id

    # Calculs ligne
    quantite = float(obj_in.get("quantite") or 0)
    prix_unitaire = float(obj_in.get("prix_unitaire") or 0)
    remise = float(obj_in.get("remise") or 0)
    taux_tva = float(obj_in.get("taux_tva") or devis.tva or 0)

    if not obj_in.get("total_ht"):
        obj_in["total_ht"] = quantite * prix_unitaire * (1 - remise / 100)
    if not obj_in.get("total_ttc"):
        obj_in["total_ttc"] = float(obj_in["total_ht"]) * (1 + taux_tva / 100)

    ligne = LigneDevis(**obj_in)
    db.add(ligne)
    await db.flush()
    await db.refresh(ligne)

    # Recalculer totaux du devis
    result = await db.execute(select(LigneDevis).where(LigneDevis.devis_id == devis_id, LigneDevis.is_deleted == False))
    lignes = list(result.scalars().all())
    devis.montant_ht = sum(float(l.total_ht or 0) for l in lignes)
    devis.montant_ttc = sum(float(l.total_ttc or 0) for l in lignes)
    await db.flush()
    await db.refresh(devis)

    return ligne


@router.put("/devis/{devis_id}/lignes/{ligne_id}", response_model=LigneDevisResponse)
async def update_ligne_devis(
    payload: CurrentUserPayload,
    db: DbDep,
    devis_id: int,
    ligne_id: int,
    data: LigneDevisCreate,
):
    _require_permission(payload, "commercial:write")
    ligne = await db.get(LigneDevis, ligne_id)
    if not ligne or ligne.is_deleted or ligne.devis_id != devis_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne non trouvée")

    obj_in = data.model_dump(exclude_unset=True)
    for field, value in obj_in.items():
        setattr(ligne, field, value)

    # Recalculer totaux de la ligne si nécessaire
    quantite = float(ligne.quantite or 0)
    prix_unitaire = float(ligne.prix_unitaire or 0)
    remise = float(ligne.remise or 0)
    taux_tva = float(ligne.taux_tva or 0)
    ligne.total_ht = quantite * prix_unitaire * (1 - remise / 100)
    ligne.total_ttc = float(ligne.total_ht) * (1 + taux_tva / 100)

    await db.flush()

    # Recalculer totaux du devis
    result = await db.execute(select(LigneDevis).where(LigneDevis.devis_id == devis_id, LigneDevis.is_deleted == False))
    lignes = list(result.scalars().all())
    devis = await devis_crud.get(db, devis_id)
    devis.montant_ht = sum(float(l.total_ht or 0) for l in lignes)
    devis.montant_ttc = sum(float(l.total_ttc or 0) for l in lignes)
    await db.flush()
    await db.refresh(ligne)
    await db.refresh(devis)
    return ligne


@router.delete("/devis/{devis_id}/lignes/{ligne_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ligne_devis(
    payload: CurrentUserPayload,
    db: DbDep,
    devis_id: int,
    ligne_id: int,
):
    _require_permission(payload, "commercial:delete")
    ligne = await db.get(LigneDevis, ligne_id)
    if not ligne or ligne.is_deleted or ligne.devis_id != devis_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne non trouvée")

    ligne.is_deleted = True
    await db.flush()

    # Recalculer totaux du devis
    result = await db.execute(select(LigneDevis).where(LigneDevis.devis_id == devis_id, LigneDevis.is_deleted == False))
    lignes = list(result.scalars().all())
    devis = await devis_crud.get(db, devis_id)
    if devis:
        devis.montant_ht = sum(float(l.total_ht or 0) for l in lignes)
        devis.montant_ttc = sum(float(l.total_ttc or 0) for l in lignes)
        await db.flush()

    return None


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


# ==================== AVENANTS ====================

avenant_crud = AvenantCRUD()


@router.get("/contrats/{contrat_id}/avenants", response_model=list[AvenantList])
async def list_avenants(
    payload: CurrentUserPayload,
    db: DbDep,
    contrat_id: int,
):
    _require_permission(payload, "commercial:read")
    avenants, _ = await avenant_crud.get_by_contrat(db, contrat_id)
    return avenants


@router.get("/avenants", response_model=list[AvenantList])
async def list_all_avenants(
    payload: CurrentUserPayload,
    db: DbDep,
):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    avenants, _ = await avenant_crud.get_by_entreprise(db, entreprise_id)
    return avenants


@router.post("/contrats/{contrat_id}/avenants", response_model=AvenantResponse, status_code=status.HTTP_201_CREATED)
async def create_avenant(
    payload: CurrentUserPayload,
    db: DbDep,
    contrat_id: int,
    data: AvenantCreate,
):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_in = data.model_dump()
    obj_in["contrat_id"] = contrat_id
    obj_in["entreprise_id"] = entreprise_id
    if not obj_in.get("numero"):
        obj_in["numero"] = await generate_numero(db, "AV", Avenant, "numero")
    avenant = await avenant_crud.create(db, obj_in)
    await db.refresh(avenant)
    return avenant


@router.get("/avenants/{id}", response_model=AvenantResponse)
async def get_avenant(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:read")
    avenant = await avenant_crud.get(db, id)
    if not avenant or avenant.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avenant non trouvé")
    return avenant


@router.put("/avenants/{id}", response_model=AvenantResponse)
async def update_avenant(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    data: AvenantUpdate,
):
    _require_permission(payload, "commercial:write")
    avenant = await avenant_crud.get(db, id)
    if not avenant or avenant.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avenant non trouvé")
    obj_in = data.model_dump(exclude_unset=True)
    return await avenant_crud.update(db, avenant, obj_in)


@router.delete("/avenants/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_avenant(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission(payload, "commercial:delete")
    avenant = await avenant_crud.get(db, id)
    if not avenant or avenant.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avenant non trouvé")
    avenant.is_deleted = True
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
    obj_in = data.model_dump(exclude={"lignes"})
    obj_in["entreprise_id"] = entreprise_id
    if not obj_in.get("numero"):
        obj_in["numero"] = await generate_numero(db, "FAC", Facture, "numero")
    facture = await facture_crud.create(db, obj_in)

    if data.lignes:
        for ligne_data in data.lignes:
            ligne_obj = LigneFacture(**ligne_data.model_dump(), facture_id=facture.id)
            db.add(ligne_obj)
        await db.flush()
        await _recalculer_facture(db, facture.id)
        await db.refresh(facture)

    return facture


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
    lignes_result = await db.execute(select(LigneFacture).where(LigneFacture.facture_id == id, LigneFacture.is_deleted == False))
    lignes = list(lignes_result.scalars().all())
    paiements_result = await db.execute(select(Paiement).where(Paiement.facture_id == id, Paiement.is_deleted == False))
    paiements = list(paiements_result.scalars().all())
    return {
        **facture.__dict__,
        "lignes": [
            {
                "id": l.id,
                "facture_id": l.facture_id,
                "type": l.type,
                "article_id": l.article_id,
                "description": l.description,
                "categorie": l.categorie,
                "quantite": float(l.quantite or 0),
                "unite": l.unite,
                "prix_unitaire": float(l.prix_unitaire or 0),
                "remise": float(l.remise or 0),
                "taux_tva": float(l.taux_tva or 0),
                "total_ht": float(l.total_ht or 0),
                "total_ttc": float(l.total_ttc or 0),
                "ordre": l.ordre,
                "is_deleted": l.is_deleted,
                "created_at": l.created_at,
                "updated_at": l.updated_at,
            }
            for l in lignes
        ],
        "paiements": [
            {
                "id": p.id,
                "facture_id": p.facture_id,
                "montant": float(p.montant or 0),
                "date_paiement": p.date_paiement,
                "mode_paiement": p.mode_paiement,
                "reference": p.reference,
                "banque": p.banque,
                "notes": p.notes,
                "is_deleted": p.is_deleted,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            }
            for p in paiements
        ],
    }


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

    await _recalculer_facture(db, data.facture_id)

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

    await _recalculer_facture(db, id)

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
        montant_ht=0,
        tva=facture.tva,
        montant_tva=0,
        montant_ttc=0,
        montant_acompte_deduit=0,
        montant_paye=0,
        reste_a_payer=0,
        date_emission=date.today(),
        date_echeance=date.today(),
        statut="emis",
        conditions_paiement=facture.conditions_paiement,
        mode_paiement=facture.mode_paiement,
        notes=facture.notes,
    )
    db.add(nouvelle_facture)
    await db.flush()
    await db.refresh(nouvelle_facture)

    lignes_result = await db.execute(select(LigneFacture).where(LigneFacture.facture_id == id, LigneFacture.is_deleted == False))
    anciennes_lignes = list(lignes_result.scalars().all())
    for ancienne in anciennes_lignes:
        nouvelle_ligne = LigneFacture(
            facture_id=nouvelle_facture.id,
            type=ancienne.type,
            article_id=ancienne.article_id,
            description=ancienne.description,
            categorie=ancienne.categorie,
            quantite=ancienne.quantite,
            unite=ancienne.unite,
            prix_unitaire=ancienne.prix_unitaire,
            remise=ancienne.remise,
            taux_tva=ancienne.taux_tva,
            total_ht=ancienne.total_ht,
            total_ttc=ancienne.total_ttc,
            ordre=ancienne.ordre,
        )
        db.add(nouvelle_ligne)
    await db.flush()
    await _recalculer_facture(db, nouvelle_facture.id)
    await db.refresh(nouvelle_facture)
    return nouvelle_facture


# ==================== LIGNES FACTURE ====================


@router.post("/factures/{facture_id}/lignes", response_model=LigneFactureResponse, status_code=status.HTTP_201_CREATED)
async def create_ligne_facture(
    payload: CurrentUserPayload,
    db: DbDep,
    facture_id: int,
    data: LigneFactureCreate,
):
    _require_permission(payload, "commercial:write")
    facture = await facture_crud.get(db, facture_id)
    if not facture or facture.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture non trouvée")

    obj_in = data.model_dump()
    obj_in["facture_id"] = facture_id

    quantite = float(obj_in.get("quantite") or 0)
    prix_unitaire = float(obj_in.get("prix_unitaire") or 0)
    remise = float(obj_in.get("remise") or 0)
    taux_tva = float(obj_in.get("taux_tva") or facture.tva or 0)

    if not obj_in.get("total_ht"):
        obj_in["total_ht"] = quantite * prix_unitaire * (1 - remise / 100)
    if not obj_in.get("total_ttc"):
        obj_in["total_ttc"] = float(obj_in["total_ht"]) * (1 + taux_tva / 100)

    ligne = LigneFacture(**obj_in)
    db.add(ligne)
    await db.flush()
    await db.refresh(ligne)

    await _recalculer_facture(db, facture_id)

    return ligne


@router.put("/factures/{facture_id}/lignes/{ligne_id}", response_model=LigneFactureResponse)
async def update_ligne_facture(
    payload: CurrentUserPayload,
    db: DbDep,
    facture_id: int,
    ligne_id: int,
    data: LigneFactureCreate,
):
    _require_permission(payload, "commercial:write")
    ligne = await db.get(LigneFacture, ligne_id)
    if not ligne or ligne.is_deleted or ligne.facture_id != facture_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne non trouvée")

    obj_in = data.model_dump(exclude_unset=True)
    for field, value in obj_in.items():
        setattr(ligne, field, value)

    quantite = float(ligne.quantite or 0)
    prix_unitaire = float(ligne.prix_unitaire or 0)
    remise = float(ligne.remise or 0)
    taux_tva = float(ligne.taux_tva or 0)
    ligne.total_ht = quantite * prix_unitaire * (1 - remise / 100)
    ligne.total_ttc = float(ligne.total_ht) * (1 + taux_tva / 100)

    await db.flush()
    await _recalculer_facture(db, facture_id)
    await db.refresh(ligne)
    return ligne


@router.delete("/factures/{facture_id}/lignes/{ligne_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ligne_facture(
    payload: CurrentUserPayload,
    db: DbDep,
    facture_id: int,
    ligne_id: int,
):
    _require_permission(payload, "commercial:delete")
    ligne = await db.get(LigneFacture, ligne_id)
    if not ligne or ligne.is_deleted or ligne.facture_id != facture_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne non trouvée")

    ligne.is_deleted = True
    await db.flush()
    await _recalculer_facture(db, facture_id)

    return None


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


# ============================================================
# DEMANDES DE TRAVAUX
# ============================================================

@router.get("/demandes", response_model=list[DemandeTravauxList])
async def list_demandes(payload: CurrentUserPayload, db: DbDep, skip: int = 0, limit: int = 100):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    return await demande_travaux_crud.get_by_entreprise(db, entreprise_id, skip=skip, limit=limit)


@router.get("/demandes/{demande_id}", response_model=DemandeTravauxResponse)
async def get_demande(payload: CurrentUserPayload, db: DbDep, demande_id: int):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    demande = await demande_travaux_crud.get(db, demande_id)
    if not demande or demande.is_deleted or demande.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande non trouvée")
    return demande


@router.post("/demandes", response_model=DemandeTravauxResponse, status_code=status.HTTP_201_CREATED)
async def create_demande(payload: CurrentUserPayload, db: DbDep, data: DemandeTravauxCreate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_data = data.model_dump(exclude_unset=True)
    obj_data["entreprise_id"] = entreprise_id
    obj_data["numero"] = await demande_travaux_crud.generate_numero(db)
    demande = await demande_travaux_crud.create(db, obj_data)
    return demande


@router.put("/demandes/{demande_id}", response_model=DemandeTravauxResponse)
async def update_demande(payload: CurrentUserPayload, db: DbDep, demande_id: int, data: DemandeTravauxUpdate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    demande = await demande_travaux_crud.get(db, demande_id)
    if not demande or demande.is_deleted or demande.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande non trouvée")
    updated = await demande_travaux_crud.update(db, demande, data.model_dump(exclude_unset=True))
    return updated


@router.delete("/demandes/{demande_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_demande(payload: CurrentUserPayload, db: DbDep, demande_id: int):
    _require_permission(payload, "commercial:delete")
    entreprise_id = _get_entreprise_id(payload)
    demande = await demande_travaux_crud.get(db, demande_id)
    if not demande or demande.is_deleted or demande.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande non trouvée")
    await demande_travaux_crud.delete(db, demande)
    return None
# ============================================================
# PROJETS
# ============================================================

@router.get("/projets", response_model=list[ProjetList])
async def list_projets(payload: CurrentUserPayload, db: DbDep, skip: int = 0, limit: int = 100):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    return await projet_crud.get_by_entreprise(db, entreprise_id, skip=skip, limit=limit)


@router.get("/projets/{projet_id}", response_model=ProjetResponse)
async def get_projet(payload: CurrentUserPayload, db: DbDep, projet_id: int):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    projet = await projet_crud.get(db, projet_id)
    if not projet or projet.is_deleted or projet.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet non trouvé")
    return projet


@router.post("/projets", response_model=ProjetResponse, status_code=status.HTTP_201_CREATED)
async def create_projet(payload: CurrentUserPayload, db: DbDep, data: ProjetCreate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_data = data.model_dump(exclude_unset=True)
    obj_data["entreprise_id"] = entreprise_id
    obj_data["reference"] = await projet_crud.generate_reference(db)
    projet = await projet_crud.create(db, obj_data)
    return projet


@router.put("/projets/{projet_id}", response_model=ProjetResponse)
async def update_projet(payload: CurrentUserPayload, db: DbDep, projet_id: int, data: ProjetUpdate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    projet = await projet_crud.get(db, projet_id)
    if not projet or projet.is_deleted or projet.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet non trouvé")
    updated = await projet_crud.update(db, projet, data.model_dump(exclude_unset=True))
    return updated


@router.delete("/projets/{projet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_projet(payload: CurrentUserPayload, db: DbDep, projet_id: int):
    _require_permission(payload, "commercial:delete")
    entreprise_id = _get_entreprise_id(payload)
    projet = await projet_crud.get(db, projet_id)
    if not projet or projet.is_deleted or projet.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet non trouvé")
    await projet_crud.delete(db, projet)
    return None

# ============================================================
# MÉTRÉS
# ============================================================

@router.get("/metres", response_model=list[MetreList])
async def list_metres(payload: CurrentUserPayload, db: DbDep, skip: int = 0, limit: int = 100):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    return await metre_crud.get_by_entreprise(db, entreprise_id, skip=skip, limit=limit)


@router.get("/metres/{metre_id}", response_model=MetreResponse)
async def get_metre(payload: CurrentUserPayload, db: DbDep, metre_id: int):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    metre = await metre_crud.get(db, metre_id)
    if not metre or metre.is_deleted or metre.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Métré non trouvé")
    return metre


@router.post("/metres", response_model=MetreResponse, status_code=status.HTTP_201_CREATED)
async def create_metre(payload: CurrentUserPayload, db: DbDep, data: MetreCreate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_data = data.model_dump(exclude_unset=True)
    obj_data["entreprise_id"] = entreprise_id
    metre = await metre_crud.create(db, obj_data)
    return metre


@router.put("/metres/{metre_id}", response_model=MetreResponse)
async def update_metre(payload: CurrentUserPayload, db: DbDep, metre_id: int, data: MetreUpdate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    metre = await metre_crud.get(db, metre_id)
    if not metre or metre.is_deleted or metre.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Métré non trouvé")
    updated = await metre_crud.update(db, metre, data.model_dump(exclude_unset=True))
    return updated


@router.delete("/metres/{metre_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_metre(payload: CurrentUserPayload, db: DbDep, metre_id: int):
    _require_permission(payload, "commercial:delete")
    entreprise_id = _get_entreprise_id(payload)
    metre = await metre_crud.get(db, metre_id)
    if not metre or metre.is_deleted or metre.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Métré non trouvé")
    await metre_crud.delete(db, metre)
    return None

# ============================================================
# SITUATIONS DE TRAVAUX
# ============================================================

@router.get("/situations", response_model=list[SituationTravauxList])
async def list_situations(payload: CurrentUserPayload, db: DbDep, skip: int = 0, limit: int = 100):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    return await situation_travaux_crud.get_by_entreprise(db, entreprise_id, skip=skip, limit=limit)


@router.get("/situations/{situation_id}", response_model=SituationTravauxResponse)
async def get_situation(payload: CurrentUserPayload, db: DbDep, situation_id: int):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    situation = await situation_travaux_crud.get(db, situation_id)
    if not situation or situation.is_deleted or situation.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situation non trouvée")
    return situation


@router.post("/situations", response_model=SituationTravauxResponse, status_code=status.HTTP_201_CREATED)
async def create_situation(payload: CurrentUserPayload, db: DbDep, data: SituationTravauxCreate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    obj_data = data.model_dump(exclude_unset=True)
    obj_data["entreprise_id"] = entreprise_id
    obj_data["numero"] = await situation_travaux_crud.generate_numero(db)
    situation = await situation_travaux_crud.create(db, obj_data)
    return situation


@router.put("/situations/{situation_id}", response_model=SituationTravauxResponse)
async def update_situation(payload: CurrentUserPayload, db: DbDep, situation_id: int, data: SituationTravauxUpdate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    situation = await situation_travaux_crud.get(db, situation_id)
    if not situation or situation.is_deleted or situation.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situation non trouvée")
    updated = await situation_travaux_crud.update(db, situation, data.model_dump(exclude_unset=True))
    return updated


@router.delete("/situations/{situation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_situation(payload: CurrentUserPayload, db: DbDep, situation_id: int):
    _require_permission(payload, "commercial:delete")
    entreprise_id = _get_entreprise_id(payload)
    situation = await situation_travaux_crud.get(db, situation_id)
    if not situation or situation.is_deleted or situation.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situation non trouvée")
    await situation_travaux_crud.delete(db, situation)
    return None


# ============================================================
# LIGNES DE SITUATION
# ============================================================

@router.get("/situations/{situation_id}/lignes", response_model=list[LigneSituationResponse])
async def list_lignes_situation(payload: CurrentUserPayload, db: DbDep, situation_id: int):
    _require_permission(payload, "commercial:read")
    entreprise_id = _get_entreprise_id(payload)
    situation = await situation_travaux_crud.get(db, situation_id)
    if not situation or situation.is_deleted or situation.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situation non trouvée")
    return await ligne_situation_crud.get_by_situation(db, situation_id)


@router.post("/situations/{situation_id}/lignes", response_model=LigneSituationResponse, status_code=status.HTTP_201_CREATED)
async def create_ligne_situation(payload: CurrentUserPayload, db: DbDep, situation_id: int, data: LigneSituationCreate):
    _require_permission(payload, "commercial:write")
    entreprise_id = _get_entreprise_id(payload)
    situation = await situation_travaux_crud.get(db, situation_id)
    if not situation or situation.is_deleted or situation.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situation non trouvée")
    obj_data = data.model_dump(exclude_unset=True)
    obj_data["situation_id"] = situation_id
    ligne = await ligne_situation_crud.create(db, obj_data)
    return ligne


@router.delete("/situations/{situation_id}/lignes/{ligne_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ligne_situation(payload: CurrentUserPayload, db: DbDep, situation_id: int, ligne_id: int):
    _require_permission(payload, "commercial:delete")
    ligne = await ligne_situation_crud.get(db, ligne_id)
    if not ligne or ligne.is_deleted or ligne.situation_id != situation_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne non trouvée")
    await ligne_situation_crud.delete(db, ligne)
    return None
