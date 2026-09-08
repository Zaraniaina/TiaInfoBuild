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

- **Push Desktop → Web** : `POST /api/sync/import-sqlite`
- **Pull Web → Desktop** : `GET /api/sync/export`
- **Statut** : `GET /api/sync/status`

---

## 🛠️ Dépannage

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

### Erreur : `Can't connect to MySQL`
- Vérifier que **MySQL est démarré** (XAMPP / WAMP / service)
- Vérifier le `DATABASE_URL` dans `.env`
- Vérifier que la base `tia_build_db` existe

### Erreur : `CORS` côté frontend
- Vérifier que `CORS_ORIGINS` dans `.env` contient l'URL exacte du frontend (ex: `http://localhost:5174`)

### Port 8000 déjà occupé
- Changer `APP_PORT` dans `.env` ET adapter le frontend (`VITE_API_URL`)

### Réinitialisation complète
```powershell
# 1. Supprimer la base
DROP DATABASE tia_build_db;
# 2. Recréer
CREATE DATABASE tia_build_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
# 3. Migrations
alembic upgrade head
# 4. Init données
python app/scripts/init_db.py
```

### 404 sur les routes
Vérifier que le backend a bien redémarré après les correctifs de préfixes de routes.

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
