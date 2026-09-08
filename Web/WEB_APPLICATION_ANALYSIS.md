# Analyse Technique — Application Web TIA INFO BUILD

> **Version:** 1.1.0  
> **Date:** 2026-09-03  
> **Scope:** Backend FastAPI + Frontend React (Web)  
> **Exclusions:** `node_modules/`, `.env`, `__pycache__/`, `.git/`, env virtuels

---

## Table des Matières

1. [Vue Globale](#1-vue-globale)
2. [Stack Technique](#2-stack-technique)
3. [Architecture Backend](#3-architecture-backend)
4. [Architecture Frontend](#4-architecture-frontend)
5. [Sécurité & Authentification](#5-sécurité--authentification)
6. [Base de Données](#6-base-de-données)
7. [API REST](#7-api-rest)
8. [RBAC & Permissions](#8-rbac--permissions)
9. [Fonctionnalités Métier](#9-fonctionnalités-métier)
10. [Configuration & Déploiement](#10-configuration--déploiement)
11. [Maintenance & Mises à Jour](#11-maintenance--mises-à-jour)

---

## 1. Vue Globale

**TIA INFO BUILD** est une plateforme de gestion BTP (Bâtiment et Travaux Publics) multi-tenant SaaS conçue pour des entreprises de construction basées à Madagascar. Elle couvre l'ensemble du cycle de vie des projets de construction : gestion des chantiers, RH, stocks, commercial, finance, matériel et alertes.

L'application   :
- **Web** — Application full-stack (FastAPI + React) avec synchronisation
- **SaaS** — Instance multi-tenant hébergée

### Schéma d'Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Navigateur)                   │
│                   React 19 + TypeScript + Vite               │
│                   Port dev : 5173                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ Proxy /api → http://localhost:8000
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND FASTAPI                            │
│                   Port : 8000                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │   Auth   │ │Routers   │ │  CRUD    │ │   Services   │  │
│  │ (JWT)    │ │(14 mod.) │ │(35 mod.) │ │ (PDF/Excel)  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ aiomysql (async)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              MYSQL 8+ (tia_build_db)                         │
│              35 tables, BIGINT PK/FK                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Technique

### 2.1 Backend (Web)

| Composant | Technologie | Version | Fichier Clé |
|-----------|-------------|---------|-------------|
| Framework | FastAPI | 0.141.1 | `Web/backend/app/main.py` |
| Langage | Python | 3.11+ | `requirements.txt` |
| ORM | SQLAlchemy (async) | 2.0.52 | `Web/backend/app/database.py` |
| Driver DB | aiomysql | 0.2.0 | `Web/backend/app/config.py` |
| Migrations | Alembic | 1.19.1 | `Web/backend/alembic/` |
| Validation | Pydantic v2 | 2.13.4 | `Web/backend/app/schemas/` |
| Auth | JWT (PyJWT) + Argon2 | 2.13.0 / 23.1.0 | `Web/backend/app/security.py` |
| Serveur | Uvicorn | 0.30.6 | `start-dev.ps1` |
| PDF | ReportLab | 4.3.1 | `Web/backend/app/core/pdf.py` |
| Excel | openpyxl + xlsxwriter | 3.1.5 / 3.2.5 | `Web/backend/app/core/export.py` |
| Monitoring | Sentry | 2.68.0 | `Web/backend/app/core/` |
| Tests | pytest + pytest-asyncio | 9.1.1 / 1.4.0 | `Web/backend/tests/` |

### 2.2 Frontend (Web)

| Composant | Technologie | Version | Fichier Clé |
|-----------|-------------|---------|-------------|
| Framework | React | 19 | `Web/frontend/src/App.tsx` |
| Langage | TypeScript | ~6.0 | `Web/frontend/tsconfig.json` |
| Build | Vite | 8.2 | `Web/frontend/vite.config.ts` |
| Routing | React Router DOM | 7.18 | `Web/frontend/src/App.tsx` |
| State (global) | Zustand | 5.x | `Web/frontend/src/stores/` |
| State (serveur) | TanStack React Query | 5.x | `Web/frontend/src/main.tsx` |
| HTTP Client | Axios | 1.19 | `Web/frontend/src/services/api.ts` |
| UI | Bootstrap 5 | 5.3 | `Web/frontend/src/styles/` |
| Charts | Chart.js + react-chartjs-2 | 4.5 / 5.3 | `Web/frontend/src/components/charts/` |
| Forms | React Hook Form + Zod | 7.x / 4.x | Pages et composants |
| Tests | Vitest + Testing Library | 4.1 / 16.3 | `Web/frontend/src/` |

---

## 3. Architecture Backend

### 3.1 Structure du Projet

```
Web/backend/
├── app/
│   ├── main.py                    # Point d'entrée FastAPI, CORS, middleware
│   ├── config.py                  # Settings (Pydantic Settings)
│   ├── database.py                # Async SQLAlchemy engine + session
│   ├── security.py                # JWT, Argon2, RBAC guards
│   ├── middleware.py               # Logging + MultiTenant
│   ├── models/                    # 35 modèles SQLAlchemy
│   ├── routers/                   # 14 routeurs API
│   ├── schemas/                   # Schémas Pydantic v2
│   ├── crud/                      # Opérations CRUD
│   ├── core/                      # Services transverses (PDF, export, permissions, scheduler)
│   ├── dependencies/              # Dépendances FastAPI
│   ├── scripts/                   # Scripts d'initialisation DB
│   └── ...
├── alembic/                       # Migrations de base de données
├── tests/                         # Tests unitaires et d'intégration
├── requirements.txt               # Dépendances Python
├── .env.example                   # Template de configuration
└── README.md                      # Guide d'installation
```

### 3.2 Point d'Entrée (`main.py`)

**Chemin:** `Web/backend/app/main.py`

| Aspect | Détail | Ligne |
|--------|--------|-------|
| Application | `FastAPI(title=settings.app_name, version="1.0.0")` | 34-40 |
| Lifespan | Startup : test connexion DB (`SELECT 1`) | 17-31 |
| | Shutdown : dispose engine pool | 30 |
| Middleware | GZip (min 1000 bytes) | 42 |
| | Logging (METHOD PATH STATUS IP DURATION) | 44 |
| | MultiTenant (injection JWT dans request.state) | 45 |
| | CORS (origines depuis settings) | 47-53 |
| Santé | `GET /health` → `{"status": "ok"}` | 56-67 |
| | `GET /` → Message d'accueil | 56-67 |
| Exception | Handler global 500 (sans stack trace) | 93-111 |
| | Handler HTTP 400/404 cohérent | 105-111 |

### 3.3 Configuration (`config.py`)

**Chemin:** `Web/backend/app/config.py`

```python
class Settings(BaseSettings):
    # Application
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_name: str = "TIA INFO BUILD API"
    
    # Base de données
    database_url: str  # MySQL async via aiomysql
    
    # JWT
    secret_key: str
    secret_key_refresh: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    
    # Politique mots de passe
    password_min_length: int = 8
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_digit: bool = True
    password_require_special: bool = True
    
    # CORS
    cors_origins: str  # CSV
    cors_credentials: bool = True
    
    # Pagination
    default_page_size: int = 25
    max_page_size: int = 100
    
    # Multi-tenant par défaut
    default_entreprise_devise: str = "MGA"
    default_entreprise_tva: float = 20.0
    default_entreprise_delai_paiement: int = 30
    
    # Logging
    log_level: str = "INFO"
```

### 3.4 Base de Données (`database.py`)

**Chemin:** `Web/backend/app/database.py`

```python
# Moteur async avec pool
engine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Fabrique de sessions
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

# Dépendance FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### 3.5 Modèles de Données (35 modèles)

**Chemin:** `Web/backend/app/models/__init__.py`

| Domaine | Modèles | Description |
|---------|---------|-------------|
| **Core** | `Entreprise`, `Utilisateur`, `Role`, `RefreshToken`, `Preference` | Entités de base, authentification |
| **Chantiers** | `Chantier`, `Phase`, `Equipe`, `MembreEquipe`, `AffectationChantier`, `AffectationRessource`, `Incident` | Gestion des projets de construction |
| **RH** | `Employe`, `Pointage`, `HeureSupplementaire`, `HistoriquePoste`, `HistoriqueConnexion` | Ressources humaines |
| **Stocks** | `Article`, `Fournisseur`, `MouvementStock` | Gestion des inventaires |
| **Commercial** | `Client`, `ClientAdresse`, `Devis`, `LigneDevis`, `Contrat` | Ventes et devis |
| **Finance** | `Facture`, `Paiement`, `Depense`, `RapportFinancier` | Comptabilité et finances |
| **Matériel** | `Materiel`, `Maintenance`, `AffectationMateriel` | Parc matériel |
| **Alertes** | `Alerte`, `AlerteMateriel` | Système d'alertes intelligent |
| **Sync** | `SyncQueue` | File de synchronisation Desktop ↔ Web |

### 3.6 Sécurité (`security.py`)

**Chemin:** `Web/backend/app/security.py`

| Fonctionnalité | Implémentation | Ligne |
|----------------|----------------|-------|
| Hachage mots de passe | `pwdlib` + `Argon2Hasher` | 18, 36-44 |
| Création access token | JWT HS256, 15 min, claims : `sub`, `type`, `role_code`, `entreprise_id`, `permissions` | 67-95 |
| Création refresh token | JWT HS256, 7 jours | 67-95 |
| Décodage token | Validation type, gestion `ExpiredSignatureError` | 98-111 |
| Utilisateur courant | Extraction depuis DB, vérification `is_deleted=False` et `statut != "inactif"` | 114-153 |
| RBAC Super Admin | Vérification `role_code == "super_admin"` | 157-169 |

### 3.7 Middleware (`middleware.py`)

**Chemin:** `Web/backend/app/middleware.py`

| Middleware | Fonction | Ligne |
|------------|----------|-------|
| `LoggingMiddleware` | Log méthode, chemin, statut, IP, durée (ms) | 13-26 |
| `MultiTenantMiddleware` | Extraction Bearer token, décodage JWT, injection dans `request.state` : `entreprise_id`, `user_id`, `role_code` | 29-43 |

### 3.8 Services Cœurs (`app/core/`)

| Fichier | Fonctionnalité | Lignes |
|---------|----------------|--------|
| `permissions.py` | 12 rôles, 25 permissions granulaires, `PERMISSION_MAP` | 127 |
| `pdf.py` | Génération PDF avec ReportLab (en-tête `#003366`, lignes alternées) | 37 |
| `export.py` | Export CSV UTF-8 BOM, sérialisation datetime/Decimal | 33 |
| `numerotation.py` | Numérotation automatique format `PREFIX-YYYY-NNNNN` | 38 |
| `scheduler.py` | Tâches planifiées (factures échues, stock bas, maintenance) | 34 |
| `import_csv.py` | Parsing CSV avec délimiteur `;` | 14 |

---

## 4. Architecture Frontend

### 4.1 Structure du Projet

```
Web/frontend/
├── src/
│   ├── main.tsx                   # Bootstrap (React Query, Router, StrictMode)
│   ├── App.tsx                    # Routes, ProtectedRoute, token refresh
│   ├── config/
│   │   └── roles.config.ts        # ROLE_MODULES, ROLE_NAMES
│   ├── pages/
│   │   ├── auth/                  # LoginPage, RegisterPage
│   │   ├── dashboard/             # DashboardPage (11 vues par rôle)
│   │   ├── chantiers/             # Gestion chantiers
│   │   ├── rh/                    # Ressources humaines
│   │   ├── stocks/                # Inventaire
│   │   ├── commercial/            # Devis, factures, clients, contrats
│   │   ├── finance/               # Dépenses, budgets, rapports
│   │   ├── materiels/             # Parc matériel
│   │   ├── alertes/               # Alertes
│   │   ├── settings/              # Paramètres entreprise
│   │   ├── historique-logins/     # Audit log
│   │   ├── client/                # Dashboard client
│   │   └── super-admin/           # SaaS admin (7 pages)
│   ├── components/
│   │   ├── layout/                # Layout, Sidebar, Topbar
│   │   ├── auth/                  # ProtectedRoute, LoginForm
│   │   ├── ui/                    # PermissionGuard, ToastContainer
│   │   ├── charts/                # 11 composants Chart.js
│   │   └── pointage/              # QR Badge, QR Scanner
│   ├── services/                  # Couche API (axios)
│   ├── stores/                    # Zustand (auth, ui, toast)
│   ├── hooks/                     # useAuth, usePermissions
│   ├── types/                     # Types TypeScript (774 lignes)
│   ├── utils/                     # permissions.ts, formatters
│   └── styles/                    # Bootstrap + TIA design system
├── vite.config.ts                 # Proxy /api → :8000, alias @
├── tsconfig.json                  # Strict mode, path alias @
├── package.json                   # Dépendances et scripts
└── README.md
```

### 4.2 Routage (`App.tsx`)

**Chemin:** `Web/frontend/src/App.tsx`

| Route | Composant | Accès | Description |
|-------|-----------|-------|-------------|
| `/login` | `LoginPage` | Public | Connexion |
| `/register` | `RegisterPage` | Public | Inscription entreprise |
| `/` | `DashboardPage` | Protégé | Redirection vers dashboard |
| `/dashboard` | `DashboardPage` | Protégé | Tableau de bord (11 vues par rôle) |
| `/chantiers` | `ChantiersPage` | Protégé | Gestion des chantiers |
| `/rh` | `RhPage` | Protégé | Ressources humaines |
| `/stocks` | `StocksPage` | Protégé | Inventaire |
| `/commercial` | `CommercialPage` | Protégé | Devis, factures, clients |
| `/finance` | `FinancePage` | Protégé | Finances |
| `/materiels` | `MaterielsPage` | Protégé | Parc matériel |
| `/alertes` | `AlertesPage` | Protégé | Alertes |
| `/historique-logins` | `HistoriqueLoginsPage` | Protégé | Audit log |
| `/settings` | `SettingsPage` | Protégé | Paramètres (admin) |
| `/client` | `ClientPage` | Protégé | Dashboard client |
| `/super-admin/*` | SuperAdmin* | Super admin | SaaS administration |
| `*` | → `/login` | Public | Catch-all |

### 4.3 Pages Principales

| Page | Module | Fonctionnalités Clés |
|------|--------|---------------------|
| `DashboardPage` | Dashboard | 11 vues par rôle, statistiques, graphiques |
| `ChantiersPage` | Chantiers | CRUD, phases, incidents, QR pointage, export CSV |
| `RhPage` | RH | Employés, pointages (QR scanner), équipes, heures sup |
| `StocksPage` | Stocks | Articles, mouvements, fournisseurs, alertes rupture |
| `CommercialPage` | Commercial | Devis (TTC auto), factures, clients, contrats, paiements |
| `FinancePage` | Finance | Dépenses, budgets, rapports, dépassements, retards |
| `MaterielsPage` | Matériels | Parc matériel, statuts, maintenances |
| `AlertesPage` | Alertes | Liste alertes, marquer lu, sévérité |
| `SettingsPage` | Paramètres | Utilisateurs, rôles, entreprise, profil |
| `ClientPage` | Client | KPIs projets, devis, factures |

### 4.4 Composants UI

| Composant | Chemin | Rôle |
|-----------|--------|------|
| `Layout` | `components/layout/` | Shell (Sidebar + Topbar + outlet) |
| `Sidebar` | `components/layout/` | Navigation role-based, responsive |
| `Topbar` | `components/layout/` | Header, thème, notifications, profil |
| `ProtectedRoute` | `components/auth/` | Garde auth + layout wrapper |
| `PermissionGuard` | `components/ui/` | Rendu conditionnel par permission |
| `ToastContainer` | `components/ui/` | Notifications toast globales |
| `DashboardCharts` | `components/charts/` | 11 graphiques Chart.js |
| `WorkerBadgeCard` | `components/pointage/` | Badge QR employé |
| `QRScannerModal` | `components/pointage/` | Scan QR pour pointage |

### 4.5 Stores Zustand

| Store | État | Actions |
|-------|------|---------|
| `auth.store.ts` | `user`, `token`, `refreshToken`, `isAuthenticated` | `login`, `logout`, `setUser`, `setTokens` |
| `ui.store.ts` | `sidebarOpen`, `theme` | `toggleSidebar`, `setTheme`, `hydrateThemeFromBackend` |
| `toast.store.ts` | Array de toasts | `addToast`, `removeToast`, `showToast` |

### 4.6 Services API (Axios)

| Service | Endpoints | Fichier |
|---------|-----------|---------|
| Core | Intercepteurs auth + refresh token | `services/api.ts` |
| Dashboard | `/dashboard/stats`, `/dashboard/ca-evolution`, `/dashboard/top-chantiers` | `services/dashboard.service.ts` |
| Chantiers | CRUD + phases, incidents, QR pointage | `services/chantiers.service.ts` |
| RH | Employés, pointages, équipes, heures sup | `services/rh.service.ts` |
| Stocks | Articles, mouvements, fournisseurs | `services/stocks.service.ts` |
| Commercial | Clients, devis, contrats, factures, paiements | `services/commercial.service.ts` |
| Finance | Stats, dépenses, budgets, rapports | `services/finance.service.ts` |
| Matériels | CRUD + maintenances | `services/materiels.service.ts` |
| Alertes | Liste, marquer lu, toutes lues | `services/alertes.service.ts` |
| Paramètres | Entreprise, utilisateurs, backup, préférences | `services/settings.service.ts` |

### 4.7 Hooks Personnalisés

| Hook | Chemin | Rôle |
|------|--------|------|
| `useAuth` | `hooks/useAuth.ts` | `loginUser`, `logout`, `fetchMe` |
| `usePermissions` | `hooks/usePermissions.ts` | `hasPermission`, `canAccess`, flags par rôle |

### 4.8 Configuration

| Fichier | Rôle |
|---------|------|
| `vite.config.ts` | Proxy `/api` → `:8000`, alias `@` → `./src`, port 5173 |
| `tsconfig.json` | Strict mode, path alias, ES2022 |
| `package.json` | Scripts : `dev`, `build`, `lint`, `preview` |
| `src/config/roles.config.ts` | `ROLE_MODULES`, `ROLE_NAMES`, `ROLE_DASHBOARD_TITLE` |

---

## 5. Sécurité & Authentification

### 5.1 Backend

| Aspect | Implémentation |
|--------|----------------|
| Authentification | JWT access (15 min) + refresh (7 jours) |
| Hachage | Argon2 via `pwdlib` |
| Token refresh | Automatique via intercepteur Axios (file de requêtes en attente) |
| CORS | Configurable via `.env`, credentials autorisés |
| RBAC | 12 rôles, 25 permissions granulaires, middleware multi-tenant |
| Validation | Pydantic v2 sur toutes les entrées |
| Gestion erreurs | Handler global 500 sans fuite de stack trace |

### 5.2 Frontend

| Aspect | Implémentation |
|--------|----------------|
| Stockage tokens | `localStorage` (token + refreshToken) |
| Refresh auto | `scheduleTokenRefresh()` basé sur JWT `exp` |
| Intercepteur Axios | Attachement Bearer, refresh automatique 401, file de requêtes |
| Protection routes | `ProtectedRoute` + vérification rôle/modules |
| Guard composants | `PermissionGuard` pour rendu conditionnel |

---

## 6. Base de Données

### 6.1 Schéma Relationnel (Web/MySQL)

**35 tables**, clés primaires et étrangères en `BIGINT`.

| Domaine | Tables |
|---------|--------|
| **Core** | `entreprise`, `utilisateur`, `role`, `refresh_token`, `preference` |
| **Chantiers** | `chantier`, `phase`, `equipe`, `membre_equipe`, `affectation_chantier`, `affectation_ressource`, `incident` |
| **RH** | `employe`, `pointage`, `heure_supplementaire`, `historique_poste`, `historique_connexion` |
| **Stocks** | `article`, `fournisseur`, `mouvement_stock` |
| **Commercial** | `client`, `client_adresse`, `devis`, `ligne_devis`, `contrat` |
| **Finance** | `facture`, `paiement`, `depense`, `rapport_financier` |
| **Matériel** | `materiel`, `maintenance`, `affectation_materiel` |
| **Alertes** | `alerte`, `alerte_materiel` |
| **Sync** | `sync_queue` |

### 6.2 Migrations

- **Outil:** Alembic
- **Chemin:** `Web/backend/alembic/`
- **Commande:** `alembic upgrade head`
- **État actuel:** 12 migrations appliquées (de `001_initial_schema` à `012_add_avenants`)

#### Procédure de migration

```bash
# Appliquer toutes les migrations en attente
alembic upgrade head

# Vérifier l'état actuel
alembic current

# Vérifier l'historique complet
alembic history
```

#### ⚠️ Contrainte critique : longueur des IDs de révision

**La colonne `version_num` de la table `alembic_version` est limitée à VARCHAR(32).**
Tout ID de révision dépassant 32 caractères sera **tronqué silencieusement** par MySQL,
ce qui provoque l'erreur suivante :

```
Online migration expected to match one row when updating 'XXX' to 'YYY' in 'alembic_version'; 0 found
```

**Règle obligatoire :** Chaque `revision` dans les fichiers de migration doit faire **≤ 32 caractères**.

| Révision | Longueur | Statut |
|----------|----------|--------|
| `001_initial_schema` | 18 | ✅ |
| `002_chantiers_schema` | 20 | ✅ |
| `003_roles_and_historique_poste` | 30 | ✅ |
| `004_remaining_modules` | 21 | ✅ |
| `005_finance_alertes_sync` | 24 | ✅ |
| `006_add_missing_columns` | 22 | ✅ |
| `007_convert_ids_to_bigint` | 25 | ✅ |
| `008_add_code_qr_badge` | 21 | ✅ |
| `009_add_pointage_columns` | 24 | ✅ |
| `010_add_subscriptions` | 21 | ✅ |
| `011_ligne_categories_factures` | 29 | ✅ |
| `012_add_avenants` | 16 | ✅ |

#### Créer une nouvelle migration

```bash
# Créer une migration (utiliser un ID court, ≤ 32 caractères)
alembic revision -m "description courte"

# Exemples d'IDs valides :
# ✅ "013_add_table_xyz" (17 car.)
# ✅ "014_fix_column" (13 car.)
# ❌ "013_add_new_table_for_customer_invoices" (41 car.) → TRONQUÉ !
```

**Bonnes pratiques :**
- Utiliser le format `NNN_description_courte` (ex. `013_add_notifications`)
- Le descriptif complet va dans la docstring du fichier, pas dans l'ID
- Vérifier la longueur : `len("votre_revision_id") <= 32`

#### Script de vérification

Un script de vérification est disponible pour diagnostiquer les problèmes de migration :

```bash
python scripts/check_alembic_version.py
```

Il vérifie :
- L'état de la table `alembic_version`
- Que le head est atteint
- Que tous les IDs de révision sont dans la limite de 32 caractères

### 6.3 Scripts d'Initialisation

| Script | Chemin | Rôle |
|--------|--------|------|
| `init_db.py` | `Web/backend/app/scripts/` | Initialisation tables et données de base |
| `reset_db.py` | `Web/backend/app/scripts/` | Réinitialisation complète |
| `fix_missing_columns.py` | `Web/backend/app/scripts/` | Correction colonnes manquantes |
| `create_super_admin.py` | `Web/backend/app/scripts/` | Création super admin initial |

---

## 7. API REST

### 7.1 Points d'Entrée

| Préfixe | Module | Description |
|---------|--------|-------------|
| `/api/auth` | Authentification | Login, register, refresh, logout, me |
| `/api/super-admin` | SaaS Admin | Gestion tenants, utilisateurs globaux, abonnements |
| `/api/utilisateurs` | Utilisateurs | CRUD utilisateurs, rôles |
| `/api/dashboard` | Dashboard | Statistiques, analytics |
| `/api/chantiers` | Chantiers | CRUD chantiers, phases, incidents |
| `/api/rh` | RH | Employés, pointages, équipes, heures sup |
| `/api/stocks` | Stocks | Articles, mouvements, fournisseurs |
| `/api/commercial` | Commercial | Clients, devis, contrats, factures, paiements |
| `/api/finance` | Finance | Dépenses, budgets, rapports |
| `/api/materiels` | Matériels | CRUD matériel, maintenances |
| `/api/alertes` | Alertes | CRUD alertes |
| `/api/parametres` | Paramètres | Settings entreprise |
| `/api/preferences` | Préférences | Préférences utilisateur |
| `/api/sync` | Sync | Import/export SQLite, statut sync |

### 7.2 Endpoints de Santé

| Méthode | Chemin | Réponse |
|---------|--------|---------|
| GET | `/health` | `{"status": "ok", "app": "...", "env": "..."}` |
| GET | `/` | Message d'accueil |

### 7.3 Synchronisation Desktop ↔ Web

| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST | `/api/sync/import-sqlite` | Import depuis SQLite (Desktop → Web) |
| GET | `/api/sync/export` | Export vers SQLite (Web → Desktop) |
| GET | `/api/sync/status` | Statut de synchronisation |

---

## 8. RBAC & Permissions

### 8.1 Rôles (12)

| Rôle | Code | Description |
|------|------|-------------|
| Super Admin | `super_admin` | Administration SaaS globale |
| Admin Entreprise | `admin_entreprise` | Administrateur d'entreprise (max 2 par entreprise) |
| Directeur | `directeur` | Direction générale |
| Comptable | `comptable` | Gestion financière |
| Chef Projet | `chef_projet` | Pilotage projets |
| Chef Chantier | `chef_chantier` | Supervision chantiers |
| RH | `rh` | Ressources humaines |
| Matériel | `materiel` | Gestion parc matériel |
| Magasinier | `magasinier` | Gestion stocks |
| Commercial | `commercial` | Ventes et devis |
| Employé | `employe` | Employé standard |
| Client | `client` | Accès limité client |

### 8.2 Permissions (25)

| Permission | Modules |
|------------|---------|
| `read` | dashboard, chantiers, rh, stocks, commercial, finance, materiels, alertes, parametres |
| `write` | chantiers, rh, stocks, commercial, finance, materiels, alertes, parametres |
| `delete` | chantiers, rh, stocks, commercial, finance, materiels |
| `*` | super_admin |

### 8.3 Matrice d'Accès (Frontend)

| Rôle | Modules Accessibles |
|------|---------------------|
| `super_admin` | Tous |
| `admin_entreprise` | Tous |
| `directeur` | dashboard, chantiers, rh, stocks, commercial, finance, materiels, alertes, parametres |
| `comptable` | dashboard, finance, commercial, parametres |
| `chef_projet` | dashboard, chantiers, rh, stocks, commercial, finance, materiels, alertes |
| `chef_chantier` | dashboard, chantiers, rh, stocks, materiels, alertes |
| `rh` | dashboard, rh, stocks, alertes |
| `materiel` | dashboard, materiels, stocks, alertes |
| `magasinier` | dashboard, stocks, alertes |
| `commercial` | dashboard, commercial, stocks, alertes |
| `employe` | dashboard, rh, stocks, alertes |
| `client` | dashboard, commercial |

---

## 9. Fonctionnalités Métier

### 9.1 Chantiers

- CRUD chantiers avec budget, statuts, dates
- Gestion des phases (planning, avancement)
- Gestion des équipes et membres
- Affectations ressources et matériels
- Incidents avec gravité
- QR code pour pointage
- Export CSV

### 9.2 Ressources Humaines

- CRUD employés (contrat, poste, salaire)
- Historique des postes
- Pointages avec QR scanner
- Équipes et affectations chantiers
- Heures supplémentaires (validation/rejet)
- Badge employé (QR)

### 9.3 Stocks

- CRUD articles avec catégorie, seuils d'alerte
- CRUD fournisseurs
- Mouvements de stock (entrée/sortie/transfert)
- Alertes rupture de stock
- Export CSV

### 9.4 Commercial

- Clients avec adresses multiples
- Devis avec calcul TTC automatique
- Transformation devis → facture
- Contrats
- Factures avec lignes détaillées
- Paiements

### 9.5 Finance

- Vue globale (CA vs dépenses)
- CRUD dépenses avec validation
- Gestion des budgets (détection dépassements)
- Suivi des retards de paiement
- Rapports financiers (PDF)
- Limites d'encours client

### 9.6 Matériels

- CRUD équipements avec statut
- Maintenances planifiées et correctives
- Affectations à des chantiers/équipes
- Alertes maintenance

### 9.7 Alertes

- Système d'alertes intelligent
- Niveaux de sévérité (critique, élevée, moyenne, info)
- Marquer lu / marquer toutes lues
- Notifications dans Topbar

### 9.8 Dashboard

- 11 vues différentes selon le rôle
- Graphiques Chart.js (11 types)
- Statistiques en temps réel
- Top chantiers, évolution CA
- Présence équipe (RH)

---

## 10. Configuration & Déploiement

### 10.1 Variables d'Environnement Backend

```env
# Application
APP_ENV=development
APP_DEBUG=True
APP_HOST=0.0.0.0
APP_PORT=8000
APP_NAME=TIA INFO BUILD API

# Base de données
DATABASE_URL=mysql+aiomysql://user:pass@localhost:3306/tia_build_db

# JWT
SECRET_KEY=...
SECRET_KEY_REFRESH=...
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Mots de passe
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=True
PASSWORD_REQUIRE_LOWERCASE=True
PASSWORD_REQUIRE_DIGIT=True
PASSWORD_REQUIRE_SPECIAL=True

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
CORS_CREDENTIALS=True

# Pagination
DEFAULT_PAGE_SIZE=25
MAX_PAGE_SIZE=100

# Multi-tenant
DEFAULT_ENTREPRISE_DEVISE=MGA
DEFAULT_ENTREPRISE_TVA=20.0
DEFAULT_ENTREPRISE_DELAI_PAIEMENT=30

# Logging
LOG_LEVEL=INFO
```

### 10.2 Variables d'Environnement Frontend

```env
VITE_API_URL=http://localhost:8000/api
```

### 10.3 Scripts de Démarrage

| Script | Rôle |
|--------|------|
| `Web/start-dev.ps1` | Démarrage complet (backend + frontend) |
| Backend | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` |
| Frontend | `npm run dev` (port 5173, proxy `/api` → 8000) |

### 10.4 Commandes Essentielles

```bash
# Backend
cd Web/backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python app/scripts/init_db.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd Web/frontend
npm install
npm run dev
```

---

## 11. Maintenance & Mises à Jour

### 11.1 Procédure de Mise à Jour de la Documentation

Cette section décrit comment maintenir ce document à jour après chaque modification du code.

**Quand mettre à jour :**
- Ajout/suppression d'un endpoint API
- Modification d'un modèle de données
- Ajout/suppression d'une page ou d'un composant
- Changement de configuration
- Ajout/suppression d'un rôle ou permission
- Modification de la stack technique

**Comment mettre à jour :**
1. Modifier les sections concernées de ce fichier (`WEB_APPLICATION_ANALYSIS.md`)
2. Mettre à jour le numéro de version et la date
3. Optionnel : mettre à jour `PROMPT_TIA_INFO_BUILD.md` si le prompt de génération évolue

### 11.2 Points de Vérification après Modification

| Type de Modification | Sections à Vérifier |
|----------------------|---------------------|
| Nouveau router/endpoint | §3 Architecture Backend, §7 API REST |
| Nouveau modèle DB | §3 Architecture Backend, §6 Base de Données |
| Nouvelle page/composant | §4 Architecture Frontend, §9 Fonctionnalités Métier |
| Changement RBAC | §8 RBAC & Permissions |
| Nouvelle dépendance | §2 Stack Technique |
| Nouvelle config .env | §10 Configuration & Déploiement |
| Nouvelle feature métier | §9 Fonctionnalités Métier |
| Nouvelle migration Alembic | §6.2 Migrations (vérifier `len(revision) <= 32`) |

### 11.3 Conventions de Nommage

- **Fichiers Python** : `snake_case`
- **Fichiers TypeScript** : `camelCase` pour les composants, `kebab-case` pour les services
- **Routes API** : `kebab-case` pluriel (ex: `/api/chantiers`, `/api/heures-sup`)
- **Variables d'environnement** : `UPPER_SNAKE_CASE`
- **Rôles** : `snake_case` (ex: `admin_entreprise`)
- **Révisions Alembic** : `NNN_description_courte` (max 32 caractères, limite de la colonne `version_num`)
  - ✅ `013_add_notifications`
  - ✅ `014_fix_column`
  - ❌ `013_add_new_table_for_customer_invoices` (tronqué !)

---

*Document mis à jour le 2026-09-03 — À mettre à jour après chaque modification significative du code.*
