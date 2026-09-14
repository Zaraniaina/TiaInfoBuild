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

## Module Commercial — Cycle Complet BTP

```
CLIENT → DEMANDE → PROJET → MÉTRÉ → DEVIS → CONTRAT → CHANTIER → SITUATION → FACTURE → PAIEMENT
```

Entités : Client, DemandeTravaux, Projet, Metre, Devis, Contrat, Avenant, Chantier, SituationTravaux, Facture, Paiement

**Frontend** : 4 onglets ajoutés à la page `/commercial` (Demandes, Projets, Métrés, Situations) avec CRUD complet, filtres, barres d'avancement et gestion des lignes d'ouvrage. Permissions RBAC : `canCreateDemande/Projet/Metre/Situation`.

## Correctifs récents

- **NameError DbSession (clonage)** : `app/routers/utilisateurs.py` definissait `DbSession = Annotated[...]` APRES son utilisation dans une annotation de fonction. Python 3.14+ (annotations paresseuses, PEP 649) masquait le bug ; Python 3.13 et avant plantait au demarrage du backend (`NameError: name 'DbSession' is not defined`). Corrige : les alias `Annotated` sont definis avant leur premiere utilisation. Regle : dans un router, ne jamais utiliser un alias `Annotated` dans une signature avant de l'avoir defini.
- **401 au login apres recration de la base** : le seed n'avait jamais ete relance. `start-dev.ps1` execute maintenant `python -m app.scripts.init_db` (idempotent) apres les migrations : les comptes de test existent toujours.
- **Migrations Alembic** : la revision `014_devis_projet_facture_situation` (34 caracteres) depassait le VARCHAR(32) de `alembic_version` -> troncature silencieuse et erreur "expected to match one row... 0 found". Renommee en `014_devis_projet_facture`. Regle : tout nom de revision doit faire 32 caracteres maximum.
- **Permissions & RBAC** : le super admin n'a plus l'entree "Tarifs & Abonnement" (il gere les abonnements via `/super-admin/abonnements`) ; workflow projet -> chantier via `POST /chantiers/from-projet/{id}` (chef_projet et super_admin).
- **UI** : bouton de fermeture (X) sur la page Tarifs ; en-tete de tableau `.table-header` defini dans `tia-design.css` (page Parametres alignee) ; bouton "Creer l'utilisateur" passe en bouton primaire.
- **Permissions admin_entreprise** : Accès complet aux modules métier
- **500 chef_chantier** : Fix UnboundLocalError dans dashboard CRUD
- **Récursion JSON** : Patch jsonable_encoder renforcé
- **Seed** : 12 comptes de test créés automatiquement
- **Rôle client** : Ajouté (12 rôles total)
- **Module commercial** : Ajout des entités Demande, Projet, Métré, Situation avec routes CRUD complètes
- **Frontend commercial** : Interfaces des 4 nouvelles entités (types, service API, onglets, modals) intégrées à CommercialPage

## Emails & Réinitialisation de Mot de Passe

### Développement — Mailpit (intercepteur local)

En développement, tous les emails envoyés par le backend sont interceptés localement par **Mailpit** (aucun email réel n'est envoyé).

1. **Télécharger Mailpit** : https://github.com/axllent/mailpit/releases
2. **Lancer Mailpit** (dans un terminal séparé) :
   ```powershell
   mailpit.exe
   # SMTP sur localhost:1025 | Interface Web sur http://localhost:8025
   ```
3. Le backend est pré-configuré pour Mailpit en dev (`SMTP_HOST=localhost`, `SMTP_PORT=1025`).
4. Consultez **http://localhost:8025** pour voir tous les emails reçus.

### Production — Configuration SMTP

Ajoutez ces variables dans `Web/backend/.env` (ou dans vos variables d'environnement serveur) :

| Variable | Description | Exemple prod |
|----------|-------------|--------------|
| `SMTP_HOST` | Serveur SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Port SMTP | `465` (SSL) ou `587` (STARTTLS) |
| `SMTP_USER` | Identifiant | `no-reply@entreprise.mg` |
| `SMTP_PASSWORD` | Mot de passe app | `xxxxxxxxxxx` |
| `SMTP_TLS` | SSL/TLS natif | `true` |
| `SMTP_FROM_EMAIL` | Expéditeur | `no-reply@entreprise.mg` |
| `SMTP_FROM_NAME` | Nom affiché | `TIA INFO BUILD` |
| `FRONTEND_URL` | URL du frontend | `https://app.entreprise.mg` |

### Flux Email Implémentés

| Déclencheur | Email envoyé |
|-------------|-------------|
| `POST /api/auth/forgot-password` | Lien de réinitialisation de mot de passe (valide 30 min) |
| `POST /api/auth/register-entreprise` | Email de confirmation et lien d'activation de compte (valide 24h) (`GET /auth/verify-email?token=...`) |
| `POST /api/auth/register-entreprise` | Email de bienvenue à l'administrateur de la nouvelle entreprise |

### Pages Frontend Ajoutées

| Route | Page | Description |
|-------|------|-------------|
| `/forgot-password` | `ForgotPasswordPage.tsx` | Formulaire de demande de réinitialisation |
| `/reset-password?token=...` | `ResetPasswordPage.tsx` | Formulaire de saisie du nouveau mot de passe |
| `/register` ou `/register-entreprise` | `RegisterPage.tsx` | Inscription d'une nouvelle entreprise |
