# Plan d'amélioration du thème Dark/Light/System — Version Complète

## 1. Objectif

Rendre le système de thème Dark/Light/System **professionnel, cohérent et maintenable** sur l'ensemble du stack (backend + frontend), avec :

- Détection automatique des préférences système (`prefers-color-scheme`)
- Adaptation fluide de la Sidebar, du Header et des menus à la taille de l'écran (desktop, tablette, mobile)
- Transitions fluides et UX moderne entre les modes
- **Garantie de lisibilité totale : aucun texte ne doit être illisible, en aucun mode**

## 2. État actuel (baseline)

### 2.1 Backend
- Modèle `Preference` existant dans `app/models/preference.py` avec champ `theme` (`light` / `dark` / `auto`)
- Pas d'endpoint dédié pour récupérer/mettre à jour les préférences utilisateur
- Pas d'intégration du thème dans le chargement du profil / login

### 2.2 Frontend
- Store Zustand `ui.store.ts` gère `theme: 'light' | 'dark' | 'auto'` + `sidebarOpen`
- CSS `tia-design.css` supporte `[data-theme="dark"]` et `@media (prefers-color-scheme: dark)` pour `auto`
- `Topbar.tsx` applique `document.documentElement.setAttribute('data-theme', theme)`
- `Sidebar.tsx` + `Layout.tsx` gèrent déjà le responsive (mobile / desktop / collapsed)
- Transitions CSS existantes mais pas globalement homogènes
- Pas de lecture initiale depuis le backend (seul `localStorage` est utilisé)
- **Gap critique** : certains textes et composants ne sont pas couverts en mode sombre (badges, placeholders, tableaux, dropdowns, modales, code, liens)

## 3. Principes directeurs pour la lisibilité

### 3.1 Règle d'or
> **Tout texte doit avoir un contraste suffisant dans les 3 modes : Light, Dark, Auto.**

### 3.2 Tokens sémantiques obligatoires
Utiliser **uniquement** des tokens CSS, jamais de couleurs en dur :

| Token | Usage | Light | Dark |
|--------|-------|-------|------|
| `--tia-text-primary` | Titres, texte principal | `#171B22` | `#E8ECF1` |
| `--tia-text-secondary` | Labels, descriptions | `#66707E` | `#9BA3B0` |
| `--tia-text-muted` | Placeholders, textes désactivés | `#8B97AF` | `#6B7280` |
| `--tia-text-on-primary` | Texte sur fond amber/navy | `#FFFFFF` | `#FFFFFF` |
| `--tia-text-on-success` | Texte sur fond succès | `#FFFFFF` | `#FFFFFF` |
| `--tia-text-on-warning` | Texte sur fond warning | `#1A1A1A` | `#1A1A1A` |
| `--tia-text-on-danger` | Texte sur fond danger | `#FFFFFF` | `#FFFFFF` |
| `--tia-link` | Liens | `#E8A93B` | `#F0C05A` |
| `--tia-link-hover` | Liens survolés | `#C4841E` | `#F5D580` |
| `--tia-text-disabled` | Textes désactivés | `#A0A8B4` | `#5A616B` |

### 3.3 Contrastes minimums (WCAG)
- Texte normal : ratio ≥ 4.5:1
- Texte large (≥24px ou bold ≥19px) : ratio ≥ 3:1
- Éléments d'interface : ratio ≥ 3:1

### 3.4 Règles de base
1. **Jamais** de `color: inherit` sans contexte connu
2. **Jamais** de `rgba(0,0,0,0.x)` en sombre (devient invisible)
3. **Toujours** vérifier les textes sur fonds colorés (badges, alertes, KPI)
4. Les `placeholder` doivent utiliser `--tia-text-muted` (jamais `#999` en dur)
5. Les `border` doivent utiliser `--tia-border` pour rester visibles

### 3.5 Philosophie couleur inspirée de VS Code — confort visuel maximal

**Inspiration :** skill `frontend-design` — principe de retenue et de choix délibérés.
VS Code est référencé car c'est l'interface que les utilisateurs cibles (développeurs, chefs de projet BTP, responsables) utilisent 6–10 h/jour.

#### 3.5.1 Règle d'or : moins de couleur = moins de fatigue
> **Une seule couleur d'accentuation.** Tout le reste est en niveaux de gris / neutres.

VS Code ne utilise pas de palette arc-en-ciel :
- **Dark+** : fond `#1E1E1E`, surface `#252526`, bordure `#3E3E42`, texte `#D4D4D4`
- **Light+** : fond `#F3F3F3`, surface `#FFFFFF`, bordure `#E4E4E4`, texte `#1E1E1E`
- **Accent unique** : bleu `#007ACC` pour les liens, focus, sélection
- **Statuts** : rouges/verts/jaunes très désaturés, jamais vifs

#### 3.5.2 Nouveaux tokens — palette VS Code-like

**Fichier :** `Web/frontend/src/styles/tia-design.css` (modifier)

```css
:root {
  /* ===== Palette VS Code-like (Light) ===== */
  --tia-bg-base: #F3F3F3;
  --tia-bg-surface: #FFFFFF;
  --tia-bg-raised: #FAFAFA;
  --tia-bg-overlay: #FFFFFF;
  --tia-bg-sidebar: #F7F7F7;
  --tia-bg-hover: rgba(0, 0, 0, 0.04);
  --tia-bg-active: rgba(0, 0, 0, 0.08);
  --tia-border: #E4E4E4;
  --tia-border-strong: #CCCCCC;
  --tia-text-primary: #1E1E1E;
  --tia-text-secondary: #616161;
  --tia-text-muted: #969696;
  --tia-text-disabled: #B0B0B0;
  
  /* ===== Accent unique (équivalent #007ACC) ===== */
  --tia-accent: #0078D4;
  --tia-accent-hover: #006CC1;
  --tia-accent-soft: rgba(0, 120, 212, 0.12);
  --tia-accent-text: #FFFFFF;
  
  /* ===== Statuts désaturés (jamais vifs) ===== */
  --tia-success: #0A7B3E;
  --tia-success-soft: #E6F4EA;
  --tia-danger: #C4313B;
  --tia-danger-soft: #FCE8E8;
  --tia-warning: #9D6B07;
  --tia-warning-soft: #FEF3D9;
  --tia-info: #005A9E;
  --tia-info-soft: #E8F0FE;
  
  /* ===== Sélection & focus ===== */
  --tia-selection-bg: var(--tia-accent-soft);
  --tia-selection-text: var(--tia-text-primary);
  --tia-focus-ring: rgba(0, 120, 212, 0.35);
  
  /* ===== Ombres très subtiles ===== */
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.06);
  --shadow-elevated: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-modal: 0 4px 24px rgba(0, 0, 0, 0.12);
}

[data-theme="dark"] {
  /* ===== Palette VS Code-like (Dark+) ===== */
  --tia-bg-base: #1E1E1E;
  --tia-bg-surface: #252526;
  --tia-bg-raised: #2D2D30;
  --tia-bg-overlay: #2D2D30;
  --tia-bg-sidebar: #1E1E1E;
  --tia-bg-hover: rgba(255, 255, 255, 0.06);
  --tia-bg-active: rgba(255, 255, 255, 0.10);
  --tia-border: #3E3E42;
  --tia-border-strong: #4E4E52;
  --tia-text-primary: #D4D4D4;
  --tia-text-secondary: #A0A0A0;
  --tia-text-muted: #707070;
  --tia-text-disabled: #555555;
  
  /* ===== Accent unique (identique light, légèrement plus lumineux) ===== */
  --tia-accent: #4DA6FF;
  --tia-accent-hover: #66B3FF;
  --tia-accent-soft: rgba(77, 166, 255, 0.15);
  --tia-accent-text: #1E1E1E;
  
  /* ===== Statuts désaturés ===== */
  --tia-success: #4CAF7C;
  --tia-success-soft: #1A3A2A;
  --tia-danger: #E57373;
  --tia-danger-soft: #3A1A1A;
  --tia-warning: #E5C07B;
  --tia-warning-soft: #3A3020;
  --tia-info: #6CB6FF;
  --tia-info-soft: #1A2A3A;
  
  /* ===== Sélection & focus ===== */
  --tia-selection-bg: var(--tia-accent-soft);
  --tia-selection-text: var(--tia-text-primary);
  --tia-focus-ring: rgba(77, 166, 255, 0.35);
  
  /* ===== Ombres très subtiles ===== */
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 4px rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-modal: 0 4px 24px rgba(0, 0, 0, 0.5);
}

@media (prefers-color-scheme: dark) {
  [data-theme="auto"] {
    /* Mêmes valeurs que [data-theme="dark"] */
    --tia-bg-base: #1E1E1E;
    --tia-bg-surface: #252526;
    --tia-bg-raised: #2D2D30;
    --tia-bg-overlay: #2D2D30;
    --tia-bg-sidebar: #1E1E1E;
    --tia-bg-hover: rgba(255, 255, 255, 0.06);
    --tia-bg-active: rgba(255, 255, 255, 0.10);
    --tia-border: #3E3E42;
    --tia-border-strong: #4E4E52;
    --tia-text-primary: #D4D4D4;
    --tia-text-secondary: #A0A0A0;
    --tia-text-muted: #707070;
    --tia-text-disabled: #555555;
    --tia-accent: #4DA6FF;
    --tia-accent-hover: #66B3FF;
    --tia-accent-soft: rgba(77, 166, 255, 0.15);
    --tia-accent-text: #1E1E1E;
    --tia-success: #4CAF7C;
    --tia-success-soft: #1A3A2A;
    --tia-danger: #E57373;
    --tia-danger-soft: #3A1A1A;
    --tia-warning: #E5C07B;
    --tia-warning-soft: #3A3020;
    --tia-info: #6CB6FF;
    --tia-info-soft: #1A2A3A;
    --tia-selection-bg: var(--tia-accent-soft);
    --tia-selection-text: var(--tia-text-primary);
    --tia-focus-ring: rgba(77, 166, 255, 0.35);
    --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 4px rgba(0, 0, 0, 0.3);
    --shadow-elevated: 0 2px 8px rgba(0, 0, 0, 0.4);
    --shadow-modal: 0 4px 24px rgba(0, 0, 0, 0.5);
  }
}
```

#### 3.5.3 Règles d'usage strictes

1. **Un seul accent** : `--tia-accent` pour liens, focus rings, sélections, états actifs
2. **Zéro dégradé** sur les backgrounds (pas de `linear-gradient` sauf cas exceptionnels documentés)
3. **Bordures minimales** : 1px, couleur `--tia-border`, jamais de border-radius sur les éléments de données (tableaux, inputs) — radius uniquement sur les conteneurs
4. **Statuts désaturés** : les badges succès/danger/warning utilisent les tokens `--tia-success`, `--tia-danger`, `--tia-warning` avec fonds `*-soft` correspondants
5. **Pas de ombres colorées** : toutes les `box-shadow` sont en noir transparent, pas d'ambre/navy dans les ombres
6. **Texte sur accent** : toujours `--tia-accent-text` (jamais `#FFF` en dur)
7. **États hover/active** : uniquement `--tia-bg-hover` et `--tia-bg-active` (noirs transparents en light, blancs transparents en dark)
8. **Sidebar** : fond `--tia-bg-sidebar` (légèrement différent du fond base pour créer une séparation subtile, sans contraste violent)
9. **Focus visible** : `box-shadow: 0 0 0 2px var(--tia-focus-ring)` sur tous les éléments focusables
10. **Aucun `#FFF` ou `#000` pur** : même en light mode, les blancs sont `#F3F3F3`/`#FAFAFA`; en dark, les noirs sont `#1E1E1E`/`#252526`

#### 3.5.4 Mapping des anciens tokens vers la nouvelle palette

| Ancien token | Nouveau token | Raison |
|--------------|---------------|--------|
| `--tia-navy` | SUPPRIMÉ | Trop saturé, remplacé par accent neutre |
| `--tia-amber` | `--tia-accent` | Une seule couleur d'accent |
| `--tia-concrete` | `--tia-bg-base` | Gris neutre VS Code |
| `--tia-surface` | `--tia-bg-surface` | Blanc cassé / gris foncé |
| `--tia-line` | `--tia-border` | Gris moyen pour bordures |
| `--tia-ink` | `--tia-text-primary` | Texte principal |
| `--tia-steel` | `--tia-text-secondary` | Texte secondaire |

#### 3.5.5 Impact sur les composants existants

- **Sidebar** : fond `--tia-bg-sidebar`, bordure droite `--tia-border`, texte liens `--tia-text-secondary`, actif `--tia-accent-soft` + bordure gauche `--tia-accent`
- **Topbar** : fond `--tia-bg-surface`, bordure bas `--tia-border`
- **KPI Cards** : fond `--tia-bg-surface`, bordure `--tia-border`, ombre `--shadow-card`
- **Boutons primaires** : fond `--tia-accent`, texte `--tia-accent-text`
- **Badges** : utiliser uniquement les statuts désaturés (`--tia-success`, `--tia-danger`, `--tia-warning`), jamais l'accent

#### 3.5.6 Confirmation par le skill `frontend-design`

> "Spend your boldness in one place. Let the signature element be the one memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief."

Application : l'accent `--tia-accent` est le seul élément "coloré" ; tout le reste est en niveaux de gris. La signature du design devient la typographie + la structure, pas les couleurs.

## 4. Plan d'implémentation détaillé

### 4.1 Backend — API Préférences (nouveau endpoint)

**Fichier :** `Web/backend/app/routers/preferences.py` (créer)

| Méthode | Route | Action |
|---------|-------|--------|
| `GET` | `/api/v1/preferences/me` | Renvoie les préférences de l'utilisateur connecté |
| `PATCH` | `/api/v1/preferences/me` | Met à jour une ou plusieurs préférences (theme, langue, etc.) |

- **Sécurité :** authentification JWT obligatoire
- **Modèle :** lecture/écriture sur `Preference` existant
- **Comportement :** si aucune préférence n'existe, renvoyer les valeurs par défaut (`theme: "auto"`, `langue: "fr"`, ...)

**Intégration :**
- Inclure le router dans `main.py`
- Ajouter `from app.routers import preferences`

### 4.2 Frontend — Récupération initiale des préférences

**Fichier :** `Web/frontend/src/stores/ui.store.ts` (modifier)

- Au démarrage, si un token existe :
  1. Lire `localStorage` (pour l'instantanéité)
  2. Appeler `GET /preferences/me`
  3. Si le backend renvoie un `theme` valide, écraser le store et `localStorage`
  4. Sinon conserver la valeur locale

### 4.3 Frontend — Synchronisation backend

- Au changement de thème via `setTheme()` :
  1. Mettre à jour le store + `localStorage`
  2. Appeler `PATCH /preferences/me` avec `{ theme: <new_value> }`
  3. Ne pas bloquer l'UI si l'appel échoue (optimistic update)

### 4.4 Frontend — Palette VS Code-like & Transitions fluides

**Fichier :** `Web/frontend/src/styles/tia-design.css` (modifier)

**Attention :** la palette complète est définie dans la section **3.5**. Ne pas ajouter de nouvelles couleurs en dehors de ce système. Tous les anciens tokens (`--tia-navy`, `--tia-amber`, `--tia-concrete`, etc.) sont remplacés par les tokens VS Code-like de la section 3.5.

```css
/* Transitions globales sur les changements de thème */
html, body, .app-shell, .sidebar, .topbar, .main-area,
.card, .kpi-card, .chart-card, .table-card, .modal-content,
.form-control, .form-select, .dropdown-menu, .btn, .badge,
.nav-pills, .nav-tabs, .breadcrumb, .pagination, .list-group,
.accordion, .toast, .tooltip, .popover {
  transition: background-color 0.25s ease, color 0.25s ease, 
              border-color 0.25s ease, box-shadow 0.25s ease;
}

/* Respecter les utilisateurs qui préfèrent moins de mouvement */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

### 4.5 Frontend — Transitions fluides

**Fichier :** `Web/frontend/src/styles/tia-design.css` (modifier)

```css
/* Transitions globales sur les changements de thème */
html, body, .app-shell, .sidebar, .topbar, .main-area,
.card, .kpi-card, .chart-card, .table-card, .modal-content,
.form-control, .form-select, .dropdown-menu, .btn, .badge,
.nav-pills, .nav-tabs, .breadcrumb, .pagination, .list-group,
.accordion, .toast, .tooltip, .popover {
  transition: background-color 0.25s ease, color 0.25s ease, 
              border-color 0.25s ease, box-shadow 0.25s ease;
}

/* Respecter les utilisateurs qui préfèrent moins de mouvement */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

### 4.6 Frontend — Coverage complète des composants (CRITIQUE)

**Fichier :** `Web/frontend/src/styles/tia-design.css` (modifier)

**Règle stricte :** tous les overrides ci-dessous doivent utiliser **exclusivement** les tokens VS Code-like définis dans la section **3.5**. Aucune couleur en dur, aucun ancien token (`--tia-navy`, `--tia-amber`, `--tia-concrete`, `--tia-line`, etc.) ne doit subsister dans les overrides dark mode.

#### 4.6.1 Textes de base
```css
body {
  font-family: var(--font-body);
  background: var(--tia-bg-base);
  color: var(--tia-text-primary);
}

::selection {
  background: var(--tia-selection-bg);
  color: var(--tia-selection-text);
}
```

#### 4.6.2 Formulaires
```css
[data-theme="dark"] .form-control,
[data-theme="dark"] .form-select {
  background-color: var(--tia-bg-raised);
  border-color: var(--tia-border);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .form-control::placeholder {
  color: var(--tia-text-muted);
}

[data-theme="dark"] .form-control:focus,
[data-theme="dark"] .form-select:focus {
  background-color: var(--tia-bg-raised);
  border-color: var(--tia-accent);
  color: var(--tia-text-primary);
  box-shadow: 0 0 0 3px var(--tia-focus-ring);
}

[data-theme="dark"] .form-label {
  color: var(--tia-text-primary);
}

[data-theme="dark"] .form-text {
  color: var(--tia-text-muted);
}

[data-theme="dark"] .input-group-text {
  background-color: var(--tia-bg-raised);
  border-color: var(--tia-border);
  color: var(--tia-text-secondary);
}

[data-theme="dark"] .form-check-input {
  background-color: var(--tia-bg-raised);
  border-color: var(--tia-border);
}

[data-theme="dark"] .form-check-input:checked {
  background-color: var(--tia-accent);
  border-color: var(--tia-accent);
}

[data-theme="dark"] .form-check-label {
  color: var(--tia-text-primary);
}
```

#### 4.6.3 Tableaux
```css
[data-theme="dark"] .table {
  color: var(--tia-text-primary);
}

[data-theme="dark"] .table-light {
  background-color: var(--tia-bg-raised);
}

[data-theme="dark"] .table td,
[data-theme="dark"] .table th {
  border-color: var(--tia-border);
}

[data-theme="dark"] .table thead th {
  color: var(--tia-text-secondary);
  background-color: var(--tia-bg-base);
  border-bottom: 1px solid var(--tia-border-strong);
}

[data-theme="dark"] .table tbody tr:hover td {
  background-color: var(--tia-bg-hover);
}

[data-theme="dark"] .table-striped > tbody > tr:nth-of-type(odd) > td {
  background-color: var(--tia-bg-hover);
}
```

#### 4.6.4 Modales & Overlays
```css
[data-theme="dark"] .modal-content {
  background-color: var(--tia-bg-surface);
  color: var(--tia-text-primary);
  border: 1px solid var(--tia-border);
}

[data-theme="dark"] .modal-header,
[data-theme="dark"] .modal-footer {
  border-color: var(--tia-border);
}

[data-theme="dark"] .modal-title {
  color: var(--tia-text-primary);
}

[data-theme="dark"] .modal-backdrop {
  background-color: rgba(0, 0, 0, 0.6);
}

[data-theme="dark"] .offcanvas {
  background-color: var(--tia-bg-surface);
  color: var(--tia-text-primary);
  border-color: var(--tia-border);
}
```

#### 4.6.5 Dropdowns
```css
[data-theme="dark"] .dropdown-menu {
  background-color: var(--tia-bg-surface);
  border-color: var(--tia-border);
  box-shadow: var(--shadow-modal);
}

[data-theme="dark"] .dropdown-item {
  color: var(--tia-text-primary);
}

[data-theme="dark"] .dropdown-item:hover {
  background-color: var(--tia-bg-hover);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .dropdown-divider {
  border-color: var(--tia-border);
}

[data-theme="dark"] .dropdown-header {
  color: var(--tia-text-secondary);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
```

#### 4.6.6 Badges & Tags
```css
[data-theme="dark"] .badge {
  border: 1px solid transparent;
}

[data-theme="dark"] .badge.bg-light {
  background-color: var(--tia-bg-raised) !important;
  color: var(--tia-text-primary) !important;
  border-color: var(--tia-border) !important;
}

[data-theme="dark"] .badge.bg-white {
  background-color: var(--tia-bg-raised) !important;
  color: var(--tia-text-primary) !important;
  border-color: var(--tia-border) !important;
}

[data-theme="dark"] .badge-role {
  border: 1px solid var(--tia-border);
}

[data-theme="dark"] .badge-actif { 
  background: var(--tia-success-soft); 
  color: var(--tia-success); 
}

[data-theme="dark"] .badge-inactif { 
  background: var(--tia-danger-soft); 
  color: var(--tia-danger); 
}
```

#### 4.6.7 Alertes & Notifications
```css
[data-theme="dark"] .alert {
  border: 1px solid var(--tia-border);
}

[data-theme="dark"] .alert-success {
  background-color: var(--tia-success-soft);
  color: var(--tia-success);
  border-color: rgba(10, 123, 62, 0.3);
}

[data-theme="dark"] .alert-danger {
  background-color: var(--tia-danger-soft);
  color: var(--tia-danger);
  border-color: rgba(196, 49, 59, 0.3);
}

[data-theme="dark"] .alert-warning {
  background-color: var(--tia-warning-soft);
  color: var(--tia-warning);
  border-color: rgba(157, 107, 7, 0.3);
}

[data-theme="dark"] .alert-info {
  background-color: var(--tia-info-soft);
  color: var(--tia-info);
  border-color: rgba(0, 90, 158, 0.3);
}

[data-theme="dark"] .toast {
  background-color: var(--tia-bg-surface);
  border-color: var(--tia-border);
  color: var(--tia-text-primary);
}
```

#### 4.6.8 Navigation (Tabs, Pills, Breadcrumb, Pagination)
```css
[data-theme="dark"] .nav-pills {
  background-color: var(--tia-bg-surface);
  border: 1px solid var(--tia-border);
}

[data-theme="dark"] .nav-pills .nav-link {
  color: var(--tia-text-secondary);
}

[data-theme="dark"] .nav-pills .nav-link.active {
  background-color: var(--tia-accent);
  color: var(--tia-accent-text);
}

[data-theme="dark"] .nav-tabs {
  border-bottom-color: var(--tia-border);
}

[data-theme="dark"] .nav-tabs .nav-link {
  color: var(--tia-text-secondary);
  border-color: var(--tia-border);
}

[data-theme="dark"] .nav-tabs .nav-link.active {
  background-color: var(--tia-bg-surface);
  color: var(--tia-text-primary);
  border-bottom-color: var(--tia-accent);
}

[data-theme="dark"] .breadcrumb {
  background-color: var(--tia-bg-raised);
}

[data-theme="dark"] .breadcrumb-item a {
  color: var(--tia-accent);
}

[data-theme="dark"] .breadcrumb-item.active {
  color: var(--tia-text-muted);
}

[data-theme="dark"] .breadcrumb-item + .breadcrumb-item::before {
  color: var(--tia-text-muted);
}

[data-theme="dark"] .pagination .page-link {
  background-color: var(--tia-bg-surface);
  border-color: var(--tia-border);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .pagination .page-item.active .page-link {
  background-color: var(--tia-accent);
  border-color: var(--tia-accent);
  color: var(--tia-accent-text);
}

[data-theme="dark"] .pagination .page-item.disabled .page-link {
  background-color: var(--tia-bg-raised);
  color: var(--tia-text-muted);
}
```

#### 4.6.9 Cards & KPI
```css
[data-theme="dark"] .card,
[data-theme="dark"] .kpi-card,
[data-theme="dark"] .chart-card,
[data-theme="dark"] .table-card {
  background-color: var(--tia-bg-surface);
  border-color: var(--tia-border);
}

[data-theme="dark"] .kpi-card .kpi-value {
  color: var(--tia-text-primary);
}

[data-theme="dark"] .kpi-card .kpi-label {
  color: var(--tia-text-secondary);
}

[data-theme="dark"] .kpi-card .kpi-context {
  color: var(--tia-text-muted);
}

[data-theme="dark"] .card-header {
  background-color: var(--tia-bg-base);
  border-bottom-color: var(--tia-border);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .card-footer {
  background-color: var(--tia-bg-base);
  border-top-color: var(--tia-border);
  color: var(--tia-text-secondary);
}
```

#### 4.6.10 Boutons
```css
[data-theme="dark"] .btn-primary {
  background-color: var(--tia-accent);
  border-color: var(--tia-accent);
  color: var(--tia-accent-text);
}

[data-theme="dark"] .btn-primary:hover {
  background-color: var(--tia-accent-hover);
  border-color: var(--tia-accent-hover);
  color: var(--tia-accent-text);
}

[data-theme="dark"] .btn-outline-primary {
  border-color: var(--tia-accent);
  color: var(--tia-accent);
}

[data-theme="dark"] .btn-outline-primary:hover {
  background-color: var(--tia-accent-soft);
  color: var(--tia-accent);
}

[data-theme="dark"] .btn-secondary {
  background-color: var(--tia-bg-raised);
  border-color: var(--tia-border);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .btn-secondary:hover {
  background-color: var(--tia-bg-active);
  border-color: var(--tia-border-strong);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .btn-light {
  background-color: var(--tia-bg-raised);
  border-color: var(--tia-border);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .btn-dark {
  background-color: var(--tia-bg-base);
  border-color: var(--tia-border);
  color: var(--tia-text-primary);
}
```

#### 4.6.11 Liens
```css
a {
  color: var(--tia-accent);
}

a:hover {
  color: var(--tia-accent-hover);
}

[data-theme="dark"] .text-primary {
  color: var(--tia-text-primary) !important;
}

[data-theme="dark"] .text-secondary {
  color: var(--tia-text-secondary) !important;
}

[data-theme="dark"] .text-muted {
  color: var(--tia-text-muted) !important;
}

[data-theme="dark"] .text-dark {
  color: var(--tia-text-primary) !important;
}

[data-theme="dark"] .text-light {
  color: var(--tia-text-secondary) !important;
}
```

#### 4.6.12 Tooltip & Popover
```css
[data-theme="dark"] .tooltip-inner {
  background-color: var(--tia-bg-raised);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .tooltip.bs-tooltip-top .tooltip-arrow::before {
  border-top-color: var(--tia-bg-raised);
}

[data-theme="dark"] .popover {
  background-color: var(--tia-bg-surface);
  border-color: var(--tia-border);
}

[data-theme="dark"] .popover-header {
  background-color: var(--tia-bg-base);
  border-bottom-color: var(--tia-border);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .popover-body {
  color: var(--tia-text-primary);
}

[data-theme="dark"] .bs-popover-top .popover-arrow::after {
  border-top-color: var(--tia-bg-surface);
}
```

#### 4.6.13 Accordion
```css
[data-theme="dark"] .accordion-item {
  background-color: var(--tia-bg-surface);
  border-color: var(--tia-border);
}

[data-theme="dark"] .accordion-button {
  color: var(--tia-text-primary);
  background-color: var(--tia-bg-surface);
}

[data-theme="dark"] .accordion-button:not(.collapsed) {
  color: var(--tia-accent);
  background-color: var(--tia-bg-hover);
}

[data-theme="dark"] .accordion-button::after {
  filter: invert(1);
}

[data-theme="dark"] .accordion-body {
  color: var(--tia-text-primary);
}
```

#### 4.6.14 Placeholder & Disabled
```css
[data-theme="dark"] ::placeholder {
  color: var(--tia-text-muted);
  opacity: 1;
}

[data-theme="dark"] :disabled,
[data-theme="dark"] .disabled {
  color: var(--tia-text-disabled);
}

[data-theme="dark"] .form-control:disabled,
[data-theme="dark"] .form-select:disabled {
  background-color: var(--tia-bg-base);
  opacity: 0.7;
}
```

#### 4.6.15 Charts & Graphiques
- S'assurer que les tooltips Chart.js utilisent `--tia-bg-surface` et `--tia-text-primary`
- Les axes et légendes doivent utiliser `--tia-text-secondary`
- Les grilles doivent utiliser `--tia-border` (jamais `#eee` en dur)

#### 4.6.16 Code & Monospace
```css
[data-theme="dark"] code,
[data-theme="dark"] pre,
[data-theme="dark"] .font-mono,
[data-theme="dark"] .valeur-chiffree {
  color: var(--tia-text-primary);
}

[data-theme="dark"] code {
  background-color: var(--tia-bg-raised);
  border: 1px solid var(--tia-border);
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
}

[data-theme="dark"] pre {
  background-color: var(--tia-bg-raised);
  border: 1px solid var(--tia-border);
  color: var(--tia-text-primary);
}

[data-theme="dark"] .table td.font-monospace,
[data-theme="dark"] .table th.font-monospace {
  color: var(--tia-text-primary);
}
```

#### 4.6.17 Scrollbar (Webkit)
```css
[data-theme="dark"] ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

[data-theme="dark"] ::-webkit-scrollbar-track {
  background: var(--tia-bg-base);
}

[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: var(--tia-border-strong);
  border-radius: 5px;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
  background: var(--tia-text-muted);
}
```

#### 4.6.18 Autres éléments Bootstrap à couvrir
- `.close` / `.btn-close` : couleur adaptée avec `--tia-text-secondary`
- `.progress` : barre avec `--tia-accent`, fond avec `--tia-bg-raised`
- `.list-group-item` : fond `--tia-bg-surface`, bordure `--tia-border`, hover `--tia-bg-hover`
- `.blockquote` : bordure `--tia-border`, texte `--tia-text-secondary`
- `.figure-caption` : texte `--tia-text-muted`
- `.code` inline : fond `--tia-bg-raised`, bordure `--tia-border`, texte `--tia-text-primary`
- `.btn-close` : utiliser `filter: invert(1)` en dark mode pour rester visible

### 4.7 Frontend — Sidebar & Topbar adaptés au thème VS Code-like

**Fichier :** `Web/frontend/src/components/layout/Sidebar.tsx` (modifier)

- Fond sidebar : `--tia-bg-sidebar`
- Liens sidebar : `--tia-text-secondary` (inactif), `--tia-accent` + `--tia-accent-soft` (actif)
- Bordure droite sidebar : `--tia-border`
- Hover liens : `--tia-bg-hover`
- Section labels : `--tia-text-muted`
- Brand mark : conserver `--tia-accent` pour le carré TB (seule couleur vive autorisée)
- User avatar : fond `--tia-bg-raised`, texte `--tia-accent`

**Fichier :** `Web/frontend/src/components/layout/Topbar.tsx` (modifier)

- Fond topbar : `--tia-bg-surface`
- Bordure bas : `--tia-border`
- Bouton thème : icône + tooltip `Clair / Sombre / Auto`
- Notification badge : fond `--tia-danger`, texte `--tia-accent-text`
- Dropdown notifications : fond `--tia-bg-surface`, bordure `--tia-border`, ombre `--shadow-modal`

### 4.8 Frontend — Indicateur de mode actif

**Fichier :** `Web/frontend/src/components/layout/Topbar.tsx` (modifier)

- Ajouter un tooltip + aria-label sur le bouton thème
- Afficher le mode actuel : `Clair`, `Sombre`, `Auto (Système)`
- Ajouter une pastille colorée à côté de l'icône pour indiquer le mode actif

### 4.9 Frontend — Responsive avancé (Sidebar / Header / Menus)

**Fichier :** `Web/frontend/src/components/layout/Sidebar.tsx` (modifier)

| Taille | Comportement Sidebar |
|--------|----------------------|
| **Desktop** (`≥992px`) | Collapsible (264px → 64px), icônes + labels masqués/affichés |
| **Tablette** (`768px – 991px`) | Overlay avec backdrop, toggle via hamburger |
| **Mobile** (`<768px`) | Overlay plein écran, swipe gesture (optionnel), labels toujours visibles |

**Fichier :** `Web/frontend/src/components/layout/Topbar.tsx` (modifier)

- Adapter la densité du header selon la taille :
  - **Mobile** : icônes uniquement, pas de texte, hauteur réduite
  - **Tablette** : nom d'utilisateur tronqué, pas de search bar
  - **Desktop** : affichage complet

**Fichier :** `Web/frontend/src/components/layout/Layout.tsx` (modifier)

- Gérer le `z-index` et la transition entre les breakpoints
- Fermer automatiquement la sidebar mobile lors d'un changement d'orientation ou de resize desktop

### 4.10 Frontend — Page de login (thème)

- La page `/login` doit aussi respecter le thème système (`auto`)
- Tous les textes du formulaire doivent être lisibles en dark mode
- Ajouter un toggle thème discret sur la page de login (optionnel mais recommandé pour la démo)

### 4.11 Tests & Vérification (renforcé)

| Niveau | Action |
|--------|--------|
| **Backend** | Tests unitaires sur `preferences.py` (CRUD) |
| **Frontend** | Tests composants `Sidebar`, `Topbar`, `ThemeToggle` |
| **Accessibilité** | Vérifier `prefers-color-scheme`, `prefers-reduced-motion`, focus-visible |
| **Contraste** | Audit automatique avec Lighthouse ou axe-core sur les 3 modes |
| **E2E** | Vérifier le cycle complet : login → chargement préférence → toggle thème → refresh → persistance |
| **Responsive** | Tester aux breakpoints : 320px, 768px, 1024px, 1440px |
| **Vérification textes** | Checklist manuelle : badges, placeholders, tableaux, dropdowns, modales, tooltips, code, disabled, charts, scrollbar |

## 5. Ordre de livraison recommandé

1. **Backend** : endpoint `preferences/me`
2. **Frontend** : synchronisation store + backend
3. **CSS** : tokens sémantiques étendus + transitions globales
4. **CSS** : coverage complète des composants (section 4.6)
5. **Responsive** : adaptation Sidebar / Topbar / Layout
6. **Polish** : indicateur visuel, page login, accessibilité
7. **Tests** : unitaires + e2e basiques + audit contraste

## 6. Fichiers impactés

### Backend
- `Web/backend/app/routers/preferences.py` (créer)
- `Web/backend/app/main.py` (modifier)
- `Web/backend/app/schemas/preference.py` (créer, optionnel)

### Frontend
- `Web/frontend/src/stores/ui.store.ts` (modifier)
- `Web/frontend/src/services/settings.service.ts` (modifier)
- `Web/frontend/src/styles/tia-design.css` (modifier — section majeure)
- `Web/frontend/src/components/layout/Sidebar.tsx` (modifier)
- `Web/frontend/src/components/layout/Topbar.tsx` (modifier)
- `Web/frontend/src/components/layout/Layout.tsx` (modifier)
- `Web/frontend/src/pages/auth/LoginPage.tsx` (modifier)

## 7. Risques & Mitigation

| Risque | Mitigation |
|--------|-----------|
| Flash de thème incorrect au chargement | Inliner le thème initial dans le `<head>` via un script synchrone (localStorage lu au plus tôt) |
| Performance des transitions | Utiliser `will-change` uniquement sur les éléments concernés, pas de transition sur `box-shadow` massive |
| Incohérence entre `localStorage` et backend | Backend = source de vérité ; `localStorage` = cache optimiste |
| Texte illisible en dark mode | Utiliser exclusivement les tokens VS Code-like de la section 3.5 ; audit Lighthouse + checklist manuelle |
| Oubli de composant | Suivre la checklist section 4.6 (formulaires, tableaux, modales, dropdowns, badges, charts, code, tooltips, accordions, pagination, breadcrumb, scrollbar) |
| Couleur en dur introduite par erreur | Linter CSS custom + review systématique : tout override dark doit référencer un token de la section 3.5 |
