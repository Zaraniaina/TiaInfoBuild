# PLAN DE MIGRATION TIA INFO BUILD — Desktop → Web
## Architecture: FastAPI + React TypeScript + Bootstrap 5

---

## 1. RÉSUMÉ DU PROJET

**Objectif** : Recréer à 100% l'application Desktop Electron TiaInfoBuild en application web avec:
- **Backend**: FastAPI + SQLAlchemy + Alembic + PostgreSQL
- **Frontend**: React 19 + TypeScript + Vite + Bootstrap 5 + Chart.js
- **Auth**: JWT Access Token + Refresh Token (rotation)
- **Nouveau rôle**: Super Admin (propriétaire SaaS qui gère les entreprises/clientes)
- **Équivalence**: Toutes les interfaces et fonctionnalités Desktop doivent être reproduites

**État actuel**:
- Desktop: Application complète (Electron + SQLite, 35 tables, 22 repos, 11 ctrl, 25 vues)
- Web Backend: Vide (requirements.txt + venv Python 3.14)
- Web Frontend: Squelette Vite/React vide (App.tsx template)

---

## 2. ARCHITECTURE GLOBALE

### 2.1 Stack Technique Finale

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Backend API | FastAPI 0.141 | Performances async, auto OpenAPI, typage fort |
| ORM | SQLAlchemy 2.0 async | Support async natif, Alembic, mature |
| Migrations | Alembic 1.19 | Versioning schéma base |
| Base de données | PostgreSQL 16 | ACID, JSONB, performant multi-tenant |
| Auth | JWT + Refresh Token | PyJWT, rotation, sécurisé |
| Frontend | React 19 + TS | Hooks, Server Components |
| Build | Vite 8 | HMR rapide, ESM natif |
| UI | Bootstrap 5.3 + Bootstrap Icons | Identique au Desktop |
| Charts | Chart.js 4 + chartjs-plugin-zoom | Graphiques dashboard |
| State | Context API + TanStack Query | Cache serveur |
| Forms | React Hook Form + Zod | Validation performante |
| HTTP Client | Axios | Intercepteurs, upload |
| États globaux | Zustand | Auth store, UI store |
| Tests backend | Pytest + pytest-asyncio + httpx | Tests unitaires + intégration |
| Tests frontend | Vitest + React Testing Library | Tests composants |
| Lint/Format | Ruff (backend) / ESLint + Prettier (frontend) | Qualité code |
| CI/CD | Makefile + GitHub Actions | Build, test, lint |

### 2.2 Architecture Backend Structure

```
Web/backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Point d'entrée FastAPI + routers
│   ├── config.py               # Settings Pydantic Settings + .env
│   ├── database.py             # Async engine, AsyncSession, Base
│   ├── middleware.py           # CORS, GZip, logging
│   ├── security.py             # JWT, hashing (pwdlib), permissions
│   │
│   ├── models/                 # SQLAlchemy 2.0 declarative (26 modèles)
│   │   ├── __init__.py
│   │   ├── entreprise.py
│   │   ├── role.py
│   │   ├── utilisateur.py
│   │   ├── preference.py
│   │   ├── chantier.py
│   │   ├── phase.py
│   │   ├── incident.py
│   │   ├── affectation_ressource.py
│   │   ├── employe.py
│   │   ├── equipe.py
│   │   ├── membre_equipe.py
│   │   ├── affectation_chantier.py
│   │   ├── pointage.py
│   │   ├── heure_supplementaire.py
│   │   ├── materiel.py
│   │   ├── affectation_materiel.py
│   │   ├── maintenance.py
│   │   ├── alerte_materiel.py
│   │   ├── article.py
│   │   ├── fournisseur.py
│   │   ├── mouvement_stock.py
│   │   ├── client.py
│   │   ├── client_adresse.py
│   │   ├── devis.py
│   │   ├── ligne_devis.py
│   │   ├── contrat.py
│   │   ├── facture.py
│   │   ├── paiement.py
│   │   ├── depense.py
│   │   ├── rapport_financier.py
│   │   ├── alerte.py
│   │   ├── historique_connexion.py
│   │   ├── historique_poste.py
│   │   ├── sync_queue.py
│   │   └── refresh_token.py
│   │
│   ├── schemas/                # Pydantic V2 schemas (response/request)
│   │   ├── __init__.py
│   │   ├── auth.py             # LoginRequest, Token, TokenPayload, UserCreate
│   │   ├── entreprise.py
│   │   ├── role.py
│   │   ├── utilisateur.py
│   │   ├── chantier.py
│   │   ├── employe.py
│   │   ├── pointage.py
│   │   ├── equipe.py
│   │   ├── article.py
│   │   ├── fournisseur.py
│   │   ├── mouvement_stock.py
│   │   ├── client.py
│   │   ├── client_adresse.py
│   │   ├── devis.py
│   │   ├── ligne_devis.py
│   │   ├── contrat.py
│   │   ├── facture.py
│   │   ├── paiement.py
│   │   ├── depense.py
│   │   ├── materiel.py
│   │   ├── maintenance.py
│   │   ├── alerte.py
│   │   └── dashboard.py
│   │
│   ├── crud/                   # Opérations CRUD async
│   │   ├── __init__.py
│   │   ├── base.py             # BaseCRUD avec create/read/update/delete/paginate
│   │   ├── entreprise.py
│   │   ├── role.py
│   │   ├── utilisateur.py
│   │   ├── chantier.py
│   │   ├── employe.py
│   │   ├── pointage.py
│   │   ├── equipe.py
│   │   ├── article.py
│   │   ├── fournisseur.py
│   │   ├── mouvement_stock.py
│   │   ├── client.py
│   │   ├── devis.py
│   │   ├── facture.py
│   │   ├── paiement.py
│   │   ├── depense.py
│   │   ├── materiel.py
│   │   ├── alerte.py
│   │   ├── historique_poste.py
│   │   └── dashboard.py
│   │
│   ├── routers/                # APIRouter (22 routeurs)
│   │   ├── __init__.py
│   │   ├── auth.py             # login, register, refresh, me, logout, change-password
│   │   ├── super_admin.py      # Gestion entreprises + utilisateurs plateforme
│   │   ├── utilisateurs.py     # CRUD utilisateurs (admin)
│   │   ├── dashboard.py        # Stats, KPIs + graphiques
│   │   ├── chantiers.py        # CRUD chantiers + phases + incidents + affectations
│   │   ├── rh.py               # Employés, pointages, équipes, heures sup
│   │   ├── stocks.py           # Articles, mouvements, fournisseurs
│   │   ├── commercial.py       # Clients, devis, contrats, factures, paiements
│   │   ├── finance.py          # Dépenses, rapports, alertes
│   │   ├── materiels.py        # Matériels, maintenances
│   │   ├── alertes.py          # Alertes globales
│   │   ├── historique.py       # Historique connexions
│   │   ├── parametres.py       # Entreprise config, settings
│   │   └── sync.py             # Sync offline (pour migration desktop)
│   │
│   ├── dependencies/
│   │   ├── __init__.py
│   │   ├── auth.py             # get_current_user, get_current_active_user, super_admin
│   │   ├── database.py         # get_async_session
│   │   └── permissions.py      # require_permission(permission_code)
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── permissions.py      # RBAC mapping (27 rôles → permissions)
│   │   ├── numerotation.py     # Génération codes DEV-YYYY-NNNNN etc.
│   │   ├── export.py           # CSV export helper
│   │   ├── import_csv.py       # CSV import helper
│   │   ├── pdf.py              # PDF generation (ReportLab)
│   │   └── scheduler.py        # Background tasks (alerts, rappels)
│   │
│   └── scripts/
│       ├── init_db.py          # Création schéma + seed rôles
│       ├── create_super_admin.py
│       └── migrate_sqlite.py   # Migration Desktop → Web
│
├── alembic/
│   ├── env.py                  # async config
│   ├── script.py.mako
│   └── versions/
│       ├── 001_initial_schema.py
│       ├── 002_add_historique_poste.py
│       ├── 003_add_refresh_tokens.py
│       └── migration_plan.md
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # Fixtures: AsyncClient, test DB
│   ├── test_auth.py
│   ├── test_utilisateurs.py
│   ├── test_super_admin.py
│   ├── test_chantiers.py
│   ├── test_rh.py
│   ├── test_stocks.py
│   ├── test_commercial.py
│   ├── test_finance.py
│   ├── test_materiels.py
│   └── test_migrations.py
│
├── requirements.txt
├── requirements-dev.txt
├── .env.example
├── .env
├── Dockerfile
└── run.py                      # Lanceur manuel uvicorn
```

### 2.3 Architecture Frontend Structure

```
Web/frontend/src/
├── main.tsx                     # Rendu React + BrowserRouter + QueryClientProvider
├── App.tsx                      # Layout principal
├── index.css                    # Design system TIA (23 CSS variables)
├── vite-env.d.ts
├── vite.config.ts
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          # Navigation identique Desktop (264px)
│   │   ├── Topbar.tsx           # Topbar + notifications + sync + profil
│   │   ├── Layout.tsx           # Wrapper layout protégé
│   │   └── RoleBadge.tsx        # Badge rôle dans sidebar
│   │
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   │
│   ├── ui/
│   │   ├── TiaButton.tsx       # btn-tia-primary / btn-tia-navy
│   │   ├── TiaModal.tsx        # Modal avec styled header
│   │   ├── TiaTable.tsx        # Table avec hover, responsive
│   │   ├── TiaPagination.tsx
│   │   ├── TiaSearchBar.tsx
│   │   ├── KpiCard.tsx         # .kpi-card avec hover/transition
│   │   ├── TiaBadge.tsx        # .badge-actif / badge-inactif
│   │   ├── TiaCard.tsx
│   │   ├── TiaDropdown.tsx
│   │   ├── EmptyState.tsx
│   │   └── PermissionGuard.tsx # Masquage éléments selon role
│   │
│   └── charts/
│       ├── CaEvolutionChart.tsx
│       ├── TopChantiersChart.tsx
│       ├── DepartesParCategorieChart.tsx
│       └── DashboardCharts.tsx
│
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   │
│   ├── dashboard/
│   │   └── DashboardPage.tsx  # KPIs + Chart.js + quick actions
│   │
│   ├── chantiers/
│   │   └── ChantiersPage.tsx
│   │
│   ├── rh/
│   │   ├── EmployesPage.tsx   # + timeline carrière + changement poste
│   │   ├── PointagesPage.tsx
│   │   ├── EquipesPage.tsx
│   │   └── HeuresSupPage.tsx
│   │
│   ├── stocks/
│   │   ├── StocksPage.tsx     # Onglets Articles/Mouvements/Fournisseurs
│   │   ├── MouvementsPage.tsx
│   │   └── FournisseursPage.tsx
│   │
│   ├── commercial/
│   │   ├── ClientsPage.tsx
│   │   ├── DevisPage.tsx
│   │   ├── ContratsPage.tsx
│   │   ├── FacturesPage.tsx
│   │   └── PaiementsPage.tsx
│   │
│   ├── finance/
│   │   ├── FinancePage.tsx    # Onglets Factures/Paiements/Dépenses
│   │   ├── DepensesPage.tsx
│   │   ├── RapportsPage.tsx
│   │   └── AlertesPage.tsx
│   │
│   ├── materiels/
│   │   └── MaterielsPage.tsx
│   │
│   ├── alertes/
│   │   └── AlertesPage.tsx
│   │
│   ├── historique-logins/
│   │   └── HistoriqueLoginsPage.tsx
│   │
│   ├── settings/
│   │   └── SettingsPage.tsx   # 6 onglets
│   │
│   └── super-admin/
│       ├── DashboardPage.tsx  # Stats plateforme
│       ├── EntreprisesPage.tsx
│       └── UtilisateursPage.tsx
│
├── hooks/
│   ├── useAuth.ts
│   ├── usePermissions.ts
│   ├── useApi.ts
│   └── useExport.ts
│
├── services/
│   ├── api.ts               # Axios instance + interceptors (token refresh auto)
│   ├── auth.service.ts
│   ├── chantiers.service.ts
│   ├── rh.service.ts
│   ├── stocks.service.ts
│   ├── commercial.service.ts
│   ├── finance.service.ts
│   ├── materiels.service.ts
│   ├── alertes.service.ts
│   ├── parametres.service.ts
│   └── super-admin.service.ts
│
├── stores/
│   ├── auth.store.ts        # Zustand: user, tokens, login/logout/refresh
│   └── ui.store.ts          # Sidebar state, theme, notifications
│
├── types/
│   ├── auth.ts
│   ├── entreprise.ts
│   ├── utilisateur.ts
│   ├── chantier.ts
│   ├── rh.ts
│   ├── stocks.ts
│   ├── commercial.ts
│   ├── finance.ts
│   ├── materiel.ts
│   ├── dashboard.ts
│   └── index.ts
│
├── utils/
│   ├── permissions.ts   # PERMISSION_MAP (identique Desktop)
│   ├── format.ts       # Dates, devises, nombres
│   └── export.ts       # CSV helpers
│
├── styles/
│   ├── tia-design.css      # Design system (23 variables)
│   ├── bootstrap-override.css
│   └── index.css
│
└── assets/
    └── logo.svg
```

---

## 3. SCHÉMA BASE DE DONNÉES COMPLET (26 tables)

### 3.1 Tables

#### Table 1: entreprises
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | SERIAL | PK | ID unique |
| nom | VARCHAR(255) | NOT NULL | Nom entreprise |
| nom_commercial | VARCHAR(255) | NULL | Nom commercial |
| adresse | TEXT | NULL | Adresse |
| code_postal | VARCHAR(20) | NULL | Code postal |
| ville | VARCHAR(100) | NULL | Ville |
| telephone | VARCHAR(50) | NULL | Téléphone |
| email | VARCHAR(255) | NULL | Email |
| logo | TEXT | NULL | Logo (URL) |
| abonnement | VARCHAR(50) | DEFAULT 'gratuit' | Type abonnement |
| devise | VARCHAR(10) | DEFAULT 'MGA' | Devise |
| siret | VARCHAR(50) | NULL | SIRET |
| numero_tva | VARCHAR(50) | NULL | TVA |
| code_ape | VARCHAR(20) | NULL | Code APE |
| site_web | VARCHAR(255) | NULL | Site web |
| prefixe_devis | VARCHAR(10) | DEFAULT 'DEV' | Préfixe devis |
| prefixe_facture | VARCHAR(10) | DEFAULT 'FAC' | Préfixe facture |
| prefixe_contrat | VARCHAR(10) | DEFAULT 'CTR' | Préfixe contrat |
| tva_defaut | NUMERIC(5,2) | DEFAULT 20.00 | TVA défaut |
| delai_paiement_defaut | INTEGER | DEFAULT 30 | Délai paiement |
| validite_devis | INTEGER | DEFAULT 30 | Validité devis (jours) |
| mentions_legales | TEXT | NULL | Mentions légales |
| actif | BOOLEAN | DEFAULT TRUE | Entreprise active |
| date_creation | TIMESTAMP | DEFAULT NOW() | Date création |
| created_at | TIMESTAMP | DEFAULT NOW() | Création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Modification |

#### Table 2: roles
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | SERIAL | PK | ID |
| nom | VARCHAR(100) | NOT NULL | Nom rôle |
| description | TEXT | NULL | Description |
| code | VARCHAR(50) | UNIQUE NOT NULL | Code unique |
| permissions | JSONB | DEFAULT '{}' | Permissions JSON |
| is_system | BOOLEAN | DEFAULT FALSE | Rôle système |
| created_at | TIMESTAMP | DEFAULT NOW() | Création |
| updated_at | TIMESTAMP | DEFAULT NOW() | Modification |

#### Table 3: utilisateurs
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | SERIAL | PK | ID |
| entreprise_id | INTEGER | FK entreprises(id) ON DELETE CASCADE | Entreprise |
| role_id | INTEGER | FK roles(id) | Rôle |
| nom | VARCHAR(100) | NOT NULL | Nom |
| prenom | VARCHAR(100) | NULL | Prénom |
| email | VARCHAR(255) | UNIQUE NOT NULL | Email |
| telephone | VARCHAR(50) | NULL | Tél |
| mot_de_passe_hash | VARCHAR(255) | NOT NULL | Hash MDP |
| statut | VARCHAR(20) | DEFAULT 'actif' | Statut |
| date_creation | TIMESTAMP | DEFAULT NOW() | Création compte |
| derniere_connexion | TIMESTAMP | NULL | Dernière connexion |
| must_change_password | BOOLEAN | DEFAULT FALSE | Doit changer MDP |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

**NOTE Super Admin**: `entreprise_id = NULL` pour le Super Admin (n'appartient à aucune entreprise)

#### Table 4: preferences
| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | SERIAL | PK | |
| user_id | INTEGER | UNIQUE FK | Utilisateur |
| theme | VARCHAR(20) | 'auto' | Thème |
| langue | VARCHAR(10) | 'fr' | Langue |
| date_format | VARCHAR(20) | 'DD/MM/YYYY' | Format date |
| devise | VARCHAR(10) | 'MGA' | Devise |
| notif_email | BOOLEAN | TRUE | Notif email |
| notif_push | BOOLEAN | TRUE | Notif push |
| notif_factures_retard | BOOLEAN | TRUE | Factures retard |
| notif_stock_bas | BOOLEAN | TRUE | Stock bas |
| created_at | TIMESTAMP | NOW() | |
| updated_at | TIMESTAMP | NOW() | |

#### Table 5: historique_connexions
| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | SERIAL | PK | |
| utilisateur_id | INTEGER | FK | Utilisateur |
| ip_address | VARCHAR(45) | NULL | IP |
| user_agent | TEXT | NULL | User agent |
| reussi | BOOLEAN | TRUE | Connexion réussie |
| date_connexion | TIMESTAMP | NOW() | Date |

#### Table 6: chantiers
| Colonne | Type | Description |
|---------|------|-------------|
| id | SERIAL | PK |
| entreprise_id | INTEGER | FK entreprises |
| client_id | INTEGER | FK clients |
| chef_chantier_id | INTEGER | FK utilisateurs |
| numero | VARCHAR(50) | Numéro |
| nom | VARCHAR(255) | NOT NULL |
| adresse | TEXT | Adresse |
| code_postal | VARCHAR(20) | CP |
| ville | VARCHAR(100) | Ville |
| date_debut | DATE | Début |
| date_fin_prevue | DATE | Fin prévue |
| date_fin_reelle | DATE | Fin réelle |
| budget_prevu | NUMERIC(12,2) | DEFAULT 0 | Budget prévu |
| budget_previsionnel | NUMERIC(12,2) | DEFAULT 0 | Budget prévisionnel |
| budget_reel | NUMERIC(12,2) | DEFAULT 0 | Budget réel |
| marge_cible | NUMERIC(5,2) | DEFAULT 0 | Marge cible |
| tva | NUMERIC(5,2) | DEFAULT 20.00 | TVA |
| statut | VARCHAR(20) | DEFAULT 'planification' | planification/en_cours/suspendu/termine/annule |
| description | TEXT | Description |
| is_deleted | BOOLEAN | DEFAULT FALSE | Soft delete |
| created_at | TIMESTAMP | NOW() | |
| updated_at | TIMESTAMP | NOW() | |

*(Les 20 tables suivantes suivent le même pattern - voir schema.sql ci-dessous pour la version complète)*

#### Tables 7-35: phase, incident, affectation_ressource, employe, equipe, membre_equipe, affectation_chantier, pointage, heure_supplementaire, materiel, affectation_materiel, maintenance, alerte_materiel, article, fournisseur, mouvement_stock, client, client_adresse, devis, ligne_devis, contrat, facture, paiement, depense, rapport_financier, alerte, historique_poste, sync_queue, refresh_tokens

**Note importante**: Toutes les tables métier (sauf roles, refresh_tokens, historique_connexions) ont:
- `entreprise_id` pour le multi-tenant (NULL autorisé pour super_admin)
- `is_deleted` pour le soft delete
- `created_at` / `updated_at` timestamps

### 3.2 Permissions RBAC Détaillées

| Code Rôle | Nom | Niveau | Permissions |
|-----------|-----|--------|-------------|
| super_admin | Super Admin (SaaS) | 0 | Toutes (accès global, entreprise_id=NULL) |
| admin_entreprise | Admin Entreprise | 1 | Toutes permissions entreprise (sauf gestion entreprises) |
| directeur | Direction Générale | 2 | Dashboard read, chantiers read, finance read, rapports read |
| chef_chantier | Chef de Chantier | 3 | Chantiers CRUD, RH CRUD, matériels read, stocks read |
| chef_projet | Chef de Projet | 3 | Chantiers CRUD, dashboard read |
| comptable | Comptable | 3 | Finance CRUD, commercial read |
| rh | Responsable RH | 3 | RH CRUD (employés, pointages, équipes, heures sup) |
| materiel | Responsable Matériel | 3 | Matériels CRUD, alertes matériel read |
| magasinier | Magasinier | 3 | Stocks CRUD (articles, mouvements, fournisseurs) |
| commercial | Commercial | 3 | Commercial CRUD (clients, devis, contrats, factures, paiements) |
| employe | Employé | 4 | RH read, chantiers read |
| client | Client | 4 | Commercial read (devis, factures) |

### 3.3 Fichier de Migration Alembic

Le fichier `alembic/versions/001_initial_schema.py` contiendra la création complète des 26 tables avec toutes les colonnes, clés étrangères et index décrites dans le schema SQL ci-dessus.

**Migrations additionnelles**:
- `002_add_historique_poste.py`: Ajout table `historique_postes` + colonnes `type_contrat`, `date_debut_contrat`, `date_fin_contrat` sur `employes`
- `003_add_refresh_tokens.py`: Ajout table `refresh_tokens`
- `004_seed_roles.py`: Insertion des rôles système
- `005_seed_super_admin.py`: Création du premier Super Admin

---

## 4. AUTHENTIFICATION & SÉCURITÉ

### 4.1 Architecture JWT + Refresh Token

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Client    │──────▶│   FastAPI   │──────▶│ PostgreSQL  │
│  (React)    │       │   Backend   │       │             │
└─────────────┘       └─────────────┘       └─────────────┘
        │                       │
        │ 1. POST /auth/login   │
        │    {email, password}  │
        │──────────────────────▶│
        │                       │ 2. Vérifier mot_de_passe_hash
        │                       │ 3. Créer access_token (15 min, algo HS256)
        │                       │ 4. Créer refresh_token (7 jours)
        │                       │ 5. Stocker hash(refresh_token) en DB
        │                       │ 6. Logger connexion dans historique
        │                       │ 7. Retourner {access, refresh, user}
        │◀──────────────────────│
        │ 8. {access, refresh,  │
        │    user}              │
        │                       │
        │ 9. Requêtes avec      │
        │    Authorization:     │
        │    Bearer <access>    │
        │──────────────────────▶│
        │                       │
        │10. Access expiré (401)│
        │◀──────────────────────│
        │                       │
        │11. POST /auth/refresh │
        │    {refresh_token}    │
        │──────────────────────▶│
        │                       │ 12. Vérifier refresh_token hash
        │                       │ 13. Vérifier non révoqué
        │                       │ 14. Rotation: révoquer ancien
        │                       │     + créer nouveau refresh
        │                       │ 15. Nouveau access_token
        │◀──────────────────────│
        │16. {access, refresh}  │
        │                       │
        │17. POST /auth/logout  │
        │    {refresh_token}    │
        │──────────────────────▶│
        │                       │ 18. Révoquer refresh_token en DB
        │◀──────────────────────│
```

### 4.2 Endpoints Auth Détaillés

| Méthode | Endpoint | Description | Accès |
|---------|----------|-------------|-------|
| POST | `/api/auth/login` | Connexion: vérifie MDP, créer tokens, logger connexion | Public |
| POST | `/api/auth/register` | Inscription nouvel utilisateur (invite ou super_admin) | Public (avec code invitation) / admin |
| POST | `/api/auth/refresh` | Rafraîchir access_token via refresh_token | Public |
| POST | `/api/auth/logout` | Révoquer refresh_token, invalider session | Authentifié |
| POST | `/api/auth/change-password` | Changer mot de passe (ancien + nouveau) | Authentifié |
| POST | `/api/auth/invite` | Inviter utilisateur (admin entreprise) | admin_entreprise+ |
| GET | `/api/auth/me` | Retourner utilisateur courant + rôle + entreprise | Authentifié |
| GET | `/api/auth/permissions` | Retourner liste permissions utilisateur | Authentifié |

### 4.3 Schéma Token JWT

```json
// Access Token (15 min)
{
  "sub": "1",           // utilisateur_id
  "email": "user@email.mg",
  "role_code": "admin_entreprise",
  "entreprise_id": 5,   // NULL pour super_admin
  "permissions": ["chantiers:*", "rh:*"],
  "type": "access",
  "exp": 1750000000,    // 15 min
  "iat": 1749999000
}

// Refresh Token (7 jours) - stocké en DB (hashé)
{
  "sub": "1",
  "type": "refresh",
  "exp": 1751000000,    // 7 jours
  "iat": 1749999000,
  "jti": "uuid-unique"  // Identifiant unique token
}
```

### 4.4 Sécurité Backend (FastAPI)

- **Mot de passe**: Haché avec Argon2id via `pwdlib[argon2]`
- **Access Token**: 15 minutes, HS256
- **Refresh Token**: 7 jours, rotation (révoquer ancien à chaque refresh)
- **Store refresh token**: Hash SHA256 + stocké en DB
- **Rate limiting**: redis-slowapi (login, register, refresh)
- **CSRF**: Protection sur cookies (mode cookieHttpOnly)
- **Validation**: Pydantic V2 partout, Zod côté frontend
- **Middleware**: Multi-tenant (injecte `request.entree_id` si user est dans une entreprise)

---

## 5. ÉQUIVALENCE DES INTERFACES DESKTOP → WEB

### 5.1 Matrice Interface → Route Web

| Module Desktop | Fichiers Desktop | Page Web (React) | Route API | Notes |
|----------------|-----------------|-------------------|-----------|-------|
| Auth Login | views/login.html, login.js | LoginPage.tsx + LoginForm.tsx | POST `/api/auth/login` | Identique design split panel |
| Auth Register | views/register.html | RegisterPage.tsx (invitation) | POST `/api/auth/register` | Avec code d'invitation |
| Dashboard | views/dashboard.html, dashboard.js | DashboardPage.tsx | GET `/api/dashboard/stats` | Chart.js + quick actions |
| Chantiers | views/chantiers/index.html | ChantiersPage.tsx | GET/POST/PUT `/api/chantiers` | CRUD + phases + incidents |
| RH Employés | rh/employes/index.html | EmployesPage.tsx | GET/POST `/api/rh/employes` | Timeline + changement poste |
| RH Pointages | rh/pointages/index.html | PointagesPage.tsx | GET/POST `/api/rh/pointages` | Filtres employé/chantier/dates |
| RH Équipes | rh/equipes/index.html | EquipesPage.tsx | GET/POST `/api/rh/equipes` | Membres + chantiers assignés |
| RH Heures Sup | rh/heures-sup/index.html | HeuresSupPage.tsx | GET/POST `/api/rh/heures-sup` | Validation + KPI |
| Stocks | views/stocks/index.html | StocksPage.tsx | GET/POST `/api/stocks/articles` | Onglets Articles/Mouvements/Fournisseurs |
| Stocks Mouvements | stocks/mouvements/index.html | StocksPage.tsx (tab) | GET/POST `/api/stocks/mouvements` | KPIs + filtres |
| Stocks Fournisseurs | stocks/fournisseurs/index.html | FournisseursPage.tsx | GET/POST `/api/stocks/fournisseurs` | Grille cartes |
| Commercial Clients | commercial/clients/index.html | ClientsPage.tsx | GET/POST `/api/commercial/clients` | Adresses multiples, import CSV |
| Commercial Devis | commercial/devis/index.html | DevisPage.tsx | GET/POST `/api/commercial/devis` | Lignes + calculs + transform contrat |
| Commercial Contrats | commercial/contrats/index.html | ContratsPage.tsx | GET/POST `/api/commercial/contrats` | CRUD complet |
| Commercial Factures | commercial/factures/index.html | FacturesPage.tsx | GET/POST `/api/commercial/factures` | Lignes + paiements intégrés |
| Commercial Paiements | commercial/paiements/index.html | PaiementsPage.tsx | GET/POST `/api/commercial/paiements` | KPI + filtres |
| Finance | views/finance/index.html | FinancePage.tsx | GET `/api/finance/stats` | Onglets Factures/Paiements/Dépenses |
| Finance Dépenses | finance/depenses/index.html | DepensesPage.tsx | GET/POST `/api/finance/depenses` | Validation + export |
| Finance Rapports | finance/rapports/index.html | RapportsPage.tsx | GET `/api/finance/rapports` | CSV/PDF export |
| Finance Alertes | finance/alertes/index.html | AlertesPage.tsx | GET/POST `/api/alertes` | Filtres + marquer lue |
| Matériels | views/materiels/index.html | MaterielsPage.tsx | GET/POST `/api/materiels` | CRUD + maintenance status |
| Alertes Globales | views/alertes/index.html | AlertesPage.tsx | GET `/api/alertes/globales` | Badge dans topbar |
| Historique Connexions | historique-logins/index.html | HistoriqueLoginsPage.tsx | GET `/api/historique-connexions` | CSV/PDF export |
| Settings Entreprise | settings.html | SettingsPage.tsx (tab 1) | PUT `/api/parametres/entreprise` | Config entreprise |
| Settings Facturation | settings.html | SettingsPage.tsx (tab 2) | PUT `/api/parametres/facturation` | Prefixes, TVA |
| Settings Utilisateurs | settings.html | SettingsPage.tsx (tab 3) | GET/POST `/api/utilisateurs` | CRUD + rôles |
| Settings Profil | settings.html | SettingsPage.tsx (tab 4) | PUT `/api/parametres/profil` | Profil courant |
| Settings Sauvegarde | settings.html | SettingsPage.tsx (tab 5) | POST `/api/parametres/backup` | Export SQLite/SQL |
| Settings Sync | settings.html | SettingsPage.tsx (tab 6) | POST `/api/sync` | Config + test connexion |
| **Super Admin** | **N/A** | **super-admin/DashboardPage.tsx** | GET `/api/super-admin/stats` | **Nouveau** |
| **Super Admin Entreprises** | **N/A** | **super-admin/EntreprisesPage.tsx** | GET/POST `/api/super-admin/entreprises` | **Nouveau** |
| **Super Admin Users** | **N/A** | **super-admin/UtilisateursPage.tsx** | GET `/api/super-admin/utilisateurs` | **Nouveau** |

---

## 6. PLAN DE MIGRATION DES DONNÉES (SQLite → PostgreSQL)

### 6.1 Script: `app/scripts/migrate_sqlite.py`

```python
"""
Script de migration des données du Desktop (SQLite) vers la Web (PostgreSQL).

Étapes:
1. Lire le fichier Desktop/tia_info_build.sqlite
2. Transformer les données (mapping colonnes, rôles)
3. Insérer dans la base PostgreSQL web
4. Logs détaillés
"""
```

### 6.2 Mapping Colonnes SQLite → PostgreSQL

| Table SQLite | Table PostgreSQL | Mapping Colonnes |
|--------------|------------------|-----------------|
| Utilisateur | utilisateurs | id→id (réattribué), email→email, motDePasseHash→mot_de_passe_hash, roleId→role_id, entrepriseId→entreprise_id, is_deleted→is_deleted, createdAt→created_at, updatedAt→updated_at, dateCreation→date_creation, derniereConnexion→derniere_connexion, statut→statut, telephone→telephone, nom→nom, prenom→prenom |
| Role | roles | id→id, nom→nom, code→code, permissions→permissions (JSON) |
| Chantier | chantiers | (identique pattern snake_case) |
| Phase | phases | (identique) |
| Employe | employes | + type_contrat, date_debut_contrat, date_fin_contrat (valeurs par défaut) |
| Pointage | pointages | (identique) |
| HeureSupplementaire | heures_supplementaires | (identique) |
| Equipe | equipes | (identique) |
| MembreEquipe | membres_equipe | (identique) |
| Article | articles | (identique) |
| MouvementStock | mouvements_stock | (identique) |
| Fournisseur | fournisseurs | (identique) |
| Client | clients | (identique) |
| ClientAdresse | client_adresses | (identique) |
| Devis | devis | + lignes_devis |
| LigneDevis | lignes_devis | (identique) |
| Contrat | contrats | (identique) |
| Facture | factures | + montant_paye, statut transitions |
| Paiement | paiements | (identique) |
| Depense | depenses | (identique) |
| Alerte | alertes | (identique) |
| Materiel | materiaux | (identique) |
| Maintenance | maintenances | (identique) |

### 6.3 Migration Rôles

```sql
-- Rôles Desktop → Web (mapping code)
-- super_admin → super_admin (gardé, mais entreprise_id=NULL)
-- admin → admin_entreprise
-- commercial → commercial
-- chef_chantier → chef_chantier
-- technicien → chef_chantier (regroupé)
-- employe → employe
-- client → client
-- NOUVEAU: directeur, chef_projet, comptable, rh, materiel, magasinier
```

### 6.4 Commandes Migration

```bash
# 1. Exporter SQLite
python app/scripts/export_sqlite.py --db Desktop/tia_info_build.sqlite --output /tmp/sqlite_export/

# 2. Exécuter migration
python app/scripts/migrate_sqlite.py --sqlite /tmp/sqlite_export/ --target postgresql://user:pass@localhost/tia_build_web

# 3. Vérifier
python app/scripts/verify_migration.py --source Desktop/tia_info_build.sqlite --target postgresql://...
```

---

## 7. PLAN D'IMPLÉMENTATION PAR PHASES

### Phase 1: Infrastructure & Bootstrap (Jours 1-3)

#### Jour 1: Initialisation Backend
- [ ] Créer structure projet `Web/backend/app/`
- [ ] Créer `config.py` (Pydantic Settings, .env)
- [ ] Créer `database.py` (async engine, session)
- [ ] Créer `main.py` (FastAPI, routers, middleware)
- [ ] Configurer Alembic
- [ ] Écrire le **premier schéma SQL complet** (26 tables)
- [ ] Créer `alembic/versions/001_initial_schema.py`

#### Jour 2: Auth & Security
- [ ] Créer `security.py` (JWT, hashing)
- [ ] Créer modèles SQLAlchemy: `role`, `utilisateur`, `entreprise`, `preference`, `refresh_token`
- [ ] Créer Pydantic schemas: `auth.py`
- [ ] Créer `crud/auth.py`, `crud/role.py`, `crud/utilisateur.py`
- [ ] Créer `routers/auth.py`, `routers/super_admin.py`
- [ ] Implémenter login, refresh, register, logout, me

#### Jour 3: Frontend Core
- [ ] Installer dépendances: bootstrap, bootstrap-icons, axios, zustand, chart.js, react-hook-form, zod
- [ ] Copier `tia-design.css` depuis Desktop
- [ ] Créer `main.tsx` (BrowserRouter, QueryClientProvider, AuthProvider)
- [ ] Créer layout: `Sidebar.tsx`, `Topbar.tsx`, `Layout.tsx`
- [ ] Créer pages auth: `LoginPage.tsx`, `RegisterPage.tsx`
- [ ] Créer `services/api.ts` (Axios interceptors: auto refresh)
- [ ] Créer `stores/auth.store.ts` (Zustand)
- [ ] Tester login flow end-to-end

### Phase 2: Modules Core - Chantiers (Jours 4-6)

#### Jour 4: Chantiers Backend
- [ ] Créer modèles: `chantier`, `phase`, `incident`, `affectation_ressource`
- [ ] Créer Pydantic schemas: `chantier.py`
- [ ] CRUD chantiers (`crud/chantier.py`)
- [ ] Router: `routers/chantiers.py` (CRUD + phases + incidents + affectations)
- [ ] Seed data: 5 chantiers test
- [ ] Écrire tests (`tests/test_chantiers.py`)

#### Jour 5: Chantiers Frontend
- [ ] Créer service API
- [ ] Créer page `ChantiersPage.tsx`
- [ ] Implémenter liste, recherche, filtres (statut)
- [ ] Modale CRUD chantier
- [ ] Gestion phases (drag-drop, draft)
- [ ] Gestion incidents
- [ ] Export CSV

#### Jour 6: Dashboard
- [ ] Backend: `routers/dashboard.py` + CRUD
- [ ] Frontend: `DashboardPage.tsx`
- [ ] KPIs (6 cards identiques Desktop)
- [ ] Graphiques Chart.js (CA évolution, top chantiers)
- [ ] Quick actions (selon rôle)
- [ ] Test RBAC sur dashboard

### Phase 3: Modules Core - RH (Jours 7-9)

#### Jour 7: RH Backend + Frontend (Employés + HistoriquePoste)
- [ ] Modèles: `employe`, `historique_poste`
- [ ] CRUD employés + historique carrière
- [ ] Router `/api/rh/employes`
- [ ] Frontend `EmployesPage.tsx` + timeline carrière
- [ ] Modale changement poste (motif, nouveau salaire, type contrat)
- [ ] Export CSV

#### Jour 8: Pointages + Équipes Backend
- [ ] Modèles: `pointage`, `equipe`, `membre_equipe`, `affectation_chantier`
- [ ] CRUD pointages + équipes + membres
- [ ] Router `/api/rh/pointages`, `/api/rh/equipes`
- [ ] Tests

#### Jour 9: Pointages + Équipes + Heures Sup Frontend
- [ ] `PointagesPage.tsx` (filtres + tableau + modale saisie)
- [ ] `EquipesPage.tsx` (CRUD + membres + chantiers)
- [ ] Heures sup (backend + frontend)

### Phase 4: Modules Core - Stocks & Commercial (Jours 10-13)

#### Jour 10: Stocks Backend + Frontend
- [ ] Modèles: `article`, `fournisseur`, `mouvement_stock`
- [ ] CRUD + updateStock + alertes
- [ ] Router `/api/stocks/*`
- [ ] Frontend: `StocksPage.tsx` (3 onglets), `FournisseursPage.tsx`, `MouvementsPage.tsx`
- [ ] Calcul auto marge article
- [ ] Export CSV

#### Jour 11: Commercial Backend (Clients + Adresses)
- [ ] Modèles: `client`, `client_adresse`
- [ ] CRUD clients + adresses multiples
- [ ] Import CSV clients avec mapping colonnes
- [ ] Router `/api/commercial/clients`
- [ ] Tests

#### Jour 12: Commercial Frontend (Clients + Devis)
- [ ] `ClientsPage.tsx` (3 onglets modal)
- [ ] `DevisPage.tsx` (lignes + calculs auto + statut)
- [ ] Export CSV
- [ ] Import CSV clients

#### Jour 13: Commercial Backend + Frontend (Contrats + Factures + Paiements)
- [ ] Modèles + CRUD: `contrat`, `facture`, `ligne_devis`, `paiement`
- [ ] Router `/api/commercial/*`
- [ ] Frontend: `ContratsPage.tsx`, `FacturesPage.tsx`, `PaiementsPage.tsx`
- [ ] Facture avec onglets (Infos/Lignes/Paiements)
- [ ] Ajouter paiement → auto-update statut
- [ ] Dupliquer facture, envoyer facture

### Phase 5: Modules Core - Finance & Matériels (Jours 14-16)

#### Jour 14: Finance Backend + Frontend (Dépenses + Alertes)
- [ ] Modèles: `depense`, `alerte`, `rapport_financier`
- [ ] CRUD dépenses + validation + alertes
- [ ] Router `/api/finance/*`, `/api/alertes`
- [ ] Frontend: `DepensesPage.tsx`, `FinancePage.tsx`
- [ ] KPIs + validation inline

#### Jour 15: Finance Frontend (Rapports + Alertes)
- [ ] `RapportsPage.tsx` (sélection période + synthèse)
- [ ] `AlertesPage.tsx` (filtres + marquer lue)
- [ ] Export CSV
- [ ] Notifications dropdown dans topbar

#### Jour 16: Matériels Backend + Frontend
- [ ] Modèles: `materiel`, `affectation_materiel`, `maintenance`, `alerte_materiel`
- [ ] CRUD matériels + maintenances
- [ ] Router `/api/materiels`
- [ ] Frontend: `MaterielsPage.tsx` (statuts, maintenance)

### Phase 6: Super Admin + Paramètres (Jours 17-18)

#### Jour 17: Super Admin
- [ ] Router `/api/super-admin/*`
- [ ] Frontend: `super-admin/DashboardPage.tsx`, `EntreprisesPage.tsx`, `UtilisateursPage.tsx`
- [ ] RBAC: super_admin bypass entreprise_id
- [ ] Création entreprise + invitation admin

#### Jour 18: Paramètres + Sync + Backup
- [ ] Router `/api/parametres/*`
- [ ] Frontend: `SettingsPage.tsx` (6 onglets)
- [ ] Sync offline (queue + push/pull)
- [ ] Backup/restore (export SQL)
- [ ] Historique connexions

### Phase 7: Finalisation (Jours 19-21)

#### Jour 19: RBAC Granulaire + Permissions UI
- [ ] Backend: décorateur `require_permission()`
- [ ] Frontend: `PermissionGuard.tsx`, `data-permission` attribute
- [ ] Tester tous les rôles sur chaque module

#### Jour 20: Tests Complets
- [ ] Tests backend: `pytest` (auth, CRUD, RBAC, multi-tenant)
- [ ] Tests frontend: `vitest` (composants, hooks)
- [ ] Tests E2E: scénarios métier

#### Jour 21: Polissage + Documentation
- [ ] Uniformiser icônes (Bootstrap Icons partout)
- [ ] Boutons `btn-tia-primary`
- [ ] Classes CSS manquantes (.kpi-card, .badge-role, etc.)
- [ ] README utilisateur + API docs
- [ ] Manuel de migration Desktop → Web

---

## 8. FICHIERS À CRÉER (Résumé)

### Backend FastAPI (Python)
```
# Models (26 fichiers SQLAlchemy)
app/models/entreprise.py, role.py, utilisateur.py, preference.py, historique_connexion.py,
chantier.py, phase.py, incident.py, affectation_ressource.py, employe.py, equipe.py,
membre_equipe.py, affectation_chantier.py, pointage.py, heure_supplementaire.py,
materiel.py, affectation_materiel.py, maintenance.py, alerte_materiel.py,
article.py, fournisseur.py, mouvement_stock.py, client.py, client_adresse.py,
devis.py, ligne_devis.py, contrat.py, facture.py, paiement.py, depense.py,
rapport_financier.py, alerte.py, historique_poste.py, sync_queue.py, refresh_token.py

# Schemas (Pydantic V2)
app/schemas/auth.py, entreprise.py, role.py, utilisateur.py, chantier.py, employe.py,
pointage.py, equipe.py, article.py, fournisseur.py, mouvement_stock.py, client.py,
client_adresse.py, devis.py, ligne_devis.py, contrat.py, facture.py, paiement.py,
depense.py, materiel.py, maintenance.py, alerte.py, dashboard.py

# CRUD (22 fichiers)
app/crud/base.py, entreprise.py, role.py, utilisateur.py, chantier.py, employe.py,
pointage.py, equipe.py, article.py, fournisseur.py, mouvement_stock.py, client.py,
devis.py, facture.py, paiement.py, depense.py, materiel.py, alerte.py,
historique_poste.py, dashboard.py

# Routers (12 fichiers APIRouter)
app/routers/auth.py, super_admin.py, chantiers.py, rh.py, stocks.py,
commercial.py, finance.py, materiels.py, alertes.py, dashboard.py,
parametres.py, sync.py

# Core
app/security.py, app/database.py, app/config.py, app/middleware.py,
app/core/permissions.py, app/core/numerotation.py, app/core/export.py,
app/core/pdf.py
```

### Frontend React TypeScript
```
# Components
src/components/layout/Sidebar.tsx, Topbar.tsx, Layout.tsx, RoleBadge.tsx
src/components/ui/TiaButton.tsx, TiaModal.tsx, TiaTable.tsx, TiaPagination.tsx,
TiaSearchBar.tsx, KpiCard.tsx, TiaBadge.tsx, TiaCard.tsx, TiaDropdown.tsx,
EmptyState.tsx, PermissionGuard.tsx
src/components/charts/CaEvolutionChart.tsx, TopChantiersChart.tsx,
DepartesParCategorieChart.tsx, DashboardCharts.tsx

# Pages (26 pages)
src/pages/auth/LoginPage.tsx, RegisterPage.tsx
src/pages/dashboard/DashboardPage.tsx
src/pages/chantiers/ChantiersPage.tsx
src/pages/rh/EmployesPage.tsx, PointagesPage.tsx, EquipesPage.tsx, HeuresSupPage.tsx
src/pages/stocks/StocksPage.tsx, MouvementsPage.tsx, FournisseursPage.tsx
src/pages/commercial/ClientsPage.tsx, DevisPage.tsx, ContratsPage.tsx,
FacturesPage.tsx, PaiementsPage.tsx
src/pages/finance/FinancePage.tsx, DepensesPage.tsx, RapportsPage.tsx, AlertesPage.tsx
src/pages/materiels/MaterielsPage.tsx
src/pages/alertes/AlertesPage.tsx
src/pages/historique-logins/HistoriqueLoginsPage.tsx
src/pages/settings/SettingsPage.tsx
src/pages/super-admin/DashboardPage.tsx, EntreprisesPage.tsx, UtilisateursPage.tsx

# Services/Hooks/Stores
src/services/api.ts (axios interceptors)
src/stores/auth.store.ts (zustand)
src/hooks/useAuth.ts, usePermissions.ts
src/utils/permissions.ts (PERMISSION_MAP)
src/utils/format.ts, export.ts
```

---

## 9. DÉPENDANCES À INSTALLER

### Backend (requirements.txt)
```txt
fastapi==0.141.1
uvicorn[standard]==0.30.6
SQLAlchemy==2.0.52
psycopg[binary]==3.2.5
alembic==1.19.1
python-jose[cryptography]==3.3.2
PyJWT==2.13.0
pwdlib[argon2]==0.2.1
python-multipart==0.0.00.00.32
email-validator==2.3.0
python-rapidjson==1.20.1
pydantic==2.13.4
pydantic-settings==2.15.0
redis==5.2.1
redis-slowapi==0.1.7
XlsxWriter==3.2.5
openpyxl==3.1.8
reportlab==4.3.1
Jinja2==3.1.6
```

### Backend Dev (requirements-dev.txt)
```txt
pytest==8.3.4
pytest-asyncio==0.25.2
pytest-cov==6.0.0
httpx==0.28.1
alembic[pytest]==1.19.1
ruff==0.9.4
black==25.1.0
```

### Frontend (package.json additions)
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.101.0",
    "axios": "^1.19.0",
    "bootstrap": "^5.3.3",
    "bootstrap-icons": "^1.13.1",
    "chart.js": "^4.4.9",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-hook-form": "^7.85.0",
    "react-router-dom": "^7.18.0",
    "zod": "^4.4.3",
    "zustand": "^5.0.3-5"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "typescript": "~6.0.2",
    "vitest": "^3.0.3",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "eslint": "^10.8.0",
    "prettier": "^3.5.0"
  }
}
```

---

## 10. COMMANDES DE DÉMARRAGE

### Setup Backend
```bash
cd Web/backend
python -m venv env
env\Scripts\activate              # Windows
# source env/bin/activate        # macOS/Linux
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Config .env (copie depuis .env.example)
# DATABASE_URL=postgresql+asyncpg://tia_user:tia_password@localhost:5432/tia_build_db
# SECRET_KEY=<generer avec: python -c "import secrets; print(secrets.token_urlsafe(32))">
# ALGORITHM=HS256
# ACCESS_TOKEN_EXPIRE_MINUTES=15
# REFRESH_TOKEN_EXPIRE_DAYS=7

# Créer la base PostgreSQL (via pgAdmin ou psql)
# psql -U postgres -c "CREATE DATABASE tia_build_db;"
# psql -U postgres -c "CREATE USER tia_user WITH PASSWORD 'tia_password';"
# psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tia_build_db TO tia_user;"

# Migrations
alembic upgrade head

# Seed rôles + super admin
python app/scripts/init_db.py
python app/scripts/create_super_admin.py --email superadmin@tia-build.mg --password changeme

# Lancer serveur
python run.py  # ou: uvicorn app.main:app --reload --port 8000
```

### Setup Frontend
```bash
cd Web/frontend
npm install

# .env
# VITE_API_URL=http://localhost:8000/api

npm run dev                          # Vite dev server sur port 5173
```

### Migration depuis Desktop (optionnel)
```bash
# 1. Copier le fichier SQLite depuis Desktop/tia_info_build.sqlite
# 2. Exécuter migration
python app/scripts/migrate_sqlite.py \
  --sqlite ../../Desktop/tia_info_build.sqlite \
  --target postgresql://tia_user:tia_password@localhost:5432/tia_build_db

# 3. Vérifier
python app/scripts/verify_migration.py
```

### Tests
```bash
# Backend
cd Web/backend
pytest -v --cov=app

# Frontend
cd Web/frontend
npm run test
```

### Production
```bash
# Build frontend
cd Web/frontend
npm run build

# Lancer avec uvicorn + frontend statique
cd Web/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 11. RISQUES & MITIGATIONS

| Risque | Mitigation |
|--------|------------|
| PostgreSQL non installé | Fournir Docker Compose pour PostgreSQL |
| Différences schema Desktop ↔ Web | Script de mapping + logs détaillés |
| Auth JWT complexe | Implémenté token rotation + refresh auto frontend |
| RBAC UI (data-permission) | Component PermissionGuard + hooks usePermissions |
| Offline sync web | Implémenté syncQueue + API offline-ready |
| Performance multi-tenant | Index sur entreprise_id + middleware injection |
| Migration données risquée | Script transactionnel + rollback |
| Différence UI Desktop ↔ Web | Design system CSS identique + composants matchés |
| Super admin entreprise_id NULL | Gérer NULL dans tous les queries multi-tenant |

### Docker Compose (fichier à créer)
```yaml
# Web/docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tia_build_db
      POSTGRES_USER: tia_user
      POSTGRES_PASSWORD: tia_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "8000:8000"
    depends_on: [db, redis]

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    depends_on: [backend]

volumes:
  postgres_data:
```

---

## 12. CHECKLIST DE VALIDATION (à cocher à la fin)

- [ ] Backend API complète (Swagger UI sur `/docs`)
- [ ] Auth JWT + Refresh Token fonctionnel
- [ ] Super Admin peut créer/gérer entreprises
- [ ] Admin entreprise peut gérer ses utilisateurs
- [ ] RBAC: chaque rôle voit/masque les bons éléments UI
- [ ] Multi-tenant: les données sont isolées par entreprise
- [ ] Dashboard avec Chart.js + KPIs
- [ ] Tous les modules CRUD fonctionnels
- [ ] Import/Export CSV (clients, articles, fournisseurs, etc.)
- [ ] Export PDF (factures, rapports)
- [ ] Notifications dropdown
- [ ] Sync offline (queue + push/pull)
- [ ] Tests backend passent (pytest)
- [ ] Tests frontend passent (vitest)
- [ ] Migration Desktop → Web possible
- [ ] README complet
- [ ] Docker Compose fonctionnel

---

*Document généré le 2026-08-18*
*Analyse Desktop basée sur: Desktop/views/, Desktop/controllers/, Desktop/models/, Desktop/services/, Desktop/shared/*
*Plan d'implémentation: 21 jours estimés (3 semaines)*
*Stack: FastAPI + React + TypeScript + Bootstrap 5 + PostgreSQL