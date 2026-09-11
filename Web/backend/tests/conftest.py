"""Fixtures pytest pour les tests async (SQLite en mémoire + client HTTP FastAPI).

- `db_session` : session async liée à un SQLite en mémoire, schéma créé depuis
  Base.metadata (tous les modèles sont importés via app.models).
- `client_factory(role_code, entreprise_id=..., user_email=..., user_id=...)` :
  AsyncClient httpx avec surcharge de `get_db` (session de test partagée) et
  `get_current_user` (payload JWT simulé). Les URLs réelles commencent par /api.
"""
from contextlib import asynccontextmanager
from typing import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession

import app.models  # noqa: F401 - enregistre tous les modèles dans Base.metadata
from app.database import Base, get_db
from app.main import app
from app.security import get_current_user


class _FakeUser:
    """Doublet minimal d'un Utilisateur pour les dépendances (id, email)."""

    def __init__(self, user_id: int, email: str | None) -> None:
        self.id = user_id
        self.email = email


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)
    async with maker() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client_factory(db_session: AsyncSession):
    async def _factory(
        role_code: str,
        entreprise_id: int | None = None,
        user_email: str | None = None,
        user_id: int = 1,
    ):
        payload = {
            "sub": str(user_id),
            "role_code": role_code,
            "entreprise_id": entreprise_id,
            "user": _FakeUser(user_id, user_email),
        }

        async def _override_get_db() -> AsyncIterator[AsyncSession]:
            yield db_session

        async def _override_get_current_user() -> dict:
            return payload

        @asynccontextmanager
        async def _client_ctx() -> AsyncIterator[AsyncClient]:
            app.dependency_overrides[get_db] = _override_get_db
            app.dependency_overrides[get_current_user] = _override_get_current_user
            transport = ASGITransport(app=app)
            try:
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    yield client
            finally:
                app.dependency_overrides.pop(get_db, None)
                app.dependency_overrides.pop(get_current_user, None)

        return _client_ctx()

    return _factory
