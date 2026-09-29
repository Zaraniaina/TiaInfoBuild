# Guide de démarrage Web — TIA INFO BUILD (XAMPP MySQL & 12 Rôles RBAC)

Guide complet pour installer, initialiser la base de données MySQL via XAMPP, exécuter les 12 rôles de la spécification `roles_tia_builds/`, et démarrer l'application Web (Backend FastAPI + Frontend React).

---

## Architecture & Spécifications Clés

1. **Clés Primaires & Étrangères Longues (`BIGINT`)** :
   - L'ensemble des 35 tables de la base de données (`schema.sql` & modèles SQLAlchemy `app/models/*.py`) utilisent des identifiants `BIGINT` (BigInteger en Python/S) pour supporter la haute volumétrie multi-tenant.
   - Migration Alembic : `007_convert_ids_to_bigint.py`.

2. **Référentiel des 12 Rôles Utilisateurs (`roles_tia_builds/`)** :
    - Application du contrôle d'accès basé sur les rôles (RBAC) avec **interfaces et tableaux de bord dédiés** pour chacun des 12 profils :
     1. **Super Administrateur SaaS** (`super_admin`) : Back-office SaaS, gestion des abonnements tenants, Mobile Money billing.
     2. **Administrateur d'Entreprise** (`admin_entreprise`) : Gestion technique, rôles, sécurité, audit des logs de connexion, **gestion abonnement tenant**.
     3. **Direction Générale / DAF** (`directeur`) : Pilotage P&L consolidé, marges réelles, validation des budgets & devis > 50M MGA.
     4. **Comptable / Responsable Financier** (`comptable`) : Saisie dépenses, calcul des marges automatiques, facturation et impayés.
     5. **Chef de Projet / Directeur Technique** (`chef_projet`) : Supervision multi-chantiers, arbitrage des ressources inter-chantiers.
     6. **Chef de Chantier / Conducteur** (`chef_chantier`) : Avancement physique (%), **pointage de l'équipe via scan des badges QR des ouvriers**, incidents.
     7. **Responsable RH** (`rh`) : Fiches salariés, grille de validation des pointages (scan de badge / manuels), validation des heures sup, habilitations.
     8. **Responsable Matériel** (`materiel`) : Parc d'engins (*Disponible, En Utilisation, En Maintenance, Hors Service*), plannings de maintenance.
     9. **Magasinier / Stocks** (`magasinier`) : Mouvements de stock, alertes stock minimum/rupture, fournisseurs.
     10. **Responsable Commercial** (`commercial`) : Devis avec calcul de marge théorique, conversion devis ➔ contrat, suivi facturation.
     11. **Ouvrier / Employé Terrain** (`employe`) : **Pointage effectué par le chef de chantier / RH via scan de badge**, checklist des tâches du jour.
     12. **Client** (`client`) : Accès lecture devis/factures, suivi chantiers.

3. **Politique de Pointage Anti-Fraude (`11_politique_pointage.md`)** :
   - Le pointage des ouvriers est enregistré par le **chef de chantier ou un RH sur site**, via **scan du badge QR de l'employé** (`POST /api/rh/pointages/scan-badge`) ou en **saisie manuelle**.
   - L'employé ne se pointe pas lui-même : il présente simplement son badge QR employé.

---

## Prérequis

1. **XAMPP** (avec le service **MySQL** démarré)
2. **Python 3.11+**
3. **Node.js 18+** et npm

---

## Étape 1 : Base de données MySQL (XAMPP)

1. Ouvrir **XAMPP Control Panel**.
2. Cliquer sur **Start** en face du service **MySQL**.
3. Ouvrir **phpMyAdmin** : [http://localhost/phpmyadmin](http://localhost/phpmyadmin)
4. Créer la base : `tia_build_db` (`utf8mb4_unicode_ci`).

---

## Étape 2 : Backend FastAPI

### Démarrage rapide (Windows PowerShell)

```powershell
cd Web
.\start-dev.ps1
```

Ce script lance automatiquement :
- Les migrations Alembic (`alembic upgrade head`)
- Le seed des donnees de base (`python -m app.scripts.init_db`, idempotent : roles,
  comptes de test, entreprise demo, abonnement par defaut)
- Backend sur http://localhost:8000
- Frontend sur http://localhost:5173

### Démarrage manuel (Windows PowerShell)

```powershell
cd Web/backend

# Créer le venv et installer les dépendances (une seule fois)
python -m venv env
.\env\Scripts\Activate.ps1
pip install -r requirements.txt

# Appliquer les migrations Alembic
alembic upgrade head

# Peupler la base avec les rôles et comptes de test
python app/scripts/init_db.py

# Démarrer le serveur
uvicorn app.main:app --reload --port 8000
```

---

## Étape 3 : Frontend React

```powershell
cd Web/frontend

# Installer les dépendances (une seule fois)
npm install

# Démarrer le serveur de développement
npm run dev
```

---

## Comptes de test (créés automatiquement par le seed)

Après avoir lancé `python app/scripts/init_db.py`, les comptes suivants sont disponibles (mot de passe : `Admin123!`) :

| Rôle | Email | Permissions principales |
|------|-------|------------------------|
| **Super Admin SaaS** | `admin@tia.mg` | Back-office SaaS, gestion tenants |
| **Admin Entreprise** | `demo@btppro.mg` | Tous modules métier, paramètres, abonnement |
| **Direction Générale** | `directeur@btppro.mg` | Dashboard, chantiers, finance, commercial, rh, matériels, stocks, alertes |
| **Comptable** | `comptable@btppro.mg` | Finance, commercial, chantiers, rh, alertes |
| **Chef de Projet** | `chefprojet@btppro.mg` | Chantiers, rh, matériels, stocks, finance, alertes |
| **Chef de Chantier** | `chefchantier@btppro.mg` | Chantiers, rh, matériels, stocks, finance, alertes, pointage |
| **Responsable RH** | `rh@btppro.mg` | RH, chantiers, alertes, pointage |
| **Responsable Matériel** | `materiel@btppro.mg` | Matériels, chantiers, alertes |
| **Magasinier** | `magasinier@btppro.mg` | Stocks, chantiers, alertes, pointage |
| **Commercial** | `commercial@btppro.mg` | Commercial, chantiers, finance, alertes |
| **Ouvrier / Terrain** | `employe@btppro.mg` | RH, chantiers, matériels, stocks, alertes, pointage (lecture seule) |
| **Client** | `client@btppro.mg` | Dashboard, commercial, chantiers |

---

## Tests rapides

### Vérifier que le backend répond

```powershell
# Health check
curl.exe http://localhost:8000/health

# Lister les routes disponibles (OpenAPI)
curl.exe http://localhost:8000/openapi.json | .\env\Scripts\python.exe -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(d.get('paths', {}).keys()))"
```

### Tester la connexion et les routes protégées

```powershell
# Login admin_entreprise
curl.exe -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"demo@btppro.mg\",\"password\":\"Admin123!\"}"

# Utiliser le token pour accéder aux routes protégées
curl.exe http://localhost:8000/api/auth/me -H "Authorization: Bearer <TOKEN>"
curl.exe http://localhost:8000/api/dashboard/stats -H "Authorization: Bearer <TOKEN>"
```

### Tester la création d'un utilisateur par l'admin entreprise

1. Se connecter avec `demo@btppro.mg` / `Admin123!`
2. Aller dans **Administration & Paramètres** → **Utilisateurs & Rôles**
3. Cliquer sur **Nouvel Utilisateur**
4. Remplir le formulaire (mot de passe : 8 caractères minimum, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial)
5. Cliquer sur **Créer l'utilisateur**

**Résultat attendu** : L'utilisateur apparaît dans la liste avec son rôle.

### Tester les routes protégées avec Swagger

1. Aller sur [http://localhost:8000/docs](http://localhost:8000/docs)
2. Cliquer sur **Authorize** et saisir le token JWT obtenu via `/api/auth/login`
3. Tester les endpoints :
   - `POST /api/utilisateurs/` — Créer un utilisateur
   - `GET /api/utilisateurs/` — Lister les utilisateurs
   - `PUT /api/utilisateurs/{id}` — Modifier un utilisateur
   - `POST /api/utilisateurs/{id}/toggle-actif` — Activer/désactiver un utilisateur

### Vérifier la cohérence des routes (pas de 404)

```powershell
# Toutes les routes doivent retourner 401 (authentification requise) et non 404
curl.exe http://localhost:8000/api/utilisateurs/
curl.exe http://localhost:8000/api/parametres/entreprise
curl.exe http://localhost:8000/api/super-admin/entreprises
```

---

## Synchronisation Desktop ↔ Web

- **Push (Desktop ➔ Web)** : `POST /api/sync/push` (lots de 200)
- **Pull (Web ➔ Desktop)** : `GET /api/sync/pull?since=…&limit=200`
- **Statut** : `GET /api/sync/status`
- Compatibilité historique (desktop SQLite hérité) : `POST /api/sync/import-sqlite` et `GET /api/sync/export`
- Conflits : **le web gagne** — le payload local rejeté est archivé dans `_sync_conflicts` côté desktop

---

## Application Desktop (Tauri 2) — offline-first

L'app desktop (`desktop/`) embarque le frontend React **et la vraie API
FastAPI en local** via un sidecar `tia-api.exe` (backend compilé avec
PyInstaller) : même API, même RBAC, même JWT que ce backend web, mais 100 %
offline sur une SQLite locale. Guide complet :
[`desktop/README.md`](../desktop/README.md).

### Lancer en développement

```powershell
# Terminal 1 — l'app desktop (lance Vite :5199 + le sidecar FastAPI local)
cd desktop ; npm run dev

# Terminal 2 (optionnel) — backend web, requis seulement pour l'activation
# (1ʳᵉ connexion) et la synchronisation
cd Web ; .\start-dev.ps1
```

Le log de l'app affiche `[sidecar] API locale prête sur
http://127.0.0.1:<port>` ; le frontend récupère l'URL via
`invoke("api_url")`. Base locale du sidecar :
`%APPDATA%/tia-info-build/local_api.db` — seed des comptes de test
automatique (mêmes identifiants que le web, mot de passe `Admin123!`).

### Tester l'API locale (hors interface)

```powershell
# Health (remplacer 51006 par le port affiché dans le log)
curl http://127.0.0.1:51006/health

# Login + création de chantier (RBAC réel) — PowerShell :
$login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:51006/api/auth/login" `
  -ContentType "application/json" -Body '{"email":"chefprojet@btppro.mg","password":"Admin123!"}'
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:51006/api/chantiers" `
  -Headers @{ Authorization = "Bearer $($login.access_token)" } `
  -ContentType "application/json" -Body '{"nom":"Chantier offline","date_debut":"2026-10-05"}'
```

> Après une modification du backend, reconstruire le sidecar (PyInstaller) :
> procédure complète dans [`desktop/README.md`](../desktop/README.md),
> section « Sidecar — API FastAPI locale », et
> [`Web/backend/README.md`](backend/README.md), section « Mode Desktop ».

---

## Module Commercial — Cycle Complet

Le module commercial gère le cycle client BTP complet :

```
CLIENT → DEMANDE → PROJET → MÉTRÉ → DEVIS → CONTRAT → CHANTIER → SITUATION → FACTURE → PAIEMENT
```

### Routes API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET/POST | `/api/commercial/demandes` | Lister/Créer demandes de travaux |
| GET/PUT/DELETE | `/api/commercial/demandes/{id}` | Détail/Modifier/Supprimer demande |
| GET/POST | `/api/commercial/projets` | Lister/Créer projets |
| GET/PUT/DELETE | `/api/commercial/projets/{id}` | Détail/Modifier/Supprimer projet |
| GET/POST | `/api/commercial/metres` | Lister/Créer métrés |
| GET/PUT/DELETE | `/api/commercial/metres/{id}` | Détail/Modifier/Supprimer métré |
| GET/POST | `/api/commercial/situations` | Lister/Créer situations de travaux |
| GET/PUT/DELETE | `/api/commercial/situations/{id}` | Détail/Modifier/Supprimer situation |
| GET/POST | `/api/commercial/situations/{id}/lignes` | Lister/Créer lignes de situation |
| DELETE | `/api/commercial/situations/{id}/lignes/{ligne_id}` | Supprimer ligne de situation |

### Seed données de test

Après `init_db.py`, les données suivantes sont créées :
- 1 demande de travaux (DEM-00001)
- 1 projet (PRJ-00001)
- 5 lignes de métré (terrassement, fondation, murs, charpente, couverture)
- 1 situation de travaux (SIT-00001, 35% avancement)

### Interfaces Frontend (page `/commercial`)

La page **Commercial & Facturation** (`Web/frontend/src/pages/commercial/`) expose 4 nouveaux onglets :

| Onglet | Composant | Fonctionnalités |
|--------|-----------|-----------------|
| **Demandes** | `DemandeTravauxTab.tsx` | Tableau filtrable (recherche + statut), modal création/édition (client, type, dates, plans), badges de statut |
| **Projets** | `ProjetsTab.tsx` | Tableau + modal (client, demande liée, dimensions L/l/H, surface, volume, niveaux) |
| **Métrés** | `MetresTab.tsx` | Tableau filtrable par projet + modal (ouvrage, formule de calcul, unité, quantité, ordre) |
| **Situations** | `SituationsTab.tsx` | Tableau avec barre d'avancement + modal situation (chantier, contrat, montant) + **modal détail des lignes d'ouvrage** (ajout/suppression, montant auto Qté × PU) |

Fichiers support :
- `src/types/index.ts` : types `DemandeTravaux`, `Projet`, `Metre`, `SituationTravaux`, `LigneSituation` (+ Create/Update)
- `src/services/commercial.service.ts` : 18 méthodes CRUD alignées sur les routes backend
- `src/config/roles.config.ts` : permissions `canCreateDemande/Projet/Metre/Situation` (RBAC 12 rôles)

Répartition des permissions de création :

| Permission | Rôles autorisés |
|------------|-----------------|
| `canCreateDemande` | super_admin, commercial |
| `canCreateProjet` | super_admin, commercial, chef_projet |
| `canCreateMetre` | super_admin, commercial, chef_projet, chef_chantier |
| `canCreateSituation` | super_admin, commercial, chef_projet, chef_chantier |

Les autres rôles (directeur, comptable, client…) ont un accès **lecture seule** sur ces onglets.

---

## Notes de version & Correctifs appliqués

- **Correctif NameError DbSession (clonage)** : `app/routers/utilisateurs.py` definissait l'alias `DbSession = Annotated[...]` APRES son utilisation dans une annotation. Python 3.14+ (annotations paresseuses, PEP 649) masquait le bug ; Python 3.13 et avant plantait au demarrage. Les alias sont maintenant definis en tete de module — regle : toujours definir les alias `Annotated` avant leur premiere utilisation.
- **Seed automatique au demarrage** : `start-dev.ps1` execute `alembic upgrade head` puis `python -m app.scripts.init_db` (idempotent) avant de lancer le backend — plus de 401 login apres une recration de la base.
- **Migrations Alembic reproductibles** : revision 014 renommee (`014_devis_projet_facture`, <= 32 caracteres) ; regle : nom de revision <= 32 caracteres, FK type-identique a la colonne cible (`sa.Integer()` vers un `int(11)`, sinon errno 150), migrations idempotentes.
- **RBAC** : le super admin n'a plus l'entree "Tarifs & Abonnement" dans la sidebar (il gere les abonnements via `/super-admin/abonnements`) ; workflow projet -> chantier (`POST /chantiers/from-projet/{id}`, chef_projet et super_admin).
- **UI** : bouton X (retour page precedente) sur la page Tarifs ; definition CSS `.table-header` ajoutee dans `tia-design.css` (en-tete de tableau de la page Parametres aligne) ; bouton "Creer l'utilisateur" passe en primaire.
- **Seed automatique** : Le script `app/scripts/init_db.py` crée maintenant les 12 comptes de test automatiquement (rôles + utilisateurs). Mot de passe universel : `Admin123!`.
- **Correctif permissions admin_entreprise** : Ajout des permissions `chantiers:read/write/delete`, `rh:read/write/delete`, `stocks:read/write/delete`, `commercial:read/write/delete`, `finance:read/write/delete`, `materiels:read/write/delete`, `alertes:read/write` pour le rôle `admin_entreprise` (provoquait un 403 sur plusieurs modules).
- **Correctif 500 chef_chantier** : Initialisation des variables `nb_incidents`, `incidents_non_resolus`, `retard_jours`, `consommation_stock`, `ecart_stock`, `nb_alertes_chantier`, `taux_avancement_physique`, `taux_avancement_financier` dans `app/crud/dashboard.py` pour éviter `UnboundLocalError`.
- **Correctif récursion JSON** : Renforcement du patch `jsonable_encoder` dans `app/main.py` pour gérer les objets SQLAlchemy imbriqués dans des dicts/listes (protection anti-boucle via `_seen` set).
- **Correctif seed roles** : Alignement des `role_id` dans le seed sur les IDs réels de la base (id=4=chef_chantier, id=6=comptable) et ajout du rôle `client` (id=12).
- **Correctif routes 404** : Les routers FastAPI avaient des préfixes en double (`/api` dans `main.py` + `/utilisateurs` dans le router). Tous les préfixes internes des routers ont été supprimés pour éviter les chemins du type `/api/utilisateurs/utilisateurs/`.
- **Correctif création utilisateurs** : Ajout de la vérification d'email existant (409), de la validation explicite des rôles (400), et de l'affichage des erreurs détaillées côté frontend.
- **Schémas de réponse** : Ajout de `role_code` dans `UtilisateurResponse` et `UtilisateurList` pour l'affichage correct des rôles dans le frontend.

---

## Dépannage

- Port 8000 occupé : changer `APP_PORT` dans `Web/backend/.env`
- Port 5173 occupé : changer le port dans `Web/frontend/vite.config.ts`
- Erreur DB : vérifier que MySQL est démarré et que la base existe
- CORS : vérifier `CORS_ORIGINS` dans `Web/backend/.env`
- 404 sur les routes : vérifier que le backend a bien redémarré après les modifications des préfixes de routes
- 500 sur `/dashboard/stats` : vérifier que le patch `jsonable_encoder` est appliqué (redémarrer le serveur)
- 403 sur les modules : vérifier les permissions dans `app/core/permissions.py`
- `NameError: name 'DbSession' is not defined` au demarrage du backend : alias `Annotated`
  utilise avant sa definition (Python < 3.14 evalue les annotations immediatement ; 3.14+ les
  evalue en paresseux et masque le bug). Corrige dans `app/routers/utilisateurs.py` : faire un
  `git pull` et relancer. **Regle** : definir les alias `Annotated` en tete de module, avant
  leur premiere utilisation dans une signature.
- `401 "Email ou mot de passe incorrect"` : comptes de test absents (base recreee sans seed).
  Lancer `python -m app.scripts.init_db` ou utiliser `start-dev.ps1` (le fait automatiquement).
- Migrations Alembic : nom de revision <= 32 caracteres (`alembic_version` = VARCHAR(32),
  sinon troncature silencieuse et erreur "0 found") ; type de FK identique au type de la
  colonne cible (sinon errno 150) ; migrations idempotentes. Details : `Web/backend/README.md`.
- **Email non reçu (dev)** : vérifier que Mailpit tourne sur `localhost:1025` et consulter l'interface web sur http://localhost:8025.
  Si Mailpit n'est pas lancé, le backend log un warning et continue sans erreur (fail-silently).

---

## Système d'Email — Mot de Passe Oublié & Inscription Entreprise

### Architecture

- Service : `app/services/email.py` — stdlib Python (`smtplib`, `email.mime`), zéro dépendance externe.
- Config : `app/config.py` — variables `SMTP_*` et `FRONTEND_URL`.

### Dev — Mailpit (intercepteur local)

**Mailpit** est un serveur SMTP de développement qui capture les emails sans les envoyer réellement.

```powershell
# Télécharger mailpit.exe depuis https://github.com/axllent/mailpit/releases
# Lancer dans un terminal séparé (avant de démarrer le backend) :
.\mailpit.exe

# SMTP : localhost:1025
# Interface Web : http://localhost:8025
```

Le backend est pré-configuré avec ces valeurs par défaut (aucun .env requis en dev).

### Prod — Variables d'environnement SMTP

Ajoutez ces variables dans `Web/backend/.env` :

```env
# SMTP Production (exemple Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=no-reply@votre-domaine.mg
SMTP_PASSWORD=<mot_de_passe_app>
SMTP_TLS=true
SMTP_FROM_EMAIL=no-reply@votre-domaine.mg
SMTP_FROM_NAME=TIA INFO BUILD

# URL publique du frontend React
FRONTEND_URL=https://app.votre-domaine.mg
```

> **Note SSL/TLS** : utilisez `SMTP_PORT=465` + `SMTP_TLS=true` pour SMTP over SSL (Gmail, OVH).
> Pour STARTTLS (port 587), laissez `SMTP_TLS=false` — `smtplib.SMTP` gère le STARTTLS automatiquement.

### Flux Email

| Endpoint | Déclencheur | Contenu de l'email |
|----------|-------------|-------------------|
| `POST /api/auth/forgot-password` | Utilisateur soumet son email | Lien de réinitialisation valide **30 minutes** |
| `POST /api/auth/reset-password` | Token validé → nouveau mot de passe accepté | *(pas d'email, retour JSON)* |
| `POST /api/auth/register-entreprise` | Inscription nouvelle entreprise | Email de confirmation + lien d'activation (`GET /auth/verify-email?token=...`) valide **24h** |
| `GET /api/auth/verify-email` | Clic sur le lien dans l'email | Active le compte admin (`is_email_verified=True`) |

### Routes Frontend

| Route | Page | Accès |
|-------|------|-------|
| `/forgot-password` | `ForgotPasswordPage.tsx` | Public |
| `/reset-password?token=...` | `ResetPasswordPage.tsx` | Public (lien depuis email) |
| `/register` ou `/register-entreprise` | `RegisterPage.tsx` | Public |
| `/verify-email?token=...` | `VerifyEmailPage.tsx` | Public (lien d'activation depuis email) |

### Sécurité

- **Tokens JWT** : les liens de réinitialisation et de vérification d'email contiennent des JWT signés (`type=password_reset` [30 min], `type=email_verification` [24h]) — aucune table de tokens supplémentaire.
- **Anti-énumération** : `POST /forgot-password` retourne toujours la même réponse, qu'un compte existe ou non.
- **Vérification Email Obligatoire** : la connexion (`POST /login`) bloque avec HTTP 403 tout compte où `is_email_verified` est `False`.
- **Politique de mot de passe** : validée côté backend (8 car. min, 1 maj, 1 min, 1 chiffre, 1 caractère spécial).
