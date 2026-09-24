//! Accès à la base SQLite locale : connexion unique, boot (schéma + migrations),
//! requêtes lecture seule et exécution groupée transactionnelle.
//!
//! La connexion est détenue par l'état global de Tauri (`Mutex<Option<DbHandle>>`) :
//! `db_boot()` l'ouvre au premier appel, les autres commandes exigent qu'elle existe.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use rusqlite::types::ValueRef;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as JsonValue};
use tauri::State;

/// Schéma embarqué du desktop (généré depuis `Web/backend` par
/// `tools/gen_sqlite_schema.py` — tables métier + tables sync + `local_session`).
pub const SCHEMA_INIT: &str = include_str!("../../schema_init.sql");

/// Timeout d'exécution d'une requête (contrat : `db_query` timeout 10 s).
const TIMEOUT_REQUETE: Duration = Duration::from_secs(10);

/// Erreurs métier des commandes Tauri. Le préfixe avant `:` est le code
/// contractuel lu par le frontend (`RESEAU_REQUIS`, `IDENTIFIANTS_INVALIDES`, …).
#[derive(Debug, thiserror::Error)]
pub enum CmdError {
    #[error("BASE_NON_INITIALISEE: {0}")]
    BaseNonInitialisee(String),
    #[error("BASE_DONNEES: {0}")]
    BaseDonnees(String),
    #[error("REQUETE_NON_AUTORISEE: {0}")]
    RequeteNonAutorisee(String),
    #[error("TIMEOUT: {0}")]
    Timeout(String),
    #[error("RESEAU_REQUIS: {0}")]
    ReseauRequis(String),
    #[error("IDENTIFIANTS_INVALIDES: {0}")]
    IdentifiantsInvalides(String),
    #[error("ACTIVATION_REQUISE: {0}")]
    ActivationRequise(String),
    #[error("EMAIL_NON_LIE: {0}")]
    EmailNonLie(String),
    #[error("ENTITE_NON_PRISE_EN_CHARGE: {0}")]
    EntiteNonPriseEnCharge(String),
    #[error("OP_NON_PRISE_EN_CHARGE: {0}")]
    OpNonPriseEnCharge(String),
    #[error("PAYLOAD_INVALIDE: {0}")]
    PayloadInvalide(String),
    #[error("TOKEN_EXPIRE: {0}")]
    TokenExpire(String),
    #[error("SERVEUR: {0}")]
    Serveur(String),
    #[error("INTERNE: {0}")]
    Interne(String),
}

impl From<rusqlite::Error> for CmdError {
    fn from(e: rusqlite::Error) -> Self {
        CmdError::BaseDonnees(e.to_string())
    }
}

impl From<serde_json::Error> for CmdError {
    fn from(e: serde_json::Error) -> Self {
        CmdError::PayloadInvalide(e.to_string())
    }
}

impl From<std::io::Error> for CmdError {
    fn from(e: std::io::Error) -> Self {
        CmdError::Interne(e.to_string())
    }
}

/// Les commandes Tauri exposent `String` comme erreur : on propage le message
/// déjà préfixé (`RESEAU_REQUIS: …`, `BASE_DONNEES: …`, …) tel quel au frontend.
impl From<CmdError> for String {
    fn from(e: CmdError) -> Self {
        e.to_string()
    }
}

/// Connexion ouverte + chemin de la base (pour `db_boot`).
pub struct DbHandle {
    pub conn: Connection,
    pub path: PathBuf,
}

/// Ét global de l'application : la connexion est créée par `db_boot`.
#[derive(Default)]
pub struct AppState {
    pub db: Mutex<Option<DbHandle>>,
}

/// Renvoyé par `db_boot()` (contrat : `db_path`, `schema_version`, `activated`).
#[derive(Debug, Serialize)]
pub struct DbBootResult {
    pub db_path: String,
    pub schema_version: i64,
    pub activated: bool,
}

/// Une instruction du lot `db_exec_batch` : `{ sql, args }`.
#[derive(Debug, Deserialize)]
pub struct ExecStatement {
    pub sql: String,
    #[serde(default)]
    pub args: Vec<JsonValue>,
}

/// Renvoyé par `db_exec_batch` : `{ rows_changed, last_id }`.
#[derive(Debug, Serialize)]
pub struct ExecResult {
    pub rows_changed: i64,
    pub last_id: Option<i64>,
}

// ============================================================================
// Ouverture & boot (schéma + migrations)
// ============================================================================

/// Chemin contractuel de la base : `%APPDATA%/tia-info-build/tia.db`.
pub fn chemin_base(app: &tauri::AppHandle) -> Result<PathBuf, CmdError> {
    use tauri::Manager;
    let dossier = match std::env::var_os("APPDATA") {
        Some(appdata) => PathBuf::from(appdata).join("tia-info-build"),
        // Repli : dossier d'application standard de Tauri (si APPDATA absent)
        None => app
            .path()
            .app_data_dir()
            .map_err(|e| CmdError::Interne(format!("dossier app introuvable : {e}")))?,
    };
    Ok(dossier.join("tia.db"))
}

/// Ouvre (ou crée) la connexion : WAL, foreign_keys ON, busy_timeout 10 s.
pub fn ouvrir_connexion(path: &Path) -> Result<Connection, CmdError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    // journal_mode renvoie une ligne -> query_row et non execute_batch
    conn.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.busy_timeout(TIMEOUT_REQUETE)?;
    Ok(conn)
}

/// Dossier des migrations desktop (`desktop/migrations`, relatif au crate).
fn dossier_migrations() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("migrations")
}

/// Liste les migrations SQL triées par nom de fichier (`0001_…`, `0002_…`, …).
///
/// Note : en dev/test le dossier source existe. Pour un installateur (Phase 5),
/// les migrations devront être embarquées via `bundle.resources` — à date, seul
/// `schema_init.sql` est inclus dans le binaire (`include_str!`).
fn lister_migrations() -> Result<Vec<(String, String)>, CmdError> {
    let dir = dossier_migrations();
    let mut noms = Vec::new();
    if let Ok(entrees) = std::fs::read_dir(&dir) {
        for entree in entrees {
            let entree = entree?;
            let p = entree.path();
            if p.extension().and_then(|e| e.to_str()) == Some("sql") {
                if let Some(nom) = p.file_name().and_then(|n| n.to_str()) {
                    noms.push(nom.to_string());
                }
            }
        }
    }
    noms.sort(); // tri lexicographique = ordre 0001 < 0002 < …
    let mut migrations = Vec::with_capacity(noms.len());
    for nom in noms {
        let contenu = std::fs::read_to_string(dir.join(&nom))?;
        migrations.push((nom, contenu));
    }
    Ok(migrations)
}

/// Applique le schéma embarqué (si base vierge) puis les migrations non
/// appliquées, suivies dans `PRAGMA user_version`. Idempotent : chaque étape
/// n'est rejouée que si `user_version` est resté en dessous.
/// Retourne la version finale (`user_version`).
pub fn boot(conn: &mut Connection) -> Result<i64, CmdError> {
    let mut version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;

    if version == 0 {
        // Premier lancement : schéma complet (IF NOT EXISTS => rejeu sûr)
        let tx = conn.transaction()?;
        tx.execute_batch(SCHEMA_INIT)?;
        tx.commit()?;
    }

    let migrations = lister_migrations()?;
    for (index, (nom, sql)) in migrations.iter().enumerate() {
        let cible = index as i64 + 1;
        if version < cible {
            let tx = conn.transaction()?;
            // Strip des eventuels BEGIN/COMMIT internes pour eviter imbriquation
            let sql_nettoye = sql.replace("BEGIN;", "").replace("COMMIT;", "");
            tx.execute_batch(&sql_nettoye)?;
            tx.pragma_update(None, "user_version", cible)?;
            tx.commit()?;
            version = cible;
            let _ = nom; // nom utile en debug/trace
        }
    }
    Ok(version)
}

/// `activated` = existence d'une ligne dans `local_session`.
pub fn est_activee(conn: &Connection) -> Result<bool, CmdError> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM local_session", [], |r| r.get(0))?;
    Ok(n > 0)
}

/// Ouvre + boot complet, utilisé par les tests (le boot de `db_boot` ouvre la
/// connexion puis appelle `boot()` directement).
#[cfg(test)]
pub fn ouvrir_et_boot(path: &Path) -> Result<(Connection, i64, bool), CmdError> {
    let mut conn = ouvrir_connexion(path)?;
    let version = boot(&mut conn)?;
    let activee = est_activee(&conn)?;
    Ok((conn, version, activee))
}

// ============================================================================
// Commandes Tauri
// ============================================================================

/// `db_boot()` — ouvre/crée la base dans l'app_data, applique schéma + migrations,
/// retourne `{ db_path, schema_version, activated }`.
#[tauri::command]
pub fn db_boot(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<DbBootResult, String> {
    let path = chemin_base(&app).map_err(|e| e.to_string())?;
    let mut guard = state.db.lock().map_err(|e| e.to_string())?;

    if guard.is_none() {
        let conn = ouvrir_connexion(&path).map_err(|e| e.to_string())?;
        *guard = Some(DbHandle {
            conn,
            path: path.clone(),
        });
    }
    let handle = guard.as_mut().expect("connexion créée ci-dessus");
    let version = boot(&mut handle.conn).map_err(|e| e.to_string())?;
    let activee = est_activee(&handle.conn).map_err(|e| e.to_string())?;
    Ok(DbBootResult {
        db_path: handle.path.to_string_lossy().into_owned(),
        schema_version: version,
        activated: activee,
    })
}

/// Vérifie qu'une requête est bien lecture seule (SELECT / CTE / EXPLAIN).
fn est_lecture_seule(sql: &str) -> bool {
    let mot = sql
        .trim_start()
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    matches!(mot.as_str(), "SELECT" | "WITH" | "EXPLAIN")
}

/// Convertit un paramètre JSON en valeur SQLite (objets/tableaux -> JSON TEXT).
fn json_vers_sql(valeur: &JsonValue) -> rusqlite::types::Value {
    match valeur {
        JsonValue::Null => rusqlite::types::Value::Null,
        JsonValue::Bool(b) => rusqlite::types::Value::Integer(*b as i64),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else {
                rusqlite::types::Value::Real(n.as_f64().unwrap_or(f64::NAN))
            }
        }
        JsonValue::String(s) => rusqlite::types::Value::Text(s.clone()),
        // JSON stocké en TEXT (pas de type JSON natif côté SQLite)
        _ => rusqlite::types::Value::Text(valeur.to_string()),
    }
}

/// Convertit une cellule SQLite en JSON (Blob -> tableau d'octets).
fn sql_vers_json(valeur: ValueRef<'_>) -> JsonValue {
    match valeur {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(i) => JsonValue::from(i),
        ValueRef::Real(f) => serde_json::Number::from_f64(f)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        ValueRef::Text(t) => JsonValue::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => JsonValue::from(b.to_vec()),
    }
}

/// `db_query(sql, args)` — SELECT uniquement, tableau d'objets, timeout 10 s.
#[tauri::command]
pub fn db_query(
    state: State<'_, AppState>,
    sql: String,
    args: Vec<JsonValue>,
) -> Result<Vec<JsonValue>, String> {
    if !est_lecture_seule(&sql) {
        return Err(
            CmdError::RequeteNonAutorisee("db_query n'accepte que des SELECT (lecture seule)"
                .into())
                .to_string(),
        );
    }

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let handle = guard
        .as_ref()
        .ok_or_else(|| CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into()))?;

    // Timeout 10 s : rusqlite 0.31 n'expose pas de progress handler, on fait
    // appel à `sqlite3_interrupt` depuis un veilleur réveillé aussitôt la
    // requête terminée (canal), pour ne jamais interrompre la requête suivante.
    let interrompu = Arc::new(AtomicBool::new(false));
    let (fin_tx, fin_rx) = mpsc::channel::<()>();
    let veilleur = {
        let interrompu = Arc::clone(&interrompu);
        let handle_bdd = handle.conn.get_interrupt_handle();
        std::thread::spawn(move || {
            if fin_rx.recv_timeout(TIMEOUT_REQUETE).is_err() {
                interrompu.store(true, Ordering::SeqCst);
                handle_bdd.interrupt();
            }
        })
    };

    let resultat = executer_select(&handle.conn, &sql, &args);
    let _ = fin_tx.send(());
    let _ = veilleur.join();

    let timeout_frappe = interrompu.load(Ordering::SeqCst);
    let resultat = resultat.map_err(|e| match &e {
        // Interruption par le veilleur => timeout contractuel
        CmdError::BaseDonnees(msg)
            if timeout_frappe || msg.to_lowercase().contains("interrupt") =>
        {
            CmdError::Timeout(format!("requête > {TIMEOUT_REQUETE:?}"))
        }
        autre => autre.clone_msg(),
    })?;
    Ok(resultat)
}

impl CmdError {
    /// Re-copie un message d'erreur sans le préfixe (aide au mapping timeout).
    fn clone_msg(&self) -> CmdError {
        match self {
            CmdError::BaseDonnees(m) => CmdError::BaseDonnees(m.clone()),
            CmdError::Timeout(m) => CmdError::Timeout(m.clone()),
            CmdError::Interne(m) => CmdError::Interne(m.clone()),
            CmdError::BaseNonInitialisee(m) => CmdError::BaseNonInitialisee(m.clone()),
            CmdError::RequeteNonAutorisee(m) => CmdError::RequeteNonAutorisee(m.clone()),
            CmdError::ReseauRequis(m) => CmdError::ReseauRequis(m.clone()),
            CmdError::IdentifiantsInvalides(m) => CmdError::IdentifiantsInvalides(m.clone()),
            CmdError::ActivationRequise(m) => CmdError::ActivationRequise(m.clone()),
            CmdError::EmailNonLie(m) => CmdError::EmailNonLie(m.clone()),
            CmdError::EntiteNonPriseEnCharge(m) => CmdError::EntiteNonPriseEnCharge(m.clone()),
            CmdError::OpNonPriseEnCharge(m) => CmdError::OpNonPriseEnCharge(m.clone()),
            CmdError::PayloadInvalide(m) => CmdError::PayloadInvalide(m.clone()),
            CmdError::TokenExpire(m) => CmdError::TokenExpire(m.clone()),
            CmdError::Serveur(m) => CmdError::Serveur(m.clone()),
        }
    }
}

/// Exécute un SELECT et renvoie un tableau d'objets (colonnes en clés).
/// En cas de doublon de nom de colonne (`SELECT * , t.*`), la dernière occurrence gagne.
fn executer_select(
    conn: &Connection,
    sql: &str,
    args: &[JsonValue],
) -> Result<Vec<JsonValue>, CmdError> {
    let valeurs: Vec<rusqlite::types::Value> = args.iter().map(json_vers_sql).collect();
    let mut stmt = conn.prepare(sql)?;
    let colonnes: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|c| (*c).to_string())
        .collect();

    let mut lignes = stmt.query(rusqlite::params_from_iter(valeurs.iter()))?;
    let mut resultat = Vec::new();
    while let Some(ligne) = lignes.next()? {
        let mut objet = Map::new();
        for (i, nom) in colonnes.iter().enumerate() {
            objet.insert(nom.clone(), sql_vers_json(ligne.get_ref(i)?));
        }
        resultat.push(JsonValue::Object(objet));
    }
    Ok(resultat)
}

/// `db_exec_batch(statements)` — exécute TOUT le lot dans UNE SEULE transaction
/// (BEGIN implicite / COMMIT, rollback sur la première erreur).
#[tauri::command]
pub fn db_exec_batch(
    state: State<'_, AppState>,
    statements: Vec<ExecStatement>,
) -> Result<ExecResult, String> {
    let mut guard = state.db.lock().map_err(|e| e.to_string())?;
    let handle = guard
        .as_mut()
        .ok_or_else(|| CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into()))?;

    exec_batch(&handle.conn, &statements).map_err(|e| e.to_string())
}

/// Cœur transactionnel de `db_exec_batch` (séparé => testable).
pub fn exec_batch(
    conn: &Connection,
    statements: &[ExecStatement],
) -> Result<ExecResult, CmdError> {
    // `&Connection` + `unchecked_transaction()` : BEGIN/COMMIT identiques à
    // `transaction()`, sans emprunt `&mut` (le Mutex d'AppState garantit
    // l'exclusivité de la connexion pendant le lot).
    let tx = conn.unchecked_transaction()?;
    let mut rows_changed: i64 = 0;

    for instruction in statements {
        let valeurs: Vec<rusqlite::types::Value> = instruction.args.iter().map(json_vers_sql).collect();
        let n = tx
            .prepare(&instruction.sql)?
            .execute(rusqlite::params_from_iter(valeurs.iter()))?;
        rows_changed += n as i64;
    }

    let last_id: i64 = tx.query_row("SELECT last_insert_rowid()", [], |r| r.get(0))?;
    tx.commit()?;

    Ok(ExecResult {
        rows_changed,
        last_id: if last_id > 0 { Some(last_id) } else { None },
    })
}

// ============================================================================
// Helpers partagés (utilisés par auth.rs et sync.rs)
// ============================================================================

/// Lit une valeur de `_sync_state`.
pub fn lire_etat(conn: &Connection, cle: &str) -> Result<Option<String>, CmdError> {
    match conn.query_row(
        "SELECT value FROM _sync_state WHERE key = ?1",
        [cle],
        |r| r.get::<_, String>(0),
    ) {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Écrit (INSERT OR REPLACE) une valeur de `_sync_state`.
pub fn ecrire_etat(conn: &Connection, cle: &str, valeur: &str) -> Result<(), CmdError> {
    conn.execute(
        "INSERT INTO _sync_state (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![cle, valeur],
    )?;
    Ok(())
}

/// Liste des colonnes d'une table (`PRAGMA table_info`), vide si la table n'existe pas.
pub fn colonnes_table(conn: &Connection, table: &str) -> std::collections::HashSet<String> {
    let mut set = std::collections::HashSet::new();
    if let Ok(mut stmt) = conn.prepare(&format!("PRAGMA table_info(\"{table}\")")) {
        let mut rows = stmt.query([]).ok();
        if let Some(rows) = rows.as_mut() {
            while let Ok(Some(row)) = rows.next() {
                if let Ok(nom) = row.get::<_, String>(1) {
                    set.insert(nom);
                }
            }
        }
    }
    set
}

/// Échappe un identifiant SQL (colonne/table issue du schéma).
fn identifier(nom: &str) -> String {
    format!("\"{}\"", nom.replace('"', "\"\""))
}

/// Construit la condition sur l'identifiant : `id` est INTEGER côté local alors
/// que `entity_id` est TEXT côté sync -> comparaison CASTee si non numérique.
pub fn condition_id(entity_id: &str) -> (String, rusqlite::types::Value) {
    match entity_id.parse::<i64>() {
        Ok(n) => ("id = ?1".to_string(), rusqlite::types::Value::Integer(n)),
        Err(_) => (
            "CAST(id AS TEXT) = ?1".to_string(),
            rusqlite::types::Value::Text(entity_id.to_string()),
        ),
    }
}

/// UPSERT d'une ligne JSON dans `table` (create/update de la sync) :
/// seules les colonnes réellement présentes dans la table sont utilisées ;
/// `sync_version` est renseignée si la table possède la colonne (migration 0001).
pub fn upsert_ligne(
    conn: &Connection,
    table: &str,
    ligne: &JsonValue,
    entity_id: &str,
    version: Option<i64>,
) -> Result<(), CmdError> {
    let colonnes = colonnes_table(conn, table);
    if colonnes.is_empty() {
        return Err(CmdError::EntiteNonPriseEnCharge(format!(
            "table inexistante: {table}"
        )));
    }

    let mut cles: Vec<String> = Vec::new();
    let mut valeurs: Vec<rusqlite::types::Value> = Vec::new();

    let mut objet = match ligne {
        JsonValue::Object(m) => m.clone(),
        _ => Map::new(),
    };
    // L'identifiant : payload.id, sinon entity_id
    if !objet.contains_key("id") {
        objet.insert(
            "id".into(),
            entity_id
                .parse::<i64>()
                .map(JsonValue::from)
                .unwrap_or_else(|_| JsonValue::String(entity_id.to_string())),
        );
    }
    // Version serveur (si la colonne existe via migration)
    if let Some(v) = version {
        if colonnes.contains("sync_version") {
            objet.insert("sync_version".into(), JsonValue::from(v));
        }
    }

    for (cle, valeur) in &objet {
        if !colonnes.contains(cle.as_str()) {
            continue; // champ inconnu localement -> ignore (commenté côté contrat)
        }
        cles.push(identifier(cle));
        valeurs.push(json_vers_sql(valeur));
    }

    if cles.is_empty() {
        return Err(CmdError::PayloadInvalide(format!(
            "aucune colonne exploitable pour {table}"
        )));
    }

    let liste_cols = cles.join(", ");
    let liste_vals = vec!["?"; cles.len()].join(", ");
    let maj = cles
        .iter()
        .map(|c| format!("{c} = excluded.{c}"))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "INSERT INTO {table} ({liste_cols}) VALUES ({liste_vals})
         ON CONFLICT(id) DO UPDATE SET {maj}"
    );

    conn.prepare(&sql)?.execute(rusqlite::params_from_iter(
        valeurs.iter(),
    ))?;
    Ok(())
}

/// Soft-delete (ou DELETE réel si la table n'a pas `is_deleted`).
pub fn supprimer_ligne(
    conn: &Connection,
    table: &str,
    entity_id: &str,
    version: Option<i64>,
) -> Result<(), CmdError> {
    let colonnes = colonnes_table(conn, table);
    if colonnes.is_empty() {
        return Err(CmdError::EntiteNonPriseEnCharge(format!(
            "table inexistante: {table}"
        )));
    }
    let (condition, param) = condition_id(entity_id);

    if colonnes.contains("is_deleted") {
        let maj_version = if colonnes.contains("sync_version") && version.is_some() {
            ", sync_version = ?2"
        } else {
            ""
        };
        let sql = format!(
            "UPDATE {table} SET is_deleted = 1{maj_version} WHERE {condition}"
        );
        let mut stmt = conn.prepare(&sql)?;
        if maj_version.is_empty() {
            stmt.execute([param])?;
        } else {
            stmt.execute(rusqlite::params![param, version.unwrap_or(0)])?;
        }
    } else {
        conn.prepare(&format!("DELETE FROM {table} WHERE {condition}"))?
            .execute([param])?;
    }
    Ok(())
}

// ============================================================================
// Tests (base dans un répertoire temporaire)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn chemin_temp(nom: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "tia_test_{}_{}",
            nom,
            std::process::id()
        ));
        let _ = std::fs::remove_file(&dir);
        let _ = std::fs::remove_file(dir.with_extension("db-wal"));
        dir.join("tia.db")
    }

    #[test]
    fn boot_cree_le_schema_complet() {
        let path = chemin_temp("boot");
        let (conn, version, activee) = ouvrir_et_boot(&path).expect("boot");

        assert!(version > 0, "user_version doit être > 0 (obtenu {version})");
        assert!(!activee, "aucune session au premier lancement");

        for attendue in ["pointages", "chantiers", "employes", "_sync_outbox"] {
            let n: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [attendue],
                    |r| r.get(0),
                )
                .expect("compte");
            assert_eq!(n, 1, "table {attendue} absente du schéma");
        }

        // Les tables sync sont bien celles du schéma embarqué (pas du Rust en dur)
        let cols = colonnes_table(&conn, "_sync_outbox");
        for c in ["seq", "entity", "entity_id", "op", "payload", "client_ts", "pushed"] {
            assert!(cols.contains(c), "_sync_outbox.{c} manquante");
        }
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn boot_est_idempotent() {
        let path = chemin_temp("idem");
        let (_, v1, _) = ouvrir_et_boot(&path).expect("1er boot");
        let (_, v2, _) = ouvrir_et_boot(&path).expect("2e boot");
        assert_eq!(v1, v2, "le boot ne doit pas rejouer les migrations");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn exec_batch_rollback_sur_erreur() {
        let path = chemin_temp("rollback");
        let (conn, _, _) = ouvrir_et_boot(&path).expect("boot");

        // 1re instruction valide, 2e fausse => TOUT doit être annulé
        let ok = ExecStatement {
            sql: "INSERT INTO _sync_state (key, value) VALUES (?1, ?2)".into(),
            args: vec![JsonValue::from("k"), JsonValue::from("v")],
        };
        let ko = ExecStatement {
            sql: "INSERT INTO table_inexistante VALUES (1)".into(),
            args: vec![],
        };
        let resultat = exec_batch(&conn, &[ok, ko]);
        assert!(resultit_est_erreur(&resultat));

        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM _sync_state", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0, "la 1re instruction doit avoir été rollback");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn exec_batch_renvoie_last_id() {
        let path = chemin_temp("lastid");
        let (conn, _, _) = ouvrir_et_boot(&path).expect("boot");
        let ins = ExecStatement {
            sql: "INSERT INTO local_session (email, entreprise_id, user_json, password_hash, activated_at)
                  VALUES (?1, ?2, ?3, ?4, ?5)"
                .into(),
            args: vec![
                JsonValue::from("a@b.mg"),
                JsonValue::from(1),
                JsonValue::from("{}"),
                JsonValue::from("hash"),
                JsonValue::from("2026-01-01T00:00:00Z"),
            ],
        };
        let res = exec_batch(&conn, &[ins]).expect("exec");
        assert_eq!(res.rows_changed, 1);
        assert!(res.last_id.is_some_and(|id| id > 0));
        let _ = std::fs::remove_file(&path);
    }

    fn resultit_est_erreur<T>(r: &Result<T, CmdError>) -> bool {
        r.is_err()
    }
}
