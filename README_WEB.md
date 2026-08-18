# Guide de lancement — TIA Info Build Web
## Stack: FastAPI + React + TypeScript + Bootstrap 5

---

## Prérequis

- **Python 3.11+** (Python 3.14 recommandé)
- **Node.js 18+** et npm
- **MySQL 8.0** installé et démarré
- **Git** (optionnel)

---

## 1. Configuration de la base de données MySQL

```bash
# Se connecter à MySQL
mysql -u root -p

# Créer la base de données
CREATE DATABASE tia_build_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Créer l'utilisateur
CREATE USER 'tia_user'@'localhost' IDENTIFIED BY 'tia_password';

# Accorder les privilèges
GRANT ALL PRIVILEGES ON tia_build_db.* TO 'tia_user'@'localhost';
FLUSH PRIVILEGES;

# Quitter
EXIT;
```

---

## 2. Backend — FastAPI

### Installation

```bash
cd Web/backend

# Créer l'environnement virtuel (si pas déjà fait)
python -m venv env

# Activer l'environnement
# Windows PowerShell:
.\env\Scripts\Activate.ps1
# Windows CMD:
env\Scripts\activate.bat

# Installer les dépendances
pip install -r requirements.txt
```

### Configuration

```bash
# Copier le fichier d'environnement
copy .env.example .env

# Éditer .env avec vos paramètres:
# - DATABASE_URL=mysql+aiomysql://tia_user:tia_password@localhost:3306/tia_build_db
# - SECRET_KEY=<générer avec: python -c "import secrets; print(secrets.token_urlsafe(32))">
# - SECRET_KEY_REFRESH=<autre secret>
```

### Initialisation de la base de données

```bash
# Créer le schéma et seed les rôles
python app/scripts/init_db.py

# Créer le Super Admin
python app/scripts/create_super_admin.py --email superadmin@tia-build.mg --password changeme
```

### Lancer le serveur

```bash
# Développement avec rechargement automatique
uvicorn app.main:app --reload --port 8000

# Ou via le script run.py
python run.py
```

### Vérification

- **API**: http://localhost:8000
- **Documentation Swagger**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health check**: http://localhost:8000/health

---

## 3. Frontend — React + Vite

### Installation

```bash
cd Web/frontend

# Installer les dépendances
npm install
```

### Configuration

```bash
# Copier le fichier d'environnement
copy .env.example .env

# Éditer .env:
# VITE_API_URL=http://localhost:8000/api
```

### Lancer le serveur

```bash
npm run dev
```

### Vérification

- **Application**: http://localhost:5173
- **Login**: http://localhost:5173/login

### Build production

```bash
npm run build
```

Les fichiers de build seront dans `dist/`.

---

## 4. Lancer en production

### Backend

```bash
cd Web/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd Web/frontend
npm run build
```

Puis servir le dossier `dist/` avec un serveur statique (nginx, Apache, ou `npx serve dist`).

---

## 5. Variables d'environnement

### Backend (`.env`)

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `APP_ENV` | Environnement | `development` |
| `APP_DEBUG` | Mode debug | `True` |
| `DATABASE_URL` | URL MySQL async | `mysql+aiomysql://tia_user:tia_password@localhost:3306/tia_build_db` |
| `SECRET_KEY` | Clé secrète JWT access | *(générer)* |
| `SECRET_KEY_REFRESH` | Clé secrète JWT refresh | *(générer)* |
| `ALGORITHM` | Algorithme JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durée token access | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Durée token refresh | `7` |
| `CORS_ORIGINS` | Origines CORS | `http://localhost:5173,http://localhost:8080` |
| `REDIS_URL` | URL Redis | `redis://localhost:6379/0` |

### Frontend (`.env`)

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `VITE_API_URL` | URL de l'API backend | `http://localhost:8000/api` |

---

## 6. Dépannage

### Erreur MySQL
```bash
# Vérifier que MySQL est démarré
# Windows: Services.msc → MySQL
# Ou via ligne de commande:
net start MySQL80
```

### Port déjà utilisé
```bash
# Backend: changer le port
uvicorn app.main:app --port 8001

# Frontend: changer le port
npm run dev -- --port 5174
```

### Problèmes de dépendances Python
```bash
# Recréer l'environnement
cd Web/backend
Remove-Item -Recurse -Force env
python -m venv env
.\env\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 7. Structure du projet

```
TiaInfoBuild/
├── Web/
│   ├── backend/                    # API FastAPI
│   │   ├── app/
│   │   │   ├── main.py             # Point d'entrée
│   │   │   ├── config.py           # Settings
│   │   │   ├── database.py         # SQLAlchemy async
│   │   │   ├── security.py         # JWT + auth
│   │   │   ├── middleware.py       # CORS, logging
│   │   │   ├── models/             # 35 modèles SQLAlchemy
│   │   │   ├── schemas/            # 20 schémas Pydantic
│   │   │   ├── crud/               # CRUD générique + métiers
│   │   │   ├── routers/            # 13 routeurs API
│   │   │   ├── dependencies/       # Dépendances FastAPI
│   │   │   ├── core/               # Permissions, export, PDF
│   │   │   └── scripts/            # init_db, create_super_admin
│   │   ├── alembic/                # Migrations
│   │   ├── tests/                  # Tests pytest
│   │   ├── requirements.txt
│   │   └── .env.example
│   └── frontend/                   # React + Vite
│       ├── src/
│       │   ├── main.tsx            # Entrée React
│       │   ├── App.tsx             # Routing
│       │   ├── styles/             # CSS design system
│       │   ├── components/         # Layout, UI, auth
│       │   ├── pages/              # Pages métier
│       │   ├── services/           # Axios + interceptors
│       │   ├── stores/             # Zustand
│       │   ├── hooks/              # useAuth, etc.
│       │   ├── types/              # Types TypeScript
│       │   └── utils/              # Permissions, format
│       ├── package.json
│       └── vite.config.ts
├── PLAN_MIGRATION_COMPLET.md       # Plan d'architecture complet
├── plan.md                         # Plan d'implémentation restant
└── README_WEB.md                   # Ce fichier
```

---

## 8. URLs importantes

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Application React |
| Backend | http://localhost:8000 | API FastAPI |
| Swagger | http://localhost:8000/docs | Documentation API interactive |
| ReDoc | http://localhost:8000/redoc | Documentation API alternative |
| Health | http://localhost:8000/health | Vérification santé API |

---

## 9. Comptes par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | superadmin@tia-build.mg | changeme |

*À changer après première connexion.*

---

*Document généré le 2026-08-18*
*Stack: FastAPI + React + TypeScript + Bootstrap 5 + MySQL 8.0*
