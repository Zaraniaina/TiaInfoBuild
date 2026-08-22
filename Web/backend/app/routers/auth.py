"""Router pour l'authentification et la gestion des tokens."""
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.config import settings
from app.database import get_db
from app.security import (
    get_current_user,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    CREDENTIALS_EXCEPTION,
)
from app.models.utilisateur import Utilisateur
from app.models.historique_connexion import HistoriqueConnexion
from app.models.refresh_token import RefreshToken
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RefreshRequest,
    Token,
    ChangePasswordRequest,
    PermissionResponse,
)
from app.core.permissions import PERMISSION_MAP, Role

router = APIRouter(tags=["auth"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.post("/login", response_model=Token)
async def login(
    credentials: LoginRequest,
    db: DbSession,
    request: Request,
):
    result = await db.execute(select(Utilisateur).where(Utilisateur.email == credentials.email, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user or not verify_password(credentials.password, user.mot_de_passe_hash):
        await db.execute(
            HistoriqueConnexion.__table__.insert().values(
                utilisateur_id=None,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                reussi=False,
                date_connexion=datetime.now(),
            )
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe incorrect")

    role_code = user.role.code if user.role else Role.EMPLOYE
    permissions = PERMISSION_MAP.get(role_code, [])
    access_token = create_access_token(
        subject=user.id,
        role_code=role_code,
        entreprise_id=user.entreprise_id,
        permissions=permissions,
    )
    refresh_token = create_refresh_token(user.id)
    refresh_hash = hash_password(refresh_token)
    refresh_expires = datetime.now() + timedelta(days=settings.refresh_token_expire_days)
    db_refresh = RefreshToken(utilisateur_id=user.id, token_hash=refresh_hash, expires_at=refresh_expires)
    db.add(db_refresh)
    user.derniere_connexion = datetime.now()
    await db.execute(
        HistoriqueConnexion.__table__.insert().values(
            utilisateur_id=user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            reussi=True,
            date_connexion=datetime.now(),
        )
    )
    await db.commit()
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        user={
            "id": user.id,
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "role_code": role_code,
            "entreprise_id": user.entreprise_id,
            "statut": user.statut,
            "must_change_password": user.must_change_password,
        },
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(payload: RefreshRequest, db: DbSession):
    try:
        data = decode_token(payload.refresh_token, refresh=True)
    except HTTPException:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalide")

    user_id = int(data.get("sub", 0))
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.utilisateur_id == user_id,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(),
        )
    )
    token_obj = result.scalar_one_or_none()
    if not token_obj or not verify_password(payload.refresh_token, token_obj.token_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalide")

    token_obj.revoked = True
    user_result = await db.execute(select(Utilisateur).where(Utilisateur.id == user_id, Utilisateur.is_deleted == False))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur non trouvé")

    role_code = user.role.code if user.role else Role.EMPLOYE
    permissions = PERMISSION_MAP.get(role_code, [])
    new_access = create_access_token(user.id, role_code, user.entreprise_id, permissions)
    new_refresh = create_refresh_token(user.id)
    new_hash = hash_password(new_refresh)
    new_refresh_expires = datetime.now() + timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshToken(utilisateur_id=user.id, token_hash=new_hash, expires_at=new_refresh_expires))
    await db.commit()
    return Token(access_token=new_access, refresh_token=new_refresh, token_type="Bearer")


@router.post("/logout")
async def logout(payload: RefreshRequest, db: DbSession):
    try:
        data = decode_token(payload.refresh_token, refresh=True)
        user_id = int(data.get("sub", 0))
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.utilisateur_id == user_id, RefreshToken.revoked == False)
        )
        token_obj = result.scalar_one_or_none()
        if token_obj:
            token_obj.revoked = True
            await db.commit()
    except HTTPException:
        pass
    return {"message": "Déconnexion réussie"}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: DbSession):
    existing = await db.execute(select(Utilisateur).where(Utilisateur.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email déjà utilisé")
    from app.crud.utilisateur import UtilisateurCRUD
    crud = UtilisateurCRUD()
    obj_in = data.model_dump(exclude={"password"})
    obj_in["mot_de_passe_hash"] = hash_password(data.password)
    user = await crud.create(db, obj_in)
    await db.refresh(user)
    return {"id": user.id, "email": user.email, "message": "Inscription réussie"}


@router.post("/change-password")
async def change_password(payload: ChangePasswordRequest, db: DbSession, current_user: CurrentUser):
    user_id = int(current_user.get("sub", 0))
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.old_password, user.mot_de_passe_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ancien mot de passe incorrect")
    user.mot_de_passe_hash = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Mot de passe modifié avec succès"}


@router.get("/me")
async def get_me(current_user: CurrentUser):
    user = current_user.get("user")
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    return {
        "user": {
            "id": user.id,
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "role_code": current_user.get("role_code"),
            "entreprise_id": current_user.get("entreprise_id"),
            "statut": user.statut,
            "must_change_password": user.must_change_password,
            "date_creation": user.date_creation,
            "derniere_connexion": user.derniere_connexion,
        }
    }


@router.get("/permissions", response_model=PermissionResponse)
async def get_permissions(current_user: CurrentUser):
    role_code = current_user.get("role_code", "")
    permissions = PERMISSION_MAP.get(role_code, [])
    return PermissionResponse(role=role_code, permissions={p: True for p in permissions})
