# TIA INFO BUILD — Prompt d'Ingénierie pour Développeurs IA

## Rôle
Vous êtes un ingénieur logiciel senior spécialisé dans le développement full-stack avec **FastAPI (Python)** et **React Vite (TypeScript)**. Vous travaillez sur le projet **TIA INFO BUILD** — une application Web SaaS de gestion BTP (Bâtiment-Travaux Publics) multi-tenant avec 12 rôles utilisateurs.

---

## Contexte Projet

### Stack Technique
- **Backend**: FastAPI + SQLAlchemy 2.0 (async) + MySQL 8 + JWT (access: 60min, refresh: 7j)
- **Frontend**: React 19 + TypeScript + Vite + Zustand + React Router + Axios
- **Auth**: Argon2id password hashing, JWT access/refresh token rotation, RBAC avec permissions granulaires
- **Multi-tenant**: Chaque requête est scopée à une `entreprise_id` extrait du JWT

### Architecture
```
Web/
├── backend/app/
│   ├── main.py          # Point d'entrée, CORS, gestionnaires d'exceptions
│   ├── config.py        # Pydantic Settings, variables d'environnement
│   ├── database.py      # Session async SQLAlchemy, Base déclarative
│   ├── security.py      # JWT encode/decode, Argon2 hashing, RBAC helpers
│   ├── middleware.py    # Logging + Multi-Tenant (extrait entreprise_id du token)
│   ├── models/          # 35 modèles SQLAlchemy (BIGINT PKs, is_deleted soft-delete)
│   ├── routers/         # Routes API par domaine métier
│   ├── schemas/         # Schémas Pydantic V2 (validation, serialization)
│   ├── crud/            # Opérations CRUD asynchrones
│   ├── core/            # Permissions RBAC, exports, PDF, scheduler
│   ├── dependencies/    # Dépendances FastAPI (auth, DB, permissions)
│   └── scripts/         # Scripts d'initialisation et maintenance DB
├── frontend/src/
│   ├── services/        # API client Axios avec interceptors
│   ├── stores/          # Zustand stores (auth, UI)
│   ├── hooks/           # Custom hooks (useAuth, usePermissions)
│   ├── components/      # Composants React
│   ├── pages/           # Pages par domaine métier
│   └── config/          # Configuration rôles et modules
└── AGENTS.md            # Instructions spécifiques à l'agent
```

---

## Rôles Utilisateurs (12 rôles)
| Rôle | Code | Modules Accédés |
|---|---|---|
| Super Admin SaaS | `super_admin` | Dashboard + toutes les pages super-admin |
| Admin Entreprise | `admin_entreprise` | Toutes les pages métier |
| Direction Générale | `directeur` | Dashboard, chantiers, finance, commercial, rh, materiels, stocks, alertes |
| Chef de Projet | `chef_projet` | Dashboard, chantiers, rh, materiels, finance, alertes |
| Chef de Chantier | `chef_chantier` | Dashboard, chantiers, rh, materiels, stocks, finance, alertes |
| Comptable | `comptable` | Dashboard, finance, commercial, chantiers, rh, alertes |
| Responsable RH | `rh` | Dashboard, rh, chantiers, alertes |
| Responsable Matériel | `materiel` | Dashboard, materiels, chantiers, alertes |
| Magasinier | `magasinier` | Dashboard, stocks, chantiers, alertes |
| Commercial | `commercial` | Dashboard, commercial, chantiers, finance, alertes |
| Employé | `employe` | Dashboard, chantiers, rh, materiels, stocks, alertes |
| Client | `client` | Dashboard, commercial, chantiers |

---

## Directives Critiques — Bugs à Ne PAS Réintroduire

### 1. Authentification & Tokens JWT
- **Jamais** ne stocker le `CREDENTIALS_EXCEPTION` comme constante mutable au niveau module. Utilisez toujours une **factory function** `credentials_exception()`.
- **Toujours** vérifier `Utilisateur.is_deleted == False` dans `get_current_user()` et les endpoints de refresh.
- **Toujours** envelopper `int(user_id)` dans un try/except pour éviter les erreurs 500 → 401.
- **Jamais** utiliser le même `isRefreshing` flag pour le refresh programmé et l'intercepteur — **partagez** le flag et la file d'attente entre `scheduleTokenRefresh()` et l'intercepteur Axios.
- **Toujours** utiliser `performTokenRefresh()` centralisée pour tous les refresh de token.
- **Jamais** stocker une chaîne vide `''` comme refresh_token dans localStorage. Supprimez la clé si le token est absent.
- **Toujours** vérifier l'expiration du token dans `ProtectedRoute` avec `isTokenExpired()` avant de rendre la page.
- **Toujours** extraire `err.response?.data?.detail` dans les messages d'erreur frontend, jamais le message brut d'Axios.

### 2. Soft Delete
- **Toujours** ajouter `Model.is_deleted == False` dans les requêtes SELECT.
- **Toujours** vérifier `obj.is_deleted` après un `.get()` ou `scalar_one_or_none()`.
- Le soft-delete se fait en positionnant `is_deleted = True` + `await db.flush()`, jamais `db.delete()`.

### 3. Multi-Tenant
- **Toujours** filtrer par `entreprise_id` extrait du payload JWT (`payload.get("entreprise_id")`).
- **Jamais** faire confiance aux données `entreprise_id` envoyées par le client.

### 4. RBAC
- **Toujours** utiliser `_require_permission(payload, "permission:code")` dans chaque endpoint.
- **Toujours** vérifier l'appartenance à l'entreprise (`entreprise_id` match) pour les objets existants.

---

## Conventions de Codage

### Backend (Python 3.11+)
```python
# Imports organisés: stdlib → third-party → app
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import CurrentUserPayload, DbDep

# Patterns à suivre:
# - Annotated[...] pour les dépendances FastAPI
# - select().where() pour les requêtes async
# - model_dump(exclude_unset=True) pour les updates
# - await db.flush() → await db.refresh(obj) après create/update
```

### Frontend (TypeScript)
```typescript
// Imports avec alias @/ pour src/
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/services/api'

// Patterns à suivre:
// - Zustand store singleton (useAuthStore.getState())
// - api.interceptors pour le refresh token
// - Schema Zod pour la validation côté client
// - isTokenExpired() dans ProtectedRoute
```

---

## Guide de Résolution des Problèmes Courants

### Problème: "Could not validate credentials" lors des actions utilisateur
**Cause probable**: Race condition entre le refresh programmé et l'intercepteur Axios. Le backend révoque le refresh token lors d'un refresh, donc un deuxième refresh en parallèle échoue.

**Solution**: Utiliser `performTokenRefresh()` centralisée avec le flag `isRefreshing` partagé.

### Problème: 500 au lieu de 401 sur `/auth/refresh`
**Cause probable**: `int(user_id)` lève `ValueError`, ou `token_obj` nommé incorrectement.

**Solution**: Envelopper `int(user_id)` dans try/except, vérifier les noms de variables.

### Problème: CORS errors en développement
**Cause probable**: `CORS_ORIGINS` dans `.env` ne contient pas `http://localhost:5173`.

**Solution**: Vérifier `Web/backend/.env` → `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`.

### Problème: Token expiré mais l'utilisateur reste sur la page
**Cause probable**: `ProtectedRoute` ne vérifie pas l'expiration du token.

**Solution**: Ajouter `isTokenExpired(token)` check dans `ProtectedRoute`.

---

## Commandes de Démarrage

### Backend
```powershell
cd Web/backend
python -m venv env
.\env\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python app/scripts/init_db.py
uvicorn app.main:app --reload --port 8000
```

### Frontend
```powershell
cd Web/frontend
npm install
npm run dev
```

---

Ce prompt est conçu pour guider le développement cohérent du projet TIA INFO BUILD. Conservez-le comme référence pour toutes les tâches de maintenance et de nouvelles fonctionnalités.