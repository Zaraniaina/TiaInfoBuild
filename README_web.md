# TIA INFO BUILD - Guide de lancement et tests

Stack : FastAPI + SQLAlchemy + MySQL | React + TypeScript + Vite + Bootstrap

## Prérequis

- Python 3.11+
- Node.js 18+
- MySQL 8+
- Redis (optionnel pour le cache/rate limiting)

## Structure

```
Web/
├── backend/
│   ├── .env                # variables d'environnement
│   ├── requirements.txt
│   ├── alembic.ini
│   └── app/
│       ├── main.py         # point d'entrée FastAPI
│       ├── config.py
│       ├── database.py
│       ├── models/
│       ├── routers/
│       ├── schemas/
│       ├── crud/
│       └── core/
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── src/
    └── dist/               # build de production
```

## 1. Backend

```bash
cd Web/backend

# Créer le .env depuis l'exemple si ce n'est pas fait
cp .env.example .env
# Éditer .env avec vos paramètres (DB, JWT, CORS)

# Créer un venv et installer les dépendances
python -m venv .venv
# Windows
.venv\Scripts\activate
# Mac/Linux
# source .venv/bin/activate

pip install -r requirements.txt

# Appliquer les migrations Alembic
alembic upgrade head

# Lancer le serveur
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Vérifier :
- http://localhost:8000/health
- http://localhost:8000/docs (Swagger)

## 2. Frontend

```bash
cd Web/frontend

# Installer les dépendances
npm install

# Lancer le serveur de dev
npm run dev
```

Ouvrir http://localhost:5173

## 3. Build production

```bash
# Frontend
cd Web/frontend
npm run build

# Servir le build statique via le backend (configuré pour servir ../frontend/dist)
# ou tout serveur statique (nginx, serve, etc.)
```

## 4. Tests rapides

### Backend
```bash
cd Web/backend

# Vérifier la syntaxe Python des fichiers modifiés
python -m py_compile app/core/permissions.py app/routers/chantiers.py app/routers/commercial.py app/routers/parametres.py app/crud/dashboard.py app/schemas/dashboard.py
```

### Frontend
```bash
cd Web/frontend

# TypeScript
npx tsc -b

# Lint
npm run lint

# Build
npm run build
```

### Comptes de test
Créer un utilisateur via `/api/auth/register` ou peupler la DB manuellement avec un rôle parmi :
- super_admin
- admin_entreprise
- directeur
- comptable
- chef_projet
- chef_chantier
- rh
- materiel
- magasinier
- commercial
- employe
- client

## 5. Variables d'environnement clés

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL async URL |
| `SECRET_KEY` | Clé JWT (générer avec `python -c "import secrets; print(secrets.token_urlsafe(32))"`) |
| `SECRET_KEY_REFRESH` | Clé JWT refresh (différente) |
| `CORS_ORIGINS` | Origines autorisées (ex: http://localhost:5173) |
| `REDIS_URL` | Optionnel |
| `FRONTEND_BUILD_DIR` | Chemin vers le build frontend pour serving static |

## 6. Dépannage

- Port 8000 occupé : changer `APP_PORT` dans `.env`
- Port 5173 occupé : changer le port dans `vite.config.ts`
- Erreur DB : vérifier que MySQL est démarré et que la base existe
- CORS : vérifier `CORS_ORIGINS` dans `.env`
