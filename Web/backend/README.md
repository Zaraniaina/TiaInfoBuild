# ⚙️ Backend — TIA INFO BUILD (FastAPI + SQLAlchemy + MySQL)

API REST de l'application de gestion BTP **TIA INFO BUILD**.

---

## 📋 Prérequis

- **Python 3.11+** (le projet a été testé avec Python 3.14)
- **MySQL 8+** (XAMPP, WAMP, MySQL natif, Docker…)
- **pip** (gestionnaire de paquets Python)
- **PowerShell** (Windows) ou **bash** (Linux/macOS)

---

## 🚀 Démarrage rapide (Windows PowerShell)

### 1. Cloner le projet et créer l'environnement virtuel

```powershell
cd D:\Tia_info_projet\projet 2\TiaInfoBuild\Web\backend

# Créer le venv (une seule fois)
python -m venv env

# Activer le venv
.\env\Scripts\Activate.ps1

# Si l'erreur "execution of scripts is disabled on this system" :
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Installer les dépendances
pip install -r requirements.txt
```

### 2. Configurer la base de données

#### a) Démarrer MySQL (XAMPP)
- Lancer le **Panneau de contrôle XAMPP**
- Cliquer **Start** sur **MySQL** (le port par défaut est 3306)

#### b) Créer la base de données
Ouvrir **phpMyAdmin** (`http://localhost/phpmyadmin`) ou un client MySQL et exécuter :

```sql
CREATE DATABASE tia_build_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### c) Vérifier le fichier `.env`
Le fichier `Web/backend/.env` doit contenir (par défaut) :

```env
DATABASE_URL=mysql+aiomysql://root:@localhost:3306/tia_build_db
SECRET_KEY=<votre-clé-secrète>
SECRET_KEY_REFRESH=<votre-clé-refresh>
ALGORITHM=HS256
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
```

> **Note** : adapter `DATABASE_URL` si vous utilisez un mot de passe MySQL :
> `mysql+aiomysql://root:VOTRE_MDP@localhost:3306/tia_build_db`

### 3. Appliquer les migrations

```powershell
alembic upgrade head
```

> **Si l'erreur `Can't create table ... (errno: 150 "Foreign key constraint is incorrectly formed")` apparaît** :
> Le problème vient d'un formatage MySQL. La migration 011 a été corrigée pour créer la table sans FK puis les ajouter séparément. Relancez après le `git pull`.

> **Si l'erreur `0 found` dans `alembic_version` apparaît** :
> La migration 011 a tourné mais la version n'a pas été enregistrée. Exécutez :
> ```powershell
> alembic stamp 011_add_ligne_categories_and_facture_totals
> alembic upgrade head
> ```

### 4. Initialiser les données de base (rôles, super admin de démo)

```powershell
python app/scripts/init_db.py
```

Ce script crée :
- Les 12 rôles principaux
- Un super admin de démo (si configuré)
- Les données de référence (plans d'abonnement, etc.)

### 5. Lancer le serveur

```powershell
uvicorn app.main:app --reload --port 8000
```

Le serveur démarre sur **http://localhost:8000**.

---

## 🔗 URLs utiles

| URL | Description |
|---|---|
| http://localhost:8000/docs | **Swagger UI** — documentation interactive de l'API |
| http://localhost:8000/redoc | **ReDoc** — documentation alternative |
| http://localhost:8000/health | **Health check** |
| http://localhost:8000/openapi.json | **Schéma OpenAPI** au format JSON |

---

## 🧪 Tests rapides

```powershell
# Vérifier que l'application se charge sans erreur
.\env\Scripts\python.exe -c "import app.main; print('OK')"

# Vérifier les routes enregistrées
curl.exe http://localhost:8000/openapi.json | .\env\Scripts\python.exe -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(d.get('paths', {}).keys()))"

# Vérifier le health check
curl.exe http://localhost:8000/health
```

---

## 🔄 Réinitialiser complètement la base de données

Si la base est dans un état incohérent :

```powershell
# 1. Supprimer la base (via phpMyAdmin ou MySQL CLI)
DROP DATABASE tia_build_db;

# 2. Recréer la base vide
CREATE DATABASE tia_build_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. Relancer toutes les migrations
alembic upgrade head

# 4. Réinitialiser les données de base
python app/scripts/init_db.py

# 5. Optionnel : créer un super admin
python app/scripts/create_super_admin.py
```

---

## 🖥️ Mode Desktop — sidecar FastAPI embarqué (offline)

`app/scripts/desktop_sidecar.py` permet d'embarquer **cette même API** dans
l'application desktop Tauri (binaire `tia-api.exe` compilé avec PyInstaller) :
toutes les routes métier tournent alors **100 % offline** sur une SQLite
locale, avec le même RBAC et les mêmes comptes de test.

```powershell
# Démarrer l'API locale à la main (port auto, ou --port 8765) :
env\Scripts\python.exe -m app.scripts.desktop_sidecar --port 8765
# → affiche « TIA_API_READY port=8765 » quand l'API écoute

# Base temporaire de test (override) :
$env:TIA_DB_URL = "./tia_poc_test.db"   # préfixe sqlite+aiosqlite:/// ajouté automatiquement

# Mode CHIFFRÉ — base SQLCipher partagée avec l'app desktop :
$env:TIA_DB_KEY = "<64 caractères hexadécimaux>"   # ou reçu par stdin depuis le Rust
$env:TIA_SEED  = "1"                                # seed des comptes de démo (opt-in en chiffré)
# Sans TIA_DB_URL, la base utilisée est %APPDATA%/tia-info-build/tia.db (celle du Rust).
# Une base claire héritée est convertie automatiquement (sqlcipher_export).
# Dépendance : pip install sqlcipher3-wheels

# Reconstruire l'exe embarqué (onefile ≈ 43 Mo) :
env\Scripts\pyinstaller.exe --noconfirm --clean --onefile --console `
  --name tia-api --distpath dist_sidecar --workpath build_sidecar `
  --specpath build_sidecar `
  --hidden-import aiosqlite --hidden-import greenlet --hidden-import email_validator `
  --hidden-import uvicorn.logging --hidden-import uvicorn.loops.auto `
  --hidden-import uvicorn.loops.asyncio --hidden-import uvicorn.protocols.http.auto `
  --hidden-import uvicorn.protocols.http.h11_impl `
  --hidden-import uvicorn.protocols.websockets.auto `
  --hidden-import uvicorn.protocols.websockets.websockets_impl `
  --hidden-import uvicorn.lifespan.on --collect-all argon2 `
  app/scripts/desktop_sidecar.py
```

* Base par défaut : `%APPDATA%/tia-info-build/local_api.db` (override
  `TIA_DB_URL`) ; tables créées depuis les modèles + seed idempotent via ORM
  (rôles, entreprise, plans, comptes de test `Admin123!`).
* Piège SQLite géré dans le script : PK `BigInteger` → `INTEGER`
  (auto-incrément rowid) — process sidecar uniquement, modèles inchangés.
* Mode chiffré : `sqlcipher3-wheels` remplace `sqlite3` (`sys.modules`) et
  `PRAGMA key = 'x''<clé>'''` est posé sur chaque connexion (clé reçue par
  stdin depuis le Rust, ou `TIA_DB_KEY`) ; base par défaut `tia.db`, seed
  opt-in (`TIA_SEED=1`), conversion claire→chiffrée automatique.
* **Outbox de synchronisation** : des hooks SQLAlchemy journalisent toute
  écriture métier dans `_sync_outbox` (même transaction, `client_ref` UUID
  posé à l'INSERT) — c'est ce qui alimente la synchronisation bidirectionnelle
  pilotée par le hub Rust `sync_run` (`push`/`pull`, conflits « web gagne »).
  Tables `_sync_*` créées si absentes ; entités mappées dans `_ENTITES_SYNC`
  (miroir de `ENTITES_SYNC` du router `/api/sync`).
* L'app desktop lance ce binaire automatiquement et lit la ligne
  `TIA_API_READY port=N` (voir `desktop/README.md`, section « Sidecar »).
* Notes PyInstaller : hidden-imports (uvicorn/aiosqlite/greenlet/argon2)
  obligatoires ; fausses alertes antivirus fréquentes sur l'exe (signer en
  production).

---

## 📁 Structure

```
app/
├── main.py           # Point d'entrée FastAPI, CORS, routers
├── config.py         # Configuration centralisée (Pydantic Settings)
├── database.py       # Connexion async SQLAlchemy
├── security.py       # JWT, hachage Argon2, RBAC
├── middleware.py     # Middlewares personnalisés (logging, cache, multi-tenant)
├── models/           # Modèles SQLAlchemy (35 tables)
├── routers/          # Routes API par domaine
├── schemas/          # Schémas Pydantic (validation)
├── crud/             # Opérations CRUD
├── core/             # Permissions, exports, PDF, scheduler
├── dependencies/     # Dépendances FastAPI (auth, DB, permissions)
└── scripts/          # Scripts d'initialisation et maintenance
    ├── init_db.py             # Initialise rôles + données de démo
    ├── reset_db.py            # Reset complet de la BDD
    ├── create_super_admin.py  # Crée un super admin
    └── fix_missing_columns.py # Script de réparation

alembic/              # Migrations de base de données
├── env.py
└── versions/          # Fichiers de migration (001 → 012+)
```

---

## 🔐 Authentification & Rôles

- **JWT** : access token (15 min) + refresh token (7 jours)
- **RBAC** : 12 rôles avec permissions granulaires
- **Endpoints protégés** : la majorité des routes nécessitent un token Bearer

### Rôles disponibles

| Rôle | Code | Permissions |
|---|---|---|
| Super Admin SaaS | `super_admin` | `*` (toutes) |
| Admin Entreprise | `admin_entreprise` | Toutes permissions entreprise |
| Direction Générale | `directeur` | Lecture + écriture limitée |
| Chef de Projet | `chef_projet` | Gestion chantiers, RH, matériel |
| Chef de Chantier | `chef_chantier` | Chantiers, RH, stocks, alertes |
| Responsable RH | `rh` | RH, pointages, équipes |
| Responsable Matériel | `materiel` | Matériels, maintenances |
| Magasinier | `magasinier` | Stocks, articles, fournisseurs |
| Commercial | `commercial` | Clients, devis, contrats, factures |
| Comptable | `comptable` | Finance, dépenses, alertes |
| Employé | `employe` | Accès limité |
| Client | `client` | Accès lecture devis/factures |

---

## ⚙️ Variables d'environnement

Le fichier `.env` à la racine de `Web/backend/` contient :

```env
# Base de données
DATABASE_URL=mysql+aiomysql://root:@localhost:3306/tia_build_db

# JWT
SECRET_KEY=...
SECRET_KEY_REFRESH=...
ALGORITHM=HS256

# CORS (origines autorisées pour le frontend)
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173

# Application
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DEBUG=True
```

---

## 🔄 Synchronisation Desktop ↔ Web

Contrat principal (desktop Tauri, bidirectionnel) :

- **Push Desktop → Web** : `POST /api/sync/push` (lots de 200, idempotence
  `(device_id, seq)`, conflits « web gagne », `client_ref` = identité desktop)
- **Pull Web → Desktop** : `GET /api/sync/pull?since=…&limit=200` (curseur
  `sync_updated_at`, payload `model_to_dict`)
- Endpoints legacy : `POST /api/sync/import-sqlite`, `GET /api/sync/export`,
  `GET /api/sync/status`.

Côté desktop, les écritures locales passent par l'API embarquée
(`desktop_sidecar.py`, hooks `_sync_outbox`) : les deux bases convergent au
cycle suivant — voir `desktop/README.md`, section « Modèle web cerveaux,
desktop offline-first ».

---

## 🛠️ Dépannage

### Erreur : `NameError: name 'DbSession' is not defined` au demarrage du backend
Cause : un alias `Annotated` (ex: `DbSession`) etait utilise dans une annotation de fonction
AVANT sa definition dans le module.
- Python 3.13 et avant : les annotations sont evaluees immediatement au `def` -> crash.
- Python 3.14+ : annotations paresseuses (PEP 649) -> le bug passe inapercu sur une machine recente
  mais casse celle du collegue.

Ce cas est corrige dans `app/routers/utilisateurs.py` (alias definis en tete de module).
**Regle a respecter** : dans tout router, definir les alias `Router = APIRouter(...)`,
`DbSession = Annotated[...]`, `AdminCheck = ...` AVANT la premiere fonction qui les utilise.
Apres un `git pull`, relancer le backend.

### Regles pour les futures migrations Alembic
- Le nom de revision (fichier + `revision=`) doit faire **32 caracteres maximum** :
  `alembic_version` est un VARCHAR(32), un nom trop long est tronque silencieusement et
  provoque l'erreur `expected to match one row... 0 found` (cas de la revision 014 renommee).
- Le type de colonne FK doit correspondre EXACTEMENT au type de la colonne cible
  (ex: FK vers `projets.id` = `int(11)` -> `sa.Integer()`, pas `BigInteger`, sinon errno 150).
- Ecrire les migrations de facon idempotente (verifier colonnes/FK/index existants
  avant creation) pour garantir la reproductibilite sur un clone.

### Erreur : `401 "Email ou mot de passe incorrect"` apres une recration de la base
Les comptes de test n'existent pas : le seed n'a pas ete relance.
```powershell
python -m app.scripts.init_db
```
Ce script est idempotent (sans effet si les donnees existent deja). `start-dev.ps1`
l'execute automatiquement apres les migrations.

### Erreur : `Can't create table ... (errno: 150)`
Problème de contrainte FK mal formée. La migration 011 a été corrigée (création de table sans FK, puis ajout séparé).

### Erreur : `0 found` dans `alembic_version`
La migration a tourné mais la version n'a pas été enregistrée. Exécutez :
```powershell
alembic stamp 011_add_ligne_categories_and_facture_totals
alembic upgrade head
```

### Erreur : `Table 'xxx' already exists` après un `stamp`
La table existe déjà dans la base mais `alembic_version` n'a pas été mis à jour. Exécutez :
```powershell
alembic stamp head
```

### Erreur : `AttributeError: type object 'Preference' has no attribute 'cle'`
La route `/api/super-admin/settings` utilise `Preference.cle` mais le modèle `Preference` n'a pas cette colonne (il est lié à `user_id`).

**Cause** : le code utilisait le mauvais modèle pour stocker les paramètres de plateforme.

**Correction** : un modèle dédié `PlatformSettings` a été créé dans `app/models/platform_settings.py` avec les colonnes `cle`, `valeur`, `description`, `updated_t`.

Pour appliquer la correction :
1. Faire un `git pull` pour récupérer le nouveau modèle
2. Créer la table :
```powershell
python -c "import asyncio; from app.database import engine, Base; from app.models.platform_settings import PlatformSettings; asyncio.run(Base.metadata.create_all(engine))"
```
3. Relancer le backend.

### Erreur : `400 Entreprise ID manquant` pour le Super Admin sur `/api/dashboard/stats`
Le Super Admin n'a pas d'entreprise_id, la route échouait.

**Correction** : ajout d'une méthode `get_global_stats` dans `DashboardCRUD` qui retourne des statistiques globales (toutes entreprises) quand l'utilisateur est super_admin sans entreprise_id.

### Écran blanc sur le frontend
**Cause** : les modules `lazy()` avec `Suspense` peuvent bloquer le rendu.

**Correction** :
- Ajout d'un `LoadingFallback` avec timeout de 10 secondes
- Affichage d'un bouton "Recharger" si le chargement prend trop de temps
- Meilleure gestion des erreurs dans `ErrorBoundary`

---

## ⚡ Bonnes pratiques de performance (pour les agents IA)

### 1. Requêtes SQL : éviter le N+1
**Problème** : charger N enregistrements puis faire N requêtes supplémentaires (un par enregistrement).
```python
# MAUVAIS : N+1 query (1 requête + N requêtes)
items = (await db.execute(select(Entreprise))).scalars().all()
for e in items:
    count = (await db.execute(
        select(func.count(Utilisateur.id)).where(Utilisateur.entreprise_id == e.id)
    )).scalar()

# BON : sous-requête scalaire corrélée (1 requête totale)
subq = (
    select(func.count(Utilisateur.id))
    .where(Utilisateur.entreprise_id == Entreprise.id)
    .correlate(Entreprise)
    .scalar_subquery()
)
result = await db.execute(select(Entreprise, subq.label("user_count")))
```

### 2. Agrégation : une seule requête au lieu de N
**Problème** : compter 10 choses différentes = 10 requêtes SQL.
```python
# MAUVAIS : 10 requêtes séparées
total = (await db.execute(select(func.count(Entreprise.id)))).scalar()
actives = (await db.execute(select(func.count(Entreprise.id)).where(...))).scalar()
...

# BON : sous-requêtes scalaires en une seule requête
subq_total = select(func.count(Entreprise.id)).scalar_subquery()
subq_actives = select(func.count(Entreprise.id)).where(Entreprise.actif == True).scalar_subquery()
row = (await db.execute(select(subq_total, subq_actives, ...))).one()
```

### 3. SQL echo : toujours désactivé en production
```python
# database.py
echo=settings.db_echo,  # False par défaut, True uniquement pour debug ponctuel
```
L'echo SQL logue **chaque requête + toutes les lignes de résultats** : x10 ou plus sur les temps de réponse.

### 4. Pagination obligatoire sur les listes
```python
# Toujours paginer les listes (éviter de charger 10 000 lignes)
@router.get("/items")
async def list_items(page: int = Query(1, ge=1), size: int = Query(25, ge=1, le=100)):
    offset = (page - 1) * size
    result = await db.execute(select(Item).offset(offset).limit(size))
    return {"items": result.scalars().all(), "total": total}
```

### 5. Index sur les colonnes de jointure et filtres
```sql
-- Index obligatoires pour les performances
CREATE INDEX idx_utilisateurs_entreprise_id ON utilisateurs(entreprise_id);
CREATE INDEX idx_utilisateurs_is_deleted ON utilisateurs(is_deleted);
CREATE INDEX idx_chantiers_entreprise_id ON chantiers(entreprise_id);
CREATE INDEX idx_factures_statut ON factures(statut);
```

### 6. Éviter les requêtes dans les boucles
```python
# MAUVAIS
for id in ids:
    item = (await db.execute(select(Item).where(Item.id == id))).scalar()

# BON : une seule requête IN
items = (await db.execute(select(Item).where(Item.id_(ids)))).scalars().all()
```

### 7. Utiliser `selectinload` pour les relations
```python
# MAUVAIS : lazy loading dans une boucle (N+1)
for e in entreprises:
    print(e.utilisateurs)  # requête supplémentaire à chaque itération

# BON : eager loading en une requête
from sqlalchemy.orm import selectinload
result = await db.execute(
    select(Entreprise).options(selectinload(Entreprise.utilisateurs))
)
```

---

## 📜 Commandes utiles (Makefile équivalent)

```powershell
# Démarrer le backend
.\start.ps1

# Appliquer les migrations
.\migrate.ps1

# Réinitialiser la BDD
.\reset.ps1

# Lancer les tests
pytest
```
