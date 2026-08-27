# Plan de Diagnostic & Implémentation — Gestion des Utilisateurs (Admin Entreprise)

> **Date :** 2026-08-27
> **Projet :** TiaInfoBuild (Web — FastAPI + React)
> **Méthodologie :** Debugging systématique (racine avant symptôme)

---

## Problematiques Identifiees

| # | Symptome | Severite |
|---|----------|----------|
| 1 | Admin entreprise ne peut pas ajouter d'utilisateur | Bloquant |
| 2 | Regle "2 admin d'entreprise max par entreprise" non appliquee | Metier |
| 3 | Le role `super_admin` apparait dans le combobox de l'admin entreprise | Securite |

---

## Phase 1 : Analyse des Causes Racines

### Probleme 1 — Admin entreprise ne peut pas ajouter d'utilisateur

#### Trace de donnees (Backend → Frontend)

| Couche | Fichier:Ligne | Ce qui se passe | Verdict |
|--------|---------------|-----------------|---------|
| Frontend (bouton) | `SettingsPage.tsx:310` | `<button onClick={openCreateUser}>` — ouvre le modal | OK |
| Frontend (modal) | `SettingsPage.tsx:531-537` | `<select>` liste les roles, pas de filtre | OK (mais voir Pb 3) |
| Frontend (soumission) | `SettingsPage.tsx:208-239` | `handleSaveUser` → `POST /utilisateurs` avec `{prenom, nom, email, role_code, password, telephone}` | OK |
| Backend (route) | `utilisateurs.py:51-84` | `POST /utilisateurs` protege par `require_permission("parametres:write")` | **POINT DE BLOCAGE POTENTIEL** |
| Backend (permission) | `permissions.py:13-26` | Verifie si `role_code` a `"parametres:write"` dans `PERMISSION_MAP` | A VERIFIER |
| Backend (permission map) | `core/permissions.py:52` | `Role.ADMIN_ENTREPRISE: ALL_PERMISSIONS` — contient bien `parametres:write` | OK |
| Backend (creation) | `utilisateurs.py:65-84` | Resout `role_code` → `role_id`, cree l'utilisateur | OK |

#### Cause Racine Identifiee

**Le probleme n'est PAS cote backend** — l'admin entreprise a bien la permission `parametres:write` (via `ALL_PERMISSION_MAP`). Le `POST /utilisateurs` fonctionne correctement.

**Le probleme est cote FRONTEND :**

1. **Le `role_code` envoye peut etre `super_admin`** — si l'admin selectionne ce role (car il est visible dans le combobox, voir Pb 3), le backend resout `super_admin` → `role_id=1` et cree un utilisateur avec le role super_admin. Cependant, **il n'y a pas de validation cote backend empechant un admin entreprise de creer un super_admin**.

2. **Aucune verification de la reponse d'erreur** — `handleSaveUser` (ligne 224-236) affiche `error?.response?.data?.detail` dans un `alert()`. Si le backend retourne une erreur 403 ou 400, l'alerte peut passer inapercue.

3. **Le `role_code` par defaut est `'employe'`** (ligne 36) — correct, pas de probleme ici.

#### Hypothese Principale

L'admin entreprise **peut techniquement** creer un utilisateur, mais :
- Soit il rencontre une erreur silencieuse (alerte non remarquee)
- Soit il tente de creer un 3e admin entreprise et rien ne l'empeche (pas de limite cote web)
- Soit le `role_code` envoye est invalide (ex: `super_admin` non filtre)

**Verification a faire :** Tester la creation avec les DevTools (Network tab) pour voir la reponse exacte du backend.

---

### Probleme 2 — Regle "2 admin d'entreprise max par entreprise"

#### Trace de donnees

| Couche | Fichier:Ligne | Ce qui se passe | Verdict |
|--------|---------------|-----------------|---------|
| Backend (creation) | `utilisateurs.py:51-84` | Aucun comptage d'admin entreprise existant | **ABSENT** |
| Backend (mise a jour role) | `utilisateurs.py:139-148` | `PUT /utilisateurs/{id}/role` — changement de role sans verification | **ABSENT** |
| Frontend (creation) | `SettingsPage.tsx:208-239` | Aucun controle du nombre d'admin avant soumission | **ABSENT** |
| Desktop (reference) | `Desktop/views/settings.js:639-721` | `hasAdminUser()` + message "Il ne peut y avoir qu'un seul administrateur" | **EXISTE cote Desktop** |

#### Cause Racine Identifiee

**La regle "2 admin max" n'est implementee NULLE PART cote Web.**

- Le backend `POST /utilisateurs` ne verifie pas le nombre d'admin entreprise existants
- Le backend `PUT /utilisateurs/{id}/role` ne verifie pas non plus
- Le frontend React ne fait aucun controle preventif
- Seul le **Desktop (Electron)** a une logique `hasAdminUser()` (mais elle limite a 1 admin, pas 2)

#### Ce qu'il faut implementer

1. **Backend :** Dans `create_utilisateur` et `update_utilisateur_role`, compter les utilisateurs avec `role_id=2` (admin_entreprise) pour l'entreprise donnee, et rejeter si le seuil (2) est atteint.
2. **Frontend :** Desactiver l'option `admin_entreprise` dans le combobox si 2 admin existent deja, avec un message explicatif.

---

### Probleme 3 — Role `super_admin` visible dans le combobox admin entreprise

#### Trace de donnees

| Couche | Fichier:Ligne | Ce qui se passe | Verdict |
|--------|---------------|-----------------|---------|
| Backend (liste roles) | `parametres.py:118-123` | `GET /roles` retourne TOUS les roles sans filtre | **PROBLEME** |
| Frontend (chargement) | `SettingsPage.tsx:91-112` | `loadRoles()` recupere tous les roles, pas de filtrage | **PROBLEME** |
| Frontend (affichage) | `SettingsPage.tsx:533-536` | `<select>` itere sur `roles` sans exclure `super_admin` | **PROBLEME** |
| Frontend (fallback) | `SettingsPage.tsx:98-110` | Le fallback hardcode ne contient pas `super_admin` | OK (mais inutile si backend OK) |

#### Cause Racine Identifiee

**Le backend `GET /roles` (parametres.py:118-123) retourne tous les roles de la table `roles`, y compris `super_admin` (id=1).**

```python
# parametres.py:121
result = await db.execute(select(Role).order_by(Role.id))
roles = result.scalars().all()
return [RoleResponse.model_validate(role) for role in roles]
```

Aucun filtre `WHERE code != 'super_admin'` n'est applique.

**Le frontend affiche tout ce qu'il recoit** — aucun filtrage cote client non plus.

#### Impact de securite

- Un admin entreprise peut **assigner le role super_admin** a un nouvel utilisateur
- Cela cree un utilisateur avec `role_id=1` qui a acces a TOUTE la plateforme (`permissions: ["*"]`)
- C'est une **vulnerabilité d'escalade de privileges**

---

## Phase 2 : Synthese des Causes Racines

| Probleme | Cause Racine | Composant | Ligne |
|----------|-------------|-----------|-------|
| 1. Admin ne peut pas ajouter d'utilisateur | Aucune limite cote web + erreur silencieuse possible | Backend + Frontend | `utilisateurs.py:51`, `SettingsPage.tsx:224` |
| 2. Regle 2 admin max non appliquee | Logique de comptage absente cote Web | Backend | `utilisateurs.py:51-84` |
| 3. Super admin visible dans combobox | `GET /roles` ne filtre pas + frontend ne filtre pas | Backend + Frontend | `parametres.py:121`, `SettingsPage.tsx:533` |

---

## Phase 3 : Plan d'Implementation

### Etape 1 — Backend : Filtrer les roles cote API (Pb 3)

**Fichier :** `Web/backend/app/routers/parametres.py`

**Modification :** Le endpoint `GET /roles` doit accepter un parametre optionnel `exclude_system` ou filtrer selon le role de l'utilisateur connecte.

```
Logique:
- Si l'utilisateur est admin_entreprise → exclure "super_admin" (id=1)
- Si l'utilisateur est super_admin → tout retourner
```

**Implementation precise :**
```python
@router.get("/roles")
async def list_roles(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "parametres:read")
    role_code = payload.get("role_code")
    query = select(Role).order_by(Role.id)
    # Securite: un admin entreprise ne doit jamais voir le role super_admin
    if role_code != Role.SUPER_ADMIN:
        query = query.where(Role.code != "super_admin")
    result = await db.execute(query)
    roles = result.scalars().all()
    return [RoleResponse.model_validate(role) for role in roles]
```

---

### Etape 2 — Backend : Ajouter la regle "2 admin max" (Pb 2)

**Fichier :** `Web/backend/app/routers/utilisateurs.py`

**Modification :** Dans `create_utilisateur` et `update_utilisateur_role`, verifier le nombre d'admin entreprise existants.

**Implementation precise :**
```python
# Dans create_utilisateur (apres la verification d'email existant)
ADMIN_ENTREPRISE_ROLE_ID = 2
MAX_ADMIN_ENTREPRISE = 2

# Si le role demande est admin_entreprise
target_role_id = obj_in.get("role_id")
if target_role_id is None and obj_in.get("role_code") == "admin_entreprise":
    target_role_id = ADMIN_ENTREPRISE_ROLE_ID

if target_role_id == ADMIN_ENTREPRISE_ROLE_ID and entreprise_id is not None:
    count_query = select(func.count()).select_from(Utilisateur).where(
        Utilisateur.entreprise_id == entreprise_id,
        Utilisateur.role_id == ADMIN_ENTREPRISE_ROLE_ID,
        Utilisateur.is_deleted == False,
    )
    current_count = (await db.execute(count_query)).scalar_one() or 0
    if current_count >= MAX_ADMIN_ENTREPRISE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Limite atteinte : maximum {MAX_ADMIN_ENTREPRISE} administrateurs par entreprise.",
        )
```

**Aussi dans `update_utilisateur_role`** (ligne 139-148) pour empecher un changement de role vers admin_entreprise si la limite est atteinte.

---

### Etape 3 — Backend : Empecher un admin entreprise de creer un super_admin (Pb 1 + Pb 3)

**Fichier :** `Web/backend/app/routers/utilisateurs.py`

**Modification :** Dans `create_utilisateur`, verifier que le role assigne ne superprivilegie pas le createur.

```python
# Securite: un admin entreprise ne peut pas creer de super_admin
creator_role = payload.get("role_code")
if creator_role != "super_admin" and obj_in.get("role_code") == "super_admin":
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Vous ne pouvez pas creer un utilisateur avec le role Super Administrateur.",
    )
```

---

### Etape 4 — Frontend : Filtrer les roles dans le combobox (Pb 3 - defense en profondeur)

**Fichier :** `Web/frontend/src/pages/settings/SettingsPage.tsx`

**Modification :** Filtrer cote client en complement du filtrage backend.

```typescript
// Dans loadRoles(), apres reception:
const filteredRoles = items
  .map((r: any) => ({ id: r.id, code: r.code, nom: r.nom }))
  .filter((r: RoleOption) => r.code !== 'super_admin')
setRoles(filteredRoles)
```

---

### Etape 5 — Frontend : Desactiver le role admin_entreprise si limite atteinte (Pb 2)

**Fichier :** `Web/frontend/src/pages/settings/SettingsPage.tsx`

**Modification :** Compter les admin entreprise existants et desactiver l'option.

```typescript
const adminCount = users.filter(u => u.role_code === 'admin_entreprise' && u.statut === 'actif').length
const adminLimitReached = adminCount >= 2

// Dans le <select> des roles:
{roles.map(r => (
  <option
    key={r.code}
    value={r.code}
    disabled={r.code === 'admin_entreprise' && adminLimitReached}
  >
    {r.nom}{r.code === 'admin_entreprise' && adminLimitReached ? ' (limite atteinte)' : ''}
  </option>
))}
```

---

### Etape 6 — Frontend : Meilleur feedback d'erreur (Pb 1)

**Fichier :** `Web/frontend/src/pages/settings/SettingsPage.tsx`

**Modification :** Remplacer les `alert()` par des notifications visuelles dans l'UI (toast ou message inline dans le modal).

---

## Phase 4 : Ordre de Priorite d'Implementation

| Priorite | Etape | Impact | Effort |
|----------|-------|--------|--------|
| **P0 (Critique)** | Etape 3 — Empecher creation de super_admin par admin entreprise | Securite / Escalade de privileges | 5 min |
| **P0 (Critique)** | Etape 1 — Filtrer GET /roles cote backend | Securite / Defense en profondeur | 5 min |
| **P1 (Important)** | Etape 2 — Regle 2 admin max cote backend | Metier / Coherence | 15 min |
| **P1 (Important)** | Etape 4 — Filtrer cote frontend (defense en profondeur) | UX / Securite | 5 min |
| **P2 (Nice)** | Etape 5 — Desactiver option si limite atteinte | UX | 10 min |
| **P3 (Optionnel)** | Etape 6 — Meilleur feedback d'erreur | UX | 15 min |

---

## Phase 5 : Tests de Validation

### Test 1 — Super admin invisible pour admin entreprise
1. Se connecter en tant qu'admin entreprise
2. Ouvrir "Nouvel Utilisateur"
3. Verifier que "Super Administrateur" n'apparait PAS dans la liste des roles
4. Verifier en parallele avec DevTools que `GET /roles` ne retourne pas `super_admin`

### Test 2 — Impossible de creer un super_admin
1. Se connecter en tant qu'admin entreprise
2. Tenter un `POST /utilisateurs` avec `role_code: "super_admin"` (via API directe)
3. Verifier que le backend retourne 403

### Test 3 — Limite 2 admin entreprise
1. Se connecter en tant qu'admin entreprise
2. S'assurer qu'il y a deja 2 admin entreprise dans la base
3. Tenter de creer un 3e utilisateur avec role `admin_entreprise`
4. Verifier que le backend retourne 400 avec message "Limite atteinte"

### Test 4 — Creation normale fonctionne
1. Se connecter en tant qu'admin entreprise
2. Creer un utilisateur avec role `employe` ou `comptable`
3. Verifier que la creation reussit

### Test 5 — Super admin peut tout faire
1. Se connecter en tant que super_admin
2. Verifier que TOUS les roles sont visibles (y compris super_admin)
3. Verifier qu'on peut creer un super_admin

---

## Risques & Considerations

| Risque | Mitigation |
|--------|------------|
| Un admin entreprise malveillant appelle l'API directement | Le filtrage backend (Etape 1, 3) est la defense reelle — le frontend est juste du confort |
| La regle "2 admin max" casse des comptes existants | Faire un audit de la base avant de deployer — identifier les entreprises qui ont deja 3+ admin |
| Le `role_code` envoye par d'autres clients (Desktop, mobile) | Appliquer la validation dans le backend, pas seulement le frontend React |

---

## Fichiers a Modifier (Resume)

| Fichier | Modifications |
|---------|---------------|
| `Web/backend/app/routers/parametres.py` | Filtrer `super_admin` dans `GET /roles` |
| `Web/backend/app/routers/utilisateurs.py` | Ajouter limite 2 admin + empecher creation de super_admin |
| `Web/frontend/src/pages/settings/SettingsPage.tsx` | Filtrer roles cote client + desactiver si limite + meilleur feedback |
