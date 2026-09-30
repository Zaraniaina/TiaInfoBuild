# Sidecar desktop : lance la VRAIE API FastAPI du backend (tous les routers
# métier) dans l'app desktop Tauri — moteur du mode « web cerveaux, desktop
# offline-first ».
#
# Deux modes, choisis par la présence de TIA_DB_KEY :
#   * CHIFFRÉ (TIA_DB_KEY = 64 hex, fourni par le Rust) : la base est SQLCipher,
#     par défaut LA BASE PARTAGÉE de l'app (`%APPDATA%/tia-info-build/tia.db`,
#     même fichier que les hubs Rust). Le driver sqlite3 est remplacé par
#     sqlcipher3 (sys.modules) avant tout import d'aiosqlite, et `PRAGMA key`
#     est appliqué à CHAQUE connexion immédiatement après ouverture.
#   * CLAIR (sans clé — tests/démo, comportement historique du POC) : SQLite
#     standard sur `%APPDATA%/tia-info-build/local_api.db`.
#
# Journal de synchronisation (_sync_outbox) : des hooks SQLAlchemy journalisent
# toute écriture métier de l'API locale DANS LA MÊME transaction — le hub Rust
# `sync_run` pousse ensuite ces opérations vers le web et tire le delta web →
# desktop (contrat bidirectionnel, `desktop/src-tauri/src/sync.rs`).
#
# Auth locale : `POST /api/auth/local-login` délivre un token signé par CE
# process (vérification contre la base locale) et `get_current_user` est
# overridé pour charger l'utilisateur depuis la base locale — le JWT web
# (clé secrète web) ne peut pas authentifier l'API embarquée offline.
#
# Contrat avec le Rust (`desktop/src-tauri/src/sidecar.rs`) :
#   * la clé arrive par stdin (1re ligne) ET en env TIA_DB_KEY (filet) ;
#   * ce process imprime `TIA_API_READY port=N` dès que l'API écoute.
#
# Usage : python desktop_sidecar.py [--port 8765]
#   TIA_DB_KEY  : clé SQLCipher (hex 64) — mode chiffré partagé.
#   TIA_DB_URL  : override du chemin de la base.
#   TIA_SEED=1  : forcer le seed des comptes de démo (mode chiffré : OFF car
#                 la base réelle contient les données de l'entreprise).
import json
import os
import sys
import socket
import asyncio
import datetime as _dt
import uuid as _uuid

# 1) Pré-requis AVANT l'import de app.* : les variables d'environnement priment
#    sur le .env lu par pydantic-settings.
os.environ.setdefault("TIA_DESKTOP", "1")

_HEX = set("0123456789abcdef")


def _cle_valide(cle: str) -> bool:
    return len(cle) == 64 and all(c in _HEX for c in cle)


# Connect SQLCipher NON patché (sauvé par _brancher_sqlcipher) : requis pour
# la conversion de base claire, qui pose ses propres PRAGMA key explicites.
_CONNECT_BRUT = None


def _brancher_sqlcipher(cle: str) -> None:
    """Remplace le module sqlite3 par sqlcipher3 AVANT tout import d'aiosqlite.

    aiosqlite (et le dialecte SQLAlchemy `sqlite+aiosqlite`) font `import
    sqlite3` puis appellent `sqlite3.connect(...)` : ils recevront donc le
    driver chiffré. Le patch de `connect` applique `PRAGMA key` immédiatement
    après chaque ouverture — SQLCipher exige que la clé précède TOUTE
    instruction, quelle qu'elle soit (celle de SQLAlchemy comprise).
    """
    import sqlcipher3.dbapi2

    _connect_orig = sqlcipher3.dbapi2.connect

    def _connect_avec_cle(*args, **kwargs):
        conn = _connect_orig(*args, **kwargs)
        # Forme "clé brute" de SQLCipher : un littéral CHAÎNE dont le contenu
        # est x'<64 hex>' (apostrophes internes doublées pour la grammaire).
        # PRAGMA = ? (binding) et PRAGMA = x'…' (littéral blob direct) sont
        # refusés par la grammaire PRAGMA de SQLite.
        conn.execute(f"PRAGMA key = 'x''{cle}'''")
        return conn

    sqlcipher3.dbapi2.connect = _connect_avec_cle
    global _CONNECT_BRUT
    _CONNECT_BRUT = _connect_orig
    sys.modules["sqlite3"] = sqlcipher3.dbapi2


def _lire_cle() -> str:
    """Clé SQLCipher : stdin d'abord (canal Rust, non visible dans les listes
    de process), env TIA_DB_KEY en filet. stdin lu uniquement s'il est pipé
    (jamais bloquant dans un terminal interactif)."""
    if sys.stdin is not None and not sys.stdin.isatty():
        ligne = sys.stdin.readline().strip().lower()
        if _cle_valide(ligne):
            return ligne
    return (os.environ.get("TIA_DB_KEY") or "").strip().lower()


def _resoudre_base() -> None:
    """Mode (clair/chiffré) + chemin de la base + DATABASE_URL, avant app.*."""
    brut = _lire_cle()
    if brut and not _cle_valide(brut):
        raise SystemExit(
            "TIA_DB_KEY invalide : 64 caractères hexadécimaux attendus (32 octets)."
        )
    chiffre = bool(brut)

    if chiffre:
        _brancher_sqlcipher(brut)

    if not os.environ.get("TIA_DB_URL"):
        dossier = os.path.join(
            os.environ.get("APPDATA") or os.path.expanduser("~"), "tia-info-build"
        )
        os.makedirs(dossier, exist_ok=True)
        # Mode chiffré : la base PARTAGÉE de l'app (mêmes données que le Rust).
        nom = "tia.db" if chiffre else "local_api.db"
        os.environ["TIA_DB_URL"] = os.path.join(dossier, nom)
    os.makedirs(os.path.dirname(os.environ["TIA_DB_URL"]), exist_ok=True)
    os.environ["DATABASE_URL"] = (
        f"sqlite+aiosqlite:///{os.environ['TIA_DB_URL'].replace(os.sep, '/')}"
    )


def _convertir_si_claire(chemin: str, cle: str) -> None:
    """Convertit en place une base claire héritée vers SQLCipher (même méthode
    que le Rust : ATTACH … KEY + sqlcipher_export). Un fichier absent/vide ou
    déjà chiffré est laissé tel quel."""
    if not os.path.exists(chemin) or os.path.getsize(chemin) == 0:
        return
    with open(chemin, "rb") as f:
        if f.read(16) != b"SQLite format 3\x00":
            return  # déjà chiffrée (ou corrompue : PRAGMA key tranchera)

    import sqlcipher3.dbapi2 as drv

    # CONNECT BRUT (sans le patch PRAGMA key global) : la base claire doit
    # être ouverte SANS aucune clé (le codec ne s'active qu'à la première
    # clé posée).
    connect_brut = _CONNECT_BRUT or drv.connect

    cible = chemin + ".chiffre"
    if os.path.exists(cible):
        os.remove(cible)
    claire = connect_brut(chemin)
    try:
        # Base claire : AUCUN PRAGMA key (le driver wetzel refuse la clé vide :
        # « PRAGMA key requires a key of one or more characters ») — le codec
        # ne s'active qu'à la première clé posée, la base reste donc lisible.
        user_version = claire.execute("PRAGMA user_version").fetchone()[0]
        chemin_sql = cible.replace("'", "''")
        # Voie validée empiriquement sur ce driver : ATTACH cible avec clause
        # KEY inline (forme 'x''hex'''), export, puis user_version préservée.
        claire.execute(f"ATTACH DATABASE '{chemin_sql}' AS chiffre KEY 'x''{cle}'''")
        claire.execute("SELECT sqlcipher_export('chiffre')")
        claire.execute(f"PRAGMA chiffre.user_version = {int(user_version)}")
        claire.execute("DETACH DATABASE chiffre")
    finally:
        claire.close()

    controle = connect_brut(cible)
    try:
        controle.execute(f"PRAGMA key = 'x''{cle}'''")
        controle.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()
    finally:
        controle.close()

    os.remove(chemin)
    for suffixe in ("-wal", "-shm", "-journal"):
        if os.path.exists(chemin + suffixe):
            os.remove(chemin + suffixe)
    os.rename(cible, chemin)


# ============================================================
# Journal de synchronisation desktop ↔ web (_sync_outbox)
# ============================================================
# Contrat avec les hubs Rust (desktop/src-tauri/src/sync.rs) :
#   * toute écriture métier faite via l'API locale est journalisée dans
#     `_sync_outbox` DANS LA MÊME transaction (rollback inclus) ;
#   * `client_ref` = identité stable de la ligne (UUID client) : posé à
#     l'INSERT s'il est absent, il voyage dans le push ; le serveur l'associe
#     à sa ligne (`_trouve_ligne`), et le pull Rust réconcilie l'id local
#     avec l'id web via cette même colonne → JAMAIS de doublon desktop↔web.

# Tables `_sync_*` du shell Rust, créées ici si absentes (le schéma généré
# depuis les modèles MySQL ne les connaît pas). Une instruction par entrée :
# le driver sqlite3 n'accepte qu'un statement par execute().
DDL_SYNC: list[str] = [
    """CREATE TABLE IF NOT EXISTS _sync_outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        op TEXT NOT NULL,
        payload TEXT NOT NULL,
        client_ts TEXT NOT NULL,
        pushed INTEGER NOT NULL DEFAULT 0
    )""",
    "CREATE TABLE IF NOT EXISTS _sync_state (key TEXT PRIMARY KEY, value TEXT)",
    # Table d'état desktop du shell Rust (session locale : email, hash
    # Argon2id du mot de passe, profil JSON). Créée par schema_init.sql côté
    # Rust ; garantie ici pour les bases claires de test.
    """CREATE TABLE IF NOT EXISTS local_session (
        email TEXT PRIMARY KEY NOT NULL,
        entreprise_id INTEGER,
        user_json TEXT,
        password_hash TEXT,
        activated_at TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS _sync_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        local_payload TEXT,
        server_payload TEXT,
        detected_at TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_outbox_pushed ON _sync_outbox (pushed)",
]

# Entités synchronisées — MIROIR STRICT de ENTITES_SYNC (app/routers/sync.py)
# et table_pour_entite (desktop/src-tauri/src/sync.rs) : toute entité ajoutée
# aux deux listes doit l'être aussi ici, sinon ses écritures locales ne
# seraient jamais poussées vers le web.
_ENTITES_SYNC: dict[str, str] = {
    "pointage": "pointages",
    "chantier": "chantiers",
    "employe": "employes",
    # --- Stocks / achats / dépenses ---
    "article": "articles",
    "mouvement_stock": "mouvements_stock",
    "achat": "commandes_fournisseur",
    "depense": "depenses",
    # --- Commercial (clients / devis / factures) ---
    "client": "clients",
    "devis": "devis",
    "facture": "factures",
    # --- RH ---
    "conge": "conges",
    "heure_supplementaire": "heures_supplementaires",
    # --- Matériel / chantier ---
    "materiel": "materiaux",
    "maintenance": "maintenances",
    "tache": "taches",
    "incident": "incidents",
}

# Colonnes gérées par le serveur, exclues du payload journalisé : le router
# /api/sync/push les ignore (COLONNES_SERVEUR) et le tenant est imposé par le
# JWT. `id` est en revanche INCLUS (lookup de repli sur update, voir sync.py).
_COLONNES_EXCLUES = {
    "entreprise_id",
    "client_ref",
    "sync_version",
    "sync_created_at",
    "sync_updated_at",
}


def _etendre_modeles_sync() -> None:
    """Garantit les colonnes de sync sur les métadonnées SQLAlchemy AVANT la
    configuration des mappers : les modèles MySQL les déclarent normalement
    (migrations 034/035), cette extension n'est qu'un filet de sécurité pour
    tout modèle enregistré sans elles (sinon les hooks `client_ref` lèveraient
    une AttributeError au flush)."""
    from sqlalchemy import Column, DateTime, Integer, Text

    import app.models  # noqa: F401
    from app.database import Base

    for table in _ENTITES_SYNC.values():
        t = Base.metadata.tables.get(table)
        if t is None:
            continue
        existantes = {c.name for c in t.columns}
        if "client_ref" not in existantes:
            t.append_column(Column("client_ref", Text, nullable=True))
        if "sync_version" not in existantes:
            t.append_column(Column("sync_version", Integer, nullable=True))
        if "sync_created_at" not in existantes:
            t.append_column(Column("sync_created_at", DateTime, nullable=True))
        if "sync_updated_at" not in existantes:
            t.append_column(Column("sync_updated_at", DateTime, nullable=True))


def _assurer_tables_sync(chemin: str) -> None:
    """Crée `_sync_*` et garantit `client_ref`/`sync_version` sur les tables
    synchronisées déjà existantes (base créée par le shell Rust, par une
    version antérieure, etc.). Idempotent.

    Passé par le DRIVER BRUT (module sqlite3, remplacé par sqlcipher3 en mode
    chiffré : le patch applique `PRAGMA key` à l'ouverture) : le moteur async
    aiosqlite refuse l'IO synchrone (greenlet), les DDL/PRAGMA n'ont pas besoin
    de SQLAlchemy."""
    import sqlite3

    conn = sqlite3.connect(chemin, timeout=30)
    try:
        conn.execute("PRAGMA busy_timeout=30000")
        for ddl in DDL_SYNC:
            conn.execute(ddl)
        conn.commit()
        for table in _ENTITES_SYNC.values():
            noms = {
                ligne[1]
                for ligne in conn.execute(f'PRAGMA table_info("{table}")').fetchall()
            }
            if not noms:
                continue  # table absente du schéma local : rien à faire
            if "client_ref" not in noms:
                conn.execute(f'ALTER TABLE "{table}" ADD COLUMN client_ref TEXT')
            if "sync_version" not in noms:
                conn.execute(
                    f'ALTER TABLE "{table}" ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1'
                )
        conn.commit()
    finally:
        conn.close()


def _serialiser_json(valeur):
    """Default de json.dumps : dates/heures → ISO, Decimal → float, UUID → str,
    bytes → hex (les colonnes binaires sont de toute façon exclues)."""
    if isinstance(valeur, (_dt.datetime, _dt.date, _dt.time)):
        return valeur.isoformat()
    if isinstance(valeur, _uuid.UUID):
        return str(valeur)
    if isinstance(valeur, (bytes, bytearray)):
        return bytes(valeur).hex()
    return str(valeur)


def _brancher_outbox() -> None:
    """Hooks SQLAlchemy : toute écriture métier de l'API locale alimente
    `_sync_outbox` sur la MÊME connexion, donc dans la MÊME transaction —
    un rollback métier annule aussi son opération de sync.

    - INSERT → op `create`, identité = client_ref (UUID généré ici s'il est
      absent : l'identité est créée à la naissance de la ligne) ;
    - UPDATE → op `update` (soft-delete `is_deleted` → op `delete`) ; une
      ligne encore sans client_ref (créée côté web, arrivée par le pull)
      en reçoit un à sa première modification locale : le serveur pourra
      l'adopter (`_trouve_ligne` par id du payload) au lieu de dupliquer ;
    - payload = colonnes métier finales du modèle (hors colonnes serveur et
      colonnes binaires : photos/documents ne transitent pas par la sync).
    """
    from sqlalchemy import LargeBinary, event, text as _text

    import app.models  # noqa: F401
    from app.database import Base

    entite_par_table = {t: e for e, t in _ENTITES_SYNC.items()}

    def _payload_de(target, table) -> str:
        binaires = {
            c.name
            for c in table.columns
            if isinstance(c.type, LargeBinary)
            or "BLOB" in type(c.type).__name__.upper()
        }
        payload = {}
        for col in table.columns:
            nom = col.name
            if nom in _COLONNES_EXCLUES or nom in binaires:
                continue
            valeur = getattr(target, nom, None)
            if valeur is None:
                continue  # payload compact : NULL = valeur par défaut
            payload[nom] = valeur
        return json.dumps(payload, default=_serialiser_json, ensure_ascii=False)

    def _journaliser(connection, entity: str, entity_id, op: str, payload_txt: str) -> None:
        connection.execute(
            _text(
                "INSERT INTO _sync_outbox (entity, entity_id, op, payload, client_ts, pushed) "
                "VALUES (:entity, :entity_id, :op, :payload, :client_ts, 0)"
            ),
            {
                "entity": entity,
                "entity_id": str(entity_id),
                "op": op,
                "payload": payload_txt,
                "client_ts": _dt.datetime.now(_dt.timezone.utc).isoformat(),
            },
        )

    for mapper in list(Base.registry.mappers):
        table = mapper.local_table
        entity = entite_par_table.get(table.name)
        if entity is None:
            continue
        if "client_ref" not in {c.name for c in table.columns}:
            continue  # modèle sans identité de sync : hors contrat
        cls = mapper.class_

        def _avant_insert(mapper_, connection, target, _entity=entity):
            if getattr(target, "client_ref", None) is None:
                target.client_ref = str(_uuid.uuid4())

        def _apres_insert(mapper_, connection, target, _entity=entity):
            _journaliser(
                connection,
                _entity,
                getattr(target, "client_ref", None),
                "create",
                _payload_de(target, mapper_.local_table),
            )

        def _avant_update(mapper_, connection, target, _entity=entity):
            if getattr(target, "client_ref", None) is None:
                target.client_ref = str(_uuid.uuid4())

        def _apres_update(mapper_, connection, target, _entity=entity):
            op = "delete" if bool(getattr(target, "is_deleted", False)) else "update"
            _journaliser(
                connection,
                _entity,
                getattr(target, "client_ref", None),
                op,
                _payload_de(target, mapper_.local_table),
            )

        event.listens_for(cls, "before_insert")(_avant_insert)
        event.listens_for(cls, "after_insert")(_apres_insert)
        event.listens_for(cls, "before_update")(_avant_update)
        event.listens_for(cls, "after_update")(_apres_update)


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

    # (c) Colonnes de sync garanties sur les métadonnées (client_ref, sync_*)
    #     AVANT la configuration des mappers (contrat desktop).
    _etendre_modeles_sync()

    _patch_sqlite_applique = True


def _port_libre() -> int:
    """Port TCP libre sur 127.0.0.1 (évite les collisions au démarrage)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def _preparer_base() -> None:
    """Crée les tables depuis les modèles (source de vérité) + PRAGMA SQLite
    + tables/hooks de sync + seed opt-in."""
    _assurer_patch_sqlite()
    cle = (os.environ.get("TIA_DB_KEY") or "").strip().lower()
    chiffre = _cle_valide(cle)
    if chiffre:
        _convertir_si_claire(os.environ["TIA_DB_URL"], cle)

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

    # Tables `_sync_*` + garanties client_ref/sync_version, puis hooks outbox :
    # à partir d'ici, toute écriture de l'API locale est journalisée pour la
    # synchronisation bidirectionnelle (push Rust vers le web, pull web→local).
    # (pause : WAL n'admet qu'un seul écrivain — create_all et les ALTER de
    # _assurer_tables_sync ne doivent pas se battre pour le lock.)
    await asyncio.sleep(0.25)
    _assurer_tables_sync(os.environ["TIA_DB_URL"])
    _brancher_outbox()

    # Seed : automatique en mode clair (démo/POC), opt-in en mode chiffré
    # (la base partagée tia.db contient les vraies données de l'entreprise —
    # on n'y injecte jamais les comptes de démo sans demande explicite).
    if os.environ.get("TIA_SEED") != "1" and chiffre:
        return

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


# ============================================================
# Auth locale (offline) : `POST /api/auth/local-login` + get_current_user
# ============================================================
# La session UI est validée contre la base LOCALE (local_session /
# utilisateurs), PAS contre le cerveau web : le JWT web (clé secrète web,
# compte possiblement absent de la base locale) ne peut pas authentifier les
# appels vers l'API embarquée. Le hub Rust `auth_login` reste la porte
# d'entrée UI (online d'abord, fallback Argon2id local) ; ce module ajoute
# l'authentification des appels HTTP de l'UI vers l'API locale.

_EXPIRATION_TOKEN_LOCAL = _dt.timedelta(days=7)
_SECRET_LOCAL = None  # secret jetable du process (généré au branchement)


def _brancher_auth_locale():
    """Branche l'auth locale dans l'app FastAPI. À appeler AVANT l'import de
    `app.main` (les routers font `from app.security import get_current_user`
    à l'import : l'override doit précéder la construction des routes).
    Renvoie l'endpoint `local_login` pour l'enregistrement de la route
    APRÈS l'import de app.main (voir main())."""

    global _SECRET_LOCAL
    import secrets as _secrets
    from types import SimpleNamespace

    import jwt as _jwt
    from fastapi import Depends, HTTPException, status as _status
    from sqlalchemy import select, text as _text

    import app.models  # noqa: F401
    from app.core.permissions import PERMISSION_MAP, Role as _Role
    from app.database import get_db as _get_db
    from app.models.utilisateur import Utilisateur
    from app.schemas.auth import LoginRequest as _LoginRequest
    from app.security import (
        credentials_exception,
        decode_token as _decode_token_web,
        oauth2_scheme,
        verify_password,
    )

    _SECRET_LOCAL = _secrets.token_hex(32)

    async def _session_locale(db, email: str | None):
        """Ligne `local_session` du compte (contrat Rust : écrite à
        l'activation/login du poste) — source d'identité offline fiable."""
        if not email:
            return None
        return (
            await db.execute(
                _text(
                    "SELECT email, entreprise_id, user_json, password_hash "
                    "FROM local_session WHERE email = :email COLLATE NOCASE"
                ),
                {"email": email},
            )
        ).first()

    async def _utilisateur_orm(db, sub):
        """Compte `utilisateurs` local s'il existe (seed/démo ou provisionné) ;
        en production la table est vide : l'identité vient de local_session."""
        try:
            user_id = int(sub)
        except (TypeError, ValueError):
            return None
        result = await db.execute(
            select(Utilisateur).where(
                Utilisateur.id == user_id,
                Utilisateur.is_deleted == False,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    def _profil_depuis_session(ligne, sub):
        """Profil compatible ORM construit depuis `local_session.user_json`
        (shape mixte : activate → `role`, login → `role_code`)."""
        try:
            data = json.loads(ligne.user_json or "{}")
        except (TypeError, ValueError):
            data = {}
        if not isinstance(data, dict):
            data = {}
        role_code = data.get("role_code") or data.get("role") or _Role.EMPLOYE
        return SimpleNamespace(
            id=int(data.get("id") or sub or 0),
            email=data.get("email") or ligne.email,
            nom=data.get("nom") or "",
            prenom=data.get("prenom"),
            role=SimpleNamespace(code=role_code),
            role_code=role_code,
            entreprise_id=(
                ligne.entreprise_id
                if ligne.entreprise_id is not None
                else data.get("entreprise_id")
            ),
            statut=data.get("statut") or "actif",
            must_change_password=bool(data.get("must_change_password", False)),
            is_email_verified=True,
            # Attributs lus par resolve_user_photo / serializers / /auth/me :
            # absents de local_session, toujours neutres.
            photo=None,
            client_id=None,
            date_creation=None,
            derniere_connexion=None,
        )

    async def _identite_locale(db, email: str | None, sub):
        """(profil, role_code, entreprise_id) résolus depuis la base LOCALE :
        `utilisateurs` s'il existe, sinon `local_session` (contrat Rust).
        (None, None, None) = identité inconnue (compte révoqué/absent)."""
        ligne = await _session_locale(db, email)
        orm_user = await _utilisateur_orm(db, sub) if sub is not None else None
        if orm_user is not None:
            role_code = orm_user.role.code if orm_user.role else _Role.EMPLOYE
            return orm_user, role_code, orm_user.entreprise_id
        if ligne is not None:
            profil = _profil_depuis_session(ligne, sub)
            return profil, profil.role_code, profil.entreprise_id
        return None, None, None

    async def local_login(
        credentials: _LoginRequest,
        db=Depends(_get_db),
    ):
        """`POST /api/auth/local-login` — auth offline (base locale uniquement).

        Vérifie email + mot de passe contre la base locale : hash
        `local_session.password_hash` prioritaire (session ouverte par le hub
        Rust `auth_login`/`auth_activate`), puis hash `utilisateurs` local.
        Renvoie un token signé par CE process (secret jetable, 7 j) + le
        profil : l'UI l'utilise pour TOUS les appels vers l'API locale.
        Messages d'erreur identiques au login normal (aucune énumération)."""
        ligne = await _session_locale(db, credentials.email)
        orm_user = None
        valide = False
        if ligne is not None and ligne.password_hash:
            valide = verify_password(credentials.password, ligne.password_hash)
        if not valide:
            orm_user = (
                await db.execute(
                    select(Utilisateur).where(
                        Utilisateur.email == credentials.email,
                        Utilisateur.is_deleted == False,  # noqa: E712
                    )
                )
            ).scalar_one_or_none()
            if orm_user is not None and orm_user.mot_de_passe_hash:
                valide = verify_password(
                    credentials.password, orm_user.mot_de_passe_hash
                )
        if not valide:
            raise HTTPException(
                status_code=_status.HTTP_401_UNAUTHORIZED,
                detail="Email ou mot de passe incorrect",
            )
        profil, role_code, entreprise_id = await _identite_locale(
            db,
            credentials.email,
            str(orm_user.id) if orm_user is not None else None,
        )
        if profil is None:
            # Hash OK mais aucune identité locale (base réinitialisée) :
            # réactivation du poste requise (1ʳᵉ connexion en ligne).
            raise HTTPException(
                status_code=_status.HTTP_403_FORBIDDEN,
                detail=(
                    "Ce poste n'est pas activé pour ce compte. Connectez-vous "
                    "une fois en ligne pour réactiver l'appareil."
                ),
            )
        statut = getattr(profil, "statut", "actif")
        if statut != "actif":
            raise HTTPException(
                status_code=_status.HTTP_409_CONFLICT,
                detail="Ce compte est désactivé. Veuillez contacter votre administrateur.",
            )
        permissions = PERMISSION_MAP.get(role_code, [])
        maintenant = _dt.datetime.now(_dt.timezone.utc)
        token = _jwt.encode(
            {
                "sub": str(profil.id),
                "type": "access",
                "iat": maintenant,
                "exp": maintenant + _EXPIRATION_TOKEN_LOCAL,
                "role_code": role_code,
                "entreprise_id": entreprise_id,
                "permissions": permissions,
                "email": profil.email,
                "aud": "local",
            },
            _SECRET_LOCAL,
            algorithm="HS256",
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": profil.id,
                "email": profil.email,
                "nom": profil.nom,
                "prenom": profil.prenom,
                "role_code": role_code,
                "entreprise_id": entreprise_id,
                "statut": statut,
                "must_change_password": bool(
                    getattr(profil, "must_change_password", False)
                ),
            },
        }

    async def _get_current_user_local(
        token: str = Depends(oauth2_scheme),
        db=Depends(_get_db),
    ):
        """Override de `app.security.get_current_user` : contrat conservé
        (payload dict avec `user` ORM), mais l'identité est chargée depuis la
        base LOCALE dans les deux cas (token local OU JWT web — l'ID
        utilisateur doit exister localement pour accéder à l'API embarquée)."""
        if not token:
            raise credentials_exception()
        try:
            claims = _jwt.decode(
                token, _SECRET_LOCAL, algorithms=["HS256"], audience="local"
            )
        except _jwt.PyJWTError:
            # Pas un token local → JWT web : mêmes règles que la prod
            # (signature + type `access`, expiration), identité locale ensuite.
            claims = _decode_token_web(token)
        profil, role_code, entreprise_id = await _identite_locale(
            db, claims.get("email") or claims.get("sub"), claims.get("sub")
        )
        if profil is None:
            raise credentials_exception()
        if getattr(profil, "statut", "actif") == "inactif":
            raise credentials_exception()
        payload = dict(claims)
        payload["sub"] = str(profil.id)
        payload["role_code"] = role_code
        payload["entreprise_id"] = entreprise_id
        payload["permissions"] = PERMISSION_MAP.get(role_code, [])
        payload["user"] = profil
        return payload

    # Remplacement dans le MODULE `app.security` : les routers importent
    # `get_current_user` au chargement de app.main — l'override doit donc
    # précéder cet import (main() respecte cet ordre).
    import app.security as _security_mod

    _security_mod.get_current_user = _get_current_user_local

    # ALIAS de dépendance à reconstruire : `CurrentUserPayload` est créé à
    # l'import de app.security avec la fonction ORIGINALE figée dans
    # Depends(...) — sans reconstruction, les routers qui l'importent
    # (commercial, rh, stocks…) valideraient les tokens avec le secret web
    # et refuseraient toute session locale (401).
    from typing import Any as _Any
    from typing_extensions import Annotated as _Annotated
    from fastapi import Depends as _Depends

    _security_mod.CurrentUserPayload = _Annotated[
        dict[str, _Any], _Depends(_get_current_user_local)
    ]

    async def _require_super_admin_local(
        payload: dict = _Depends(_get_current_user_local),
    ):
        if payload.get("role_code") != "super_admin":
            raise HTTPException(
                status_code=_status.HTTP_403_FORBIDDEN,
                detail="Super admin privileges required",
            )
        return payload

    _security_mod.require_super_admin = _require_super_admin_local
    _security_mod.SuperAdminDep = _Annotated[
        dict[str, _Any], _Depends(_require_super_admin_local)
    ]
    return local_login


def main() -> None:
    port = 0
    args = sys.argv[1:]
    if "--port" in args:
        port = int(args[args.index("--port") + 1])
    if port == 0:
        port = _port_libre()

    asyncio.run(_preparer_base())

    # 1) Auth locale AVANT l'import de app.main (voir _brancher_auth_locale).
    local_login = _brancher_auth_locale()

    # 2) Import direct de l'app (et non "app.main:app" en string) : PyInstaller
    #    inclut ainsi statiquement toute l'API (routers, modèles) dans l'exe.
    from app.main import app as fastapi_app
    import uvicorn

    # 3) Enregistrement de la route d'auth locale (après création de l'app).
    fastapi_app.add_api_route(
        "/api/auth/local-login",
        local_login,
        methods=["POST"],
        include_in_schema=False,
    )

    # CORS : la WebView (dev = http://localhost:5199 ; bundle = tauri://localhost
    # ou http://tauri.localhost) doit pouvoir appeler l'API locale directement.
    # Fait côté Python pour ne rien ajouter au shell Rust.
    from fastapi.middleware.cors import CORSMiddleware
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5199",
            "http://127.0.0.1:5199",
            "tauri://localhost",
            "http://tauri.localhost",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )

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


_resoudre_base()

if __name__ == "__main__":
    main()
