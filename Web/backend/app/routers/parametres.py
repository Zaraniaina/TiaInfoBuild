"""Router pour les paramètres et la configuration."""
from typing import Any

from fastapi import APIRouter, HTTPException, status, UploadFile, File

from app.core import file_storage
from app.core.permissions import PERMISSION_MAP, Role
from app.core.serializers import model_to_dict
from app.database import get_db
from app.models.entreprise import Entreprise
from app.models.historique_connexion import HistoriqueConnexion
from app.models.preference import Preference
from app.models.role import Role as RoleModel
from app.models.utilisateur import Utilisateur
from app.models.client import Client
from app.models.employe import Employe
from app.schemas.entreprise import EntrepriseUpdate
from app.schemas.role import RoleResponse
from app.schemas.utilisateur import UtilisateurUpdate
from app.security import CurrentUserPayload, DbDep
from app.services.user_service import resolve_user_photo
from sqlalchemy import select, func

router = APIRouter(tags=["parametres"])


def _require_permission(payload: dict[str, Any], permission: str) -> None:
    role_code = payload.get("role_code")
    if not role_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission manquante",
        )
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas la permission pour cette action",
        )


@router.get("/entreprise")
async def get_entreprise(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "parametres:read")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    result = await db.execute(select(Entreprise).where(Entreprise.id == entreprise_id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    return {"entreprise": model_to_dict(entreprise)}


@router.put("/entreprise")
async def update_entreprise(payload: CurrentUserPayload, db: DbDep, data: EntrepriseUpdate):
    _require_permission(payload, "parametres:write")
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
    return {"entreprise": model_to_dict(entreprise)}


@router.post("/entreprise/logo")
async def upload_entreprise_logo(
    payload: CurrentUserPayload,
    db: DbDep,
    fichier: UploadFile = File(...)
):
    _require_permission(payload, "parametres:write")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    result = await db.execute(select(Entreprise).where(Entreprise.id == entreprise_id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")

    try:
        url = await file_storage.save_upload(
            fichier, "entreprise-logos", file_storage.ALLOWED_PHOTO_EXT, file_storage.MAX_PHOTO_MB
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if entreprise.logo and entreprise.logo.startswith("/api/uploads/"):
        await file_storage.delete_upload(entreprise.logo)

    entreprise.logo = url
    await db.flush()
    return {"logo": url}


@router.delete("/entreprise/logo")
async def delete_entreprise_logo(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "parametres:write")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    result = await db.execute(select(Entreprise).where(Entreprise.id == entreprise_id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")

    if entreprise.logo and entreprise.logo.startswith("/api/uploads/"):
        await file_storage.delete_upload(entreprise.logo)

    entreprise.logo = None
    await db.flush()
    return {"logo": None}


@router.put("/facturation")
async def update_facturation(payload: CurrentUserPayload, db: DbDep, data: EntrepriseUpdate):
    _require_permission(payload, "parametres:write")
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
    return {"entreprise": model_to_dict(entreprise)}


@router.get("/profile")
async def get_profile(payload: CurrentUserPayload, db: DbDep):
    user_id = payload.get("sub")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == int(user_id) if user_id else 0))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    pref_result = await db.execute(select(Preference).where(Preference.user_id == user.id))
    pref = pref_result.scalar_one_or_none()

    photo = await resolve_user_photo(user, db)
    role_code = user.role_code or payload.get("role_code")
    is_employe = (role_code == "employe")

    return {
        "utilisateur": {
            "id": user.id,
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "telephone": user.telephone,
            "photo": photo,
            "role_code": role_code,
            "entreprise_id": user.entreprise_id,
            "must_change_password": user.must_change_password,
            "statut": user.statut,
            "is_employe": is_employe,
        },
        "preferences": pref,
    }


@router.put("/profile")
async def update_profile(payload: CurrentUserPayload, db: DbDep, data: UtilisateurUpdate):
    user_id = payload.get("sub")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == int(user_id) if user_id else 0))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")

    role_code = user.role_code or payload.get("role_code")
    is_employe = (role_code == "employe")

    obj_in = data.model_dump(exclude_unset=True)
    allowed_profile_fields = {"nom", "prenom", "telephone", "email"}
    if not is_employe:
        allowed_profile_fields.add("photo")

    for field, value in obj_in.items():
        if field in allowed_profile_fields and value is not None:
            setattr(user, field, value)

    # Si non employé et photo modifiée, synchroniser avec Client et Employe si applicable
    if not is_employe and "photo" in obj_in:
        new_photo = obj_in["photo"]
        if user.client_id:
            c_res = await db.execute(select(Client).where(Client.id == user.client_id))
            c_obj = c_res.scalar_one_or_none()
            if c_obj:
                c_obj.photo = new_photo
        if user.email and user.entreprise_id:
            emp_res = await db.execute(select(Employe).where(func.lower(Employe.email) == user.email.strip().lower(), Employe.entreprise_id == user.entreprise_id))
            emp_obj = emp_res.scalar_one_or_none()
            if emp_obj:
                emp_obj.photo = new_photo

    await db.flush()
    resolved_photo = await resolve_user_photo(user, db)
    return {
        "utilisateur": {
            "id": user.id,
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "telephone": user.telephone,
            "photo": resolved_photo,
            "role_code": role_code,
            "entreprise_id": user.entreprise_id,
            "must_change_password": user.must_change_password,
            "statut": user.statut,
            "is_employe": is_employe,
        }
    }


@router.post("/profile/photo")
async def upload_profile_photo(
    payload: CurrentUserPayload,
    db: DbDep,
    fichier: UploadFile = File(...)
):
    user_id = payload.get("sub")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == int(user_id) if user_id else 0))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")

    role_code = user.role_code or payload.get("role_code")
    if role_code == "employe":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La photo de profil des employés est gérée par le service RH (badge professionnel)."
        )

    try:
        url = await file_storage.save_upload(
            fichier, "profile-photos", file_storage.ALLOWED_PHOTO_EXT, file_storage.MAX_PHOTO_MB
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if user.photo and user.photo.startswith("/api/uploads/"):
        await file_storage.delete_upload(user.photo)

    user.photo = url
    if user.client_id:
        c_res = await db.execute(select(Client).where(Client.id == user.client_id))
        c_obj = c_res.scalar_one_or_none()
        if c_obj:
            c_obj.photo = url

    await db.flush()
    return {"photo": url}


@router.delete("/profile/photo")
async def delete_profile_photo(payload: CurrentUserPayload, db: DbDep):
    user_id = payload.get("sub")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == int(user_id) if user_id else 0))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")

    role_code = user.role_code or payload.get("role_code")
    if role_code == "employe":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La photo de profil des employés est gérée par le service RH (badge professionnel)."
        )

    if user.photo and user.photo.startswith("/api/uploads/"):
        await file_storage.delete_upload(user.photo)

    user.photo = None
    if user.client_id:
        c_res = await db.execute(select(Client).where(Client.id == user.client_id))
        c_obj = c_res.scalar_one_or_none()
        if c_obj:
            c_obj.photo = None

    await db.flush()
    return {"photo": None}


@router.get("/roles")
async def list_roles(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "parametres:read")
    role_code = payload.get("role_code")
    query = select(RoleModel).order_by(RoleModel.id)
    if role_code != Role.SUPER_ADMIN:
        query = query.where(RoleModel.code != "super_admin")
    result = await db.execute(query)
    roles = result.scalars().all()
    return [RoleResponse.model_validate(role) for role in roles]


@router.post("/backup")
async def create_backup(payload: CurrentUserPayload):
    _require_permission(payload, "parametres:write")
    return {"download_url": "/downloads/backup-placeholder.zip"}


@router.get("/audit-logs")
async def list_audit_logs(
    payload: CurrentUserPayload,
    db: DbDep,
    page: int = 1,
    size: int = 50,
    utilisateur_id: int | None = None,
    reussi: bool | None = None,
):
    _require_permission(payload, "parametres:read")
    entreprise_id = payload.get("entreprise_id")
    skip = (page - 1) * size

    query = select(HistoriqueConnexion).where(HistoriqueConnexion.is_deleted == False)
    if entreprise_id is not None:
        query = query.join(Utilisateur, HistoriqueConnexion.utilisateur_id == Utilisateur.id).where(Utilisateur.entreprise_id == entreprise_id)
    if utilisateur_id:
        query = query.where(HistoriqueConnexion.utilisateur_id == utilisateur_id)
    if reussi is not None:
        query = query.where(HistoriqueConnexion.reussi == reussi)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.order_by(HistoriqueConnexion.date_connexion.desc()).offset(skip).limit(size))
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": log.id,
                "utilisateur_id": log.utilisateur_id,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "reussi": log.reussi,
                "date_connexion": log.date_connexion.isoformat() if log.date_connexion else None,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "size": size,
    }
