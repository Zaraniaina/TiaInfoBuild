"""Couche base de données async (SQLAlchemy 2.0 + aiomysql)."""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """Classe de base déclarative pour tous les modèles."""


engine = create_async_engine(
    settings.database_url,
    # Volontairement decouple de app_debug : l'echo SQL logue chaque requete ET
    # les lignes de resultats, ce qui multiplie le temps de reponse par 10 ou
    # plus. Activer uniquement via DATABASE_ECHO=True pour un debug ponctuel.
    echo=settings.db_echo,
    pool_pre_ping=True,
    pool_recycle=3600,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dépendance FastAPI: fournit une session de base de données async."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
