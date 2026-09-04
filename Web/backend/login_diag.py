"""Diagnostic : reproduit le bloc de login pour isoler l'exception exacte."""
import asyncio, sys, traceback
from datetime import datetime, timedelta

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.utilisateur import Utilisateur
from app.models.refresh_token import RefreshToken
from app.models.historique_connexion import HistoriqueConnexion
from app.security import verify_password, hash_password, create_access_token, create_refresh_token
from app.core.permissions import PERMISSION_MAP, Role
from app.config import settings


async def main():
    email = sys.argv[1] if len(sys.argv) > 1 else "demo@btppro.mg"
    pwd = sys.argv[2] if len(sys.argv) > 2 else "Admin123!"
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Utilisateur).where(Utilisateur.email == email, Utilisateur.is_deleted == False))
        user = result.scalar_one_or_none()
        print("user found:", user is not None)
        if not user:
            return
        print("id:", user.id, "role_id:", user.role_id, "entreprise_id:", user.entreprise_id, "statut:", user.statut)
        print("pwd ok:", verify_password(pwd, user.mot_de_passe_hash))
        try:
            role_code = user.role.code if user.role else Role.EMPLOYE
            print("role_code:", role_code)
        except Exception:
            print("ECHEC role_code:")
            traceback.print_exc()
            return
        try:
            permissions = PERMISSION_MAP.get(role_code, [])
            access_token = create_access_token(subject=user.id, role_code=role_code, entreprise_id=user.entreprise_id, permissions=permissions)
            refresh_token = create_refresh_token(user.id)
            print("tokens OK, access len:", len(access_token))
        except Exception:
            print("ECHEC tokens:")
            traceback.print_exc()
            return
        try:
            refresh_hash = hash_password(refresh_token)
            refresh_expires = datetime.now() + timedelta(days=settings.refresh_token_expire_days)
            db_refresh = RefreshToken(utilisateur_id=user.id, token_hash=refresh_hash, expires_at=refresh_expires)
            db.add(db_refresh)
            user.derniere_connexion = datetime.now()
            print("avant insert historique_connexion")
            await db.execute(
                HistoriqueConnexion.__table__.insert().values(
                    utilisateur_id=user.id,
                    ip_address="127.0.0.1",
                    user_agent="diag",
                    reussi=True,
                    date_connexion=datetime.now(),
                )
            )
            print("avant commit")
            await db.commit()
            print("COMMIT OK")
        except Exception:
            print("ECHEC bloc commit/insert :")
            traceback.print_exc()


asyncio.run(main())