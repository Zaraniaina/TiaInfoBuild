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
