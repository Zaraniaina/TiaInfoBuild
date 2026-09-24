# TIA INFO BUILD — Desktop (Tauri 2 + Rust + SQLite)

Application desktop **offline-first** du SaaS BTP TIA Info Build : elle embarque le
frontend React existant (`Web/frontend`) dans une WebView et remplace la couche
API par une **SQLite locale** + un cycle de synchronisation vers le backend
FastAPI (qui reste le **maître des données**).

Plan complet : `docs/plan-desktop-tauri.md`.

## Arborescence

```
desktop/
├── package.json            # scripts dev/build (CLI Tauri 2)
├── schema_init.sql         # schéma embarqué (GÉNÉRÉ depuis Web/backend — ne pas éditer)
├── migrations/
│   └── 0001_initial.sql    # colonnes sync_version (suivies via PRAGMA user_version)
└── src-tauri/
    ├── Cargo.toml          # tauri 2, rusqlite bundled SQLCipher (OpenSSL vendored), reqwest (rustls), keyring 3, argon2
    ├── tauri.conf.json     # fenêtre 1440×900, dev sur :5199, bundle NSIS
    ├── capabilities/       # core:default (les commandes custom n'exigent aucune permission)
    ├── generate_icons.py   # icônes placeholder (PNG 256 + ICO) — Phase 5 : vraies icônes
    └── src/
        ├── main.rs         # builder Tauri + handler des 8 commandes
        ├── db.rs           # connexion unique chiffrée (PRAGMA key/rekey), boot/schéma/migrations, query/exec
        ├── secret.rs       # clé de chiffrement : TIA_DB_KEY ou keyring OS (32 octets, générée au 1er lancement)
        ├── auth.rs         # activation online, login online→offline (Argon2id, keyring)
        └── sync.rs         # outbox push / curseur pull / conflits « web gagne »
```

## Développement

```powershell
# Dépendances de la CLI (une fois)
cd desktop ; npm install

# Backend FastAPI requis (login/sync) — dans un autre terminal :
cd Web ; .\start-dev.ps1

# L'app desktop (lance aussi Vite :5199 via beforeDevCommand)
cd desktop ; npm run dev

# Vérifications Rust
cd desktop\src-tauri
$env:PATH = 'C:\xampp\perl\bin;' + $env:PATH   # Perl requis par OpenSSL vendored (SQLCipher)
cargo check        # première exécution longue (dépendances compilées)
cargo test         # tests de boot/schéma/transactions/chiffrement
```

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

* **Écritures locales** : toujours via `db_exec_batch([...])` — **une seule
  transaction** : métier + insertion dans `_sync_outbox` (jamais l'un sans l'autre).
* **`sync_run({ serverUrl })`** : push de l'outbox (lots de 200,
  `POST /api/sync/push`) puis pull (`GET /api/sync/pull?since=…&limit=200`).
* **Conflits** : la version serveur gagne ; le payload local rejeté part dans
  `_sync_conflicts` et le record serveur est réappliqué localement (transaction).
* **Curseur** : `_sync_state.cursor` n'avance que si tout le lot est applicable —
  une entité non mappée bloque l'avancée (rien n'est perdu, upserts idempotents).
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
| `cargo check` échoue sur les icônes | `python src-tauri/generate_icons.py` |
