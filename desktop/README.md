# TIA INFO BUILD — Desktop (Tauri 2 + Rust + SQLite)

Application desktop **offline-first** du SaaS BTP TIA Info Build : elle embarque
le frontend React existant (`Web/frontend`) dans une WebView, remplace la couche
API par une **SQLite locale** + un cycle de synchronisation vers le backend
FastAPI (qui reste le **maître des données**), et fait désormais tourner la
**vraie API FastAPI en local** via un sidecar (`tia-api.exe`, backend compilé
avec PyInstaller).

Plan complet : `docs/plan-desktop-tauri.md`.

## Arborescence

```
desktop/
├── package.json            # scripts dev/build (CLI Tauri 2)
├── schema_init.sql         # schéma embarqué (GÉNÉRÉ depuis Web/backend — ne pas éditer)
├── migrations/
│   └── 0001_initial.sql    # colonnes sync_version (suivies via PRAGMA user_version)
└── src-tauri/
    ├── Cargo.toml          # tauri 2, rusqlite bundled SQLCipher (OpenSSL vendored), reqwest (rustls), keyring 3, argon2, tokio
    ├── tauri.conf.json     # fenêtre 1440×900, dev sur :5199, bundle NSIS + externalBin (sidecar)
    ├── binaries/           # tia-api-<triple>.exe — sidecar FastAPI (artefact gitignoré, voir « Sidecar »)
    ├── capabilities/       # core:default (les commandes custom n'exigent aucune permission)
    ├── generate_icons.py   # icônes du logo (PNG 16→256 + ICO, embarquées dans l'exe)
    └── src/
        ├── main.rs         # builder Tauri + commandes + spawn/arrêt du sidecar
        ├── sidecar.rs      # lancement tia-api.exe, lecture « TIA_API_READY port=N », commande api_url
        ├── db.rs           # connexion unique chiffrée (PRAGMA key/rekey), boot/schéma/migrations, query/exec
        ├── secret.rs       # clé de chiffrement : TIA_DB_KEY ou keyring OS (32 octets, générée au 1er lancement)
        ├── auth.rs         # activation online, login online→offline (Argon2id, keyring)
        └── sync.rs         # outbox push / curseur pull / conflits « web gagne »
```

## Développement

```powershell
# Dépendances de la CLI (une fois)
cd desktop ; npm install

# L'app desktop (lance aussi Vite :5199 via beforeDevCommand)
cd desktop ; npm run dev

# Vérifications Rust
cd desktop\src-tauri
$env:PATH = 'C:\xampp\perl\bin;' + $env:PATH   # Perl requis par OpenSSL vendored (SQLCipher)
cargo check        # première exécution longue (dépendances compilées)
cargo test         # tests de boot/schéma/transactions/chiffrement
```

Au démarrage, l'app **lance elle-même le sidecar** `tia-api.exe` (backend
FastAPI compilé) : le log affiche `[sidecar] API locale prête sur
http://127.0.0.1:<port>` quand l'API locale répond. Le port est **choisi
automatiquement** (aucune collision) — le frontend le récupère via
`invoke("api_url")`.

> **Backend web requis ?** Seulement pour l'activation (1ʳᵉ connexion) et la
> synchronisation : `cd Web ; .\start-dev.ps1` dans un autre terminal. Sans
> lui, l'app démarre et fonctionne 100 % offline (API locale).

> **Perl / OpenSSL vendored** : la feature `bundled-sqlcipher-vendored-openssl`
> compile OpenSSL depuis les sources — `C:\xampp\perl\bin` doit être dans le
> PATH à chaque (re)compilation d'`openssl-sys`. Une fois compilé (cache
> cargo), Perl n'est plus requis pour les builds suivants.

> Note `beforeDevCommand` : il est lancé par la CLI Tauri ; si le prefix
> `../Web/frontend` n'est pas résolu depuis le bon répertoire de travail sur
> votre machine, lancer Vite à la main (`cd Web/frontend ; npm run dev -- --port 5199`)
> puis relancer `npm run dev` — le `devUrl` (`http://localhost:5199`) reste la cible.

## Build installateur

```powershell
cd desktop
npm run build      # = tauri build -> installeur NSIS (Windows)
```

`beforeBuildCommand` exécute `npm --prefix ../Web/frontend run build:desktop`
(le bundle Windows doit exister dans `Web/frontend/dist`).

Le **sidecar est embarqué automatiquement** dans l'installeur via
`bundle.externalBin` : l'exe installé déploie `tia-api.exe` à côté de
`tia-desktop.exe` (avec le nom triple attendu à la compilation, sans suffixe
une fois installé). Prérequis : le binaire doit exister dans
`src-tauri/binaries/` (section « Sidecar » ci-dessus) avant `npm run build`.

> **Production** : signer `tia-api.exe` (comme l'exe principal) pour éviter
> les fausses alertes antivirus liées à PyInstaller, et vérifier que
> l'antivirus cible n'empêche pas l'extraction onefile au premier lancement.

## Sidecar — API FastAPI locale (`tia-api.exe`)

L'app embarque le **backend FastAPI complet** compilé en un exécutable
autonome (PyInstaller onefile, ≈ 43 Mo) : toutes les routes métier, le JWT et
le RBAC fonctionnent **100 % offline** sur une base SQLite locale — plus de
double maintenance des routes locales (`services/local/*.routes.ts`).

### (Re)construire le sidecar

```powershell
cd Web\backend
env\Scripts\python.exe -m pip install pyinstaller        # une seule fois

env\Scripts\pyinstaller.exe --noconfirm --clean --onefile --console `
  --name tia-api --distpath dist_sidecar --workpath build_sidecar `
  --specpath build_sidecar `
  --hidden-import aiosqlite --hidden-import greenlet --hidden-import email_validator `
  --hidden-import uvicorn.logging --hidden-import uvicorn.loops.auto `
  --hidden-import uvicorn.loops.asyncio --hidden-import uvicorn.protocols.http.auto `
  --hidden-import uvicorn.protocols.http.h11_impl `
  --hidden-import uvicorn.protocols.websockets.auto `
  --hidden-import uvicorn.protocols.websockets.websockets_impl `
  --hidden-import uvicorn.lifespan.on --collect-all argon2 `
  app/scripts/desktop_sidecar.py

# Déployer pour Tauri (nom attendu : tia-api-<triple>.exe) :
cp dist_sidecar/tia-api.exe ..\..\desktop\src-tauri\binaries\tia-api-x86_64-pc-windows-msvc.exe
```

> `desktop/src-tauri/binaries/` est **gitignoré** (artefact de build). Après
> toute modification du backend : reconstruire le sidecar puis relancer
> `npm run dev` — pas besoin de recompiler le Rust, le binaire est copié dans
> `target/debug` par le build Tauri.

### Fonctionnement

* `src/sidecar.rs` spawn `tia-api.exe`, lit la ligne contractuelle
  **`TIA_API_READY port=N`** (timeout 180 s : extraction onefile + uvicorn
  froid sont lents) et arrête le process à la fermeture de l'app.
* **Base partagée SQLCipher (`tia.db`)** : le Rust ouvre la base avant le
  spawn (conversion claire→chiffrée au premier passage, clé au keyring) puis
  transmet la clé au process Python **par stdin** (1ʳᵉ ligne, env
  `TIA_DB_KEY` en filet). Côté Python, le driver `sqlcipher3-wheels` remplace
  `sqlite3` (`sys.modules`) avant tout import d'aiosqlite et `PRAGMA key`
  est appliqué sur **chaque connexion** — l'API FastAPI complète (JWT, RBAC)
  travaille donc directement sur la même base chiffrée que les hubs Rust.
  Une base claire héritée est convertie par `sqlcipher_export` (base
  d'origine conservée en cas d'échec). Sans clé (tests/démo) : comportement
  historique sur `local_api.db` en clair.
* **Seed** : automatique en mode clair (démo/POC) ; **opt-in** en mode
  chiffré (`TIA_SEED=1`) — la base partagée contient les vraies données,
  on n'y injecte pas les comptes de démo sans demande explicite.
* **Outbox de synchronisation** : des hooks SQLAlchemy journalisent TOUTE
  écriture métier de l'API locale dans `_sync_outbox` (même transaction :
  un rollback métier annule aussi son opération de sync) avec un
  `client_ref` UUID posé à l'INSERT — identité stable desktop↔web que le
  serveur adopte au push et que le pull Rust utilise pour réconcilier les
  ids (aucun doublon). Tables `_sync_*` créées par le sidecar si absentes.
* **Branchement UI (ON par défaut)** : `Web/frontend/src/services/sidecar.ts`
  résout `invoke("api_url")` et réécrit les URLs axios vers l'API locale
  (routers montés sous `/api`) ; kill switch `VITE_SIDECAR_HTTP=0` pour
  retomber sur le mode hybride (routes SQLite + relais web). Le badge de
  synchronisation affiche l'état de l'**API locale** (Prête/Indisponible,
  bouton « Revérifier ») pour diagnostiquer le démarrage (extraction
  onefile lente). CORS WebView préconfiguré dans le sidecar
  (`localhost:5199`, `tauri://localhost`).
* Dépannage : fausses alertes antivirus fréquentes sur un exe PyInstaller
  (signer le binaire en production) ; antivirus bloquant l'extraction
  onefile → ajouter une exclusion ; `clé de chiffrement invalide` ou
  « file is not a database » → clé du keyring ≠ clé du fichier, voir
  `secret.rs`.

## Modèle « web cerveaux, desktop offline-first »

| Flux | Réseau | Implémentation |
|---|---|---|
| 1ʳᵉ connexion (activation du poste) | **Web requis** | `auth_activate` → `POST /api/auth/desktop/activate` (offline : `RESEAU_REQUIS`) |
| Connexion suivante | Local d'abord, online si dispo | `auth_login` : online puis fallback Argon2id local (`offline: true`) |
| Usage métier (chantiers, RH, stocks…) | **100 % local** | UI → API locale (sidecar) sur la base partagée `tia.db` ; écritures journalisées dans `_sync_outbox` |
| Synchronisation | Web (auto : démarrage / 5 min / retour réseau, ou manuelle) | `sync_run` : push outbox + pull curseur — **bidirectionnelle, les deux bases convergent** |
| Inscription entreprise, mot de passe oublié/reset, vérification email, abonnements & paiements | **Web requis** | `estRequeteWebRequise()` dans `services/sidecar.ts` : jamais interceptées en local ; hors-ligne → erreur 503 avec message clair |

La règle « web requis » est appliquée dans l'intercepteur axios (`services/api.ts`)
AVANT toute redirection locale : les fluxSMTP/comptes/abonnements ne peuvent pas
diverger entre desktop et web.

## Activation (1ʳᵉ connexion — **online requis**)

`auth_activate({ serverUrl, email, password, deviceId })` appelle
`POST {server}/api/auth/desktop/activate` :

* jetsons `access_token` / `refresh_token` → **keyring Windows** (service `tia-desktop`) ;
* `local_session` créée avec un **hash Argon2id** du mot de passe ;
* référentiel de base éventuel inséré ; `_sync_state.cursor` = `server_time`.

Erreurs : `RESEAU_REQUIS: …`, `IDENTIFIANTS_INVALIDES: …`, `EMAIL_NON_LIE: …`.

## Login offline

`auth_login({ serverUrl, email, password })` :

1. essai **online** `POST /api/auth/login` puis profil `GET /api/parametres/profile` ;
2. si **réseau inaccessible** (ou serveur en erreur, sauf 401/403) → vérification
   du hash Argon2id local : `offline: true`, tokens `null` ;
3. 401/403 serveur → `IDENTIFIANTS_INVALIDES` (**sans** repli offline) ;
4. aucune session locale → `ACTIVATION_REQUISE`.

## Base locale chiffrée (SQLCipher)

* Feature rusqlite `bundled-sqlcipher-vendored-openssl` : SQLCipher + OpenSSL
  **compilés depuis les sources** — voir l'encadré Perl ci-dessus.
* **Clé** (32 octets, 64 hex) — `src/secret.rs` :
  1. `TIA_DB_KEY` (environnement) si définie — tests / CI / usage expert ;
  2. sinon **keyring Windows** (service `tia-info-build`, entrée `db-key`) —
     clé générée paresseusement au 1ʳᵉ lancement (`getrandom`), jamais en dur.
* **Ouverture** (`db::ouvrir_connexion`) :
  * base **claire** (version antérieure non chiffrée) → conversion en place par
    `sqlcipher_export` (officiel SQLCipher ; `PRAGMA rekey` ne chiffre pas une
    base jamais keyée) : export chiffré → **contrôle d'ouverture avec la clé**
    → remplacement du fichier. Échec = base d'origine conservée intacte ;
  * base vide ou **chiffrée** → `PRAGMA key` + contrôle `sqlite_master` :
    mauvaise clé → « déchiffrement de la base impossible… » explicite.
* **Tests** : `cargo test` couvre base chiffrée au repos, migration
  clair → chiffré et rejet de la mauvaise clé (clé pilotée par `TIA_DB_KEY`).

## Synchronisation (web = maître)

* **Écritures locales** : via l'API locale (sidecar — hooks `_sync_outbox`
  automatiques) ou via `db_exec_batch([...])` (registre SQLite) — dans les
  deux cas **une seule transaction** : métier + outbox (jamais l'un sans l'autre).
* **`sync_run({ serverUrl })`** : push de l'outbox (lots de 200,
  `POST /api/sync/push`) puis pull (`GET /api/sync/pull?since=…&limit=200`).
* **Conflits** : la version serveur gagne ; le payload local rejeté part dans
  `_sync_conflicts` et le record serveur est réappliqué localement (transaction).
* **Curseur** : `_sync_state.cursor` n'avance que si tout le lot est applicable —
  une entité non mappée bloque l'avancée (rien n'est perdu, upserts idempotents).
* **Convergence des ids** : le pull résout les lignes locales par `client_ref`
  (`upsert_ligne`, test `upsert_resout_le_client_ref_sans_doublon`) — une
  ligne créée hors-ligne est « adoptée » par le serveur et garde son id local,
  jamais de doublon desktop↔web.
* Entités mappées aujourd'hui : les **16** du contrat PHASE 4 — `pointage`,
  `chantier`, `employe` + les 13 étendues (`article`, `mouvement_stock`,
  `achat`, `depense`, `client`, `devis`, `facture`, `conge`,
  `heure_supplementaire`, `materiel`, `maintenance`, `tache`, `incident`) —
  voir `table_pour_entite()` dans `src/sync.rs`.
* `sync_status()` : `{ online, pending, last_sync_at, conflicts }` pour le badge hors-ligne.

## Commandes exposées (`invoke`)

| Commande | Signature |
|---|---|
| `db_boot` | `() -> { db_path, schema_version, activated }` |
| `db_query` | `(sql, args[]) -> objets[]` — SELECT uniquement, timeout 10 s |
| `db_exec_batch` | `([{sql, args}]) -> { rows_changed, last_id }` — transaction unique |
| `auth_activate` | `({serverUrl, email, password, deviceId}) -> {access_token, refresh_token, entreprise_id, user, offline:false}` |
| `auth_login` | `({serverUrl, email, password}) -> {access_token\|null, refresh_token\|null, entreprise_id, user, offline}` |
| `api_url` | `() -> string` — URL de l'API locale (`http://127.0.0.1:<port>`) ou erreur `SIDECAR_INDISPONIBLE: …` |
| `net_online` | `() -> bool` — TCP 2 s vers l'hôte connu (défaut `1.1.1.1:443`) |
| `sync_status` | `() -> { online, pending, last_sync_at, conflicts }` |
| `sync_run` | `({serverUrl}) -> { pushed, pulled, conflicts, cursor, error }` |

## Régénérer le schéma local

Le schéma est tiré des modèles SQLAlchemy du backend (source de vérité) :

```powershell
# script équivalent à tools/gen_sqlite_schema.py (voir rapport d'intégration)
python tools/gen_sqlite_schema.py > desktop/schema_init.sql
```

Puis **incrémenter** une migration dans `desktop/migrations/` (jamais éditer
`schema_init.sql` à la main, jamais éditer une migration déjà livrée).

## Dépannage

| Symptôme | Cause / solution |
|---|---|
| `IDENTIFIANTS_INVALIDES` au login offline | mot de passe local différent → activation en ligne requise |
| `ACTIVATION_REQUISE` | aucune `local_session` → refaire l'activation (online) |
| `RESEAU_REQUIS` pendant `sync_run` | normal hors ligne : l'outbox est intacte, la synchro reprend au retour du réseau |
| `TOKEN_EXPIRE` en sync | JWT expiré → re-login en ligne (le refresh n'est pas encore branché, Phase 4) |
| `ENTITE_NON_PRISE_EN_CHARGE` | entité absente de `table_pour_entite()` → Phase 4 |
| `déchiffrement de la base impossible` | `TIA_DB_KEY` différente de la clé du keyring (ou fichier corrompu) |
| build échoue sur OpenSSL / SQLCipher | Perl absent du PATH → `$env:PATH='C:\xampp\perl\bin;'+$env:PATH` puis relancer |
| `SIDECAR_INDISPONIBLE` (via `api_url`) | le sidecar n'a pas fini de démarrer (extraction onefile lente) → attendre/réessayer ; persistant = binaire absent de `src-tauri/binaries/` → le reconstruire (section « Sidecar ») |
| `cargo check` échoue sur les icônes | `python src-tauri/generate_icons.py` |
