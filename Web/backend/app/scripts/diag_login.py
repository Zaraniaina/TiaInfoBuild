"""Diagnostic rapide pour l'authentification demo@btppro.mg."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.utilisateur import Utilisateur
from app.security import verify_password, hash_password

TEST_EMAIL = "demo@btppro.mg"
TEST_PASSWORD = "Admin123!"

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Utilisateur).where(Utilisateur.email == TEST_EMAIL, Utilisateur.is_deleted == False)
        )
        user = result.scalar_one_or_none()
        if not user:
            print(f"UTILISATEUR NON TROUVE: {TEST_EMAIL}")
            return

        print(f"Utilisateur trouve: id={user.id}, email={user.email}, statut={user.statut}, is_deleted={user.is_deleted}")
        print(f"role_id={user.role_id}, entreprise_id={user.entreprise_id}")
        print(f"mot_de_passe_hash (debut): {user.mot_de_passe_hash[:40]}...")
        print(f"must_change_password={user.must_change_password}")

        ok = verify_password(TEST_PASSWORD, user.mot_de_passe_hash)
        print(f"Verification mot de passe: {ok}")

        new_hash = hash_password(TEST_PASSWORD)
        print(f"Nouveau hash (debut): {new_hash[:40]}...")
        print(f"Verification avec nouveau hash: {verify_password(TEST_PASSWORD, new_hash)}")

        if user.role:
            print(f"Role: {user.role.code} / {user.role.nom}")
        else:
            print("Role: None (pas charge)")

if __name__ == "__main__":
    asyncio.run(main())
