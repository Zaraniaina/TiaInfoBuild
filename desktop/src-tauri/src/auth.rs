//! Authentification offline-first : activation online obligatoire, login
//! online avec repli offline (hash Argon2id local), jetons en OS keyring.
//!
//! Contrat serveur :
//!   * `POST {server}/api/auth/desktop/activate` {email, password, device_id}
//!     -> {access_token, refresh_token, entreprise_id, user, server_time, referentiel?}
//!   * `POST {server}/api/auth/login` {email, password}
//!     -> {access_token, refresh_token?, user?}   (endpoint existant, réponse `Token`)
//!   * `GET  {server}/api/parametres/profile` (header `Authorization: Bearer …`)
//!     -> {utilisateur, preferences}

use std::time::Duration;

use argon2::password_hash::{rand_core::OsRng, SaltString};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use tauri::State;

use crate::db::{ecrire_etat, upsert_ligne, CmdError, AppState};

/// Service du credential store Windows (clé : `tia-desktop` / `access_token`, `refresh_token`).
const SERVICE_KEYRING: &str = "tia-desktop";

/// Timeout HTTP (activation/login : le frontend affiche « en ligne requis »).
const TIMEOUT_HTTP: Duration = Duration::from_secs(20);

// ============================================================================
// Contrats d'entrée/sortie (camelCase côté JS)
// ============================================================================

/// `auth_activate({ serverUrl, email, password, deviceId })`
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateParams {
    pub server_url: String,
    pub email: String,
    pub password: String,
    pub device_id: String,
}

/// `auth_login({ serverUrl, email, password })`
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginParams {
    pub server_url: String,
    pub email: String,
    pub password: String,
}

/// Renvoyé par `auth_activate` et `auth_login` :
/// `{ access_token, refresh_token, entreprise_id, user, offline }`
/// (`offline: false` toujours sur l'activation ; tokens `null` en offline).
#[derive(Debug, Serialize)]
pub struct AuthResult {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub entreprise_id: i64,
    pub user: JsonValue,
    pub offline: bool,
}

#[derive(Debug, Deserialize)]
struct ReponseActivate {
    access_token: String,
    refresh_token: String,
    entreprise_id: i64,
    user: JsonValue,
    server_time: Option<String>,
    referentiel: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
struct ReponseLogin {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    user: Option<JsonValue>,
}

// ============================================================================
// Helpers : HTTP, keyring, Argon2id, session locale
// ============================================================================

pub(crate) fn client_http() -> Result<reqwest::Client, CmdError> {
    reqwest::Client::builder()
        .timeout(TIMEOUT_HTTP)
        .build()
        .map_err(|e| CmdError::Interne(e.to_string()))
}

pub(crate) fn url_api(server_url: &str, chemin: &str) -> String {
    format!(
        "{}/{}",
        server_url.trim_end_matches('/'),
        chemin.trim_start_matches('/')
    )
}

/// Extrait le `detail` FastAPI d'une réponse en erreur (fallback : HTTP <code>).
fn detail_fastapi(status: reqwest::StatusCode, corps: &str) -> String {
    if let Ok(v) = serde_json::from_str::<JsonValue>(corps) {
        if let Some(d) = v.get("detail") {
            return match d {
                JsonValue::String(s) => s.clone(),
                autre => autre.to_string(),
            };
        }
    }
    format!("HTTP {}", status.as_u16())
}

/// Stocke un jeton dans le keyring Windows (service `tia-desktop`).
fn stocker_jeton(cle: &str, valeur: &str) -> Result<(), CmdError> {
    let entree = keyring::Entry::new(SERVICE_KEYRING, cle)
        .map_err(|e| CmdError::Interne(format!("keyring: {e}")))?;
    entree
        .set_password(valeur)
        .map_err(|e| CmdError::Interne(format!("keyring: {e}")))
}

/// Lit un jeton du keyring ; `None` si absent.
pub fn lire_jeton(cle: &str) -> Result<Option<String>, CmdError> {
    let entree = keyring::Entry::new(SERVICE_KEYRING, cle)
        .map_err(|e| CmdError::Interne(format!("keyring: {e}")))?;
    match entree.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(CmdError::Interne(format!("keyring: {e}"))),
    }
}

/// Hash Argon2id (PHC) du mot de passe pour la session locale.
fn hasher_mot_de_passe(mdp: &str) -> Result<String, CmdError> {
    let sel = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(mdp.as_bytes(), &sel)
        .map(|h| h.to_string())
        .map_err(|e| CmdError::Interne(format!("argon2: {e}")))
}

/// Vérifie un mot de passe contre un hash Argon2id PHC stocké.
fn verifier_mot_de_passe(mdp: &str, phc: &str) -> bool {
    match PasswordHash::new(phc) {
        Ok(hash) => Argon2::default()
            .verify_password(mdp.as_bytes(), &hash)
            .is_ok(),
        Err(_) => false,
    }
}

/// Lit la session locale (`local_session`) pour un email donné.
struct SessionLocale {
    entreprise_id: Option<i64>,
    user_json: Option<String>,
    password_hash: Option<String>,
}

fn lire_session(conn: &rusqlite::Connection, email: &str) -> Result<Option<SessionLocale>, CmdError> {
    match conn.query_row(
        "SELECT entreprise_id, user_json, password_hash FROM local_session WHERE email = ?1",
        [email],
        |r| {
            Ok(SessionLocale {
                entreprise_id: r.get(0)?,
                user_json: r.get(1)?,
                password_hash: r.get(2)?,
            })
        },
    ) {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Crée ou met à jour `local_session` (hash Argon2id du mot de passe).
/// `maj_date` = true seulement à l'activation (réactivation) : un simple
/// login online conserve la date d'activation d'origine.
fn ecrire_session(
    conn: &rusqlite::Connection,
    email: &str,
    entreprise_id: i64,
    user: &JsonValue,
    hash: &str,
    maj_date: bool,
) -> Result<(), CmdError> {
    let maintenant = chrono::Utc::now().to_rfc3339();
    let user_json = user.to_string();
    if maj_date {
        conn.execute(
            "INSERT INTO local_session (email, entreprise_id, user_json, password_hash, activated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(email) DO UPDATE SET
               entreprise_id = excluded.entreprise_id,
               user_json = excluded.user_json,
               password_hash = excluded.password_hash,
               activated_at = excluded.activated_at",
            rusqlite::params![email, entreprise_id, user_json, hash, maintenant],
        )?;
    } else {
        conn.execute(
            "INSERT INTO local_session (email, entreprise_id, user_json, password_hash, activated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(email) DO UPDATE SET
               entreprise_id = excluded.entreprise_id,
               user_json = excluded.user_json,
               password_hash = excluded.password_hash",
            rusqlite::params![email, entreprise_id, user_json, hash, maintenant],
        )?;
    }
    Ok(())
}

/// Insère le référentiel de base renvoyé par le serveur à l'activation.
///
/// Formats acceptés (le contrat serveur exact est à confirmer côté backend) :
///   * `{"table": "<table du schéma>", "record": {...}}` -> upsert de la ligne ;
///   * tout autre objet -> stocké tel quel dans `_sync_state.referentiel_initial`
///     (consultable via `db_query`).
fn inserer_referentiel(
    conn: &rusqlite::Connection,
    referentiel: &JsonValue,
) -> Result<(), CmdError> {
    let table = referentiel.get("table").and_then(|v| v.as_str());
    let ligne = referentiel
        .get("record")
        .or_else(|| referentiel.get("ligne"));

    if let (Some(table), Some(ligne)) = (table, ligne) {
        // Nejamais trust un nom de table venant du réseau : vérification explicite.
        let existe: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?1",
            [table],
            |r| r.get(0),
        )?;
        if existe > 0 {
            let entity_id = ligne
                .get("id")
                .and_then(|v| v.as_i64())
                .map(|n| n.to_string())
                .unwrap_or_default();
            return upsert_ligne(conn, table, ligne, &entity_id, None);
        }
    }
    ecrire_etat(conn, "referentiel_initial", &referentiel.to_string())
}

/// Met à jour le curseur de sync + device_id + server_url dans `_sync_state`.
fn ecrire_etat_activation(
    conn: &rusqlite::Connection,
    server_url: &str,
    device_id: Option<&str>,
    cursor: Option<&str>,
) -> Result<(), CmdError> {
    ecrire_etat(conn, "server_url", server_url)?;
    if let Some(d) = device_id {
        ecrire_etat(conn, "device_id", d)?;
    }
    if let Some(c) = cursor {
        // Contrat : `_sync_state.cursor` = server_time reçu à l'activation
        ecrire_etat(conn, "cursor", c)?;
    }
    Ok(())
}

// ============================================================================
// Commandes Tauri
// ============================================================================

/// `auth_activate(...)` — ONLINE UNIQUEMENT (1ʳᵉ connexion du desktop).
///
/// * réseau inaccessible -> `RESEAU_REQUIS: …`
/// * identifiants refusés (401/403) -> `IDENTIFIANTS_INVALIDES: …`
/// * email non lié à un compte desktop (409) -> `EMAIL_NON_LIE: …`
///
/// À succès : jetons en keyring, `local_session` (hash Argon2id), référentiel
/// éventuel, `_sync_state.cursor` = `server_time`.
#[tauri::command]
pub async fn auth_activate(
    state: State<'_, AppState>,
    params: ActivateParams,
) -> Result<AuthResult, String> {
    activer(&state, &params).await.map_err(|e| e.to_string())
}

async fn activer(state: &State<'_, AppState>, p: &ActivateParams) -> Result<AuthResult, CmdError> {
    let client = client_http()?;
    let url = url_api(&p.server_url, "api/auth/desktop/activate");

    let reponse = client
        .post(&url)
        .json(&json!({
            "email": p.email,
            "password": p.password,
            "device_id": p.device_id,
        }))
        .send()
        .await;

    let reponse = match reponse {
        // Échec réseau (connexion, timeout, DNS…) => online requis
        Err(e) => return Err(CmdError::ReseauRequis(e.to_string())),
        Ok(r) => r,
    };

    let status = reponse.status();
    let corps = reponse.text().await.unwrap_or_default();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(CmdError::IdentifiantsInvalides(detail_fastapi(
            status, &corps,
        )));
    }
    if status == reqwest::StatusCode::CONFLICT {
        return Err(CmdError::EmailNonLie(detail_fastapi(status, &corps)));
    }
    if !status.is_success() {
        return Err(CmdError::Serveur(format!(
            "activation refusée : {}",
            detail_fastapi(status, &corps)
        )));
    }

    let donnees: ReponseActivate = serde_json::from_str(&corps)
        .map_err(|e| CmdError::Serveur(format!("réponse illisible : {e}")))?;

    let user = if donnees.user.is_object() {
        donnees.user
    } else {
        json!({})
    };

    // 1) Argon2id du mot de passe (nécessaire au login offline futur)
    let hash = hasher_mot_de_passe(&p.password)?;

    // 2) Keyring AVANT la DB : si le credential store échoue, on aborte proprement
    stocker_jeton("access_token", &donnees.access_token)?;
    stocker_jeton("refresh_token", &donnees.refresh_token)?;

    // 3) Écritures DB atomiques : session + référentiel + état de sync
    {
        let mut guard = state
            .db
            .lock()
            .map_err(|e| CmdError::Interne(e.to_string()))?;
        let handle = guard.as_mut().ok_or_else(|| {
            CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into())
        })?;
        let tx = handle.conn.transaction()?;
        ecrire_session(&tx, &p.email, donnees.entreprise_id, &user, &hash, true)?;
        if let Some(ref rel) = donnees.referentiel {
            inserer_referentiel(&tx, rel)?;
        }
        ecrire_etat_activation(&tx, &p.server_url, Some(&p.device_id), donnees.server_time.as_deref())?;
        tx.commit()?;
    }

    Ok(AuthResult {
        access_token: Some(donnees.access_token),
        refresh_token: Some(donnees.refresh_token),
        entreprise_id: donnees.entreprise_id,
        user,
        offline: false,
    })
}

/// `auth_login(...)` — essai ONLINE d'abord, repli OFFLINE sur erreur réseau.
///
/// * 401/403 serveur -> `IDENTIFIANTS_INVALIDES` (pas de repli offline sur des
///   identifiants que le réseau a refusés).
/// * échec réseau (ou endpoint indisponible) -> vérification Argon2id local :
///     * session absente -> `ACTIVATION_REQUISE: …`
///   * mot de passe local faux -> `IDENTIFIANTS_INVALIDES: …`
///   * OK -> tokens `null`, `offline: true`.
#[tauri::command]
pub async fn auth_login(
    state: State<'_, AppState>,
    params: LoginParams,
) -> Result<AuthResult, String> {
    connecter(&state, &params).await.map_err(|e| e.to_string())
}

async fn connecter(state: &State<'_, AppState>, p: &LoginParams) -> Result<AuthResult, CmdError> {
    let client = client_http()?;
    let url_login = url_api(&p.server_url, "api/auth/login");

    let tentative = match client
        .post(&url_login)
        .json(&json!({ "email": p.email, "password": p.password }))
        .send()
        .await
    {
        // Réseau inaccessible -> repli offline
        Err(_) => None,
        Ok(reponse) => {
            let status = reponse.status();
            if status == reqwest::StatusCode::UNAUTHORIZED
                || status == reqwest::StatusCode::FORBIDDEN
            {
                let corps = reponse.text().await.unwrap_or_default();
                return Err(CmdError::IdentifiantsInvalides(detail_fastapi(
                    status, &corps,
                )));
            }
            if !status.is_success() {
                // 5xx, 429, mauvaise URL… : pas un refus d'identifiants -> offline
                None
            } else {
                Some(
                    reponse
                        .json::<ReponseLogin>()
                        .await
                        .map_err(|e| CmdError::Serveur(format!("réponse login illisible : {e}")))?,
                )
            }
        }
    };

    match tentative {
        Some(login) => login_en_ligne(state, p, login, &client).await,
        None => login_hors_ligne(state, p),
    }
}

/// Chemin ONLINE : rafraîchit les jetons + le profil + `local_session`.
async fn login_en_ligne(
    state: &State<'_, AppState>,
    p: &LoginParams,
    login: ReponseLogin,
    client: &reqwest::Client,
) -> Result<AuthResult, CmdError> {
    let mut user = login.user.filter(|u| u.is_object()).unwrap_or_else(|| json!({}));
    let mut entreprise_id = user
        .get("entreprise_id")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    // Profil complet via GET /api/parametres/profile (Bearer) — si cet appel
    // échoue, on garde l'objet `user` renvoyé par /api/auth/login.
    let url_profile = url_api(&p.server_url, "api/parametres/profile");
    if let Ok(reponse) = client
        .get(&url_profile)
        .bearer_auth(&login.access_token)
        .send()
        .await
    {
        if reponse.status().is_success() {
            if let Ok(corps) = reponse.json::<JsonValue>().await {
                if let Some(u) = corps.get("utilisateur") {
                    if u.is_object() {
                        entreprise_id = u
                            .get("entreprise_id")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(entreprise_id);
                        user = u.clone();
                    }
                }
            }
        }
    }

    // Repli : profil absent partout -> session locale existante, sinon 0
    if entreprise_id == 0 {
        let garde = state.db.lock().map_err(|e| CmdError::Interne(e.to_string()))?;
        if let Some(handle) = garde.as_ref() {
            if let Ok(Some(s)) = lire_session(&handle.conn, &p.email) {
                entreprise_id = s.entreprise_id.unwrap_or(0);
                if !user.is_object() || user.as_object().map(|m| m.is_empty()).unwrap_or(false) {
                    if let Some(uj) = s.user_json {
                        user = serde_json::from_str(&uj).unwrap_or_else(|_| json!({}));
                    }
                }
            }
        }
    }

    // Rafraîchir les jetons + la session locale (le hash est re-créé avec le
    // mot de passe exactement vérifié par le serveur)
    stocker_jeton("access_token", &login.access_token)?;
    if let Some(ref t) = login.refresh_token {
        stocker_jeton("refresh_token", t)?;
    }
    let hash = hasher_mot_de_passe(&p.password)?;
    {
        let mut garde = state
            .db
            .lock()
            .map_err(|e| CmdError::Interne(e.to_string()))?;
        let handle = garde
            .as_mut()
            .ok_or_else(|| CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into()))?;
        let tx = handle.conn.transaction()?;
        ecrire_session(&tx, &p.email, entreprise_id, &user, &hash, false)?;
        ecrire_etat_activation(&tx, &p.server_url, None, None)?;
        tx.commit()?;
    }

    Ok(AuthResult {
        access_token: Some(login.access_token),
        refresh_token: login.refresh_token,
        entreprise_id,
        user,
        offline: false,
    })
}

/// Chemin OFFLINE : vérification du hash Argon2id stocké dans `local_session`.
fn login_hors_ligne(
    state: &State<'_, AppState>,
    p: &LoginParams,
) -> Result<AuthResult, CmdError> {
    let garde = state
        .db
        .lock()
        .map_err(|e| CmdError::Interne(e.to_string()))?;
    let handle = garde
        .as_ref()
        .ok_or_else(|| CmdError::BaseNonInitialisee("appelez db_boot() d'abord".into()))?;

    let session = lire_session(&handle.conn, &p.email)?
        .ok_or_else(|| CmdError::ActivationRequise("aucune session locale pour cet email".into()))?;

    let hash = session
        .password_hash
        .ok_or_else(|| CmdError::ActivationRequise("session locale sans hash".into()))?;
    if !verifier_mot_de_passe(&p.password, &hash) {
        return Err(CmdError::IdentifiantsInvalides(
            "mot de passe local incorrect".into(),
        ));
    }

    let user = session
        .user_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_else(|| json!({}));

    Ok(AuthResult {
        access_token: None,
        refresh_token: None,
        entreprise_id: session.entreprise_id.unwrap_or(0),
        user,
        offline: true,
    })
}
