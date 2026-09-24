"""Router pour l'authentification et la gestion des tokens."""
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
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
    create_password_reset_token,
    verify_password_reset_token,
    create_email_verification_token,
    verify_email_verification_token,
)
from app.models.utilisateur import Utilisateur
from app.models.historique_connexion import HistoriqueConnexion
from app.models.refresh_token import RefreshToken
from app.models.role import Role as RoleModel
from app.schemas.auth import (
    LoginRequest,
    DesktopActivateRequest,
    RegisterRequest,
    RefreshRequest,
    Token,
    ChangePasswordRequest,
    PermissionResponse,
    RegisterEntrepriseRequest,
    RegisterEntrepriseResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.services.email import (
    send_reset_password_email,
    send_welcome_entreprise_email,
    send_email_verification_email,
)
from app.services.user_service import resolve_user_photo
from app.core.permissions import PERMISSION_MAP, ROLE_NAMES, Role

router = APIRouter(tags=["auth"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.post("/login", response_model=Token)
async def login(
    credentials: LoginRequest,
    db: DbSession,
    request: Request,
):
    try:
        result = await db.execute(select(Utilisateur).where(Utilisateur.email == credentials.email, Utilisateur.is_deleted == False))
        user = result.scalar_one_or_none()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email ou mot de passe incorrect",
        )

    if not user or not verify_password(credentials.password, user.mot_de_passe_hash):
        try:
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
        except Exception:
            await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if user.is_email_verified is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Veuillez confirmer votre adresse email avant de vous connecter. Un email de confirmation vous a été envoyé par email.",
        )

    try:
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
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la connexion. Veuillez réessayer.",
        )
    user_photo = await resolve_user_photo(user, db)
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
            "photo": user_photo,
        },
    )


@router.post("/desktop/activate")
async def desktop_activate(
    credentials: DesktopActivateRequest,
    db: DbSession,
    request: Request,
):
    """Active un poste desktop (offline-first) — voir docs/plan-desktop-tauri.md §5.2.

    Vérifie email/mot de passe contre la table utilisateurs (logique de hash et
    messages identiques à POST /login pour empêcher l'énumération d'adresses),
    puis renvoie les mêmes tokens que le login normal, le profil minimal de
    l'utilisateur, l'heure serveur (source de vérité temporelle du desktop) et
    un petit référentiel (rôles + permissions) pour le premier seed local.

    Endpoint PUBLIC (aucun JWT requis) : la seule protection est la vérification
    des identifiants ; aucun noms d'utilisateurs n'est exposé en cas d'échec.
    """
    # 1. Recherche du compte (même requête que /login).
    try:
        result = await db.execute(
            select(Utilisateur).where(
                Utilisateur.email == credentials.email,
                Utilisateur.is_deleted == False,
            )
        )
        user = result.scalar_one_or_none()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email ou mot de passe incorrect",
        )

    # 2. Identifiants invalides (email inconnu OU mauvais mot de passe) → 401,
    #    message strictement identique au login : aucune énumération possible.
    if not user or not verify_password(credentials.password, user.mot_de_passe_hash):
        try:
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
        except Exception:
            await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    # 3. Le compte existe et le mot de passe est bon mais le compte n'est pas
    #    actif (désactivé ou email non confirmé) → 409. Accessible uniquement
    #    avec le bon mot de passe : pas d'énumération.
    if user.statut != "actif" or user.is_email_verified is False:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Aucun compte actif n'est lié à cette adresse email. Veuillez contacter votre administrateur.",
        )

    # 4. Tokens identiques au login normal (mêmes fonctions de création).
    try:
        role_code = user.role.code if user.role else Role.EMPLOYE
        permissions = PERMISSION_MAP.get(role_code, [])
        access_token = create_access_token(
            subject=user.id,
            role_code=role_code,
            entreprise_id=user.entreprise_id,
            permissions=permissions,
        )
        refresh_token = create_refresh_token(user.id)
        db.add(
            RefreshToken(
                utilisateur_id=user.id,
                token_hash=hash_password(refresh_token),
                expires_at=datetime.now() + timedelta(days=settings.refresh_token_expire_days),
            )
        )
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
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la connexion. Veuillez réessayer.",
        )

    # 5. Référentiel minimal pour le seed local (optionnel côté client : en cas
    #    de souci, l'activation reste OK et `referentiel` est simplement null).
    try:
        roles_rows = (
            await db.execute(select(RoleModel).where(RoleModel.is_deleted == False).order_by(RoleModel.id))
        ).scalars().all()
        referentiel: dict[str, Any] | None = {
            "roles": [
                {"code": r.code, "nom": r.nom, "description": r.description}
                for r in roles_rows
                if r.code != Role.SUPER_ADMIN
            ],
            "permissions": PERMISSION_MAP,
            "role_names": ROLE_NAMES,
        }
    except Exception:
        referentiel = None

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "entreprise_id": user.entreprise_id,
        "user": {
            "id": user.id,
            "email": user.email,
            "nom": user.nom,
            "prenom": user.prenom,
            "role": role_code,
        },
        "server_time": datetime.now(timezone.utc).isoformat(),
        "referentiel": referentiel,
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(payload: RefreshRequest, db: DbSession):
    try:
        data = decode_token(payload.refresh_token, refresh=True)
    except HTTPException:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalide")

    user_id = int(data.get("sub", 0))
    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.utilisateur_id == user_id,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(),
        )
        .order_by(RefreshToken.created_at.desc())
        .limit(1)
    )
    token_obj = result.scalar_one_or_none()
    if not token_obj or not verify_password(payload.refresh_token, token_obj.token_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalide")

    token_obj.revoked = True
    user_result = await db.execute(
        select(Utilisateur).where(
            Utilisateur.id == user_id,
            Utilisateur.is_deleted == False,
        )
    )
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
            select(RefreshToken)
            .where(RefreshToken.utilisateur_id == user_id, RefreshToken.revoked == False)
            .order_by(RefreshToken.created_at.desc())
            .limit(1)
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
    # Pas de db.refresh(user) : l'id est déjà renseigné après le flush, et un refresh
    # chargerait en eager toutes les relations selectin (chantiers, clients, etc.) et
    # échouerait en 500 si une seule colonne manque dans une table liée.
    return {"id": user.id, "email": user.email, "message": "Inscription réussie"}


@router.post("/register-entreprise", response_model=RegisterEntrepriseResponse, status_code=status.HTTP_201_CREATED)
async def register_entreprise(
    data: RegisterEntrepriseRequest,
    db: DbSession,
    request: Request,
    background_tasks: BackgroundTasks,
):
    from app.crud.role import RoleCRUD
    from app.models.entreprise import Entreprise

    try:
        existing_email = await db.execute(select(Utilisateur).where(Utilisateur.email == data.admin_email))
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un utilisateur avec cette adresse email existe déjà.",
            )

        entreprise = Entreprise(
            nom=data.nom_entreprise,
            email=data.entreprise_email or data.admin_email,
            adresse=data.adresse,
            telephone=data.telephone,
            abonnement="essai",
        )
        db.add(entreprise)
        await db.flush()

        # Essai gratuit automatique (30 jours, accès complet) — anti-essai infini
        # intégré : une entreprise ne repart jamais un 2e essai.
        from app.services.subscription_state import demarrer_essai
        await demarrer_essai(db, entreprise.id)

        role_crud = RoleCRUD()
        admin_role = await role_crud.get_by_code(db, Role.ADMIN_ENTREPRISE)
        if not admin_role:
            admin_role = Role(
                code=Role.ADMIN_ENTREPRISE,
                nom="Admin Entreprise",
                description="Administrateur de l'entreprise",
                permissions={"*": True},
                is_system=True,
            )
            db.add(admin_role)
            await db.flush()

        role_code = admin_role.code
        hashed_password = hash_password(data.password)
        admin_user = Utilisateur(
            entreprise_id=entreprise.id,
            role_id=admin_role.id,
            nom=data.admin_nom,
            prenom=data.admin_prenom,
            email=data.admin_email,
            mot_de_passe_hash=hashed_password,
            statut="actif",
            is_email_verified=False,
        )
        db.add(admin_user)
        await db.flush()

        await db.commit()

        # Envoi de l'email de confirmation en tâche de fond (non bloquant)
        # Config SMTP résolue AVANT la tâche (la session db est fermée dans BackgroundTasks)
        from app.services.mail_config import get_effective_smtp_config
        verification_token = create_email_verification_token(admin_user.email)
        admin_fullname = f"{admin_user.prenom or ''} {admin_user.nom or ''}".strip()
        try:
            _smtp_cfg = await get_effective_smtp_config(db)
        except Exception:
            _smtp_cfg = await get_effective_smtp_config(None)
        background_tasks.add_task(
            send_email_verification_email,
            to_email=admin_user.email,
            verification_token=verification_token,
            admin_nom=admin_fullname,
            entreprise_nom=entreprise.nom,
            smtp_config=_smtp_cfg,
        )

        return RegisterEntrepriseResponse(
            entreprise_id=entreprise.id,
            utilisateur_id=admin_user.id,
            email=admin_user.email,
            role_code=role_code,
            message="Entreprise créée avec succès. Un email de confirmation vous a été envoyé pour activer votre compte.",
        )
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        import logging, traceback
        logging.getLogger(__name__).error(f"Erreur lors de la création d'entreprise: {exc}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de créer l'entreprise : {str(exc)}",
        )


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: DbSession, background_tasks: BackgroundTasks):
    """Demande un lien de réinitialisation de mot de passe envoyé par email."""
    result = await db.execute(
        select(Utilisateur).where(
            Utilisateur.email == payload.email,
            Utilisateur.is_deleted == False,
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun compte enregistré avec cette adresse email.",
        )

    if user.statut != "actif":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte est désactivé. Veuillez contacter votre administrateur.",
        )

    reset_token = create_password_reset_token(user.email)
    user_name = f"{user.prenom or ''} {user.nom or ''}".strip()
    from app.services.mail_config import get_effective_smtp_config as _get_cfg
    try:
        _smtp_cfg2 = await _get_cfg(db)
    except Exception:
        _smtp_cfg2 = await _get_cfg(None)
    background_tasks.add_task(
        send_reset_password_email,
        to_email=user.email,
        reset_token=reset_token,
        user_name=user_name,
        smtp_config=_smtp_cfg2,
    )

    return {
        "message": "Un lien de réinitialisation vous a été envoyé par email. Veuillez vérifier votre boîte de réception."
    }


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: DbSession):
    """Réinitialise le mot de passe via un token JWT valide."""
    email = verify_password_reset_token(payload.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le lien de réinitialisation est invalide ou a expiré.",
        )

    result = await db.execute(
        select(Utilisateur).where(
            Utilisateur.email == email,
            Utilisateur.is_deleted == False,
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé ou compte désactivé.",
        )

    user.mot_de_passe_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.commit()

    return {
        "message": "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter."
    }


@router.get("/verify-email")
async def verify_email(token: str, db: DbSession):
    """Valide l'adresse email d'un utilisateur grâce au token JWT de vérification."""
    email = verify_email_verification_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le lien de confirmation est invalide ou a expiré.",
        )

    result = await db.execute(
        select(Utilisateur).where(
            Utilisateur.email == email,
            Utilisateur.is_deleted == False,
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé ou compte supprimé.",
        )

    if user.is_email_verified:
        return {"message": "Votre adresse email est déjà confirmée. Vous pouvez vous connecter."}

    user.is_email_verified = True
    await db.commit()

    return {
        "message": "Votre adresse email a été confirmée avec succès. Vous pouvez maintenant vous connecter."
    }


@router.post("/change-password")
async def change_password(payload: ChangePasswordRequest, db: DbSession, current_user: CurrentUser):
    user_id = int(current_user.get("sub", 0))
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.old_password, user.mot_de_passe_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ancien mot de passe incorrect")
    user.mot_de_passe_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.commit()
    return {
        "message": "Mot de passe modifié avec succès",
        "user": {
            "id": user.id,
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "role_code": current_user.get("role_code"),
            "entreprise_id": current_user.get("entreprise_id"),
            "must_change_password": False,
        }
    }


@router.get("/me")
async def get_me(current_user: CurrentUser, db: DbSession):
    user = current_user.get("user")
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    user_photo = await resolve_user_photo(user, db)
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
            "photo": user_photo,
            "date_creation": user.date_creation.isoformat() if user.date_creation else None,
            "derniere_connexion": user.derniere_connexion.isoformat() if user.derniere_connexion else None,
        }
    }


@router.get("/permissions", response_model=PermissionResponse)
async def get_permissions(current_user: CurrentUser):
    role_code = current_user.get("role_code", "")
    permissions = PERMISSION_MAP.get(role_code, [])
    return PermissionResponse(role=role_code, permissions={p: True for p in permissions})
