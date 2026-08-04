# TIA INFO BUILD — Application Desktop (Electron)

TIA INFO BUILD est une application de bureau Electron conçue pour la gestion complète du BTP (Bâtiment / Travaux Publics). Elle permet de gérer les chantiers, le personnel, les matériels, les stocks et la comptabilité depuis un espace local sécurisé, tout en restant synchronisée avec le serveur Django distant.

**Architecture clé : OFFLINE-FIRST (Local-First)**
- L'application fonctionne **100% en local** sans connexion internet
- Base de données **SQLite** locale (`better-sqlite3`) → autonomie totale
- Synchronisation avec le serveur Django **optionnelle et asynchrone** (push/pull quand le réseau est disponible)
- L'utilisateur travaille normalement hors ligne ; la sync se fait en arrière-plan

---

## 📋 Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | >= 22.12.0 |
| npm | >= 10.0.0 |
| Electron | ^43.2.0 (installé via npm) |

> ⚠️ Electron 43+ exige Node.js >= 22.12.0. Vérifiez votre version avec :
> ```bash
> node --version
> npm --version
> ```

---

## 📦 Modules / Packages npm à installer

Le projet utilise les dépendances suivantes, définies dans `package.json` :

### Dépendances de production (runtime)

| Package | Version | Rôle |
|---------|---------|------|
| axios | ^1.19.0 | Requêtes HTTP vers l'API Django distante |
| better-sqlite3 | ^13.0.2 | Base de données SQLite locale (synchronisation hors ligne) |

### Dépendances de développement

| Package | Version | Rôle |
|---------|---------|------|
| electron | ^43.2.0 | Framework de l'application desktop |

### Installation complète

```bash
# 1. Installer toutes les dépendances (production + développement)
npm install

# 2. (Optionnel) Installer uniquement les dépendances de production
npm install --omit=dev

# 3. (Optionnel) Installer uniquement les dépendances de développement
npm install --include=dev
```

> Le fichier `package-lock.json` est fourni et garantit une installation reproductible.

---

## 🏗️ Architecture

### Processus Electron

| Processus | Rôle |
|-----------|------|
| **Main process** (`main.js`) | Orchestration : fenêtre, IPC handlers, base de données, contrôleurs |
| **Preload bridge** (`preload.js`) | API IPC structurée par module (`api.chantiers.*`, `api.rh.*`, ...) |
| **Renderer** (`views/`) | Interface utilisateur (HTML/JS vanilla + Bootstrap 5 + design system TIA) |

### Structure du projet

```
Desktop/
├── main.js                          # Point d'entrée Electron — crée la fenêtre principale + IPC handlers
├── preload.js                       # Script de préchargement — expose l'API via contextBridge
├── package.json                     # Configuration npm / Electron
├── package-lock.json                # Verrouillage des versions (généré)
├── tia_info_build.sqlite            # Base de données SQLite locale (créée à l'init)
├── apiUrl/
│   └── url.js                       # Configuration URL de l'API Django
│
├── controllers/                     # Logique métier (main process)
│   ├── authController.js            # Authentification (local + API Django)
│   ├── chantierController.js        # CRUD Chantiers, Phases, Incidents
│   ├── rhController.js              # Employés, Pointages, Équipes, Heures sup
│   ├── materielController.js        # Matériels, Maintenance
│   ├── stockController.js           # Articles, Fournisseurs, Mouvements
│   ├── commercialController.js      # Clients, Devis, Contrats, Factures, Paiements
│   ├── financeController.js         # Dépenses, Alertes
│   ├── dashboardController.js       # KPIs, CA, top chantiers, activité récente
│   ├── syncController.js            # Synchronisation
│   └── utilisateurController.js     # Gestion des utilisateurs
│
├── models/
│   ├── db.js                        # Connexion à la base SQLite locale
│   ├── init.js                      # Initialisation des tables (26+ tables + seed + triggers)
│   └── repositories/                # Patron Repository (CRUD + filtres entreprise)
│       ├── BaseRepository.js
│       ├── ChantierRepository.js
│       ├── PhaseRepository.js
│       ├── IncidentRepository.js
│       ├── EmployeRepository.js
│       ├── PointageRepository.js
│       ├── HeureSupplementaireRepository.js
│       ├── EquipeRepository.js
│       ├── MembreEquipeRepository.js
│       ├── MaterielRepository.js
│       ├── MaintenanceRepository.js
│       ├── ArticleRepository.js
│       ├── FournisseurRepository.js
│       ├── MouvementStockRepository.js
│       ├── ClientRepository.js
│       ├── DevisRepository.js
│       ├── LigneDevisRepository.js
│       ├── ContratRepository.js
│       ├── FactureRepository.js
│       ├── PaiementRepository.js
│       ├── DepenseRepository.js
│       ├── AlerteRepository.js
│       ├── DashboardRepository.js
│       ├── SyncRepository.js
│       └── UtilisateurRepository.js
│
├── services/
│   ├── apiClient.js                 # Client HTTP pour l'API Django (axios)
│   └── syncService.js               # Orchestrateur de synchronisation
│
├── public/
│   ├── tia-design.css               # Design system TIA complet
│   ├── bootstrap/                   # Bootstrap 5 (CSS + JS + Icons)
│   └── js/                          # Scripts utilitaires renderer
│
├── views/                           # Interface utilisateur (renderer)
│   ├── router.js                    # Router SPA (hash-based) + guards + helpers
│   ├── layout.html / layout.js      # App shell (sidebar + topbar + content)
│   ├── index.html                   # Page de connexion
│   ├── login.js                     # Logique frontend connexion
│   ├── register.html                # Page d'inscription entreprise
│   ├── register.js                  # Logique frontend inscription
│   ├── dashboard.html / dashboard.js
│   ├── settings.html / settings.js
│   ├── chantiers/
│   ├── rh/
│   │   ├── employes/
│   │   ├── pointages/
│   │   ├── equipes/
│   │   └── heures-sup/
│   ├── materiels/
│   ├── stocks/
│   │   ├── fournisseurs/
│   │   └── mouvements/
│   ├── commercial/
│   │   ├── clients/
│   │   ├── devis/
│   │   ├── contrats/
│   │   ├── factures/
│   │   └── paiements/
│   └── finance/
│       ├── depenses/
│       ├── rapports/
│       └── alertes/
│
└── tests/                           # (en préparation)
```

---

## 🧩 Modules métier

| Module | Tables principales | Vues |
|--------|-------------------|------|
| **Chantiers** (cœur) | Chantier, Phase, Incident, AffectationRessource | Liste, détail, création, phases, incidents |
| **RH** | Employe, Equipe, MembreEquipe, AffectationChantier, Pointage, HeureSupplementaire | Employés, pointages, équipes, heures sup |
| **Matériels** | Materiel, AffectationMateriel, Maintenance, AlerteMateriel | Liste, détail, maintenance |
| **Stocks** | Article, Fournisseur, MouvementStock | Articles, fournisseurs, mouvements |
| **Commercial** | Client, Devis, LigneDevis, Contrat, Facture, Paiement | Clients, devis, contrats, factures, paiements |
| **Finance** | Depense, RapportFinancier, Alerte | Dépenses, rapports, alertes |
| **Transverse** | Entreprise, Role, Utilisateur, Preference | Login, register, paramètres, utilisateurs |

---

## 🗄️ Base de données locale (SQLite)

- **Fichier** : `tia_info_build.sqlite` (à la racine du dossier `Desktop/`)
- **ORM/Driver** : `better-sqlite3`
- **Initialisation** : Automatique au lancement de l'application via `models/init.js`
- **Tables créées** : 26+ tables couvrant tous les modules (Transverse, Chantiers, RH, Matériels, Stocks, Commercial, Finance, Sync)

### Schéma clé des tables (exemples)

```sql
-- Utilisateur
CREATE TABLE Utilisateur (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER UNIQUE,       -- ID du serveur Django (synchronisation)
    entrepriseId INTEGER,
    roleId INTEGER,
    nom TEXT NOT NULL,
    prenom TEXT,
    email TEXT UNIQUE NOT NULL,
    motDePasseHash TEXT,
    telephone TEXT,
    statut TEXT,
    dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
    derniereConnexion DATETIME,
    is_synced INTEGER DEFAULT 0,    -- 0 = non synchronisé, 1 = synchronisé
    is_deleted INTEGER DEFAULT 0    -- Suppression logique
);

-- Chantier
CREATE TABLE Chantier (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER UNIQUE,
    entrepriseId INTEGER,
    clientId INTEGER,
    chefChantierId INTEGER,
    nom TEXT NOT NULL,
    adresse TEXT,
    dateDebut DATE,
    dateFinPrevue DATE,
    dateFinReelle DATE,
    budgetPrevu REAL,
    budgetReel REAL,
    statut TEXT,
    description TEXT,
    is_synced INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0
);

-- Employe
CREATE TABLE Employe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER UNIQUE,
    entrepriseId INTEGER,
    matricule TEXT,
    nom TEXT NOT NULL,
    prenom TEXT,
    poste TEXT,
    dateEmbauche DATE,
    salaireBase REAL,
    telephone TEXT,
    statut TEXT,
    is_synced INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0
);
```

Chaque table porte les champs techniques :
- `server_id` (ID côté serveur Django)
- `is_synced` (0 = local uniquement, 1 = synchronisé)
- `is_deleted` (soft delete)
- `created_at` / `updated_at`

---

## ⚙️ Configuration

### API Django distante

- **URL de base** : `http://localhost:8000/api`
- **Configurer dans** : `apiUrl/url.js` (et `controllers/authController.js`)

```js
const API_BASE_URL = 'http://localhost:8000/api';
```

- **Utilisation** : Authentification à distance (première connexion) — l'application tente d'abord une vérification locale, puis appelle l'API Django si l'utilisateur n'existe pas localement.

> 🔧 À modifier si le serveur Django tourne sur une autre adresse/port.

---

## ▶️ Lancement de l'application

```bash
# Démarrer l'application en mode développement
npm start
```

Cela exécute `electron .` qui lance `main.js` — le point d'entrée de l'application.

### Comportement au lancement

1. Electron se lance et crée la fenêtre principale (BrowserWindow).
2. Le menu par défaut est désactivé (`Menu.setApplicationMenu(null)`).
3. La base de données SQLite est initialisée (`initDatabase()`).
4. L'IPC `auth:login` est enregistré pour gérer les connexions.
5. La fenêtre charge `views/index.html` (page de connexion).
6. La fenêtre démarre maximisée.

---

## 🔒 Sécurité & Architecture

### Contexte de sécurité Electron

- `nodeIntegration: false` — Désactivé pour isoler le monde Node.js du monde navigateur.
- `contextIsolation: true` — Activé pour exposer uniquement les APIs contrôlées via `contextBridge`.
- `preload.js` — Le seul pont entre le processus principal et le rendu, expose `window.api.*`.

### Authentification

Le flux d'authentification (`authController.js`) fonctionne en deux étapes :

1. **Vérification locale** : Recherche de l'utilisateur dans la base SQLite locale.
   - Si trouvé → comparaison du mot de passe (⚠️ à sécuriser avec bcrypt en production).
   - Si mot de passe correct → connexion réussie, mise à jour de `derniereConnexion`.
2. **Première connexion** : Si l'utilisateur n'existe pas localement :
   - Appel à l'API Django (`POST /api/auth/login/`).
   - Si succès → l'utilisateur est synchronisé localement (`INSERT INTO Utilisateur`).
   - Si échec réseau → message d'erreur affiché.

### Synchronisation

- **Push** : envoi des enregistrements locaux modifiés (`is_synced = 0`) vers l'API Django, par table
- **Pull** : récupération des modifications distantes depuis la dernière synchro
- **Statut** : indicateur visuel dans la topbar (synced / pending / offline / error)
- **Configuration** : URL API (dans `apiUrl/url.js`), intervalle de sync, activation/désactivation

Chaque table possède les champs :
- `server_id` — Identifiant unique du serveur Django (pour la synchronisation bidirectionnelle).
- `is_synced` — Indique si l'enregistrement a été synchronisé (0 = en attente, 1 = synchronisé).
- `is_deleted` — Suppression logique (pour la synchronisation des suppressions).

---

## 🎨 Design System

- Réutilise **exactement** `public/tia-design.css` (aligné sur le web)
- Bootstrap 5 inclus (`public/bootstrap/`)
- Classes disponibles : `.app-shell`, `.sidebar`, `.topbar`, `.card-kpi`, `.badge-*`, `.btn-tia-*`, tables responsives, modales, toasts

---

## 🧭 Pattern de développement (consolidé)

Pour chaque module, une seule vue `index.html` (fragment injecté) + `index.js` (logique renderer), avec des **modales Bootstrap** pour les actions de création / édition / détail.

- Les routes sont déclarées dans `views/router.js`
- Chaque vue expose un contrôleur global (`window.<module>Controller`) avec une méthode `init()`
- Les appels IPC se font via `window.api.<module>.invoke('action', ...)`
- Un `loadScript()` dynamique charge le JS de la vue au besoin

---

## 🔑 Points d'attention

1. **Multi-tenant** : chaque donnée locale porte `entrepriseId`, filtré systématiquement par les repositories
2. **Soft delete** : jamais de suppression physique (`is_deleted = 1`)
3. **IDs hybrides** : `id` local + `server_id` (ID Django) pour la réconciliation
4. **Offline-first** : l'app est 100% fonctionnelle sans connexion
5. **Design system** : réutiliser `tia-design.css`, ne pas créer de CSS custom

---

## 🗒️ Notes & TODOs

- [ ] **Sécuriser les mots de passe** : utiliser bcrypt ou argon2 au lieu de comparaison directe.
- [ ] **Implémenter l'inscription** : `register.js` est actuellement une simulation (TODO).
- [ ] **Synchronisation complète** : ajouter la synchronisation des Chantiers, Employés, Matériels, Stocks.
- [ ] **Gestion des erreurs réseau** : améliorer la robustesse en cas de serveur Django inaccessible.
- [ ] **Mode hors ligne** : le stockage local permet déjà le travail offline, mais la synchronisation bidirectionnelle n'est pas encore implémentée.
- [ ] **Packaging** : ajouter `electron-builder` + scripts `build:win/mac/linux`.
- [ ] **Tests** : ajouter Jest (unitaires + IPC) et Playwright (E2E).

---

## 📄 Fichiers clés

| Fichier | Description |
|---------|-------------|
| `main.js` | Point d'entrée Electron — configuration de la fenêtre et de l'IPC |
| `preload.js` | Pont de sécurité — expose `window.api` via `contextBridge` |
| `models/db.js` | Connexion SQLite locale via `better-sqlite3` |
| `models/init.js` | Création et initialisation des tables de la base locale |
| `controllers/authController.js` | Logique d'authentification (local + API Django) |
| `views/index.html` | Interface de connexion |
| `views/register.html` | Interface d'inscription entreprise |
| `views/login.js` | Logique frontend de la page de connexion |
| `views/register.js` | Logique frontend de la page d'inscription (simulation) |
| `views/router.js` | Router SPA (hash-based) + guards + helpers |
| `views/layout.html` / `layout.js` | App shell (sidebar + topbar + content) |

---

## 🗂️ Documentation associée

- `TIA_INFO_BUILD_Conception_BDD.md` — Schéma de base de données (conception UML par module)
- `RAPPORT_ANALYSE_DESKTOP.md` — Rapport d'analyse comparé (plan ↔ code)
- `PLAN_ACTION_DESKTOP_V2.md` — Feuille de route des correctifs et améliorations

---

## 🆘 Support

- **Développé par** : TIA INFO BUILD — Madagascar
- **Année** : 2026
- **Projet associé** : TiaInfoBuild (Backend Django)