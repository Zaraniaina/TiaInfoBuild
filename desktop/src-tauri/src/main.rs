//! TIA INFO BUILD — application desktop offline-first.
//!
//! Shell Tauri 2 autour du frontend React existant (`Web/frontend`) avec une
//! SQLite locale (`%APPDATA%/tia-info-build/tia.db`) et un cycle de
//! synchronisation web (maître) ↔ desktop. Voir `docs/plan-desktop-tauri.md`.
//!
//! Commandes exposées au frontend via `invoke` :
//!   * `db_boot`, `db_query`, `db_exec_batch`
//!   * `auth_activate`, `auth_login`
//!   * `net_online`, `sync_status`, `sync_run`

mod auth;
mod db;
mod sync;

fn main() {
    tauri::Builder::default()
        .manage(db::AppState::default())
        .invoke_handler(tauri::generate_handler![
            db::db_boot,
            db::db_query,
            db::db_exec_batch,
            auth::auth_activate,
            auth::auth_login,
            sync::net_online,
            sync::sync_status,
            sync::sync_run
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application Tauri");
}
