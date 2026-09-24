//! Moteur de synchronisation desktop ↔ web.
//!
//! Règles (contrat `docs/plan-desktop-tauri.md`) :
//!   * **web = maître** : en cas de conflit, la version serveur est réappliquée
//!     en local et le payload local rejeté est journalisé dans `_sync_conflicts` ;
//!   * cycle = **push** (outbox, lots de 200) puis **pull** (curseur `since`) ;
//!   * toute application de changements serveur passe par **une transaction
//!     SQLite unique** (rollback global en cas d'échec) ;
//!   * entité hors map : opération laissée dans l'outbox (push) / curseur non
//!     avancé (pull) + `error: ENTITE_NON_PRISE_EN_CHARGE: …` exposé.

use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use tauri::State;

use crate::auth::{client_http, lire_jeton, url_api};
use crate::db::{
    colonnes_table, condition_id, ecrire_etat, lire_etat, supprimer_ligne, upsert_ligne, CmdError,
    AppState,
};

/// Taille d'un lot : 200 opérations poussées / 200 changements tirés (contrat).
const TAILLE_LOT: usize = 200;

/// Timeout de la vérification TCP « en ligne » (contrat : 2 s, std uniquement).
const TIMEOUT_TCP: Duration = Duration::from_secs(2);

// ============================================================================
// Map des entités -> table locale
// ============================================================================

/// Traduit une `entity` de sync vers sa table SQLite locale.
///
/// **PHASE 4 : ajouter les entités restantes** (stocks, articles, achats,
/// finance, commercial, RH, matériel, rapports, alertes…). Toute entité
/// absente de ce `match` est refusée proprement sans perdre l'opération.
fn table_pour_entite(entity: &str) -> Option<&'static str> {
    match entity {
        "pointage" => Some("pointages"),
        "chantier" => Some("chantiers"),
        "employe" => Some("employes"),
        _ => None,
    }
}

// ============================================================================
// Réseau : `net_online()` (TCP rapide, sans dépendance lourde)
// ============================================================================

/// Extrait `(hôte, port)` d'une URL serveur (défaut : 443 https / 80 http).
fn extraire_hote_port(url: &str) -> (String, u16) {
    let sans_scheme = url.split("://").nth(1).unwrap_or(url);
    let hote_port = sans_scheme.split('/').next().unwrap_or(sans_scheme);
    if let Some((h, p)) = hote_port.rsplit_once(':') {
        if let Ok(port) = p.parse::<u16>() {
            return (h.to_string(), port);
        }
    }
    let port = if url.trim_start().starts_with("http://") { 80 } else { 443 };
    (hote_port.to_string(), port)
}

/// Test TCP avec timeout (le DNS de résolution peut, lui, dépasser 2 s :
/// limite connue de l'approche `std` sans dépendance).
fn tester_tcp(hote: &str, port: u16) -> bool {
    let adresses = match (hote, port).to_socket_addrs() {
        Ok(a) => a,
        Err(_) => return false,
    };
    for adresse in adresses {
        if TcpStream::connect_timeout(&adresse, TIMEOUT_TCP).is_ok() {
            return true;
        }
    }
    false
}

/// Lit l'URL serveur enregistrée (`_sync_state.server_url`) sous lock court.
fn server_url_stockee(state: &State<'_, AppState>) -> Option<String> {
    let garde = state.db.lock().ok()?;
    let handle = garde.as_ref()?;
    lire_etat(&handle.conn, "server_url").ok().flatten()
}

/// `net_online() -> bool` — l'hôte du `server_url` connu, sinon `1.1.1.1:443`.
#[tauri::command]
pub fn net_online(state: State<'_, AppState>) -> bool {
    let (hote, port) = match server_url_stockee(&state) {
        Some(url) => extraire_hote_port(&url),
        None => ("1.1.1.1".to_string(), 443),
    };
    tester_tcp(&hote, port)
}

// ============================================================================
// `sync_status()` (sans paramètre : la base doit déjà être ouverte)
// ============================================================================

/// `{ online, pending, last_sync_at, conflicts }`
#[derive(Debug, Serialize)]
pub struct SyncStatusResult {
    pub online: bool,
    pub pending: i64,
    pub last_sync_at: Option<String>,
    pub conflicts: i64,
}

/// `sync_status()` — état de la file pour le badge Topbar.
#[tauri::command]
pub fn sync_status(state: State<'_, AppState>) -> Result<SyncStatusResult, String> {
    let (pending, conflicts, last_sync_at, url) = {
        let garde = state.db.lock().map_err(|e| e.to_string())?;
        let handle = garde
            .as_ref()
            .ok_or_else(|| CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into()))?;
        let conn = &handle.conn;
        let pending: i64 = conn
            .query_row("SELECT COUNT(*) FROM _sync_outbox WHERE pushed = 0", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        let conflicts: i64 = conn
            .query_row("SELECT COUNT(*) FROM _sync_conflicts", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        let last = lire_etat(conn, "last_sync_at").map_err(|e| e.to_string())?;
        let url = lire_etat(conn, "server_url").map_err(|e| e.to_string())?;
        (pending, conflicts, last, url)
    };

    let (hote, port) = match url {
        Some(u) => extraire_hote_port(&u),
        None => ("1.1.1.1".to_string(), 443),
    };
    Ok(SyncStatusResult {
        online: tester_tcp(&hote, port),
        pending,
        last_sync_at,
        conflicts,
    })
}

// ============================================================================
// `sync_run({ serverUrl })` : cycle push -> pull
// ============================================================================

/// `sync_run({ serverUrl })`
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncParams {
    pub server_url: String,
}

/// `{ pushed, pulled, conflicts, cursor, error }`
#[derive(Debug, Serialize)]
pub struct SyncRunResult {
    pub pushed: i64,
    pub pulled: i64,
    pub conflicts: i64,
    pub cursor: Option<String>,
    pub error: Option<String>,
}

impl SyncRunResult {
    fn avec_erreur(error: String) -> Self {
        SyncRunResult {
            pushed: 0,
            pulled: 0,
            conflicts: 0,
            cursor: None,
            error: Some(error),
        }
    }
}

#[derive(Debug, Deserialize)]
struct ReponsePush {
    #[serde(default)]
    applied: i64,
    #[serde(default)]
    conflicts: Vec<ConflitServeur>,
    #[serde(default)]
    server_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConflitServeur {
    seq: i64,
    entity: String,
    entity_id: String,
    server_record: JsonValue,
}

#[derive(Debug, Deserialize)]
struct ReponsePull {
    #[serde(default)]
    changes: Vec<Changement>,
    #[serde(default)]
    cursor: Option<String>,
    #[serde(default)]
    server_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Changement {
    entity: String,
    entity_id: String,
    op: String,
    payload: JsonValue,
    #[serde(default)]
    version: Option<i64>,
}

/// `base_version` : champ supplémentaire `base_version` du payload s'il a été
/// écrit à l'origine, sinon `sync_version` actuel de l'enregistrement local.
fn base_version(conn: &rusqlite::Connection, table: &str, entity_id: &str) -> Option<i64> {
    if !colonnes_table(conn, table).contains("sync_version") {
        return None;
    }
    let (condition, param) = condition_id(entity_id);
    conn.query_row(
        &format!("SELECT sync_version FROM {table} WHERE {condition}"),
        [param],
        |r| r.get::<_, Option<i64>>(0),
    )
    .ok()
    .flatten()
}

/// Encode un paramètre d'URL (curseur ISO, etc.) sans dépendance externe.
fn encoder_url(valeur: &str) -> String {
    let mut out = String::with_capacity(valeur.len());
    for octet in valeur.bytes() {
        match octet {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(octet as char)
            }
            _ => out.push_str(&format!("%{octet:02X}")),
        }
    }
    out
}

/// Commande Tauri `sync_run({ serverUrl })` : push de l'outbox puis pull.
#[tauri::command]
pub async fn sync_run(
    state: State<'_, AppState>,
    params: SyncParams,
) -> Result<SyncRunResult, String> {
    cycle_sync(&state, &params.server_url)
        .await
        .map_err(|e| e.to_string())
}

async fn cycle_sync(
    state: &State<'_, AppState>,
    server_url: &str,
) -> Result<SyncRunResult, CmdError> {
    let mut erreurs: Vec<String> = Vec::new();

    // Jeton de sync (keyring) — activation préalable obligatoire
    let token = match lire_jeton("access_token")? {
        Some(t) => t,
        None => {
            return Ok(SyncRunResult::avec_erreur(
                "ACTIVATION_REQUISE: aucun jeton de synchronisation".into(),
            ))
        }
    };

    // ------------------------------------------------------------------
    // PUSH — lecture de l'outbox (lock court), construction du batch
    // ------------------------------------------------------------------
    let (changes, device_id, cursor, entites_hors_map, outbox_vide) = {
        let garde = state
            .db
            .lock()
            .map_err(|e| CmdError::Interne(e.to_string()))?;
        let handle = garde
            .as_ref()
            .ok_or_else(|| CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into()))?;
        let conn = &handle.conn;

        let device_id = lire_etat(conn, "device_id")?.unwrap_or_default();
        let cursor = lire_etat(conn, "cursor")?;

        let mut stmt = conn.prepare(
            "SELECT seq, entity, entity_id, op, payload, client_ts
             FROM _sync_outbox WHERE pushed = 0 ORDER BY seq LIMIT ?1",
        )?;
        let lignes = stmt.query_map([TAILLE_LOT as i64], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, String>(5)?,
            ))
        })?;

        let mut changes = Vec::new();
        let mut hors_map: Vec<String> = Vec::new();
        let mut lignes_lues = 0usize;
        for ligne in lignes {
            let (seq, entity, entity_id, op, payload_txt, client_ts) = ligne?;
            lignes_lues += 1;

            let Some(table) = table_pour_entite(&entity) else {
                // Contrat : entité hors map => ON LA LAISSE dans l'outbox
                if !hors_map.contains(&entity) {
                    hors_map.push(entity);
                }
                continue;
            };

            let payload: JsonValue = match serde_json::from_str::<JsonValue>(&payload_txt) {
                Ok(v) if v.is_object() => v,
                _ => {
                    if !hors_map.contains(&entity) {
                        hors_map.push(entity);
                    }
                    erreurs.push(format!("PAYLOAD_INVALIDE: outbox seq {seq}"));
                    continue;
                }
            };

            let bv = payload
                .get("base_version")
                .and_then(|v| v.as_i64())
                .or_else(|| base_version(conn, table, &entity_id));

            changes.push(json!({
                "seq": seq,
                "entity": entity,
                "entity_id": entity_id,
                "op": op,
                "payload": payload,
                "client_ts": client_ts,
                "base_version": bv,
            }));
        }

        (
            changes,
            device_id,
            cursor,
            hors_map,
            lignes_lues == 0,
        )
    };

    for entity in &entites_hors_map {
        erreurs.push(format!("ENTITE_NON_PRISE_EN_CHARGE: {entity}"));
    }

    let mut pushed: i64 = 0;
    let mut conflicts_total: i64 = 0;
    let mut push_ok = true;

    if !outbox_vide && !changes.is_empty() {
        let client = client_http()?;
        let url = url_api(server_url, "api/sync/push");
        let corps = json!({ "device_id": device_id, "changes": changes });

        let reponse = client.post(&url).bearer_auth(&token).json(&corps).send().await;
        let reponse = match reponse {
            // Contrat : erreur réseau -> {error: RESEAU_REQUIS} sans toucher l'outbox
            Err(e) => {
                erreurs.push(format!("RESEAU_REQUIS: push: {e}"));
                return Ok(terminer(state, 0, 0, 0, erreurs));
            }
            Ok(r) => r,
        };

        let status = reponse.status();
        if status == reqwest::StatusCode::UNAUTHORIZED
            || status == reqwest::StatusCode::FORBIDDEN
        {
            erreurs.push("TOKEN_EXPIRE: push refusé (401/403)".into());
            push_ok = false;
        } else if !status.is_success() {
            erreurs.push(format!("SERVEUR: push HTTP {}", status.as_u16()));
            push_ok = false;
        } else {
            let donnees: ReponsePush = reponse
                .json()
                .await
                .map_err(|e| CmdError::Serveur(format!("réponse push illisible : {e}")))?;

            // Application locale : opérations appliquées + conflits « web gagne »
            // dans UNE SEULE transaction.
            {
                let mut garde = state
                    .db
                    .lock()
                    .map_err(|e| CmdError::Interne(e.to_string()))?;
                let handle = garde.as_mut().ok_or_else(|| {
                    CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into())
                })?;
                let tx = handle.conn.transaction()?;
                let seqs: Vec<i64> = changes
                    .iter()
                    .filter_map(|c| c.get("seq").and_then(|s| s.as_i64()))
                    .collect();

                // Les lignes non envoyées (entité hors map) ne sont PAS dans `changes`
                // => elles restent pushed=0, conformément au contrat.
                for seq in &seqs {
                    tx.execute("UPDATE _sync_outbox SET pushed = 1 WHERE seq = ?1", [seq])?;
                }

                let mut conflits = 0i64;
                for conflit in &donnees.conflicts {
                    let local: Option<String> = tx
                        .query_row(
                            "SELECT payload FROM _sync_outbox WHERE seq = ?1",
                            [conflit.seq],
                            |r| r.get(0),
                        )
                        .ok();
                    tx.execute(
                        "INSERT INTO _sync_conflicts
                           (entity, entity_id, local_payload, server_payload, detected_at)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![
                            conflit.entity,
                            conflit.entity_id,
                            local.unwrap_or_else(|| "null".into()),
                            conflit.server_record.to_string(),
                            chrono::Utc::now().to_rfc3339()
                        ],
                    )?;

                    // Règle « web gagne » : réappliquer server_record en local
                    match table_pour_entite(&conflit.entity) {
                        Some(table) => {
                            let version = conflit
                                .server_record
                                .get("version")
                                .and_then(|v| v.as_i64());
                            upsert_ligne(
                                &tx,
                                table,
                                &conflit.server_record,
                                &conflit.entity_id,
                                version,
                            )?;
                        }
                        None => {
                            // Table inconnue côté desktop : journaliser quand même
                            // (sinon boucle infinie) et exposer l'entité absente.
                            erreurs.push(format!(
                                "ENTITE_NON_PRISE_EN_CHARGE: {}",
                                conflit.entity
                            ));
                        }
                    }
                    tx.execute(
                        "UPDATE _sync_outbox SET pushed = 1 WHERE seq = ?1",
                        [conflit.seq],
                    )?;
                    conflits += 1;
                }

                if let Some(ref st) = donnees.server_time {
                    ecrire_etat(&tx, "last_sync_at", st)?;
                }
                tx.commit()?;

                pushed = donnees.applied;
                conflicts_total = conflits;
            }
        }
    } else if !outbox_vide && changes.is_empty() {
        // Outbox 100 % hors map : rien d'envoyable, les ops restent en file.
        push_ok = true;
    }

    if !push_ok {
        // Push refusé -> on n'essaie pas de pull (jeton/serveur en erreur)
        return Ok(terminer(state, 0, 0, conflicts_total, erreurs));
    }

    // ------------------------------------------------------------------
    // PULL — GET /api/sync/pull?since=<cursor>&limit=200
    // ------------------------------------------------------------------
    let mut pulled: i64 = 0;
    let client = client_http()?;
    let url = format!(
        "{}/api/sync/pull?since={}&limit={}",
        server_url.trim_end_matches('/'),
        encoder_url(cursor.as_deref().unwrap_or("")),
        TAILLE_LOT
    );

    let reponse = client.get(&url).bearer_auth(&token).send().await;
    let reponse = match reponse {
        Err(e) => {
            erreurs.push(format!("RESEAU_REQUIS: pull: {e}"));
            None
        }
        Ok(r) => {
            let status = r.status();
            if status == reqwest::StatusCode::UNAUTHORIZED
                || status == reqwest::StatusCode::FORBIDDEN
            {
                erreurs.push("TOKEN_EXPIRE: pull refusé (401/403)".into());
                None
            } else if !status.is_success() {
                erreurs.push(format!("SERVEUR: pull HTTP {}", status.as_u16()));
                None
            } else {
                Some(
                    r.json::<ReponsePull>()
                        .await
                        .map_err(|e| CmdError::Serveur(format!("réponse pull illisible : {e}")))?,
                )
            }
        }
    };

    if let Some(donnees) = reponse {
        let mut hors_map: Vec<String> = Vec::new();

        {
            // Une SEULE transaction pour tout le lot serveur (rollback global).
            let mut garde = state
                .db
                .lock()
                .map_err(|e| CmdError::Interne(e.to_string()))?;
            let handle = garde
                .as_mut()
                .ok_or_else(|| CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into()))?;
            let tx = handle.conn.transaction()?;

            for ch in &donnees.changes {
                let Some(table) = table_pour_entite(&ch.entity) else {
                    hors_map.push(ch.entity.clone());
                    continue;
                };
                match ch.op.as_str() {
                    "create" | "update" => {
                        upsert_ligne(&tx, table, &ch.payload, &ch.entity_id, ch.version)?;
                        pulled += 1;
                    }
                    "delete" => {
                        supprimer_ligne(&tx, table, &ch.entity_id, ch.version)?;
                        pulled += 1;
                    }
                    autre => {
                        erreurs.push(format!(
                            "OP_NON_PRISE_EN_CHARGE: {} ({autre})",
                            ch.entity
                        ));
                    }
                }
            }

            if let Some(ref st) = donnees.server_time {
                ecrire_etat(&tx, "last_sync_at", st)?;
            }
            // Curseur avancé uniquement si tout le lot est applicable : sinon on
            // re-tirera le même lot au prochain cycle (upserts idempotents) et le
            // changement d'entité inconnue ne sera jamais perdu.
            if hors_map.is_empty() {
                if let Some(ref c) = donnees.cursor {
                    ecrire_etat(&tx, "cursor", c)?;
                }
            }
            tx.commit()?;
        }

        for entity in hors_map {
            erreurs.push(format!("ENTITE_NON_PRISE_EN_CHARGE: {entity}"));
        }
    }

    Ok(terminer(state, pushed, pulled, conflicts_total, erreurs))
}

/// Relit le curseur final et construit le résultat contractuel.
fn terminer(
    state: &State<'_, AppState>,
    pushed: i64,
    pulled: i64,
    conflicts: i64,
    mut erreurs: Vec<String>,
) -> SyncRunResult {
    let cursor = {
        let garde = state.db.lock().ok();
        // `garde` : Option<MutexGuard<Option<DbHandle>>> -> on descend d'abord
        // vers l'Option<DbHandle> (Deref du guard) avant d'accéder à `.conn`.
        garde
            .as_ref()
            .and_then(|guard| guard.as_ref())
            .and_then(|handle| lire_etat(&handle.conn, "cursor").ok().flatten())
    };
    // Priorité au premier signalement, puis cumul lisible
    let error = if erreurs.is_empty() {
        None
    } else {
        erreurs.dedup();
        Some(erreurs.join(" ; "))
    };
    SyncRunResult {
        pushed,
        pulled,
        conflicts,
        cursor,
        error,
    }
}
