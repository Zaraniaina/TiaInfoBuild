# RAPPORT D'ANALYSE — Projet Desktop Electron TIA INFO BUILD

> **Date d'analyse** : 31 juillet 2026  
> **Analyse comparée** : PLAN_ACTION_DESKTOP.md ↔ état actuel du code  
> **Conclusion générale** : Le projet est **beaucoup plus avancé** que ce que suggère le plan d'action. L'ensemble de l'architecture technique est en place (DB, repositories, contrôleurs, vues, router, IPC, design system). Il reste cependant **5 correctifs critiques à appliquer** et **9 vues à créer** pour que l'application soit pleinement fonctionnelle et ne plante pas au démarrage.

---

## 1. ÉTAT ACTUEL PAR COMPOSANTE

### 1.1 Schéma de base de données (`models/init.js`) — ✅ COMPLÈTE

Toutes les tables définies dans `TIA_INFO_BUILD_Conception_BDD.md` sont créées, y compris :

| Module | Tables présentes | Sync flags | Triggers |
|--------|-----------------|------------|----------|
| Transverse | Entreprise ✅, Role ✅, Utilisateur ✅ | ✅ | ✅ |
| Chantiers | Chantier ✅, Phase ✅, Incident ✅, AffectationRessource ✅ | ✅ | ✅ |
| RH | Employe ✅, Equipe ✅, MembreEquipe ✅, AffectationChantier ✅, Pointage ✅, HeureSupplementaire ✅ | ✅ | ✅ |
| Matériels | Materiel ✅, AffectationMateriel ✅, Maintenance ✅, AlerteMateriel ✅ | ✅ | ✅ |
| Stocks | Article ✅, Fournisseur ✅, MouvementStock ✅ | ✅ | ✅ |
| Commercial | Client ✅, Devis ✅, LigneDevis ✅, Contrat ✅, Facture ✅, Paiement ✅ | ✅ | ✅ |
| Finance | Depense ✅, RapportFinancier ✅, Alerte ✅ | ✅ | ✅ |
| Sync | SyncQueue ✅ + index ✅ | — | — |

- **Seed data** initial (entreprise par défaut, role admin, utilisateur admin@tiabuild.com) ✅
- Tous les champs techniques `server_id`, `is_synced`, `is_deleted`, `created_at`, `updated_at` sont présents sur chaque table ✅

### 1.2 Repositories (`models/repositories/`) — ⚠️ 23/24 EXISTENT

| Repository | Existe? |
|-----------|---------|
| BaseRepository | ✅ |
| ChantierRepository | ✅ |
| PhaseRepository | ❌ **MANQUANT — BUG CRITIQUE** |
| IncidentRepository | ✅ |
| EmployeRepository | ✅ |
| PointageRepository | ✅ |
| HeureSupplementaireRepository | ✅ |
| EquipeRepository | ✅ |
| MembreEquipeRepository | ✅ |
| MaterielRepository | ✅ |
| MaintenanceRepository | ✅ |
| ArticleRepository | ✅ |
| FournisseurRepository | ✅ |
| MouvementStockRepository | ✅ |
| ClientRepository | ✅ |
| DevisRepository | ✅ |
| LigneDevisRepository | ✅ |
| ContratRepository | ✅ |
| FactureRepository | ✅ |
| PaiementRepository | ✅ |
| DepenseRepository | ✅ |
| AlerteRepository | ✅ |
| DashboardRepository | ✅ |
| SyncRepository | ✅ |

> **Bug critique #1** : `PhaseRepository.js` est **importer** dans `main.js` (ligne 8) et `ChantierRepository.js` (ligne 266), mais **le fichier n'existe pas**. L'application **plantera au démarrage** avec `MODULE_NOT_FOUND`.

### 1.3 Contrôleurs (`controllers/`) — ✅ TOUS PRÉENTS (8/8)

| Contrôleur | Ligne dans main.js | Description |
|-----------|-------------------|-------------|
| authController | ✅ | Auth local + API Django |
| chantierController | ✅ | CRUD Chantiers, Phases, Incidents |
| rhController | ✅ | Employés, Pointages, Équipes, Heures sup |
| materielController | ✅ | Matériels, Maintenance |
| stockController | ✅ | Articles, Fournisseurs, Mouvements |
| commercialController | ✅ | Clients, Devis, Contrats, Factures, Paiements |
| financeController | ✅ | Dépenses, Alertes |
| dashboardController | ✅ | KPIs, CA, top chantiers, activité récente |

### 1.4 IPC Handlers (`preload.js` + `main.js`) — ⚠️ BONNE COUVERTURE MAIS STUBS

**preload.js** expose une API structurée complète (`api.chantiers.*`, `api.rh.*`, `api.materiels.*`, `api.stocks.*`, `api.commercial.*`, `api.finance.*`, `api.dashboard.*`, `api.sync.*`, `api.utils.*`, `api.session.*`) ✅

**main.js** enregistre des handlers IPC pour **presque tous les modules** ✅

> **Bug critique #2** : Les handlers suivants sont des **stubs** ne faisant rien :
> - `auth:check` → renvoie toujours `{ authenticated: false }`
> - `session:get` → renvoie toujours `null`
> - `session:set` → renvoie `{ success: true }` sans rien faire
> - `session:clear` → renvoie `{ success: true }` sans rien faire
> - `notification:show` → renvoie `{ success: true }` sans afficher de notification
> - `sync:push` / `sync:pull` / `sync:status` → dépendent de SyncService qui est partiellement stubbé

### 1.5 Router & Layout (`views/router.js`, `views/layout.html`, `views/layout.js`) — ✅ COMPLETS

- Router SPA hash-based avec guards d'authentification ✅
- Layout app-shell (sidebar + topbar + content-area) ✅
- Navigation par module dans la sidebar (Pilotage, Ressources, Commercial, Administration) ✅
- Gestion du state utilisateur/entreprise ✅
- Sync UI dans la topbar ✅

> **Bug critique #3** : Dans `layout.js` ligne 328, le code appelle `window.api.getAlertCount(AppState.entreprise.id)` mais **cette méthode n'existe pas** dans `preload.js`. L'appel correct serait `window.api.alertes.invoke('countNonLues', AppState.entreprise.id)`. Cela provoquera une erreur JS à l'exécution.

### 1.6 Services (`services/`) — ⚠️ PARTIELLEMENT FONCTIONNELS

| Fichier | État |
|--------|------|
| apiClient.js | ✅ Structure complète (axios-based), mais utilise `fetch` dans main process (problème — mais axios est importé ailleurs) |
| syncService.js | ✅ Orchestration push/pull, mais délègue à SyncRepository |
| SyncRepository.js | ⚠️ **3 bugs critiques** |

> **Bug critique #4 (SyncRepository)** :
> 1. **Utilise `localStorage`** (lignes 84, 122-123, 146) — API navigateur non disponible dans le processus principal Electron (Node.js).
> 2. **Utilise `navigator.onLine`** (ligne 152) — API navigateur non disponible dans le main process.
> 3. **Référence une table `SyncLog`** (lignes 7, 222) — qui **n'existe pas** en base (la table réelle s'appelle `SyncQueue`). → Erreur SQL à l'exécution.

### 1.7 Design System — ✅ COMPLET

- `public/tia-design.css` — Design system TIA complet ✅
- `public/bootstrap/` — Bootstrap 5 (CSS + JS + Icons) ✅
- Classes CSS `.app-shell`, `.sidebar`, `.topbar`, `.content-area`, `.card-kpi`, `.badge-*`, `.btn-tia-*` ✅

### 1.8 Vues (`views/`) — ⚠️ PARTIELLEMENT COMPLÈTES

**Vues existantes (13 vues principales avec index.html + index.js):**

| Module | Vue | Existe? |
|--------|-----|---------|
| Auth | index.html (login) | ✅ |
| Auth | login.js | ✅ |
| Auth | register.html | ✅ |
| Auth | register.js | ✅ |
| Layout | layout.html | ✅ |
| Layout | layout.js | ✅ |
| Router | router.js | ✅ |
| Dashboard | dashboard.html | ✅ |
| Dashboard | dashboard.js | ✅ |
| Chantiers | chantiers/index.html + index.js | ✅ |
| RH — Employés | rh/employes/employes.html + employes.js | ✅ |
| RH — Employés | rh/employes/index.html + index.js | ✅ |
| RH — Pointages | rh/pointages/index.html + index.js | ✅ |
| Matériels | materiels/index.html + index.js | ✅ |
| Stocks | stocks/index.html + index.js | ✅ |
| Stocks — Fournisseurs | stocks/fournisseurs/index.html + index.js | ✅ |
| Commercial — Clients | commercial/clients/index.html + index.js | ✅ |
| Commercial — Devis | commercial/devis/index.html + index.js | ✅ |
| Commercial — Factures | commercial/factures/index.html + index.js | ✅ |
| Finance | finance/index.html + index.js | ✅ |
| Settings | settings.html + settings.js | ✅ |

**Vues manquantes (9 répertoires vides ou absents) :**

| Module | Vue manquante | Route du router |
|--------|--------------|-----------------|
| RH — Équipes | rh/equipes/index.html + index.js | `equipes` ❌ non routée |
| RH — Heures sup | rh/heures-sup/index.html + index.js | `heures-sup` ❌ non routée |
| Stocks — Articles | stocks/articles/ (vide) | géré par stocks/index.html ? |
| Stocks — Mouvements | stocks/mouvements/ (vide) | non routée |
| Commercial — Contrats | commercial/contrats/ (vide) | `contrats` ❌ non routée |
| Commercial — Paiements | commercial/paiements/ (vide) | non routée |
| Finance — Dépenses | finance/depenses/ (vide) | géré par finance/index.html ? |
| Finance — Rapports | finance/rapports/ (vide) | non routée |
| Finance — Alertes | finance/alertes/ (vide) | `alertes` ❌ non routée |

> **Note d'architecture** : Le projet a adopté un pattern **consolidé** (un seul `index.html` par module avec des modaux) au lieu du pattern du plan (`liste.html`, `detail.html`, `form.html` séparés). Ce choix est valide mais nécessite que les vues manquantes soient créées dans ce style.

### 1.9 Build & Packaging — ❌ MANQUANT

| Élément | Situation |
|---------|-----------|
| `electron-builder` | ❌ Pas dans package.json |
| Scripts `build:win`, `build:mac`, `build:linux` | ❌ Absents |
| `icon.png` | ❌ Référencé dans main.js (ligne 94) mais **n'existe pas** dans `public/` |
| `auto-update` (electron-updater) | ❌ Absent |
| Menu application | ✅ Désactivé (`Menu.setApplicationMenu(null)`) |

### 1.10 Tests — ❌ MANQUANT

| Type de test | Présent? |
|-------------|---------|
| Tests unitaires (Jest) | ❌ |
| Tests IPC intégration | ❌ |
| Tests E2E (Playwright/Cypress) | ❌ |
| Jest dans package.json | ❌ |

### 1.11 Documentation — ⚠️ DÉPASSÉE

Le `README.md` décrit l'état **initial** du projet :
- Ne mentionne que **3 tables** (Utilisateur, Chantier, Employe) alors qu'il y en a 27
- Ne mentionne pas les controllers, repositories, router, services, layout
- Les TODOs mentionnent "Implémenter la synchronisation" et "Gestion des erreurs réseau" alors que **des services de sync existent** (buggés mais présents)

---

## 2. TABLEAU RECAPTULATIF DES ÉCARTS

| Critère | Plan d'action | État actuel | Écart |
|---------|--------------|-------------|-------|
| DB schema | 25 tables à créer | ✅ 27 tables créées | +2 tables (SyncQueue, triggers) |
| Repositories | 14 à créer | 23 existent (manque PhaseRepository) | ⚠️ 1 manquant → CRITIQUE |
| Controllers | 8 à créer | ✅ 8 existent | ✅ Conforme |
| Vues | 30+ fichiers HTML/JS | 13 vues existantes, 9 manquantes | ⚠️ 9 modules non viewifiés |
| Router | À créer | ✅ SPA hash-based | ✅ Conforme |
| Layout | À créer | ✅ App shell complet | ✅ Conforme |
| IPC / preload | À créer | ✅ API structurée par module | ✅ Conforme |
| Auth | login/register basique | ✅ login + register (local + Django) | ✅ Conforme |
| Sync service | À créer | ✅ Service + Repository (buggé) | ⚠️ 3 bugs critiques |
| Design system | À adapter | ✅ Bootstrap 5 + tia-design.css | ✅ Conforme |
| Build/packaging | À faire | ❌ electron-builder absent | ❌ 100% manquant |
| Tests | À faire | ❌ Aucun | ❌ 100% manquant |
| Documentation | À faire | ⚠️ README obsolète | ⚠️ À mettre à jour |

---

## 3. CLASSEMENT DES PRIORITÉS DE CORRECTION

### 🔴 URGENT (bloque le démarrage / crash)
1. **Créer `PhaseRepository.js`** — le fichier est importé mais inexistant
2. **Corriger `SyncRepository.js`** — localStorage/navigator/SyncLog → api client Node.js + table SyncQueue
3. **Corriger `layout.js`** — `window.api.getAlertCount` → `window.api.alertes.invoke('countNonLues', ...)`
4. **Implémenter `auth:check`** — pour valider la session au login
5. **Configurer `icon.png`** — ou retirer la référence de main.js

### 🟡 IMPORTANT (complétude fonctionnelle)
6. Créer les 9 vues manquantes (équipes, heures-sup, contrats, paiements, mouvements, alertes, dépenses, rapports, articles)
7. Ajouter routes manquantes dans `router.js`
8. Implémenter `notification:show` IPC handler (notification native Electron)
9. Mettre à jour `README.md`

### 🟢 MOINS URGENT (qualité & déploiement)
10. Ajouter `electron-builder` + scripts build
11. Ajouter `electron-updater` pour auto-update
12. Ajouter tests unitaires (Jest) + E2E (Playwright)
13. Implémenter résolution de conflits de synchronisation

---

*Fin du rapport d'analyse.*
