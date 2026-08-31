"""Script de création du premier Super Admin."""
import asyncio
import sys
import secrets
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.database import engine
from app.models.utilisateur import Utilisateur
from app.models.role import Role
from app.security import hash_password
from sqlalchemy import text
import argparse


async def create_super_admin(email: str, password: str, nom: str = "Super Admin") -> None:
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT id FROM roles WHERE code = 'super_admin'"))
        role_row = result.fetchone()
        if not role_row:
            raise RuntimeError("Rôle super_admin non trouvé. Exécutez d'abord init_db.py")

        user_result = await conn.execute(
            text("SELECT id FROM utilisateurs WHERE email = :email"),
            {"email": email},
        )
        if user_result.fetchone():
            print(f"  Utilisateur {email} existe déjà")
            return

        await conn.execute(
            text(
                "INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe_hash, role_id, entreprise_id, statut, date_creation, created_at, updated_at) "
                "VALUES (:nom, :prenom, :email, :password_hash, :role_id, NULL, 'actif', NOW(), NOW(), NOW())"
            ),
            {
                "nom": nom,
                "prenom": None,
                "email": email,
                "password_hash": hash_password(password),
                "role_id": role_row[0],
            },
        )
    print(f" Super Admin créé: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Créer le premier Super Admin")
    parser.add_argument("--email", required=True, help="Email du super admin")
    parser.add_argument("--password", required=True, help="Mot de passe du super admin")
    parser.add_argument("--nom", default="Super Admin", help="Nom du super admin")
    args = parser.parse_args()
    asyncio.run(create_super_admin(args.email, args.password, args.nom))
