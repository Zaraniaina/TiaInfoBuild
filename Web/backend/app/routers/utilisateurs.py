"""Router pour la gestion des utilisateurs de l'entreprise."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import get_current_user
from app.dependencies.auth import get_current_active_user
from app.dependencies.permissions import require_permission
from app.crud.utilisateur import UtilisateurCRUD
from app.models.utilisateur import Utilisateur
from app.models.role import Role
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurUpdate, UtilisateurResponse, UtilisateurList, UtilisateurRoleUpdate

router = APIRouter(prefix="/utilisateurs", tags=["utilisateurs"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_active_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
AdminCheck = Annotated[dict[str, Any], Depends(require_permission("parametres:write"))]


@router.get("/", response_model=dict)
async def list_utilisateurs(
    payload: AdminCheck,
    db: DbSession,
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    entreprise_id = payload.get("entreprise_id")
    crud = UtilisateurCRUD()
    query = select(Utilisateur).where(Utilisateur.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Utilisateur.entreprise_id == entreprise_id)
    if search:
        query = query.where((Utilisateur.nom.ilike(f"%{search}%")) | (Utilisateur.email.ilike(f"%{search}%")))
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    items = result.scalars().all()
    return {
        "items": [UtilisateurList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/", response_model=UtilisateurResponse, status_code=status.HTTP_201_CREATED)
async def create_utilisateur(payload: AdminCheck, db: DbSession, data: UtilisateurCreate):
    entreprise_id = payload.get("entreprise_id")
    obj_in = data.model_dump(exclude={"password"})
    if entreprise_id is not None and not obj_in.get("entreprise_id"):
        obj_in["entreprise_id"] = entreprise_id
    from app.security import hash_password
    obj_in["mot_de_passe_hash"] = hash_password(data.password)
    user = Utilisateur(**obj_in)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/{id}", response_model=UtilisateurResponse)
async def get_utilisateur(payload: AdminCheck, db: DbSession, id: int):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    return user


@router.put("/{id}", response_model=UtilisateurResponse)
async def update_utilisateur(payload: AdminCheck, db: DbSession, id: int, data: UtilisateurUpdate):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    obj_in = data.model_dump(exclude_unset=True)
    for field, value in obj_in.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return user


@router.put("/{id}/role", response_model=UtilisateurResponse)
async def update_utilisateur_role(payload: AdminCheck, db: DbSession, id: int, data: UtilisateurRoleUpdate):
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    user.role_id = data.role_id
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_utilisateur(payload: AdminCheck, db: DbSession, id: int):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    user.is_deleted = True
    await db.flush()
    return None


@router.post("/{id}/toggle-actif", response_model=dict)
async def toggle_utilisateur_actif(payload: AdminCheck, db: DbSession, id: int):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    user.statut = "inactif" if user.statut == "actif" else "actif"
    await db.flush()
    await db.refresh(user)
    return {"statut": user.statut}
