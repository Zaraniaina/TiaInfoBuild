# TIA INFO BUILD - Guide de lancement et tests

Stack : FastAPI + SQLAlchemy + MySQL | React + TypeScript + Vite + Bootstrap

## Démarrage rapide

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

Créer un utilisateur via `/api/auth/register` ou peupler la DB manuellement avec un rôle parmi :
- super_admin
- admin_entreprise
- directeur
- comptable
- chef_projet
- chef_chantier
- rh
- materiel
- magasinier
- commercial
- employe
- client

## Dépannage

- Port 8000 occupé : changer `APP_PORT` dans `Web/backend/.env`
- Port 5173 occupé : changer le port dans `Web/frontend/vite.config.ts`
- Erreur DB : vérifier que MySQL est démarré et que la base existe
- CORS : vérifier `CORS_ORIGINS` dans `Web/backend/.env`
- 404 sur les routes : vérifier que le backend a bien redémarré après les correctifs de préfixes
