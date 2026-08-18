"""CRUD pour le modèle Utilisateur."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.utilisateur import Utilisateur
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurUpdate
from app.security import hash_password
from app.crud.base import BaseCRUD


class UtilisateurCRUD(BaseCRUD[Utilisateur]):
    def __init__(self) -> None:
        super().__init__(Utilisateur)

    async def get_by_email(self, db: AsyncSession, email: str) -> Utilisateur | None:
        result = await db.execute(select(Utilisateur).where(Utilisateur.email == email))
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, obj_in: UtilisateurCreate) -> Utilisateur:
        data = obj_in.model_dump(exclude={"password"})
        data["mot_de_passe_hash"] = hash_password(obj_in.password)
        return await super().create(db, data)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Utilisateur], int]:
        query = select(Utilisateur).where(Utilisateur.entreprise_id == entreprise_id, Utilisateur.is_deleted == False)
        count_query = select(Utilisateur.id).where(Utilisateur.entreprise_id == entreprise_id, Utilisateur.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())

    async def authenticate(self, db: AsyncSession, email: str, password: str) -> Utilisateur | None:
        user = await self.get_by_email(db, email)
        if not user:
            return None
        from app.security import verify_password
        if not verify_password(password, user.mot_de_passe_hash):
            return None
        return user
