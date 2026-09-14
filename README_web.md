# TIA INFO BUILD - Guide de lancement et tests

Stack : FastAPI + SQLAlchemy + MySQL | React + TypeScript + Vite + Bootstrap

## Démarrage rapide (Windows PowerShell — système insensible à la casse)

```powershell
cd Web
.\start-dev.ps1
```

Cela lance automatiquement :
- Backend FastAPI sur http://localhost:8000
- Frontend React sur http://localhost:5173

## Structure

```
Web/
├── README_Web.md      # Guide principal du projet web
├── start-dev.ps1      # Script de démarrage rapide (Windows)
├── backend/
│   ├── .env           # variables d'environnement
│   ├── requirements.txt
│   ├── alembic.ini
│   └── app/
│       ├── main.py    # point d'entrée FastAPI
│       ├── config.py
│       ├── database.py
│       ├── models/
│       ├── routers/
│       ├── schemas/
│       ├── crud/
│       └── core/
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── src/
    └── dist/          # build de production
```

## Documentation détaillée

- **Guide complet** : [`Web/README_Web.md`](Web/README_Web.md)
- **Backend** : [`Web/backend/README.md`](Web/backend/README.md)
- **Frontend** : [`Web/frontend/README.md`](Web/frontend/README.md)

## Tests rapides

### Backend

```powershell
cd Web/backend
.\env\Scripts\python.exe -c "import app.main; print('OK')"
curl.exe http://localhost:8000/health
curl.exe http://localhost:8000/openapi.json | .\env\Scripts\python.exe -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(d.get('paths', {}).keys()))"
```

### Frontend

```powershell
cd Web/frontend
npx tsc -b
npm run lint
npm run build
```

## Comptes de test

Les comptes sont créés automatiquement par le seed (voir Dépannage et `Web/backend/README.md`).
Mot de passe universel : `Admin123!`. Rôles disponibles :
- super_admin (admin@tia.mg)
- admin_entreprise (demo@btppro.mg)
- directeur, comptable, chef_projet, chef_chantier, rh, materiel, magasinier, commercial
- employe, client

Si les comptes n'existent pas (base recreee) : `python -m app.scripts.init_db`
depuis `Web/backend` (idempotent, sans effet si les donnees existent deja).

## Dépannage

- Port 8000 occupé : changer `APP_PORT` dans `Web/backend/.env`
- Port 5173 occupé : changer le port dans `Web/frontend/vite.config.ts`
- Erreur DB : vérifier que MySQL est démarré et que la base existe
- CORS : vérifier `CORS_ORIGINS` dans `Web/backend/.env`
- 404 sur les routes : vérifier que le backend a bien redémarré après les correctifs de préfixes
- `NameError: name 'DbSession' is not defined` au demarrage : version Python < 3.14 et alias
  `Annotated` utilise avant sa definition. Corrige dans le depot (definir les alias en tete de
  module) -> faire un `git pull` puis relancer. Details : `Web/backend/README.md`.
- `401` au login : comptes de test absents (base recreee sans seed). Lancer le seed ou utiliser
  `start-dev.ps1` qui le fait automatiquement.
- Migrations Alembic : nom de revision <= 32 caracteres (sinon troncature silencieuse dans
  `alembic_version` et erreur "0 found") ; type de FK identique au type de la colonne cible
  (sinon errno 150). Details : `Web/backend/README.md`.

---

## ⚡ Bonnes pratiques de performance (pour les agents IA)

### Backend (FastAPI + SQLAlchemy)

1. **Éviter le N+1** : utiliser des sous-requêtes scalaires corrélées au lieu de boucles avec requêtes.
2. **Agréger en une requête** : utiliser `scalar_subquery()` pour combiner plusieurs comptes.
3. **SQL echo désactivé** : `echo=settings.db_echo` (False par défaut, x10 sur les temps si activé).
4. **Pagination obligatoire** : `offset`/`limit` sur toutes les listes, jamais de `SELECT *` complet.
5. **Index** : colonnes de jointure (`entreprise_id`) et filtres fréquents (`is_deleted`, `statut`).
6. **`selectinload`** pour les relations eager, jamais de lazy loading dans une boucle.

### Frontend (React)

1. **Requêtes parallèles** : utiliser `Promise.all()` pour les appels indépendants.
```typescript
// MAUVAIS : séquentiel
const users = await fetchUsers();
const projects = await fetchProjects();

// BON : parallèle
const [users, projects] = await Promise.all([fetchUsers(), fetchProjects()]);
```

2. **Éviter les re-renders inutiles** : mémoiser avec `React.memo`, `useMemo`, `useCallback`.

3. **Pagination côté serveur** : ne jamais charger 10 000 lignes côté client.

4. **Debounce sur la recherche** : attendre 300ms après la dernière frappe avant d'appeler l'API.

5. **Éviter les appels API dans les boucles** : utiliser un seul appel avec filtre IN.

### Résultat des optimisations appliquées

| Route | Avant | Après | Gain |
|-------|-------|-------|------|
| `/api/super-admin/stats` | 9 requêtes (~1500ms) | 1 requête (281ms) | ~5x |
| `/api/super-admin/entreprises` | N+1 (1+3N requêtes) | 2 requêtes (1461ms) | ~3x+ |
| SQL echo | Activé (x10) | Désactivé | ~10x |

Voir `Web/backend/README.md` pour les exemples de code détaillés.

