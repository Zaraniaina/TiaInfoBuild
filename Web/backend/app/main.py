"""TIA INFO BUILD - Backend FastAPI
Point d'entrée principal: application, routers, middleware, CORS.
"""
from datetime import datetime, date
from decimal import Decimal

import fastapi.encoders as _encoders

# Patch : évite la récursion infinie de jsonable_encoder sur les objets SQLAlchemy
# (relations circulaires ex: Utilisateur.role <-> Role.utilisateurs).
# On ne sérialise que les colonnes, pas les relations.
# On convertit datetime/date/Decimal en types JSON-sérialisables.
# On patche AUSSI les modules qui ont déjà importé jsonable_encoder avant nous.
_original_jsonable_encoder = _encoders.jsonable_encoder


def _valeur_json(v):
    """Convertit une valeur en type JSON-sérialisable."""
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    return v


def _safe_jsonable_encoder(obj, **kwargs):
    # Éviter la récursion sur les objets déjà visités via id()
    seen = kwargs.pop("_seen", None)
    if seen is None:
        seen = set()

    if hasattr(obj, "__table__"):
        obj_id = id(obj)
        if obj_id in seen:
            return str(obj)  # référence circulaire -> représentation textuelle
        seen.add(obj_id)
        try:
            return {c.name: _valeur_json(getattr(obj, c.name)) for c in obj.__table__.columns}
        except Exception:
            return str(obj)
    if isinstance(obj, dict):
        return {k: _safe_jsonable_encoder(v, _seen=seen) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_safe_jsonable_encoder(item, _seen=seen) for item in obj]
    if isinstance(obj, (datetime, date, Decimal)):
        return _valeur_json(obj)
    return _original_jsonable_encoder(obj, **kwargs)


_encoders.jsonable_encoder = _safe_jsonable_encoder
import sys as _sys
for _m in list(_sys.modules.values()):
    if getattr(_m, "jsonable_encoder", None) is _original_jsonable_encoder:
        setattr(_m, "jsonable_encoder", _safe_jsonable_encoder)

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine
from app.middleware import CacheControlMiddleware, LoggingMiddleware, MultiTenantMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events: startup et shutdown."""
    # Startup: tester la connexion DB
    try:
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print(" Database connection OK")
    except Exception as exc:
        print(f" Database connection failed: {exc}")
    # Startup: detecter la derive de schema (modeles vs base) avant qu'elle ne
    # casse le login ou d'autres endpoints en production (erreur 1054 / 500).
    try:
        await _verifier_derive_schema()
    except Exception as exc:
        print(f" Schema drift check failed: {exc}")
    yield
    # Shutdown: fermer le pool
    await engine.dispose()
    print(" Database disconnected")


async def _verifier_derive_schema():
    """Compare les modeles SQLAlchemy au schema MySQL reel et journalise les ecarts."""
    from sqlalchemy import inspect
    import app.models  # noqa: F401 (enregistre tous les modeles dans Base.metadata)
    from app.database import Base

    def _compare(sync_conn):
        insp = inspect(sync_conn)
        db_tables = set(insp.get_table_names())
        missing_tables = []
        missing_cols = []
        for table_name, table in Base.metadata.tables.items():
            if table_name not in db_tables:
                missing_tables.append(table_name)
                continue
            cols = {c["name"] for c in insp.get_columns(table_name)}
            for col in table.columns:
                if col.name not in cols:
                    missing_cols.append(f"{table_name}.{col.name}")
        return missing_tables, missing_cols

    async with engine.connect() as conn:
        missing_tables, missing_cols = await conn.run_sync(_compare)

    if missing_tables or missing_cols:
        print(" ATTENTION: derive de schema detectee (modeles vs base de donnees).")
        print("   Tables manquantes :" + (", ".join(missing_tables) or " aucune"))
        print("   Colonnes manquantes :" + (", ".join(missing_cols) or " aucune"))
        print("   -> Executer: alembic upgrade head  (ou python compare_schema.py pour le rapport complet)")
    else:
        print(" Schema OK: aucun ecart entre les modeles et la base de donnees")


app = FastAPI(
    title=settings.app_name,
    description="API REST pour TIA Info Build — Gestion BTP",
    version="1.0.0",
    debug=settings.app_debug,
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(LoggingMiddleware)
app.add_middleware(MultiTenantMiddleware)
app.add_middleware(CacheControlMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}


@app.get("/", tags=["root"])
async def root():
    return {
        "message": f"Bienvenue sur {settings.app_name}",
        "docs": "/docs",
        "health": "/health",
    }


# Inclusion des routers
from app.routers import auth, super_admin, chantiers, rh, stocks, commercial, finance, materiels, alertes, dashboard, parametres, sync, utilisateurs, preferences, subscriptions, espace_client

api_prefix = "/api"

app.include_router(auth.router, prefix=f"{api_prefix}/auth", tags=["auth"])
app.include_router(super_admin.router, prefix=f"{api_prefix}/super-admin", tags=["super-admin"])
app.include_router(utilisateurs.router, prefix=f"{api_prefix}/utilisateurs", tags=["utilisateurs"])
app.include_router(dashboard.router, prefix=f"{api_prefix}/dashboard", tags=["dashboard"])
app.include_router(chantiers.router, prefix=f"{api_prefix}/chantiers", tags=["chantiers"])
app.include_router(rh.router, prefix=f"{api_prefix}/rh", tags=["rh"])
app.include_router(stocks.router, prefix=f"{api_prefix}/stocks", tags=["stocks"])
app.include_router(commercial.router, prefix=f"{api_prefix}/commercial", tags=["commercial"])
app.include_router(finance.router, prefix=f"{api_prefix}/finance", tags=["finance"])
app.include_router(materiels.router, prefix=f"{api_prefix}/materiels", tags=["materiels"])
app.include_router(alertes.router, prefix=f"{api_prefix}/alertes", tags=["alertes"])
app.include_router(parametres.router, prefix=f"{api_prefix}/parametres", tags=["parametres"])
app.include_router(preferences.router, prefix=f"{api_prefix}/preferences", tags=["preferences"])
app.include_router(sync.router, prefix=f"{api_prefix}/sync", tags=["sync"])
app.include_router(subscriptions.router, prefix=f"{api_prefix}/subscriptions", tags=["subscriptions"])
app.include_router(espace_client.router, prefix=f"{api_prefix}/espace-client", tags=["espace-client"])


# --- Handlers d'exceptions globaux ---

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Capture toutes les exceptions non gérées et retourne un message générique sans exposer de stack trace."""
    import logging
    logger = logging.getLogger("tia")
    logger.error("Erreur non gérée sur %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur interne est survenue. Veuillez réessayer ou contacter le support."},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Garantit que les HTTPException retournent toujours un message clair."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )
