"""Couche base de données async (SQLAlchemy 2.0 + aiomysql)."""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

import aiomysql
import pymysql

# Correctif de compatibilité Python 3.14 / aiomysql :
# Empêche AttributeError: 'NoneType' object has no attribute 'send'
# lors du ping/recycle des connexions inactives dans le pool SQLAlchemy.
_orig_aiomysql_ping = aiomysql.Connection.ping
_orig_aiomysql_ensure_closed = aiomysql.Connection.ensure_closed


async def _safe_aiomysql_ping(self, reconnect=True):
    try:
        writer = getattr(self, "_writer", None)
        if writer is None or getattr(writer, "_transport", None) is None:
            raise pymysql.OperationalError(2006, "Connection is closed (no transport)")
        loop = getattr(self, "_loop", None)
        if loop is None or (getattr(loop, "_proactor", None) is None and hasattr(loop, "_proactor")):
            raise pymysql.OperationalError(2006, "Connection event loop closed")
        return await _orig_aiomysql_ping(self, reconnect=reconnect)
    except (pymysql.OperationalError, pymysql.InterfaceError):
        raise
    except Exception as exc:
        raise pymysql.OperationalError(2006, f"MySQL server has gone away ({exc})") from exc


async def _safe_aiomysql_ensure_closed(self):
    try:
        await _orig_aiomysql_ensure_closed(self)
    except Exception:
        pass


_orig_aiomysql_close = aiomysql.Connection.close


def _safe_aiomysql_close(self):
    try:
        _orig_aiomysql_close(self)
    except Exception:
        pass


aiomysql.Connection.ping = _safe_aiomysql_ping
aiomysql.Connection.ensure_closed = _safe_aiomysql_ensure_closed
aiomysql.Connection.close = _safe_aiomysql_close


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
