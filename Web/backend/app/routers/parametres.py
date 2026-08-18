"""Router pour les paramètres et la configuration."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.entreprise import Entreprise
from app.models.utilisateur import Utilisateur
from app.models.preference import Preference
from app.schemas.entreprise import EntrepriseUpdate
from app.schemas.utilisateur import UtilisateurUpdate
from app.schemas.role import RoleResponse

router = APIRouter(prefix="/parametres", tags=["parametres"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_active_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/entreprise")
async def get_entreprise(payload: CurrentUser, db: DbSession):
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    result = await db.execute(select(Entreprise).where(Entreprise.id == entreprise_id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    return {"entreprise": entreprise}


@router.put("/entreprise")
async def update_entreprise(payload: CurrentUser, db: DbSession, data: EntrepriseUpdate):
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    result = await db.execute(select(Entreprise).where(Entreprise.id == entreprise_id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    obj_in = data.model_dump(exclude_unset=True)
    for field, value in obj_in.items():
        setattr(entreprise, field, value)
    await db.flush()
    await db.refresh(entreprise)
    return {"entreprise": entreprise}


@router.put("/facturation")
async def update_facturation(payload: CurrentUser, db: DbSession, data: EntrepriseUpdate):
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    result = await db.execute(select(Entreprise).where(Entreprise.id == entreprise_id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    obj_in = data.model_dump(exclude_unset=True)
    allowed = {"prefixe_devis", "prefixe_facture", "prefixe_contrat", "tva_defaut", "delai_paiement_defaut", "validite_devis"}
    for field, value in obj_in.items():
        if field in allowed:
            setattr(entreprise, field, value)
    await db.flush()
    await db.refresh(entreprise)
    return {"entreprise": entreprise}


@router.get("/profile")
async def get_profile(payload: CurrentUser, db: DbSession):
    user_id = payload.get("sub")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == int(user_id) if user_id else 0))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    pref_result = await db.execute(select(Preference).where(Preference.user_id == user.id))
    pref = pref_result.scalar_one_or_none()
    return {
        "utilisateur": user,
        "preferences": pref,
    }


@router.put("/profile")
async def update_profile(payload: CurrentUser, db: DbSession, data: UtilisateurUpdate):
    user_id = payload.get("sub")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == int(user_id) if user_id else 0))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    obj_in = data.model_dump(exclude_unset=True)
    for field, value in obj_in.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return {"utilisateur": user}


@router.get("/roles")
async def list_roles(db: DbSession):
    result = await db.execute(select(Role).order_by(Role.id))
    roles = result.scalars().all()
    return [RoleResponse.model_validate(role) for role in roles]


@router.post("/backup")
async def create_backup(payload: CurrentUser):
    return {"download_url": "/downloads/backup-placeholder.zip"}
