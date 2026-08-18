"""Script d'initialisation de la base de données: création du schéma et seed des rôles."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.database import engine, Base
from app.models.role import Role
from app.core.permissions import Role, PERMISSION_MAP, ROLE_NAMES
from app.security import hash_password
from sqlalchemy import text


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Schema created")

    async with engine.begin() as conn:
        for code, permissions in PERMISSION_MAP.items():
            result = await conn.execute(text("SELECT id FROM roles WHERE code = :code"), {"code": code})
            row = result.fetchone()
            if not row:
                await conn.execute(
                    text(
                        "INSERT INTO roles (nom, code, permissions, is_system) VALUES (:nom, :code, :permissions, :is_system)"
                    ),
                    {
                        "nom": ROLE_NAMES.get(code, code),
                        "code": code,
                        "permissions": str(permissions).replace("'", '"'),
                        "is_system": True,
                    },
                )
    print("✅ Roles seeded")


if __name__ == "__main__":
    asyncio.run(init_db())
