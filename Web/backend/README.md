# ⚙️ Backend — TIA INFO BUILD (FastAPI + SQLAlchemy + MySQL)

API REST de l'application de gestion BTP **TIA INFO BUILD**.

---

## 📋 Prérequis

- Python 3.11+
- MySQL 8+ (XAMPP)
- pip

---

## 🚀 Démarrage

```powershell
cd Web/backend

# Créer le venv et installer les dépendances (une seule fois)
python -m venv env
.\env\Scripts\Activate.ps1
pip install -r requirements.txt

# Appliquer les migrations Alembic
alembic upgrade head

# Initialiser la base (rôles, admin de démo)
python app/scripts/init_db.py

# Lancer le serveur
uvicorn app.main:app --reload --port 8000
```

- **API Docs (Swagger)** : [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check** : [http://localhost:8000/health](http://localhost:8000/health)
- **OpenAPI JSON** : [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

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

## 📁 Structure

```
app/
├── main.py           # Point d'entrée FastAPI, CORS, routers
├── config.py         # Configuration centralisée (Pydantic Settings)
├── database.py       # Connexion async SQLAlchemy
├── security.py       # JWT, hachage Argon2, RBAC
├── middleware.py     # Middlewares personnalisés
├── models/           # Modèles SQLAlchemy (35 tables)
├── routers/          # Routes API par domaine
├── schemas/          # Schémas Pydantic (validation)
├── crud/             # Opérations CRUD
├── core/             # Permissions, exports, PDF, scheduler
├── dependencies/     # Dépendances FastAPI (auth, DB, permissions)
└── scripts/          # Scripts d'initialisation et maintenance
```

---

## 🔐 Authentification & Rôles

- **JWT** : access token (15 min) + refresh token (7 jours)
- **RBAC** : 11 rôles avec permissions granulaires
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

# CORS
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

## 🔄 Synchronisation Desktop ↔ Web

- **Push Desktop → Web** : `POST /api/sync/import-sqlite`
- **Pull Web → Desktop** : `GET /api/sync/export`
- **Statut** : `GET /api/sync/status`

---

## 🛠️ Dépannage

- **404 sur les routes** : vérifier que le backend a bien redémarré après les correctifs de préfixes de routes
- **Erreur DB** : vérifier que MySQL est démarré et que la base `tia_build_db` existe
- **CORS** : vérifier `CORS_ORIGINS` dans `.env`
- **Port 8000 occupé** : changer `APP_PORT` dans `.env`
