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

# Anciennement codé en dur à 2 ; on résout désormais l'id réel du rôle admin_entreprise
# depuis la base pour ne pas dépendre de l'ordre d'insertion des rôles.
MAX_ADMIN_ENTREPRISE = 2


async def _resolve_admin_role_id(db: DbSession) -> int | None:
    """Retourne l'id réel du rôle admin_entreprise (ou None s'il n'existe pas encore)."""
    # On utilise le code littéral "admin_entreprise" : l'import `Role` ici est le modèle SQL,
    # pas l'énuméré de core.permissions.
    result = await db.execute(select(Role.id).where(Role.code == "admin_entreprise"))
    return result.scalar_one_or_none()


router = APIRouter(tags=["utilisateurs"])
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
    creator_role = payload.get("role_code")
    existing = await db.execute(
        select(Utilisateur).where(
            Utilisateur.email == data.email,
            Utilisateur.is_deleted == False,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un utilisateur avec cet email existe déjà",
        )
    obj_in = data.model_dump(exclude={"password"})
    if entreprise_id is not None and not obj_in.get("entreprise_id"):
        obj_in["entreprise_id"] = entreprise_id
    from app.security import hash_password
    obj_in["mot_de_passe_hash"] = hash_password(data.password)
    if obj_in.get("role_code"):
        if obj_in["role_code"] == "super_admin" and creator_role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous ne pouvez pas créer un utilisateur avec le rôle Super Administrateur.",
            )
        role_result = await db.execute(select(Role).where(Role.code == obj_in["role_code"]))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rôle invalide: {obj_in['role_code']}",
            )
        obj_in["role_id"] = role.id
        del obj_in["role_code"]
    # Limite du nombre d'administrateurs par entreprise (id du rôle résolu dynamiquement)
    admin_role_id = await _resolve_admin_role_id(db)
    if admin_role_id is not None and obj_in.get("role_id") == admin_role_id and entreprise_id is not None:
        count_query = select(func.count()).select_from(Utilisateur).where(
            Utilisateur.entreprise_id == entreprise_id,
            Utilisateur.role_id == admin_role_id,
            Utilisateur.is_deleted == False,
        )
        current_count = (await db.execute(count_query)).scalar_one() or 0
        if current_count >= MAX_ADMIN_ENTREPRISE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Limite atteinte : maximum {MAX_ADMIN_ENTREPRISE} administrateurs par entreprise.",
            )
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
    if "email" in obj_in and obj_in["email"] != user.email:
        existing = await db.execute(
            select(Utilisateur).where(
                Utilisateur.email == obj_in["email"],
                Utilisateur.id != id,
                Utilisateur.is_deleted == False,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un utilisateur avec cet email existe déjà",
            )
    if obj_in.get("role_code"):
        role_result = await db.execute(select(Role).where(Role.code == obj_in["role_code"]))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rôle invalide: {obj_in['role_code']}",
            )
        obj_in["role_id"] = role.id
        del obj_in["role_code"]
    for field, value in obj_in.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return user


@router.put("/{id}/role", response_model=UtilisateurResponse)
async def update_utilisateur_role(payload: AdminCheck, db: DbSession, id: int, data: UtilisateurRoleUpdate):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    # Limite du nombre d'administrateurs par entreprise (id du rôle résolu dynamiquement)
    admin_role_id = await _resolve_admin_role_id(db)
    if admin_role_id is not None and data.role_id == admin_role_id and entreprise_id is not None and user.role_id != admin_role_id:
        count_query = select(func.count()).select_from(Utilisateur).where(
            Utilisateur.entreprise_id == entreprise_id,
            Utilisateur.role_id == admin_role_id,
            Utilisateur.is_deleted == False,
        )
        current_count = (await db.execute(count_query)).scalar_one() or 0
        if current_count >= MAX_ADMIN_ENTREPRISE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Limite atteinte : maximum {MAX_ADMIN_ENTREPRISE} administrateurs par entreprise.",
            )
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
