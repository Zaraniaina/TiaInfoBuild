"""TIA INFO BUILD - Backend FastAPI
Point d'entrée principal: application, routers, middleware, CORS.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine


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
    yield
    # Shutdown: fermer le pool
    await engine.dispose()
    print("🔌 Database disconnected")


app = FastAPI(
    title=settings.app_name,
    description="API REST pour TIA Info Build — Gestion BTP",
    version="1.0.0",
    debug=settings.app_debug,
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

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
from app.routers import auth, super_admin, chantiers, rh, stocks, commercial, finance, materiels, alertes, dashboard, parametres, sync, utilisateurs

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
app.include_router(sync.router, prefix=f"{api_prefix}/sync", tags=["sync"])
