# TIA INFO BUILD — Application Web SaaS de Gestion BTP

Stack : FastAPI + SQLAlchemy + MySQL | React + TypeScript + Vite + Bootstrap

## Démarrage rapide

```powershell
cd Web
.\start-dev.ps1
```

- Backend : http://localhost:8000
- Frontend : http://localhost:5173
- Docs API : http://localhost:8000/docs

## Documentation

- **Guide complet** : [`Web/README_Web.md`](Web/README_Web.md)
- **Backend** : [`Web/backend/README.md`](Web/backend/README.md)
- **Frontend** : [`Web/frontend/README.md`](Web/frontend/README.md)

## Comptes de test

Mot de passe universel : `Admin123!`

| Rôle | Email |
|------|-------|
| Super Admin | `admin@tia.mg` |
| Admin Entreprise | `demo@btppro.mg` |
| Directeur | `directeur@btppro.mg` |
| Comptable | `comptable@btppro.mg` |
| Chef de Projet | `chefprojet@btppro.mg` |
| Chef de Chantier | `chefchantier@btppro.mg` |
| RH | `rh@btppro.mg` |
| Matériel | `materiel@btppro.mg` |
| Magasinier | `magasinier@btppro.mg` |
| Commercial | `commercial@btppro.mg` |
| Employé | `employe@btppro.mg` |
| Client | `client@btppro.mg` |

## Structure

```
Web/
├── README_Web.md      # Guide principal
├── start-dev.ps1      # Script de démarrage rapide
├── backend/           # FastAPI + SQLAlchemy
└── frontend/          # React + Vite
```

## Correctifs récents

- **Permissions admin_entreprise** : Accès complet aux modules métier
- **500 chef_chantier** : Fix UnboundLocalError dans dashboard CRUD
- **Récursion JSON** : Patch jsonable_encoder renforcé
- **Seed** : 12 comptes de test créés automatiquement
- **Rôle client** : Ajouté (12 rôles total)
