# 🚀 Guide de démarrage Web — TIA INFO BUILD (XAMPP MySQL)

Guide pas à pas pour installer, initialiser la base de données MySQL via XAMPP, et démarrer l'application Web (Backend FastAPI + Frontend React) ainsi que la synchronisation avec l'application Desktop.

---

## 📋 Prérequis

1. **XAMPP** (avec le service **MySQL** démarré)
2. **Python 3.11+**
3. **Node.js 18+** et npm

---

## 🗄️ Étape 1 : Base de données MySQL (XAMPP)

1. Ouvrir **XAMPP Control Panel**.
2. Cliquer sur **Start** en face du service **MySQL**.
3. Ouvrir **phpMyAdmin** dans votre navigateur : [http://localhost/phpmyadmin](http://localhost/phpmyadmin)
4. Cliquer sur **Nouvelle base de données** (New database).
5. Nom de la base : `tia_build_db` (Interclassement: `utf8mb4_unicode_ci`).
6. Cliquer sur **Créer**.

> ℹ️ *Par défaut sur XAMPP, l'utilisateur MySQL est `root` sans mot de passe.*

---

## ⚙️ Étape 2 : Backend FastAPI

### 1. Ouvrir le terminal dans `Web/backend` :
```powershell
cd Web/backend
```

### 2. Créer et activer l'environnement virtuel Python :
```powershell
python -m venv env
.\env\Scripts\Activate.ps1
```

### 3. Installer les dépendances :
```powershell
pip install -r requirements.txt
```

### 4. Vérifier le fichier `.env` :
Le fichier `.env` dans `Web/backend/.env` contient :
```ini
DATABASE_URL=mysql+aiomysql://root:@localhost:3306/tia_build_db
SECRET_KEY=tia_info_build_secret_access_key_dev_2026_change_in_prod
SECRET_KEY_REFRESH=tia_info_build_secret_refresh_key_dev_2026_change_in_prod
```

### 5. Appliquer les migrations de base de données :
```powershell
alembic upgrade head
```

### 6. Initialiser les données de test (Seed rôles + comptes démo) :
```powershell
python app/scripts/init_db.py
```

### 7. Démarrer le serveur Backend :
```powershell
uvicorn app.main:app --reload --port 8000
```
- **API Swagger Docs** : [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check** : [http://localhost:8000/health](http://localhost:8000/health)

---

## 💻 Étape 3 : Frontend React (Vite)

### 1. Ouvrir un second terminal dans `Web/frontend` :
```powershell
cd Web/frontend
```

### 2. Installer les dépendances :
```powershell
npm install
```

### 3. Démarrer le serveur de développement Frontend :
```powershell
npm run dev
```
- **Application Web** : [http://localhost:5173](http://localhost:5173)

---

## 🔑 Comptes de Connexion Démo

| Rôle | Email | Mot de passe | Accès / Portée |
|---|---|---|---|
| **Super Admin** | `admin@tia.mg` | `Admin123!` | Dashboard SaaS, gestion entreprises |
| **Admin Entreprise** | `demo@btppro.mg` | `Admin123!` | Entreprise BTP PRO (Chantiers, RH, Stocks, Commercial, Finance) |

---

## 🔄 Synchronisation Bidirectionnelle Desktop ↔ Web

Le serveur Web FastAPI est le **cerveau principal** (Source de Vérité) :

1. **Desktop → Web (Push)** : L'application Desktop Electron envoie ses données locales SQLite au Web via `POST /api/sync/import-sqlite`.
2. **Web → Desktop (Pull)** : L'application Desktop récupère les données à jour depuis le Web via `GET /api/sync/export`.
3. **Statut Sync** : Consultable sur `GET /api/sync/status`.

---

## ⚡ Script de démarrage rapide 1-Click (PowerShell)

Vous pouvez aussi démarrer Backend et Frontend simultanément avec le script `Web/start-dev.ps1` :
```powershell
cd Web
.\start-dev.ps1
```
