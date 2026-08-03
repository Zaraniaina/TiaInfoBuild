# PLAN D'ACTION — Reproduction des fonctionnalités Web dans l'application Desktop (Electron)

## 📋 Contexte
- **Projet Web (Django)** : Application SaaS multi-tenant complète avec 7 modules (Chantiers, RH, Matériels, Stocks, Commercial, Finance, Administration)
- **Projet Desktop (Electron + SQLite)** : Application locale avec authentification basique (login/register), design system TIA partagé
- **Base de données** : SQLite locale (better-sqlite3) synchronisable avec le serveur Django via API

## ✅ ÉTAT ACTUEL (corrigé)
Les erreurs signalées au démarrage ont été traitées de façon ciblée :
- compatibilité SQLite avec les colonnes manquantes ajoutées dans la base locale
- adaptation des repositories sur les champs utilisés par l’UI (budget prévisionnel, stock actuel, montant TTC, photo, etc.)
- correction des requêtes qui utilisaient des colonnes non présentes ou des noms incompatibles

Les vérifications réalisées sur la base locale ont bien fonctionné :
- la base initialise sans erreur
- les colonnes critiques sont maintenant accessibles

---

## ✅ CE QUE VOUS AVEZ DÉJÀ APPORTÉ
À partir de votre travail actuel, vous avez déjà posé une base solide :
- correction de la compatibilité SQLite pour les colonnes manquantes dans la base locale
- adaptation des repositories pour les champs utilisés par l’UI : budget, stock, montant TTC, photo, etc.
- amélioration de la stabilité du démarrage de l’application Desktop
- documentation du plan d’action et du contexte technique du projet

Ces changements sont un bon point de départ pour des contributions plus ciblées, lisibles et faciles à valider.

## 🧭 NOUVEAU PLAN D’ACTION PROGRESSIF POUR VOS CONTRIBUTIONS
L’objectif n’est plus de tout faire d’un coup, mais de contribuer par petites unités logiques, avec un travail manuel et visible à chaque étape.

### Étape 0 — Organiser votre travail Git/GitHub (avant chaque contribution)
Avant chaque modification, garder cette routine :
- vérifier l’état du dépôt : `git status`
- vérifier les fichiers modifiés : `git diff`
- créer une branche par fonctionnalité : `git checkout -b feat/nom-de-la-fonctionnalite`
- faire des commits petits et compréhensibles : `git add ...` puis `git commit -m "..."`
- pousser régulièrement : `git push origin nom-de-la-branche`

Exemples de branches :
- `fix/db-compatibility`
- `feat/chantiers-budget`
- `feat/rh-employes`
- `docs/plan-action`

Exemples de messages de commit :
- `fix(db): add compatibility columns for desktop app`
- `feat(chantiers): support budget fields in repository`
- `docs: add progressive contribution plan`

### Étape 1 — Consolider le socle déjà commencé (priorité haute)
Objectif : rendre l’application stable pour les usages essentiels.
Travaux attendus :
- finaliser la compatibilité de la base locale pour les modules déjà ouverts
- vérifier le chargement du tableau de bord, des chantiers et des employés
- corriger les erreurs SQL restantes si elles apparaissent

Critère de validation :
- l’application démarre sans erreur critique
- les écrans de base affichent des données sans crash

### Étape 2 — Contribuer à un module métier simple : Chantiers
Objectif : améliorer une vraie fonctionnalité métier visible.
Travaux attendus :
- ajouter ou corriger la création d’un chantier
- permettre l’ajout d’une phase liée au chantier
- garantir que le budget prévisionnel est bien enregistré et visible

Critère de validation :
- un chantier peut être créé depuis l’UI
- la phase est persistée dans la base
- le budget apparaît correctement dans la vue

### Étape 3 — Contribuer à un second module : RH / Employés
Objectif : rendre le module RH utilisable de façon progressive.
Travaux attendus :
- améliorer la création d’un employé
- vérifier l’enregistrement des informations de base
- faire fonctionner la liste et la consultation d’un employé

Critère de validation :
- un employé peut être ajouté sans erreur
- la liste se met à jour correctement

### Étape 4 — Ajouter un module complémentaire : Stocks
Objectif : couvrir un cas métier complémentaire avec peu de risque.
Travaux attendus :
- gérer les articles
- supporter le stock actuel et le seuil d’alerte
- faire apparaître les informations utiles dans la vue stock

Critère de validation :
- un article peut être créé
- le stock est mis à jour
- les alertes de stock sont visibles

### Étape 5 — Documentation, qualité et préparation d’un PR
Objectif : rendre votre contribution propre et partageable.
Travaux attendus :
- nettoyer les fichiers modifiés
- vérifier le contenu de chaque commit
- préparer une pull request propre avec un résumé clair
- documenter la fonctionnalité ajoutée et les validations faites

Critère de validation :
- le changement est facilement compréhensible par un autre développeur
- le PR montre bien votre contribution et ses effets

## 🛠️ COMPÉTENCES GIT / GITHUB À DÉVELOPPER PROGRESSIVEMENT
Pour bien ajuster cette application, il est utile de maîtriser ces gestes de base :

### Git de base
- `git status` : voir l’état des fichiers
- `git diff` : comparer les changements
- `git add <fichiers>` : préparer les modifications
- `git commit -m "message"` : enregistrer un changement proprement
- `git branch` : voir les branches
- `git checkout -b <nom>` : créer une nouvelle branche
- `git push origin <branche>` : envoyer la branche sur GitHub

### GitHub de base
- ouvrir une Pull Request après une branche fonctionnelle
- écrire un titre clair et un résumé de modification
- lier la PR aux changements réalisés
- consulter les commentaires et faire les ajustements demandés

### Bonnes pratiques à garder
- un commit = une idée claire
- une branche = une fonctionnalité ou un correctif
- ne pas mélanger plusieurs sujets dans un même commit
- faire des commits réguliers pour garder un historique propre

## 🎯 Objectif
Reproduire toutes les fonctionnalités du web (hors super-admin) dans l'application desktop, en reprenant le même design system (TIA Design System) et la même structure de base de données.

**Architecture clé : OFFLINE-FIRST (Local-First)**
- L'application desktop fonctionne **100% en local** sans connexion internet
- Base de données SQLite locale (`better-sqlite3`) → autonomie totale
- La synchronisation avec le serveur Django est **optionnelle et asynchrone** (quand connexion disponible)
- L'utilisateur travaille normalement hors ligne ; la sync se fait en arrière-plan quand le réseau revient

---

## 📦 PHASE 1 — FONDATIONS & ARCHITECTURE (Priorité HAUTE)

### 1.1 Compléter le schéma de base de données locale (SQLite)
**Fichier :** `Desktop/models/init.js`

Ajouter les tables manquantes selon `TIA_INFO_BUILD_Conception_BDD.md` :
- [ ] **Module Transverse** : `Entreprise`, `Role` (actuellement seul `Utilisateur` existe)
- [ ] **Module Chantiers** : `Phase`, `Incident`, `AffectationRessource` (actuellement seul `Chantier` existe)
- [ ] **Module RH** : `Equipe`, `MembreEquipe`, `AffectationChantier`, `Pointage`, `HeureSupplementaire` (actuellement seul `Employe` existe)
- [ ] **Module Matériels** : `Materiel`, `AffectationMateriel`, `Maintenance`, `AlerteMateriel`
- [ ] **Module Stocks** : `Article`, `Fournisseur`, `MouvementStock`
- [ ] **Module Commercial** : `Client`, `Devis`, `LigneDevis`, `Contrat`, `Facture`, `Paiement`
- [ ] **Module Finance** : `Depense`, `RapportFinancier`, `Alerte`

**Champs techniques à ajouter sur CHAQUE table** :
- `server_id INTEGER UNIQUE` (ID côté serveur Django pour sync)
- `is_synced INTEGER DEFAULT 0` (0=local uniquement, 1=synchro OK)
- `is_deleted INTEGER DEFAULT 0` (soft delete)
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
- `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`

### 1.2 Créer la couche d'abstraction base de données (Repository Pattern)
**Nouveaux fichiers :** `Desktop/models/repositories/`
- [ ] `BaseRepository.js` — CRUD générique + sync flags
- [ ] `ChantierRepository.js`
- [ ] `PhaseRepository.js`
- [ ] `IncidentRepository.js`
- [ ] `EmployeRepository.js`
- [ ] `PointageRepository.js`
- [ ] `MaterielRepository.js`
- [ ] `ArticleRepository.js`
- [ ] `MouvementStockRepository.js`
- [ ] `ClientRepository.js`
- [ ] `DevisRepository.js`
- [ ] `FactureRepository.js`
- [ ] `DepenseRepository.js`
- [ ] `AlerteRepository.js`

### 1.3 Étendre le système IPC (Main ↔ Renderer)
**Fichiers :** `Desktop/preload.js` + `Desktop/main.js`
- [ ] Exposer une API IPC structurée par module : `api.chantiers.*`, `api.rh.*`, `api.materiels.*`, `api.stocks.*`, `api.commercial.*`, `api.finance.*`
- [ ] Ajouter gestion des erreurs standardisée (`{ success: true, data }` / `{ success: false, error }`)
- [ ] Ajouter événements `sync:*` pour synchronisation bidirectionnelle

### 1.4 Système de navigation / Router côté Renderer
**Nouveau fichier :** `Desktop/views/router.js` ou utiliser un micro-router
- [ ] Navigation SPA sans rechargement (hash routing ou History API)
- [ ] Guards d'authentification (rediriger vers login si non connecté)
- [ ] Gestion du state utilisateur/entreprise courant (stocké en localStorage + IPC)

---

## 🎨 PHASE 2 — DESIGN SYSTEM & LAYOUT PRINCIPAL (Priorité HAUTE)

### 2.1 Adapter le layout "App Shell" (Sidebar + Topbar + Content)
**Fichiers existants :** `Desktop/public/tia-design.css` (déjà très complet, basé sur le web)
**Nouveaux fichiers :**
- [ ] `Desktop/views/layout.html` — Template principal (sidebar, topbar, content-area)
- [ ] `Desktop/views/layout.js` — Logique sidebar toggle, navigation active, user menu
- [ ] Adapter les classes CSS `.app-shell`, `.sidebar`, `.main-area`, `.topbar`, `.content-area` déjà présentes dans `tia-design.css`

### 2.2 Navigation latérale (Sidebar) — Modules BTP
Reproduire exactement la navigation du web (`Web/templates/base.html` lignes 50-73) :
- [ ] **Pilotage** : Tableau de bord, Chantiers, Finances
- [ ] **Ressources** : Employés, Matériels, Stocks
- [ ] **Commercial** : Clients, Devis & Contrats
- [ ] **Administration** (si rôle admin/directeur) : Utilisateurs

### 2.3 Barre supérieure (Topbar)
- [ ] Burger menu (mobile)
- [ ] Titre de page dynamique
- [ ] Avatar utilisateur + menu dropdown (profil, déconnexion)

### 2.4 Composants UI réutilisables (déjà dans tia-design.css, vérifier completude)
- [ ] Cards KPI (`.card-kpi`)
- [ ] Tableaux responsives (`.table-responsive`)
- [ ] Badges statuts (`.badge-actif`, `.badge-inactif`, etc.)
- [ ] Boutons primaires (`.btn-tia-primary`, `.btn-tia-navy`)
- [ ] Formulaires (inputs, selects, validation visuelle)
- [ ] Modales (Bootstrap 5 modal)
- [ ] Toasts/Alertes

---

## 🏗️ PHASE 3 — MODULE CHANTIERS (Cœur métier — Priorité TRÈS HAUTE)

### 3.1 Modèles & Repository
- [ ] Compléter tables `Phase`, `Incident`, `AffectationRessource` dans `init.js`
- [ ] Créer `ChantierRepository`, `PhaseRepository`, `IncidentRepository`

### 3.2 Vues (Renderer) — Fichiers HTML/JS
**Nouveaux fichiers :**
- [ ] `Desktop/views/chantiers/liste.html` + `liste.js` — Liste paginée, recherche, bouton "Nouveau"
- [ ] `Desktop/views/chantiers/detail.html` + `detail.js` — Vue détaillée avec onglets : Infos, Phases, Incidents, Budget, Ressources
- [ ] `Desktop/views/chantiers/form.html` + `form.js` — Création/Édition (mode création / modification)
- [ ] `Desktop/views/chantiers/phase-form.html` + `phase-form.js` — Ajout phase
- [ ] `Desktop/views/chantiers/incident-form.html` + `incident-form.js` — Déclaration incident

### 3.3 Contrôleurs (Main Process)
**Nouveau fichier :** `Desktop/controllers/chantierController.js`
- [ ] `getAll(filters, pagination)` — Liste avec filtres (statut, recherche)
- [ ] `getById(id)` — Détail complet avec relations
- [ ] `create(data)` — Création + validation
- [ ] `update(id, data)` — Modification
- [ ] `delete(id)` — Soft delete
- [ ] `addPhase(chantierId, data)` — Ajout phase
- [ ] `addIncident(chantierId, data)` — Déclaration incident
- [ ] `getStats(chantierId)` — KPIs pour dashboard

### 3.4 IPC Handlers (Main)
- [ ] `chantiers:list`, `chantiers:get`, `chantiers:create`, `chantiers:update`, `chantiers:delete`
- [ ] `chantiers:phase:create`, `chantiers:incident:create`
- [ ] `chantiers:stats`

---

## 👷 PHASE 4 — MODULE RH (Priorité HAUTE)

### 4.1 Modèles & Repository
- [ ] Compléter tables RH dans `init.js`
- [ ] Créer repositories : `EmployeRepository`, `EquipeRepository`, `PointageRepository`, `HeureSuppRepository`

### 4.2 Vues
- [ ] `Desktop/views/rh/employes/liste.html` + `liste.js`
- [ ] `Desktop/views/rh/employes/detail.html` + `detail.js` (onglets : Infos, Affectations, Pointages, Heures sup)
- [ ] `Desktop/views/rh/employes/form.html` + `form.js`
- [ ] `Desktop/views/rh/pointages/liste.html` + `liste.js` (saisie pointage journalier)
- [ ] `Desktop/views/rh/pointages/form.html` + `form.js`
- [ ] `Desktop/views/rh/equipes/liste.html` + `liste.js`
- [ ] `Desktop/views/rh/heures-sup/liste.html` + `liste.js`

### 4.3 Contrôleurs & IPC
- [ ] `Desktop/controllers/rhController.js`
- [ ] IPC handlers : `rh:employes:*`, `rh:pointages:*`, `rh:equipes:*`, `rh:heures-sup:*`

---

## 🛠️ PHASE 5 — MODULE MATÉRIELS (Priorité MOYENNE)

### 5.1 Modèles & Repository
- [ ] Tables : `Materiel`, `AffectationMateriel`, `Maintenance`, `AlerteMateriel`
- [ ] Repositories correspondants

### 5.2 Vues
- [ ] `Desktop/views/materiels/liste.html` + `liste.js`
- [ ] `Desktop/views/materiels/detail.html` + `detail.js` (onglets : Infos, Affectations, Maintenance, Alertes)
- [ ] `Desktop/views/materiels/form.html` + `form.js`
- [ ] `Desktop/views/materiels/maintenance-form.html` + `maintenance-form.js`
- [ ] `Desktop/views/materiels/affectation-form.html` + `affectation-form.js`

### 5.3 Contrôleurs & IPC
- [ ] `Desktop/controllers/materielController.js`
- [ ] IPC handlers : `materiels:*`

---

## 📦 PHASE 6 — MODULE STOCKS (Priorité MOYENNE)

### 6.1 Modèles & Repository
- [ ] Tables : `Article`, `Fournisseur`, `MouvementStock`
- [ ] Repositories

### 6.2 Vues
- [ ] `Desktop/views/stocks/articles/liste.html` + `liste.js` (avec indicateurs stock bas)
- [ ] `Desktop/views/stocks/articles/form.html` + `form.js`
- [ ] `Desktop/views/stocks/fournisseurs/liste.html` + `liste.js`
- [ ] `Desktop/views/stocks/fournisseurs/form.html` + `form.js`
- [ ] `Desktop/views/stocks/mouvements/liste.html` + `liste.js` (historique entrées/sorties)
- [ ] `Desktop/views/stocks/mouvements/form.html` + `form.js` (saisie entrée/sortie avec maj auto stock)

### 6.3 Contrôleurs & IPC
- [ ] `Desktop/controllers/stockController.js`
- [ ] IPC handlers : `stocks:articles:*`, `stocks:fournisseurs:*`, `stocks:mouvements:*`

---

## 💼 PHASE 7 — MODULE COMMERCIAL (Priorité MOYENNE)

### 7.1 Modèles & Repository
- [ ] Tables : `Client`, `Devis`, `LigneDevis`, `Contrat`, `Facture`, `Paiement`
- [ ] Repositories

### 7.2 Vues
- [ ] `Desktop/views/commercial/clients/liste.html` + `liste.js`
- [ ] `Desktop/views/commercial/clients/form.html` + `form.js`
- [ ] `Desktop/views/commercial/devis/liste.html` + `liste.js`
- [ ] `Desktop/views/commercial/devis/detail.html` + `detail.js` (lignes, totaux, statut)
- [ ] `Desktop/views/commercial/devis/form.html` + `form.js` (gestion lignes dynamiques)
- [ ] `Desktop/views/commercial/contrats/liste.html` + `liste.js`
- [ ] `Desktop/views/commercial/factures/liste.html` + `liste.js`
- [ ] `Desktop/views/commercial/paiements/form.html` + `form.js`

### 7.3 Contrôleurs & IPC
- [ ] `Desktop/controllers/commercialController.js`
- [ ] IPC handlers : `commercial:*`

---

## 💰 PHASE 8 — MODULE FINANCE / TABLEAU DE BORD (Priorité MOYENNE)

### 8.1 Modèles & Repository
- [ ] Tables : `Depense`, `RapportFinancier`, `Alerte`
- [ ] Repositories

### 8.2 Vues
- [ ] `Desktop/views/finance/depenses/liste.html` + `liste.js`
- [ ] `Desktop/views/finance/depenses/form.html` + `form.js`
- [ ] `Desktop/views/finance/rapports/liste.html` + `liste.js`
- [ ] `Desktop/views/finance/alertes/liste.html` + `liste.js` (tableau de bord alertes)

### 8.3 Tableau de bord principal (Dashboard)
- [ ] `Desktop/views/dashboard.html` + `dashboard.js`
- [ ] KPIs : Chantiers actifs, Budget total, Employés présents, Stocks bas, Devis en attente, Alertes
- [ ] Graphiques simples (Chart.js ou SVG) : Avancement chantiers, Évolution budget, Pointages

### 8.4 Contrôleurs & IPC
- [ ] `Desktop/controllers/financeController.js`
- [ ] `Desktop/controllers/dashboardController.js`
- [ ] IPC handlers : `finance:*`, `dashboard:stats`

---

## 🔄 PHASE 9 — SYNCHRONISATION AVEC LE SERVEUR DJANGO (Priorité HAUTE pour production)

### 9.1 Architecture Sync
- [ ] Service `Desktop/services/syncService.js` (orchestrateur)
- [ ] Stratégie : **Offline-first** → Push local → Pull distant → Résolution conflits (last-write-wins ou manuel)
- [ ] Queue de sync persistante (table `SyncQueue` en local)

### 9.2 API Client (Axios wrapper)
- [ ] `Desktop/services/apiClient.js` — Base URL configurable, intercepteurs auth, retry, offline detection

### 9.3 Endpoints de sync par module
- [ ] `POST /api/sync/push/` — Envoi modifications locales (batch)
- [ ] `GET /api/sync/pull/?since=<timestamp>` — Récupération modifications distantes
- [ ] `POST /api/sync/conflicts/` — Résolution conflits

### 9.4 UI Sync
- [ ] Indicateur de statut sync dans la topbar (synced / pending / conflict / offline)
- [ ] Bouton "Synchroniser maintenant"
- [ ] Écran de résolution de conflits si nécessaire

---

## ⚙️ PHASE 10 — CONFIGURATION & DÉPLOIEMENT (Priorité BASSE)

### 10.1 Configuration utilisateur
- [ ] `Desktop/views/settings.html` + `settings.js`
- [ ] Paramètres : URL serveur API, fréquence sync auto, thème, langue, sauvegarde locale

### 10.2 Build & Packaging
- [ ] `electron-builder` config (package.json `build` section)
- [ ] Icônes, splash screen, auto-update (electron-updater)
- [ ] Scripts npm : `build:win`, `build:mac`, `build:linux`

### 10.3 Tests
- [ ] Tests unitaires repositories (Jest)
- [ ] Tests d'intégration IPC
- [ ] Tests E2E (Playwright ou Cypress + Electron)

---

## 📁 STRUCTURE CIBLE DU PROJET DESKTOP

```
Desktop/
├── main.js                     # Entry point Electron
├── preload.js                  # IPC bridge
├── package.json
├── tia_info_build.sqlite       # DB SQLite
├── controllers/                # Logique métier (Main process)
│   ├── authController.js
│   ├── chantierController.js
│   ├── rhController.js
│   ├── materielController.js
│   ├── stockController.js
│   ├── commercialController.js
│   ├── financeController.js
│   └── dashboardController.js
├── models/
│   ├── db.js                   # Connexion better-sqlite3
│   ├── init.js                 # Schéma complet (toutes tables)
│   └── repositories/           # Couche données
│       ├── BaseRepository.js
│       ├── ChantierRepository.js
│       ├── PhaseRepository.js
│       ├── IncidentRepository.js
│       ├── EmployeRepository.js
│       ├── PointageRepository.js
│       ├── MaterielRepository.js
│       ├── ArticleRepository.js
│       ├── MouvementStockRepository.js
│       ├── ClientRepository.js
│       ├── DevisRepository.js
│       ├── FactureRepository.js
│       └── DepenseRepository.js
├── services/
│   ├── apiClient.js            # Client HTTP Django API
│   └── syncService.js          # Synchronisation offline-first
├── public/
│   ├── tia-design.css          # Design system (existant)
│   └── bootstrap/              # Bootstrap 5 (existant)
└── views/                      # Renderer process (UI)
    ├── layout.html             # App shell (sidebar + topbar)
    ├── layout.js
    ├── router.js               # SPA router
    ├── index.html              # Login (existant)
    ├── login.js
    ├── register.html
    ├── register.js
    ├── dashboard.html
    ├── dashboard.js
    ├── settings.html
    ├── settings.js
    ├── chantiers/
    │   ├── liste.html + liste.js
    │   ├── detail.html + detail.js
    │   ├── form.html + form.js
    │   ├── phase-form.html + phase-form.js
    │   └── incident-form.html + incident-form.js
    ├── rh/
    │   ├── employes/
    │   │   ├── liste.html + liste.js
    │   │   ├── detail.html + detail.js
    │   │   └── form.html + form.js
    │   ├── pointages/
    │   │   ├── liste.html + liste.js
    │   │   └── form.html + form.js
    │   ├── equipes/
    │   │   ├── liste.html + liste.js
    │   │   └── form.html + form.js
    │   └── heures-sup/
    │       ├── liste.html + liste.js
    │       └── form.html + form.js
    ├── materiels/
    │   ├── liste.html + liste.js
    │   ├── detail.html + detail.js
    │   ├── form.html + form.js
    │   ├── maintenance-form.html + maintenance-form.js
    │   └── affectation-form.html + affectation-form.js
    ├── stocks/
    │   ├── articles/
    │   │   ├── liste.html + liste.js
    │   │   └── form.html + form.js
    │   ├── fournisseurs/
    │   │   ├── liste.html + liste.js
    │   │   └── form.html + form.js
    │   └── mouvements/
    │       ├── liste.html + liste.js
    │       └── form.html + form.js
    ├── commercial/
    │   ├── clients/
    │   │   ├── liste.html + liste.js
    │   │   └── form.html + form.js
    │   ├── devis/
    │   │   ├── liste.html + liste.js
    │   │   ├── detail.html + detail.js
    │   │   └── form.html + form.js
    │   ├── contrats/
    │   │   ├── liste.html + liste.js
    │   │   └── detail.html + detail.js
    │   ├── factures/
    │   │   ├── liste.html + liste.js
    │   │   └── detail.html + detail.js
    │   └── paiements/
    │       └── form.html + form.js
    └── finance/
        ├── depenses/
        │   ├── liste.html + liste.js
        │   └── form.html + form.js
        ├── rapports/
        │   ├── liste.html + liste.js
        │   └── detail.html + detail.js
        └── alertes/
            └── liste.html + liste.js
```

---

## 🗓️ PLANNING SUGGÉRÉ (itératif)

| Sprint | Focus | Livrables |
|--------|-------|-----------|
| **Sprint 1** (1-2 sem) | Fondations | DB complète, Repositories, IPC structuré, Layout principal (sidebar/topbar), Router, Auth guards |
| **Sprint 2** (2-3 sem) | Module Chantiers | CRUD Chantiers, Phases, Incidents, Liste + Détail + Formulaires, Dashboard KPIs chantiers |
| **Sprint 3** (2 sem) | Module RH | Employés, Pointages, Équipes, Heures sup |
| **Sprint 4** (2 sem) | Module Matériels + Stocks | Matériels (CRUD, maintenance, affectations), Stocks (articles, fournisseurs, mouvements) |
| **Sprint 5** (2 sem) | Module Commercial | Clients, Devis (avec lignes), Contrats, Factures, Paiements |
| **Sprint 6** (1-2 sem) | Finance + Dashboard | Dépenses, Rapports, Alertes, Tableau de bord global |
| **Sprint 7** (2 sem) | Synchronisation | Sync offline-first, résolution conflits, UI statut sync |
| **Sprint 8** (1 sem) | Polish & Build | Settings, packaging, tests, documentation |

---

## 🔑 POINTS D'ATTENTION CRITIQUES

1. **Multi-tenant** : Chaque donnée locale porte `entrepriseId` (récupéré à la connexion). Filtrer **systématiquement** par entreprise dans tous les repositories.

2. **Soft delete + Sync flags** : Ne jamais `DELETE` physiquement. `is_deleted=1` + `is_synced=0` → push suppression au serveur.

3. **IDs hybrides** : `id` (local AUTOINCREMENT) + `server_id` (ID Django). Utiliser `server_id` pour la réconciliation sync.

4. **Design system** : Réutiliser **exactement** `tia-design.css` (déjà aligné sur le web). Ne pas recréer de CSS custom.

5. **Navigation** : Reproduire la structure de `Web/templates/base.html` (sidebar sections : Pilotage, Ressources, Commercial, Administration).

6. **Offline-first** : L'app doit être 100% fonctionnelle sans connexion. La sync est asynchrone et en arrière-plan.

7. **Validation** : Valider côté renderer (UX) ET côté main (sécurité/intégrité DB).

---

## 🚀 PROCHAINES ÉTAPES IMMÉDIATES (À DÉMARRER AUJOURD'HUI)

1. [ ] **Étendre `models/init.js`** avec toutes les tables du document de conception BDD
2. [ ] **Créer `BaseRepository.js`** + 2-3 repositories pilotes (Chantier, Employe, Article)
3. [ ] **Créer `views/layout.html` + `layout.js`** (App Shell avec sidebar/topbar fonctionnelle)
4. [ ] **Créer `views/router.js`** (navigation SPA hash-based)
5. [ ] **Étendre `preload.js`** avec namespace IPC par module
6. [ ] **Implémenter `chantierController.js`** + IPC handlers + vues Liste/Détail/Form Chantier

---

*Document généré le 2025-07-30 — Prêt pour exécution en mode ACT*