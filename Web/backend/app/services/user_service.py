"""Service pour la gestion et la résolution des données utilisateurs et photos de profil."""
from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.utilisateur import Utilisateur
from app.models.employe import Employe
from app.models.client import Client


async def resolve_user_photo(user: Utilisateur | None, db: AsyncSession) -> str | None:
    """
    Résout la photo de profil appropriée selon la règle métier :
    - Employés (role 'employe' ou fiche Employe correspondante par email+entreprise_id) :
      héritent exclusivement de Employe.photo (RH badge).
    - Clients (role 'client' ou client_id) : photo de Client.photo ou Utilisateur.photo.
    - Super admin, Admin entreprise, Admin, Autres : photo Utilisateur.photo.
    """
    if not user:
        return None

    role_code = user.role_code

    # 1. Si rôle est 'employe' ou si l'utilisateur a une fiche Employé RH correspondante
    if role_code == "employe" or (user.email and user.entreprise_id):
        result = await db.execute(
            select(Employe).where(
                func.lower(Employe.email) == user.email.strip().lower(),
                Employe.entreprise_id == user.entreprise_id,
                Employe.is_deleted == False
            )
        )
        employe = result.scalar_one_or_none()
        if employe and employe.photo:
            return employe.photo
        if role_code == "employe":
            return user.photo

    # 2. Si client
    if role_code == "client" or user.client_id:
        if user.client_id:
            result = await db.execute(select(Client).where(Client.id == user.client_id))
            client_obj = result.scalar_one_or_none()
            if client_obj and client_obj.photo:
                return client_obj.photo

    # 3. Rôles internes web / admin / fallback
    return user.photo
