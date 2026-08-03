# PLAN D'ACTION V2 — Rapport d'Analyse & Feuille de Route Desktop Electron

> **Date** : 31 juillet 2026  
> **Basé sur** : Rapport d'analyse `RAPPORT_ANALYSE_DESKTOP.md`  
> **Contexte** : Le `PLAN_ACTION_DESKTOP.md` original décrivait un état futur. L'analyse révèle que **l'architecture est 90 % implémentée**. Ce document corrige le plan pour cibler **uniquement ce qui manque ou est cassé**.

---

## 📊 SYNTHÈSE EXECUTIVE

| Domaine | % Complété | Prochaine action |
|---------|-----------|-----------------|
| Base de données | ✅ 100% | Aucun (toutes tables + triggers + seed) |
| Repositories | ⚠️ 96% (23/24) | Créer `PhaseRepository.js` |
| Contrôleurs | ✅ 100% (8/8) | Aucun |
| Architecture IPC | ⚠️ 90% | Implémenter `auth:check` + `notification:show` |
| Router / Layout | ✅ 100% | Aucun |
| Vues | ⚠️ 56% (13/23 modules) | Créer 9 modules de vues |
| Services (sync) | ⚠️ 50% | Corriger 3 bugs critiques dans `SyncRepository.js` |
| Design system | ✅ 100% | Aucun |
| Auth | ⚠️ 90% | Implémenter `auth:check` + session persistée |
| Build / Packaging | ❌ 0% | Ajouter electron-builder |
| Tests | ❌ 0% | Ajouter Jest |
| Documentation | ⚠️ 20% | Mettre à jour README.md |

---

## 🔴 PHASE 1 — CORRECTIFS CRITIQUES (Blocage démarrage)

> **Objectif** : Faire démarrer l'application sans crash, corriger les bugs runtime.  
> **Durée estimée** : 1 jour ouvré (Sprint 0 — Hotfix)

### 1.1 Créer `Desktop/models/repositories/PhaseRepository.js`

**Problème** : `main.js` ligne 8 et `ChantierRepository.js` ligne 266 exigent ce fichier, mais il n'existe pas.

**Structure attendue** (basé sur le pattern des autres repositories) :
- `extends BaseRepository`
- `constructor() { super('Phase') }`
- Méthodes : `getByChantier(chantierId)`, `updateAvancement(id, pct)`, `reorder(chantierId, ids)`, `getAvancementGlobal(chantierId)`
- Ces méthodes sont **déjà appelées** par `chantierController.js` (lignes 104, 116, 124, 134) et `ChantierRepository.js` (ligne 276-282 via `addPhase`).

**Fichier à créer** :
```
Desktop/models/repositories/PhaseRepository.js
```

### 1.2 Corriger `Desktop/models/repositories/SyncRepository.js`

**3 bugs critiques :**

| Bug | Ligne | Problème | Correction |
|-----|-------|----------|------------|
| localStorage | 84, 122-123, 146 | API navigateur non disponible en main process | Utiliser `apiUrl/url.js` ou une table locale `SyncConfig` |
| navigator.onLine | 152 | API navigateur non disponible en main process | Utiliser `require('electron').app.isPackaged` ou une variable d'état |
| SyncLog table | 7, 222 | Table n'existe pas (c'est `SyncQueue`) | Renommer `SyncLog` → `SyncQueue`, adapter le schéma (`type`, `table`, `recordId`, `action`, `status`, `details`, `dateSync` → mapping vers colonnes existantes) |

**Fichier à corriger** :
```
Desktop/models/repositories/SyncRepository.js
```

### 1.3 Corriger `Desktop/views/layout.js` — Bug getAlertCount

**Problème** (ligne 328) :
```js
const count = window.api.getAlertCount(AppState.entreprise.id)
```
**Correction** :
```js
const result = await window.api.alertes.invoke('countNonLues', AppState.entreprise.id)
const count = result?.data || 0
```

**Fichier à corriger** :
```
Desktop/views/layout.js  (ligne ~326-329)
```

### 1.4 Implémenter `auth:check` et `notification:show` dans `main.js`

**Problème** : `auth:check` est un stub renvoyant toujours `{ authenticated: false }`. La session utilisateur est stockée dans `localStorage` côté renderer mais le main process ne peut pas y accéder (contextIsolation).

**Correction** : Implémenter un mécanisme de session via `api.session.set` / `api.session.get` qui stocke la session côté main process (variable module-level ou electron-store).

```js
// main.js — Remplacer les stubs :
let _session = null;

ipcMain.handle('session:set', async (e, data) => {
    _session = data;
    return { success: true };
});
ipcMain.handle('session:get', async () => {
    return { success: true, data: _session };
});
ipcMain.handle('auth:check', async () => {
    return { authenticated: !!_session, user: _session };
});
ipcMain.handle('notification:show', async (e, title, body) => {
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
        new Notification({ title, body }).show();
    }
    return { success: true };
});
```

**Fichier à corriger** :
```
Desktop/main.js  (lignes 119-124, 279)
```

### 1.5 Créer `Desktop/public/icon.png` ou retirer la référence

**Problème** : `main.js` ligne 94 référence `path.join(__dirname, 'public', 'icon.png')` qui n'existe pas.

**Solution** : Créer un fichier `icon.png` (512x512) ou commenter la ligne `icon:` dans la configuration de la fenêtre.

**Fichier concerné** :
```
Desktop/main.js (ligne 94) ou Desktop/public/icon.png
```

---

## 🟡 PHASE 2 — VUES MANQUANTES (9 modules)

> **Objectif** : Créer les interfaces pour les modules dont le répertoire existe mais est vide.  
> **Pattern existant** : Un `index.html` (fragment HTML injecté) + `index.js` (logic du renderer) par module, chargé dynamiquement par le router.  
> **Durée estimée** : 2-3 semaines

### 2.1 Module RH — Équipes

| Fichier | Description |
|---------|-------------|
| `views/rh/equipes/index.html` | Liste des équipes avec bouton "Nouvelle équipe" |
| `views/rh/equipes/index.js` | Logique : appel IPC `api.equipes.invoke('list', entrepriseId)`, création modale |
| **Route** | Ajouter `window.router.add('equipes', ...)` dans `router.js` |
| **IPC handlers** | `equipes:list` ✅ déjà dans main.js (ligne 162), `equipes:create` ✅ (ligne 163) |

### 2.2 Module RH — Heures Sup

| Fichier | Description |
|---------|-------------|
| `views/rh/heures-sup/index.html` | Liste des heures supplémentaires |
| `views/rh/heures-sup/index.js` | Logique : appel IPC `api.heuresSup.invoke('list', ...)`, création |
| **Route** | Ajouter `window.router.add('heures-sup', ...)` dans `router.js` |
| **IPC handlers** | `heures-sup:list` ✅ (ligne 159), `heures-sup:create` ✅ (ligne 160) |

### 2.3 Module Commercial — Contrats

| Fichier | Description |
|---------|-------------|
| `views/commercial/contrats/index.html` | Liste des contrats |
| `views/commercial/contrats/index.js` | Logique : appel IPC `api.contrats.invoke('list', ...)` |
| **Route** | Ajouter `window.router.add('contrats', ...)` dans `router.js` |
| **IPC handlers** | `contrats:list` ✅ (ligne 211), `contrats:get` ✅ (ligne 212) |

### 2.4 Module Commercial — Paiements

| Fichier | Description |
|---------|-------------|
| `views/commercial/paiements/index.html` | Formulaire/gestion paiements par facture |
| `views/commercial/paiements/index.js` | Logique : appel IPC `api.paiements.invoke('byFacture', id)` |
| **Route** | Optionnel — peut être un modal depuis factures |
| **IPC handlers** | `paiements:byFacture` ✅ (ligne 222) |

### 2.5 Module Stocks — Mouvements

| Fichier | Description |
|---------|-------------|
| `views/stocks/mouvements/index.html` | Historique des entrées/sorties |
| `views/stocks/mouvements/index.js` | Logique : appel IPC `api.mouvements.invoke('byPeriode', ...)` |
| **Route** | Ajouter `window.router.add('mouvements', ...)` dans `router.js` |
| **IPC handlers** | `mouvements:byArticle` ✅ (ligne 180), `mouvements:byChantier` ✅ (181), `mouvements:byPeriode` ✅ (182), `mouvements:stats` ✅ (183) |

### 2.6 Module Stocks — Articles

> **Note** : `stocks/index.html` existe déjà — vérifier s'il gère les articles. Si oui, créer juste une route dédiée.

| Fichier | Action |
|---------|--------|
| Vérifier `views/stocks/index.html` | S'occupe-t-il des articles + mouvements + seuils d'alerte ? |
| Si non : créer `views/stocks/articles/index.html + index.js` | Vue dédiée articles avec indicateur stock bas |

### 2.7 Module Finance — Alertes

| Fichier | Description |
|---------|-------------|
| `views/finance/alertes/index.html` | Tableau de bord des alertes (non lues, par gravité) |
| `views/finance/alertes/index.js` | Logique : appel IPC `api.alertes.invoke('nonLues', entrepriseId)` |
| **Route** | Ajouter `window.router.add('alertes', ...)` dans `router.js` |
| **IPC handlers** | `alertes:nonLues` ✅ (ligne 230), `alertes:marquerLue` ✅ (231), `alertes:countNonLues` ✅ (234) |

### 2.8 Module Finance — Dépenses

| Fichier | Description |
|---------|-------------|
| `views/finance/depenses/index.html` | Liste des dépenses par chantier/catégorie |
| `views/finance/depenses/index.js` | Logique : appel IPC `api.depenses.invoke('byChantier', id)` |
| **Route** | Ajouter `window.router.add('depenses', ...)` dans `router.js` |
| **IPC handlers** | `depenses:byChantier` ✅ (ligne 225), `depenses:totalByChantier` ✅ (226), `depenses:byCategorie` ✅ (227), `depenses:enAttenteValidation` ✅ (228) |

### 2.9 Module Finance — Rapports

| Fichier | Description |
|---------|-------------|
| `views/finance/rapports/index.html` | Génération et consultation des rapports financiers |
| `views/finance/rapports/index.js` | Logique : appel IPC `api.dashboard.invoke('stats', entrepriseId)` |
| **Route** | Ajouter `window.router.add('rapports', ...)` dans `router.js` |
| **IPC handlers** | Dashboard handlers ✅ (lignes 237-240) |

### 2.10 Router — Ajouter les routes manquantes

Dans `views/router.js`, ajouter :
```js
window.router.add('equipes', ...);
window.router.add('heures-sup', ...);
window.router.add('mouvements', ...);
window.router.add('contrats', ...);
window.router.add('paiements', ...);  // ou modal
window.router.add('articles', ...);   // ou intégré à stocks
window.router.add('depenses', ...);
window.router.add('rapports', ...);
window.router.add('alertes', ...);
```

Et mettre à jour `updatePageTitle()` (lignes 183-196) pour ces nouvelles routes.

---

## 🟢 PHASE 3 — QUALITÉ, BUILD & TESTS

> **Objectif** : Rendre l'application production-ready.  
> **Durée estimée** : 2 semaines

### 3.1 Build & Packaging

| Action | Commande |
|--------|----------|
| Installer electron-builder | `npm install --save-dev electron-builder` |
| Ajouter config dans `package.json` | Section `build` : appId, productName, directories, files, win/mac/linux |
| Ajouter scripts npm | `"build:win": "electron-builder --win"`, `"build:mac"`, `"build:linux"` |
| Icônes | Créer `icon.png` + `icon.ico` + `icon.icns` |
| Auto-update | `npm install --save electron-updater` + config dans main.js |

### 3.2 Sécurité mot de passe

| Action | Détails |
|--------|---------|
| Remplacer SHA-256 par bcrypt | `npm install bcryptjs` et modifier `authController.js` |
| Migration | Les mots de passe existants (SHA-256) restent valides via fallback |

### 3.3 Tests

| Type | Outil | Scope |
|------|-------|-------|
| Unitaires | Jest | BaseRepository, repositories, controllers |
| IPC | Jest + mock Electron | Tous les handlers IPC |
| E2E | Playwright + Electron | Login → navigation → CRUD chantier |

### 3.4 Documentation

| Action |
|--------|
| Mettre à jour `README.md` : architecture complète, toutes les tables, structure des dossiers, scripts disponibles |
| Documenter le pattern consigné (index.html + index.js + modal) |
| Ajouter guide de contribution (CONTRIBUTING.md) |

---

## 🗓️ PLANNING RÉALISTE (V2)

| Sprint | Durée | Focus | Livrables |
|--------|-------|-------|-----------|
| **Sprint 0** (1 jour) | Hotfix | Correctifs critiques | PhaseRepository.js créé, SyncRepository corrigé, layout.js corrigé, auth:check implémenté, icon.png |
| **Sprint 1** (2 sem) | Vues manquantes — batch 1 | Équipes, Heures sup, Contrats, Mouvements | 4 vues + routes + router |
| **Sprint 2** (1,5 sem) | Vues manquantes — batch 2 | Alertes, Dépenses, Rapports, Articles | 4 vues + routes + router |
| **Sprint 3** (1 sem) | Build & packaging | electron-builder, icons, scripts, README | App packagée, README mis à jour |
| **Sprint 4** (1,5 sem) | Tests & sécurité | bcrypt, Jest tests unitaires + IPC, Playwright E2E | Suite de tests, mots de passe sécurisés |

---

## 📋 TABLEAU DE SUivi DÉTAILLÉ

### 🔴 Sprint 0 — Correctifs critiques

- [ ] **1.1** → Créer `Desktop/models/repositories/PhaseRepository.js`  
- [ ] **1.2** → Corriger `Desktop/models/repositories/SyncRepository.js` (localStorage → main-process-safe, SyncLog → SyncQueue, navigator → state)  
- [ ] **1.3** → Corriger `Desktop/views/layout.js` ligne 328 (`getAlertCount` → `api.alertes.invoke('countNonLues')`)  
- [ ] **1.4** → Implémenter `auth:check`, `session:get/set/clear`, `notification:show` dans `main.js`  
- [ ] **1.5** → Créer `Desktop/public/icon.png` (512×512)  

### 🟡 Sprint 1 — Vues manquantes (batch 1)

- [ ] **2.1** → Module RH Équipes : `rh/equipes/index.html + index.js` + route
- [ ] **2.2** → Module RH Heures sup : `rh/heures-sup/index.html + index.js` + route
- [ ] **2.3** → Module Commercial Contrats : `commercial/contrats/index.html + index.js` + route
- [ ] **2.4** → Module Stocks Mouvements : `stocks/mouvements/index.html + index.js` + route

### 🟡 Sprint 2 — Vues manquantes (batch 2)

- [ ] **2.5** → Module Stocks Articles : vérifier `stocks/index.html` ou créer `stocks/articles/index.html + index.js`
- [ ] **2.6** → Module Commercial Paiements : `commercial/paiements/index.html + index.js`
- [ ] **2.7** → Module Finance Alertes : `finance/alertes/index.html + index.js` + route
- [ ] **2.8** → Module Finance Dépenses : `finance/depenses/index.html + index.js` + route
- [ ] **2.9** → Module Finance Rapports : `finance/rapports/index.html + index.js` + route
- [ ] **2.10** → Mettre à jour `router.js` : `updatePageTitle()` pour toutes les nouvelles routes

### 🟢 Sprint 3 — Build, sécurité & docs

- [ ] **3.1** → Installer `electron-builder`, config `package.json` build section, scripts npm
- [ ] **3.2** → Créer icônes (icon.png, icon.ico, icon.icns)
- [ ] **3.3** → Remplacer SHA-256 par `bcryptjs` dans `authController.js`
- [ ] **3.4** → Mettre à jour `README.md` (architecture complète)

### 🟢 Sprint 4 — Tests

- [ ] **4.1** → Installer Jest, créer config de test
- [ ] **4.2** → Tests unitaires : BaseRepository, 3 repositories pilotes
- [ ] **4.3** → Tests IPC intégration : 5 handlers clés
- [ ] **4.4** → Installer Playwright, test E2E : login → navigation dashboard → CRUD chantier

---

## 🔍 ANNEXES

### A. Correspondance PLAN_ACTION_DESKTOP.md → fichiers existants

| Élément du plan | Fichier(s) existant(s) |
|-----------------|------------------------|
| `models/init.js` étendu | ✅ `Desktop/models/init.js` (661 lignes — TOUTES tables) |
| `BaseRepository.js` | ✅ `Desktop/models/repositories/BaseRepository.js` |
| `ChantierRepository.js` | ✅ `Desktop/models/repositories/ChantierRepository.js` |
| `PhaseRepository.js` | ❌ **MANQUANT** |
| `IncidentRepository.js` | ✅ `Desktop/models/repositories/IncidentRepository.js` |
| `EmployeRepository.js` | ✅ `Desktop/models/repositories/EmployeRepository.js` |
| `PointageRepository.js` | ✅ `Desktop/models/repositories/PointageRepository.js` |
| `MaterielRepository.js` | ✅ `Desktop/models/repositories/MaterielRepository.js` |
| `ArticleRepository.js` | ✅ `Desktop/models/repositories/ArticleRepository.js` |
| `MouvementStockRepository.js` | ✅ `Desktop/models/repositories/MouvementStockRepository.js` |
| `ClientRepository.js` | ✅ `Desktop/models/repositories/ClientRepository.js` |
| `DevisRepository.js` | ✅ `Desktop/models/repositories/DevisRepository.js` |
| `FactureRepository.js` | ✅ `Desktop/models/repositories/FactureRepository.js` |
| `DepenseRepository.js` | ✅ `Desktop/models/repositories/DepenseRepository.js` |
| `AlerteRepository.js` | ✅ `Desktop/models/repositories/AlerteRepository.js` |
| `chantierController.js` | ✅ `Desktop/controllers/chantierController.js` |
| `rhController.js` | ✅ `Desktop/controllers/rhController.js` |
| `materielController.js` | ✅ `Desktop/controllers/materielController.js` |
| `stockController.js` | ✅ `Desktop/controllers/stockController.js` |
| `commercialController.js` | ✅ `Desktop/controllers/commercialController.js` |
| `financeController.js` | ✅ `Desktop/controllers/financeController.js` |
| `dashboardController.js` | ✅ `Desktop/controllers/dashboardController.js` |
| `router.js` | ✅ `Desktop/views/router.js` (503 lignes) |
| `layout.html` | ✅ `Desktop/views/layout.html` |
| `layout.js` | ✅ `Desktop/views/layout.js` |
| `syncService.js` | ✅ `Desktop/services/syncService.js` (buggé) |
| `apiClient.js` | ✅ `Desktop/services/apiClient.js` |

### B. Résumé des bugs critiques à corriger

| # | Fichier | Ligne(s) | Bug | Sévérité |
|---|--------|----------|-----|----------|
| 1 | `models/repositories/PhaseRepository.js` | N/A | Fichier manquant, importé → crash | 🔴 CRITIQUE |
| 2 | `models/repositories/SyncRepository.js` | 84, 122, 146 | `localStorage` en main process | 🔴 CRITIQUE |
| 3 | `models/repositories/SyncRepository.js` | 152 | `navigator.onLine` en main process | 🔴 CRITIQUE |
| 4 | `models/repositories/SyncRepository.js` | 7, 222 | Table `SyncLog` n'existe pas | 🔴 CRITIQUE |
| 5 | `views/layout.js` | 328 | `window.api.getAlertCount()` n'existe pas | 🟡 IMPORTANT |
| 6 | `main.js` | 120-124 | `session:set/get/clear` sont des stubs | 🟡 IMPORTANT |
| 7 | `main.js` | 119 | `auth:check` renvoie toujours `{ authenticated: false }` | 🟡 IMPORTANT |
| 8 | `main.js` | 279 | `notification:show` est un stub | 🟡 IMPORTANT |
| 9 | `main.js` | 94 | `icon.png` référencé mais absent | 🟡 IMPORTANT |
| 10 | `package.json` | — | Pas de electron-builder, pas de scripts build | 🟢 MINOR |
| 11 | `README.md` | — | Documentation obsolète | 🟡 IMPORTANT |

---

*Document généré le 2026-07-31 — Plan V2 basé sur l'analyse réelle du code.*
