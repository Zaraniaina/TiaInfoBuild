# Plan de Diagnostic — Erreur 401 "Could not validate credentials"

> **Date :** 2026-08-27
> **Symptome :** `POST /api/utilisateurs/` retourne 401 Unauthorized pour l'admin entreprise
> **Message d'erreur exact :** `"Could not validate credentials"`
> **Méthodologie :** Debugging systématique — tracer le flux complet du token

---

## Flux Complet du Token (données collectées)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. BACKEND : Création du token (auth.py:42-101)                     │
│    - JWT signé avec secret_key (config.py:27)                        │
│    - Claims : sub, type=access, iat, exp, role_code, entreprise_id,  │
│      permissions                                                    │
│    - Expire après 60min (config.py:30, changé de 15min)             │
├─────────────────────────────────────────────────────────────────────┤
│ 2. FRONTEND : Stockage (auth.store.ts)                               │
│    - Zustand (mémoire) + localStorage (persistant)                   │
│    - Clés : access_token, refresh_token, user_info                   │
├─────────────────────────────────────────────────────────────────────┤
│ 3. FRONTEND : Attachement aux requêtes (api.ts:16-20)               │
│    - Interceptor request : lit token dans zustand PUIS localStorage  │
│    - Header : Authorization: Bearer <token>                          │
├─────────────────────────────────────────────────────────────────────┤
│ 4. BACKEND : Validation (security.py:113-140)                        │
│    - get_current_user_payload : décode JWT → 401 si invalide/expiré  │
│    - get_current_user : vérifie user existe ET statut == "actif"     │
│    - get_current_active_user : vérifie statut == "actif" → 403       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Causes Racines Identifiées (par probabilité)

### Cause 1 — Token expiré avant l'action (PROBABLE)

**Fichier :** `config.py:30` (maintenant 60min, était 15min)

**Mécanisme :**
- L'access token expire après 60min
- Si l'admin se connecte puis attend > 60min avant d'ajouter un utilisateur → 401
- Le frontend a un interceptor 401 qui tente le refresh automatiquement
- **MAIS** : si le refresh token est aussi invalide/expiré → logout silencieux

**Vérification :**
```bash
# Dans la console DevTools (Application → Local Storage)
# Vérifier la valeur de access_token
# Le décoder sur https://jwt.io pour voir la date d'expiration (claim "exp")
```

---

### Cause 2 — Refresh token invalide ou manquant (PROBABLE)

**Fichier :** `Web/backend/app/routers/auth.py:104-140` (refresh endpoint)
**Fichier :** `Web/frontend/src/services/api.ts:42-66` (interceptor refresh)

**Mécanisme :**
1. Requête `POST /api/utilisateurs` avec token expiré → 401
2. Interceptor lit `refresh_token` dans zustand/localStorage
3. Appelle `POST /api/auth/refresh` avec le refresh token
4. Backend vérifie :
   - Le refresh token existe dans la table `refresh_tokens`
   - Il n'est pas `revoked`
   - Il n'est pas `expires_at < now`
   - Le hash correspond (`verify_password`)
5. **Si une de ces conditions échoue → 401 "Refresh token invalide"**
6. Frontend fait `logout()` → l'utilisateur est déconnecté

**Pourquoi le refresh token serait invalide :**
- Déjà utilisé (rotation : chaque refresh invalide l'ancien)
- Expiré (`refresh_token_expire_days: 7`)
- Révoqué manuellement
- Pas stocké correctement dans localStorage

**Vérification :**
```bash
# DevTools Console
localStorage.getItem('refresh_token')
// Si null → le refresh token a été supprimé

# Backend MySQL
SELECT * FROM refresh_tokens WHERE utilisateur_id = <ID> ORDER BY created_at DESC;
// Vérifier revoked, expires_at
```

---

### Cause 3 — Utilisateur inactif dans la base de données (POSSIBLE)

**Fichier :** `Web/backend/app/security.py:136-137`

**Mécanisme :**
```python
if not user or user.statut == "inactif":
    raise CREDENTIALS_EXCEPTION  # → 401 "Could not validate credentials"
```

Si l'admin entreprise a `statut != "actif"` dans la table `utilisateurs`, TOUTES les requêtes échouent avec 401.

**Vérification :**
```sql
SELECT id, email, statut FROM utilisateurs WHERE email = 'demo@btppro.mg';
-- doit retourner statut = 'actif'
```

---

### Cause 4 — Token non attaché à la requête (PEU PROBABLE)

**Fichier :** `Web/frontend/src/services/api.ts:16-20`

**Mécanisme :**
```typescript
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token || localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Si `useAuthStore.getState().token` retourne `null` ET `localStorage.getItem('access_token')` retourne `null`, le header n'est pas attaché → 401.

**Quand cela arrive :**
- Après un logout partiel (localStorage cleared mais zustand pas sync)
- Après un refresh de page avant que zustand ne se réinitialise depuis localStorage
- Si le token a été supprimé par un autre onglet

**Vérification :**
```javascript
// DevTools Console
localStorage.getItem('access_token')  // Doit être non-null
useAuthStore.getState().token         // Doit être non-null
```

---

### Cause 5 — `entreprise_id` manquant dans le JWT (PAS POUR ADMIN_ENTREPRISE)

**Fichier :** `Web/backend/app/security.py:75-76`

**Mécanisme :**
```python
if entreprise_id is not None:
    extra["entreprise_id"] = entreprise_id
```

Pour `super_admin`, `entreprise_id` est `None` → absent du JWT.
Pour `admin_entreprse`, `entreprise_id` est défini → présent dans le JWT.

**Conclusion :** Cette cause ne s'applique PAS à l'admin entreprise.

---

### Cause 6 — Secret key changé ou environnement différent (PEU PROBABLE)

**Fichier :** `Web/backend/app/config.py:27-28`

**Mécanisme :**
- Si le backend est redémarré avec une `.env` différente, `secret_key` change
- Les tokens existants deviennent invalides (signature invalide)
- Le `jwt.decode()` lève `PyJWTError` → 401

**Vérification :**
```bash
# Vérifier que la .env n'a pas été modifiée
cat Web/backend/.env | grep SECRET
```

---

## Arbre de Diagnostic (ordre de vérification)

```
401 "Could not validate credentials"
│
├── Étape 1 : Vérifier le token dans localStorage
│   └── Si null → Cause 4 (token non attaché)
│       → Solution : se reconnecter
│
├── Étape 2 : Décoder le JWT sur jwt.io
│   ├── Si "exp" est dans le passé → Cause 1 (token expiré)
│   │   → Le refresh devrait se faire automatiquement
│   │   → Si refresh échoue → Cause 2
│   │
│   ├── Si "exp" est dans le futur → Token valide
│   │   └── Passer à l'étape 3
│   │
│   └── Si signature invalide → Cause 6 (secret changé)
│       → Solution : redémarrer avec la bonne .env
│
├── Étape 3 : Vérifier le refresh token
│   └── Si refresh_token est null dans localStorage → Cause 2
│       → Solution : se reconnecter
│
├── Étape 4 : Vérifier le statut de l'utilisateur en DB
│   └── Si statut != 'actif' → Cause 3
│       → SQL: UPDATE utilisateurs SET statut='actif' WHERE email='demo@btppro.mg'
│
└── Étape 5 : Vérifier les logs backend
    └── Chercher la stack trace complète de l'erreur 401
        → Elle indique exactement quelle vérification a échoué
```

---

## Logs à Consulter

### Backend (terminal uvicorn)
```bash
# Chercher les lignes 401 pour /api/utilisateurs/
# Le backend logge implicitement via uvicorn :
# INFO:     127.0.0.1:54760 - "POST /api/utilisateurs/ HTTP/1.1" 401 Unauthorized

# Pour avoir plus de détails, ajouter temporairement un log dans security.py:
# logging.warning(f"Auth failed for user_id={payload.get('sub')}: {exc}")
```

### Frontend (DevTools Console)
```javascript
// Intercepter les erreurs 401
// Dans la console :
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('[API ERROR]', error.config.url, error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);
```

---

## Facteurs Aggravants Identifiés

| Facteur | Impact | Fichier |
|---------|--------|---------|
| Expiration courte (15min → 60min) | Token expire rapidement | `config.py:30` |
| Refresh token rotation | Un refresh invalide l'ancien | `auth.py:126` |
| Pas de refresh proactif | L'utilisateur doit faire une action pour déclencher le refresh | `api.ts` |
| `entreprise_id` absent pour super_admin | Bloque les routes métier | `security.py:75-76` |
| `_retry` flag per-config | Peut supprimer le retry dans des cas rares | `api.ts:26` |

---

## Plan de Vérification Rapide (sans modifier le code)

1. **Ouvrir DevTools → Application → Local Storage**
   - Vérifier que `access_token` existe et n'est pas vide
   - Vérifier que `refresh_token` existe et n'est pas vide

2. **Décoder le JWT**
   - Aller sur https://jwt.io
   - Coller le contenu de `access_token`
   - Vérifier que `exp` est dans le futur
   - Vérifier que `role_code` = `"admin_entreprise"`
   - Vérifier que `entreprise_id` est présent et est un nombre

3. **Vérifier le statut de l'utilisateur en DB**
   ```sql
   SELECT id, email, role_id, statut, entreprise_id FROM utilisateurs WHERE email = 'demo@btppro.mg';
   -- statut doit être 'actif'
   -- role_id doit être 2 (admin_entreprise)
   -- entreprise_id doit être un nombre valide
   ```

4. **Tester manuellement l'endpoint**
   ```bash
   # Récupérer le token depuis localStorage, puis :
   curl -X POST http://localhost:8000/api/utilisateurs/ \
     -H "Authorization: Bearer <VOTRE_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"Test123!","nom":"Test","prenom":"User","role_code":"employe"}'
   
   # Si 401 : le token est invalide/expiré
   # Si 403 : permission manquante (pas parametres:write)
   # Si 201 : ça marche !
   ```

5. **Vérifier les logs backend**
   - Regarder la sortie du terminal uvicorn
   - Chercher la ligne 401
   - Si possible, ajouter un log temporaire dans `security.py` ligne 136 :
     ```python
     import logging
     logger = logging.getLogger(__name__)
     logger.warning(f"Auth check failed: user_id={user_id}, found={user is not None}, statut={user.statut if user else 'N/A'}")
     ```

---

## Solutions Selon la Cause Identifiée

| Cause | Solution | Fichier à modifier |
|-------|----------|-------------------|
| 1. Token expiré | Refresh automatique avant expiration | `api.ts` (déjà fait) |
| 2. Refresh invalide | Se reconnecter (nouvelle session) | Aucun (comportement normal) |
| 3. Utilisateur inactif | `UPDATE utilisateurs SET statut='actif'` | SQL direct |
| 4. Token non attaché | Vérifier l'interceptor request | `api.ts:16-20` |
| 6. Secret changé | Restaurer la .env originale | `.env` |

---

## Conclusion

Le problème 401 "Could not validate credentials" est **un problème d'authentification, pas de permissions**. Il se produit AVANT que la vérification de rôle/permission ne soit exécutée.

Les causes les plus probables sont :
1. **Token expiré** + refresh qui échoue (Cause 1 + 2 combinées)
2. **Utilisateur inactif** en base de données (Cause 3)

Le diagnostic se fait en 5 minutes avec les étapes de vérification ci-dessus.
