# TIA INFO BUILD — Application Desktop de Gestion BTP

> **TIA INFO BUILD Desktop** est une application de bureau **Electron** autonome, conçue pour la gestion complète des entreprises du BTP (Bâtiment / Travaux Publics). Elle combine une base de données locale SQLite, une interface moderne Bootstrap et un système RBAC avancé pour couvrir l'ensemble des métiers de la construction.

---

## 🏗️ Architecture

```
Desktop/
├── main.js                          # Point d'entrée Electron — IPC, sécurité, fenêtre
├── preload.js                       # Pont sécurisé — expose window.api via contextBridge
├── package.json                     # Dépendances et scripts npm
├── jest.config.js                   # Configuration tests unitaires et intégration
├── tia_info_build.sqlite            # Base de données SQLite locale
│
├── models/
│   ├── db.js                        # Connexion SQLite via better-sqlite3
│   ├── init.js                      # Initialisation/migration automatique des tables
│   └── repositories/                # Couche d'accès aux données (Repository pattern)
│       ├── BaseRepository.js
│       ├── ChantierRepository.js
│       ├── PhaseRepository.js
│       ├── IncidentRepository.js
│       ├── EmployeRepository.js
│       ├── PointageRepository.js
│       ├── EquipeRepository.js
│       ├── ArticleRepository.js
│       ├── FournisseurRepository.js
│       ├── MouvementStockRepository.js
│       ├── ClientRepository.js
│       ├── DevisRepository.js
│       ├── ContratRepository.js
│       ├── FactureRepository.js
│       ├── PaiementRepository.js
│       ├── DepenseRepository.js
│       ├── AlerteRepository.js
│       ├── MaterielRepository.js
│       ├── MaintenanceRepository.js
│       ├── BudgetPrevisionnelRepository.js
│       ├── SousTraitantRepository.js
│       ├── CatalogueDevisRepository.js
│       ├── NotificationRepository.js
│       └── ...
│
├── controllers/                     # Contrôleurs métier (couche service)
│   ├── authController.js
│   ├── chantierController.js
│   ├── rhController.js
│   ├── stockController.js
│   ├── materielController.js
│   ├── commercialController.js
│   ├── financeController.js
│   ├── dashboardController.js
│   ├── alerteController.js
│   ├── budgetController.js
│   ├── sousTraitantController.js
│   ├── catalogueController.js
│   ├── notificationController.js
│   └── ...
│
├── views/                           # Interface utilisateur (SPA Bootstrap)
│   ├── layout.html                  # Shell principal — sidebar, topbar, routing
│   ├── router.js                    # Routeur hash — chargement dynamique des vues
│   ├── index.html                   # Page de connexion
│   ├── login.js / register.js       # Authentification
│   ├── dashboard.js                 # Tableau de bord synthétique
│   ├── projets/index.js             # Dashboard multi-chantiers Chef de Projet
│   ├── terrain/index.js             # Mode Terrain mobile-first Chef de Chantier
│   ├── commercial/                  # Module commercial
│   │   ├── pipeline.html/js         # Pipeline Kanban
│   │   ├── catalogue-devis.html/js  # Catalogue modèles de devis BTP
│   │   ├── devis/                   # CRUD devis avec lignes
│   │   ├── contrats/                # Gestion contrats
│   │   ├── factures/                # Facturation avec PDF standardisé
│   │   └── paiements/               # Suivi encaissements
│   ├── finance/                     # Module financier
│   │   ├── depenses/                # Dépenses par chantier
│   │   ├── rapports/                # Rapports financiers
│   │   └── alertes/                 # Alertes classiques
│   ├── finances/                    # Modules avancés Phase 1
│   │   ├── tresorerie.html/js       # Vue J-30, J-60, J-90
│   │   └── budget-previsionnel.html/js  # Comparaison prévu/réel
│   ├── alertes/
│   │   └── intelligentes.html/js    # Alertes intelligentes (retards, dépassements)
│   ├── rh/                          # Ressources Humaines
│   │   ├── employes/                # Dossier employé enrichi
│   │   ├── pointages/               # Pointage quotidien
│   │   ├── equipes/                 # Gestion équipes
│   │   └── heures-sup/              # Heures supplémentaires
│   ├── stocks/                      # Gestion des stocks
│   │   ├── index.html/js            # Articles et mouvements
│   │   ├── fournisseurs/            # CRUD fournisseurs
│   │   └── mouvements/              # Entrées/sorties par chantier
│   ├── materiels/index.html/js      # Parc matériel et maintenances
│   ├── chantiers/index.html/js      # Gestion complète chantiers + phases + incidents
│   ├── sous-traitants/index.html/js # CRUD sous-traitants + affectations
│   ├── notifications/index.html/js  # Centre de notifications
│   ├── historique-logins/           # Historique connexions
│   ├── audit-log/                   # Journal d'audit
│   └── settings.html/js             # Paramètres entreprise et préférences
│
├── services/
│   ├── emailService.js              # Envoi emails (factures, relances)
│   ├── syncService.js               # Synchronisation avec serveur
│   └── apiClient.js                 # Client API
│
├── shared/
│   └── permissions.js               # RBAC centralisé — 9 rôles métier BTP
│
├── scripts/
│   └── verify-permissions.js        # Audit des permissions
│
├── tests/
│   ├── unit/                        # Tests repositories, RBAC
│   └── integration/                 # Tests IPC, cohérence frontend/backend
│
└── public/
    ├── bootstrap/                   # Bootstrap 5 + Icons
    └── tia-design.css               # Charte graphique TIA INFO BUILD
```

---

## 🎯 Orientation et conception

### Principe fondateur
L'application est conçue **par et pour les métiers du BTP**. Chaque fonctionnalité répond à un besoin réel des utilisateurs terrain, chefs de chantier, comptables, commerciaux et dirigeants.

### Philosophie technique
- **Autonomie** : base de données locale SQLite, fonctionnement hors-ligne complet
- **Sécurité** : Electron sécurisé (`contextIsolation`, pas de `nodeIntegration`), RBAC par rôle métier
- **Performance** : Repository pattern, requêtes optimisées, triggers SQLite pour les calculs automatiques
- **Évolutivité** : architecture modulaire par métier, migrations automatiques, système de vues dynamiques

### Modules métier

| Module | Rôles concernés | Description |
|--------|-----------------|-------------|
| **Chantiers** | Tous | Création, suivi, phases, incidents, photos, affectations |
| **Ressources Humaines** | RH, CHEF_CHANTIER, DIRECTEUR | Employés, pointages, équipes, heures supplémentaires |
| **Commercial** | COMMERCIAL, DIRECTEUR, COMPTABLE | Pipeline Kanban, devis, contrats, factures, catalogue BTP |
| **Finance** | COMPTABLE, DIRECTEUR | Dépenses, trésorerie J-30/J-60/J-90, budget prévisionnel |
| **Stocks** | MAGASINIER, CHEF_CHANTIER | Articles, fournisseurs, mouvements, alertes rupture |
| **Matériels** | MATERIEL, CHEF_CHANTIER | Parc matériel, maintenances, affectations chantiers |
| **Sous-traitants** | CHEF_CHANTIER, CHEF_PROJET | CRUD, affectations, suivi |
| **Alertes intelligentes** | Tous | Retards paiement, dépassements budget, habilitations |
| **Mode Terrain** | CHEF_CHANTIER | Interface mobile-first pour usage sur chantier |
| **Notifications** | Tous | Centre de notifications temps réel |

---

## 👥 Rôles métier (RBAC)

L'application dispose de **9 rôles métier** correspondant aux fonctions réelles dans une entreprise BTP :

| Rôle | Code | Espace dédié |
|------|------|--------------|
| Administrateur d'Entreprise | `ADMIN` | Administration, utilisateurs, sauvegardes |
| Comptable / Responsable Financier | `COMPTABLE` | Finances, dépenses, factures, trésorerie |
| Direction Générale / DAF | `DIRECTEUR` | Pilotage stratégique, alertes, budgets |
| Chef de Chantier / Conducteur de Travaux | `CHEF_CHANTIER` | Mode Terrain, chantiers, équipes, stocks |
| Chef de Projet / Directeur Technique | `CHEF_PROJET` | Projets multi-chantiers, budgets, ressources |
| Responsable RH | `RH` | Employés, pointages, équipes, heures sup |
| Responsable Matériel / Logisticien | `MATERIEL` | Matériels, maintenances, disponibilités |
| Magasinier / Responsable Stock | `MAGASINIER` | Stocks, fournisseurs, mouvements, inventaire |
| Commercial / Responsable Commercial | `COMMERCIAL` | Pipeline, devis, contrats, factures, catalogue |

---

## 🚀 Fonctionnalités clés

### Phase 1 — Quick Wins ✅
- Nouvelles tables BDD : `BudgetPrevisionnel`, `SousTraitant`, `CatalogueDevis`, `Notification`
- Vue Trésorerie consolidée (J-30, J-60, J-90)
- Vue Budget Prévisionnel vs Réel
- Vue Sous-Traitants
- Vue Catalogue Devis BTP
- Vue Notifications
- Sidebar enrichie et Router étendu
- Préload API modulaire

### Phase 2 — Fonctionnalités cœur métier ✅
- Workflow validation dépenses 2 niveaux (Chef de Chantier → Comptable)
- Dashboard Chef de Projet multi-chantiers
- Pipeline Commercial Kanban
- Alertes Intelligentes (factures retard, dépassements, habilitations)
- Mode Terrain mobile-first
- Création de facture depuis devis accepté
- Relances clients automatiques (J+15, J+30, J+60)
- Export PDF factures standardisé

### Phase 3 — En cours 🟡
- Filtres avancés factures (client, période, chantier)
- Calcul automatique `montantPaye` et `resteAPayer`
- Triggers notifications automatiques sur événements métier
- Purge automatique des anciennes notifications
- RBAC complété : permissions `projets:list`, `pipeline:list`, `alertes-intelligentes:list`, `terrain:access`

### Phase 4 — Roadmap
- Pointage par PIN/NFC
- Gantt visuel interactif
- Module paie RH
- Rapprochement bancaire
- Signature électronique
- Module Qualité/VAE
- Module Sécurité
- Géolocalisation matériel
- Carnet de travaux numérique

---

## 📦 Stack technique

| Couche | Technologie | Usage |
|--------|-------------|-------|
| **Desktop** | Electron ^38.8.6 | Application bureau multi-OS |
| **Base de données** | better-sqlite3 ^13.0.3 | Stockage local, hors-ligne |
| **Frontend** | Bootstrap 5 + Vanilla JS | Interface SPA responsive |
| **Routing** | Router hash personnalisé | Navigation dynamique |
| **Sécurité** | contextIsolation, RBAC | Isolation et droits par rôle |
| **Tests** | Jest ^29.7.0 | Unitaires et intégration |
| **Build** | electron-builder | Packaging Windows/Mac/Linux |

---

## ▶️ Installation et lancement

```bash
# Installation des dépendances
npm install

# Lancement en mode développement
npm start

# Lancement des tests
npm test

# Build de production
npm run build
npm run build:win
```

---

## 🔒 Sécurité

- **Authentification locale** : bcrypt pour les mots de passe
- **RBAC** : 9 rôles métier avec permissions granulaire par module
- **Audit** : journal d'audit automatique sur les actions sensibles
- **Sauvegarde** : export SQLite/SQL, import, restore, configuration automatique
- **Isolation** : `contextIsolation: true`, pas de `nodeIntegration`

---

## 📊 État du projet

| Phase | Statut | Couverture |
|-------|--------|------------|
| Phase 1 — Quick Wins | ✅ Appliquée | 100% |
| Phase 2 — Cœur métier | ✅ Appliquée | 100% |
| Phase 3 — Optimisation | 🟡 En cours | 40% |
| Phase 4 — Intégrations | ❌ À venir | 0% |

---

## 🆘 Support

- **Développé par** : TIA INFO BUILD — Madagascar
- **Année** : 2026
- **Contact** : [Contact TIA INFO BUILD](mailto:contact@tiainfobuild.mg)

---

> © 2026 TIA INFO BUILD — Madagascar. Tous droits réservés.
