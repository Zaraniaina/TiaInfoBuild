//! TIA INFO BUILD — application desktop offline-first.
//!
//! Shell Tauri 2 autour du frontend React existant (`Web/frontend`) avec une
//! SQLite locale (`%APPDATA%/tia-info-build/tia.db`) et un cycle de
//! synchronisation web (maître) ↔ desktop. Voir `docs/plan-desktop-tauri.md`.
//!
//! Commandes exposées au frontend via `invoke` :
//!   * `db_boot`, `db_query`, `db_exec_batch`
//!   * `auth_activate`, `auth_login`
//!   * `api_url` (URL du sidecar FastAPI local)
//!   * `net_online`, `sync_status`, `sync_run`

mod auth;
mod db;
mod secret;
mod sidecar;
mod sync;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .manage(db::AppState::default())
        .manage(sidecar::SidecarEtat::default())
        .invoke_handler(tauri::generate_handler![
            db::db_boot,
            db::db_query,
            db::db_exec_batch,
            auth::auth_activate,
            auth::auth_login,
            sidecar::api_url,
            sync::net_online,
            sync::sync_status,
            sync::sync_run
        ])
        .setup(|app| {
            // Le sidecar (API FastAPI embarquée) démarre en tâche de fond :
            // l'app reste utilisable pendant l'extraction du binaire et le
            // démarrage d'uvicorn (`api_url` répondra SIDECAR_INDISPONIBLE
            // jusqu'à la ligne contractuelle TIA_API_READY).
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match sidecar::demarrer(handle.clone()).await {
                    Ok(actif) => {
                        println!(
                            "[sidecar] API locale prête sur http://127.0.0.1:{}",
                            actif.port
                        );
                        handle
                            .state::<sidecar::SidecarEtat>()
                            .definir(actif);
                    }
                    Err(e) => {
                        eprintln!("[sidecar] démarrage impossible : {e}");
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application Tauri")
        .run(|app, event| {
            // Arrêt du sidecar quand la boucle d'événements se termine.
            if let tauri::RunEvent::Exit = event {
                let etat = app.state::<sidecar::SidecarEtat>();
                tauri::async_runtime::block_on(sidecar::arreter(etat.inner()));
            }
        });
}
