# POC sidecar : lance la VRAIE API FastAPI du backend (tous les routers métier)
# sur une base SQLite locale chiffrée au repos par SQLCipher (ouvrée par le Rust).
# Offline-first : 100 % local, zéro dépendance réseau.
#
# Usage : python desktop_sidecar.py [--port 8765]
#   TIA_DB_URL : override de l'URL SQLite (tests). Défaut : %APPDATA%/tia-info-build/local_api.db
import os
import sys
import socket
import asyncio

# 1) Pré-requis AVANT l'import de app.* : moteur SQLite local (les variables
#    d'environnement priment sur le .env lu par pydantic-settings).
os.environ.setdefault("TIA_DESKTOP", "1")
if not os.environ.get("TIA_DB_URL"):
    _appdata = os.environ.get("APPDATA") or os.path.expanduser("~")
    _db_path = os.path.join(_appdata, "tia-info-build", "local_api.db")
    os.environ["TIA_DB_URL"] = _db_path
# Créer le dossier parent dans tous les cas (TIA_DB_URL peut pointer ailleurs
# quand le process est lancé par le shell Tauri).
os.makedirs(os.path.dirname(os.environ["TIA_DB_URL"]), exist_ok=True)
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{os.environ['TIA_DB_URL'].replace(os.sep, '/')}"

_patch_sqlite_applique = False


def _assurer_patch_sqlite() -> None:
    """Adapte les modèles MySQL à SQLite — process sidecar uniquement, aucun modèle touché."""
    global _patch_sqlite_applique
    if _patch_sqlite_applique:
        return
    from sqlalchemy import BigInteger, Integer
    from sqlalchemy.ext.compiler import compiles

    # (a) Rendu DDL : BigInteger -> INTEGER pour sqlite.
    @compiles(BigInteger, "sqlite")
    def _bigint_vers_int(type_, compiler, **kw):
        return "INTEGER"

    # (b) Auto-incrément : SQLite n'alias le rowid que pour INTEGER PRIMARY KEY.
    #     Les PK BigInteger deviennent Integer dans les métadonnées.
    import app.models  # noqa: F401
    from app.database import Base

    for table in Base.metadata.tables.values():
        for col in table.columns:
            if col.primary_key and isinstance(col.type, BigInteger):
                col.type = Integer()
    _patch_sqlite_applique = True


def _port_libre() -> int:
    """Port TCP libre sur 127.0.0.1 (évite les collisions au démarrage)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def _preparer_base() -> None:
    """Crée les tables depuis les modèles (source de vérité) + PRAGMA SQLite + seed ORM."""
    _assurer_patch_sqlite()
    from sqlalchemy import event, select

    import app.models  # noqa: F401 — enregistre tous les modèles dans Base.metadata
    from app.database import Base, engine, AsyncSessionLocal

    @event.listens_for(engine.sync_engine, "connect")
    def _pragmas(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed minimal idempotent VIA LES MODÈLES ORM : les défauts Python
    # (is_deleted, created_at, etc.) sont ainsi remplis correctement.
    from app.security import hash_password
    from app.scripts.init_db import (
        ROLES_SYSTEME,
        ENTREPRISE_TEST,
        SUPER_ADMIN,
        ADMIN_ENTREPRISE,
        PLANS_DEFAUT,
        MOT_DE_PASSE_DEMO,
        TEST_ACCOUNTS,
    )
    from app.models.role import Role
    from app.models.entreprise import Entreprise
    from app.models.plan import Plan
    from app.models.utilisateur import Utilisateur

    async with AsyncSessionLocal() as db:
        # 1) Rôles système (par code)
        codes = set((await db.execute(select(Role.code))).scalars())
        for role in ROLES_SYSTEME:
            if role["code"] not in codes:
                db.add(Role(**role))
        await db.flush()

        # 2) Entreprise de test
        ent = (
            await db.execute(
                select(Entreprise).where(Entreprise.nom == ENTREPRISE_TEST["nom"]).limit(1)
            )
        ).scalar_one_or_none()
        if ent is None:
            ent = Entreprise(**ENTREPRISE_TEST)
            db.add(ent)
            await db.flush()
        entreprise_id = ent.id

        # 3) Plans d'abonnement (essai + gratuit)
        codes_plans = set((await db.execute(select(Plan.code))).scalars())
        for plan in PLANS_DEFAUT:
            if plan["code"] not in codes_plans:
                db.add(Plan(**plan))

        # 4) Super admin + admin entreprise
        for compte, avec_entreprise in ((SUPER_ADMIN, False), (ADMIN_ENTREPRISE, True)):
            u = (
                await db.execute(select(Utilisateur).where(Utilisateur.email == compte["email"]))
            ).scalar_one_or_none()
            if u is None:
                db.add(
                    Utilisateur(
                        **{
                            **compte,
                            "mot_de_passe_hash": hash_password(MOT_DE_PASSE_DEMO),
                            "entreprise_id": entreprise_id if avec_entreprise else None,
                        }
                    )
                )

        # 5) Comptes de test par rôle métier
        roles_par_id = dict((await db.execute(select(Role.id, Role.code))).all())
        for role_id, email, nom, prenom, _code in TEST_ACCOUNTS:
            u = (
                await db.execute(select(Utilisateur).where(Utilisateur.email == email))
            ).scalar_one_or_none()
            if u is None:
                db.add(
                    Utilisateur(
                        email=email,
                        nom=nom,
                        prenom=prenom,
                        mot_de_passe_hash=hash_password(MOT_DE_PASSE_DEMO),
                        statut="actif",
                        must_change_password=False,
                        role_id=role_id,
                        entreprise_id=entreprise_id,
                    )
                )
        await db.commit()


def main() -> None:
    port = 0
    args = sys.argv[1:]
    if "--port" in args:
        port = int(args[args.index("--port") + 1])
    if port == 0:
        port = _port_libre()

    asyncio.run(_preparer_base())

    # Import direct de l'app (et non "app.main:app" en string) : PyInstaller
    # inclut ainsi statiquement toute l'API (routers, modèles) dans l'exécutable.
    from app.main import app as fastapi_app
    import uvicorn

    # Ligne contractuelle lue par le Rust pour détecter la disponibilité.
    print(f"TIA_API_READY port={port}", flush=True)

    uvicorn.run(
        fastapi_app,
        host="127.0.0.1",
        port=port,
        reload=False,
        workers=1,
        log_level="info",
    )


if __name__ == "__main__":
    main()
