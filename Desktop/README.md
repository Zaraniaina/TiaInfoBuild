# TIA INFO BUILD — Application Desktop (Electron)

> **TIA INFO BUILD** est une application de bureau **Electron** conçue pour la gestion complète du BTP (Bâtiment / Travaux Publics). Elle permet de gérer les chantiers, le personnel, les matériels, les stocks et la comptabilité depuis un espace local sécurisé, tout en restant synchronisée avec le serveur Django distant.

---

## 📋 Prerequisites

| Outil | Version minimale |
|-------|-----------------|
| **Node.js** | `>= 22.12.0` |
| **npm** | `>= 10.0.0` |
| **Electron** | `^43.2.0` (installé via npm) |

> ⚠️ Electron 43+ exige **Node.js >= 22.12.0**. Vérifiez votre version avec :
> ```bash
> node --version
> npm --version
> ```

---

## 📦 Modules / Packages npm à installer

Le projet utilise les dépendances suivantes, définies dans [`package.json`](./package.json) :

### Dépendances de production (runtime)

| Package | Version | Rôle |
|---------|---------|------|
| `axios` | `^1.19.0` | Requêtes HTTP vers l'API Django distante |
| `better-sqlite3` | `^13.0.2` | Base de données SQLite locale (synchronisation hors ligne) |

### Dépendances de développement

| Package | Version | Rôle |
|---------|---------|------|
| `electron` | `^43.2.0` | Framework de l'application desktop |

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

## ⚙️ Configuration

### Structure du projet

```
Desktop/
├── main.js                          # Point d'entrée Electron — crée la fenêtre principale
├── preload.js                       # Script de préchargement — expose l'API via contextBridge
├── package.json                     # Configuration npm / Electron
├── package-lock.json                # Verrouillage des versions (généré)
├── tia_info_build.sqlite            # Base de données SQLite locale (créée à l'init)
│
├── models/
│   ├── db.js                        # Connexion à la base SQLite locale
│   └── init.js                      # Initialisation des tables (Utilisateur, Chantier, Employe)
│
├── controllers/
│   └── authController.js            # Authentification (local + API Django)
│
├── views/
│   ├── index.html                   # Page de connexion
│   ├── login.js                     # Logique frontend connexion
│   ├── register.html                # Page d'inscription entreprise
│   └── register.js                  # Logique frontend inscription
│
└── public/
    ├── tia-design.css               # Styles personnalisés (charte TIA INFO BUILD)
    └── bootstrap/                     # Framework CSS Bootstrap (CSS + JS + Icons)
        ├── css/
        ├── js/
        └── bootstrap-icons/
```

### Base de données locale (SQLite)

- **Fichier** : `tia_info_build.sqlite` (à la racine du dossier `Desktop/`)
- **ORM/Driver** : [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)
- **Initialisation** : Automatique au lancement de l'application via `models/init.js`
- **Tables créées** :
  - `Utilisateur` — Gestion des comptes utilisateurs (avec `server_id` pour synchronisation)
  - `Chantier` — Suivi des chantiers de construction
  - `Employe` — Gestion des employés / salariés

#### Schéma clé des tables

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

### API Django distante

- **URL de base** : `http://localhost:8000/api`
- **Configurer dans** : [`controllers/authController.js`](./controllers/authController.js)
  ```js
  const API_BASE_URL = 'http://localhost:8000/api';
  ```
- **Utilisation** : Authentification à distance (première connexion) — l'application tente d'abord une vérification locale, puis appelle l'API Django si l'utilisateur n'existe pas localement.

> 🔧 **À modifier** si le serveur Django tourne sur une autre adresse/port.

---

## ▶️ Lancement de l'application

```bash
# Démarrer l'application en mode développement
npm start
```

> Cela exécute `electron .` qui lance `main.js` — le point d'entrée de l'application.

### Comportement au lancement

1. Electron se lance et crée la fenêtre principale (`BrowserWindow`).
2. Le menu par défaut est désactivé (`Menu.setApplicationMenu(null)`).
3. La base de données SQLite est initialisée (`initDatabase()`).
4. L'IPC `auth:login` est enregistré pour gérer les connexions.
5. La fenêtre charge `views/index.html` (page de connexion).
6. La fenêtre démarre maximisée.

---

## 🔒 Sécurité & Architecture

### Contexte de sécurité Electron

- **`nodeIntegration: false`** — Désactivé pour isoler le monde Node.js du monde navigateur.
- **`contextIsolation: true`** — Activé pour exposer uniquement les APIs contrôlées via `contextBridge`.
- **`preload.js`** — Le seul pont entre le processus principal et le rendu, expose `window.api.login()`.

### Authentification

Le flux d'authentification (`authController.js`) fonctionne en deux étapes :

1. **Vérification locale** : Recherche de l'utilisateur dans la base SQLite locale.
   - Si trouvé → comparaison du mot de passe (⚠️ à sécuriser avec `bcrypt` en production).
   - Si mot de passe correct → connexion réussie, mise à jour de `derniereConnexion`.
2. **Première connexion** : Si l'utilisateur n'existe pas localement :
   - Appel à l'API Django (`POST /api/auth/login/`).
   - Si succès → l'utilisateur est synchronisé localement (`INSERT INTO Utilisateur`).
   - Si échec réseau → message d'erreur affiché.

### Synchronisation

Chaque table possède les champs :
- `server_id` — Identifiant unique du serveur Django (pour la synchronisation bidirectionnelle).
- `is_synced` — Indique si l'enregistrement a été synchronisé (0 = en attente, 1 = synchronisé).
- `is_deleted` — Suppression logique (pour la synchronisation des suppressions).

---

## 🗒️ Notes & TODOs

- [ ] **Sécuriser les mots de passe** : utiliser `bcrypt` ou `argon2` au lieu de comparaison directe.
- [ ] **Implémenter l'inscription** : `register.js` est actuellement une simulation (TODO).
- [ ] **Synchronisation complète** : ajouter la synchronisation des Chantiers, Employés, Matériels, Stocks.
- [ ] **Gestion des erreurs réseau** : améliorer la robustesse en cas de serveur Django inaccessible.
- [ ] **Mode hors ligne** : le stockage local permet déjà le travail offline, mais la synchronisation bidirectionnelle n'est pas encore implémentée.

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

---

## 🆘 Support

- **Développé par** : TIA INFO BUILD — Madagascar
- **Année** : 2026
- **Projet associé** : [TiaInfoBuild (Backend Django)](https://github.com/Zaraniaina/TiaInfoBuild)

---

> © 2026 TIA INFO BUILD — Madagascar. Tous droits réservés.
