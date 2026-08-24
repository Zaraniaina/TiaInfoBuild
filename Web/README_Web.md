# 🚀 Guide de démarrage Web — TIA INFO BUILD (XAMPP MySQL & 11 Rôles RBAC)

Guide complet pour installer, initialiser la base de données MySQL via XAMPP, exécuter les 11 rôles de la spécification `roles_tia_builds/`, et démarrer l'application Web (Backend FastAPI + Frontend React).

---

## 🏗️ Architecture & Spécifications Clés

1. **Clés Primaires & Étrangères Longues (`BIGINT`)** :
   - L'ensemble des 35 tables de la base de données (`schema.sql` & modèles SQLAlchemy `app/models/*.py`) utilisent des identifiants `BIGINT` (BigInteger en Python/SQL) pour supporter la haute volumétrie multi-tenant.
   - Migration Alembic : `007_convert_ids_to_bigint.py`.

2. **Référentiel des 11 Rôles Utilisateurs (`roles_tia_builds/`)** :
   - Application du contrôle d'accès basé sur les rôles (RBAC) avec **interfaces et tableaux de bord dédiés** pour chacun des 11 profils :
     1. **Super Administrateur SaaS** (`super_admin`) : Back-office SaaS, gestion des abonnements tenants, Mobile Money billing.
     2. **Administrateur d'Entreprise** (`admin_entreprise`) : Gestion technique, rôles, sécurité, audit des logs de connexion.
     3. **Direction Générale / DAF** (`directeur`) : Pilotage P&L consolidé, marges réelles, validation des budgets & devis > 50M MGA.
     4. **Comptable / Responsable Financier** (`comptable`) : Saisie dépenses, calcul des marges automatiques, facturation et impayés.
     5. **Chef de Projet / Directeur Technique** (`chef_projet`) : Supervision multi-chantiers, arbitrage des ressources inter-chantiers.
     6. **Chef de Chantier / Conducteur** (`chef_chantier`) : Avancement physique (%), **génération QR Code pointage chantier**, auto-déclaration GPS, incidents.
     7. **Responsable RH** (`rh`) : Fiches salariés, grille de validation des pointages QR/GPS, validation des heures sup, habilitations.
     8. **Responsable Matériel** (`materiel`) : Parc d'engins (*Disponible, En Utilisation, En Maintenance, Hors Service*), plannings de maintenance.
     9. **Magasinier / Stocks** (`magasinier`) : Mouvements de stock, alertes stock minimum/rupture, fournisseurs.
     10. **Responsable Commercial** (`commercial`) : Devis avec calcul de marge théorique, conversion devis ➔ contrat, suivi facturation.
     11. **Ouvrier / Employé Terrain** (`employe`) : **Scan mobile du QR Code pointage site**, checklist des tâches du jour.

3. **Politique de Pointage Anti-Fraude (`11_politique_pointage.md`)** :
   - Endpoint API : `POST /api/rh/pointages/qr-checkin`
   - Pointage QR Code dynamically generated on site by Chef de Chantier (Catégorie A), auto-déclaration GPS (Catégorie B), QR Code fixe dépôt (Catégorie D).

---

## 📋 Prérequis

1. **XAMPP** (avec le service **MySQL** démarré)
2. **Python 3.11+**
3. **Node.js 18+** et npm

---

## 🗄️ Étape 1 : Base de données MySQL (XAMPP)

1. Ouvrir **XAMPP Control Panel**.
2. Cliquer sur **Start** en face du service **MySQL**.
3. Ouvrir **phpMyAdmin** : [http://localhost/phpmyadmin](http://localhost/phpmyadmin)
4. Créer la base : `tia_build_db` (`utf8mb4_unicode_ci`).

---

## ⚙️ Étape 2 : Backend FastAPI

```powershell
cd Web/backend
python -m venv env
.\env\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python app/scripts/init_db.py
uvicorn app.main:app --reload --port 8000
```

- **API Documentation Swagger** : [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check** : [http://localhost:8000/health](http://localhost:8000/health)

---

## 💻 Étape 3 : Frontend React (Vite)

```powershell
cd Web/frontend
npm install
npm run dev
```

- **Application Web** : [http://localhost:5173](http://localhost:5173)

---

## 🔑 Comptes de Connexion Démo (11 Rôles)

| Rôle | Email | Mot de passe | Espace & Interface Dédiée |
|---|---|---|---|
| **Super Admin SaaS** | `admin@tia.mg` | `Admin123!` | Dashboard Back-office SaaS & Tenants |
| **Admin Entreprise** | `demo@btppro.mg` | `Admin123!` | Paramètres & Audit Comptes |
| **Direction Générale** | `directeur@btppro.mg` | `Admin123!` | Pilotage P&L, Marges & Validations |
| **Comptable** | `comptable@btppro.mg` | `Admin123!` | Dépenses, Bilan Financier & Impayés |
| **Chef de Projet** | `chefprojet@btppro.mg` | `Admin123!` | Supervision Multi-Chantiers |
| **Chef de Chantier** | `chefchantier@btppro.mg` | `Admin123!` | **Générateur QR Pointage**, Avancement % |
| **Responsable RH** | `rh@btppro.mg` | `Admin123!` | Validation Pointages QR/GPS & Salariés |
| **Responsable Matériel** | `materiel@btppro.mg` | `Admin123!` | Engins, Maintenances & Affectations |
| **Magasinier** | `magasinier@btppro.mg` | `Admin123!` | Stock Mini, Entrées/Sorties Dépôt |
| **Commercial** | `commercial@btppro.mg` | `Admin123!` | Devis, Contrats & Pipeline Clients |
| **Ouvrier / Terrain** | `ouvrier@btppro.mg` | `Admin123!` | **Scan QR Pointage**, Tâches du Jour |

---

## 🔄 Synchronisation Desktop ↔ Web

- **Push (Desktop ➔ Web)** : `POST /api/sync/import-sqlite`
- **Pull (Web ➔ Desktop)** : `GET /api/sync/export`
- **Statut** : `GET /api/sync/status`

