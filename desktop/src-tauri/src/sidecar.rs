//! Lancement et supervision du sidecar API local (`tia-api.exe`, la vraie
//! API FastAPI du backend compilée via PyInstaller).
//!
//! Contrat avec `Web/backend/app/scripts/desktop_sidecar.py` :
//!   * le sidecar imprime sur stdout la ligne `TIA_API_READY port=N` dès que
//!     l'API écoute sur `127.0.0.1:N` (port choisi par le sidecar lui-même :
//!     0 = premier port libre, donc aucune collision possible) ;
//!   * une sortie avant cette ligne = échec de démarrage (stderr à relire).
//!
//! La base SQLite du sidecar (`%APPDATA%/tia-info-build/local_api.db`) est
//! distincte de la base SQLCipher du Rust (`tia.db`) : ce POC prouve que
//! l'API métier complète tourne offline ; la fusion des deux stores est
//! l'étape suivante du plan desktop.

use std::sync::Mutex;
use std::time::Duration;

use tauri::Manager;
use tokio::io::{AsyncBufReadExt, BufReader};

/// État global Tauri : le sidecar actif une fois la ligne contractuelle lue.
#[derive(Default)]
pub struct SidecarEtat {
    interieur: Mutex<Option<SidecarActif>>,
}

impl SidecarEtat {
    /// Enregistre le sidecar démarré (appelé par la tâche de fond du setup).
    pub fn definir(&self, actif: SidecarActif) {
        if let Ok(mut garde) = self.interieur.lock() {
            *garde = Some(actif);
        }
    }

    /// Retire le sidecar actif (pour l'arrêter à la fermeture de l'app).
    pub fn prendre(&self) -> Option<SidecarActif> {
        self.interieur.lock().ok().and_then(|mut g| g.take())
    }

    /// Port d'écoute actuel, si le sidecar est prêt.
    pub fn port(&self) -> Option<u16> {
        self.interieur.lock().ok().and_then(|g| g.as_ref().map(|a| a.port))
    }
}

pub struct SidecarActif {
    pub port: u16,
    pub enfant: tokio::process::Child,
}

/// Nom du binaire déclaré dans `tauri.conf.json > bundle > externalBin` :
/// Tauri attend `binaries/tia-api-<triple>.exe` dans le dépôt et le déploie
/// sous le nom `tia-api.exe` à côté de l'exécutable (dev comme bundle).
const NOM_BINNAIRE: &str = "tia-api.exe";

/// Timeout de démarrage : machine de dev lente (uvicorn froid ≈ 2 min),
/// extraction onefile PyInstaller ≈ 10-20 s.
const TIMEOUT_DEMARRAGE: Duration = Duration::from_secs(180);

/// Chemin du sidecar : à côté de l'exécutable (tauri dev copie le sidecar
/// dans `target/debug`, le bundle NSIS le déploie avec l'exe principal), en
/// repli dans le dossier des ressources du bundle.
fn chemin_sidecar(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dossier) = exe.parent() {
            let candidat = dossier.join(NOM_BINNAIRE);
            if candidat.exists() {
                return Ok(candidat);
            }
        }
    }
    if let Ok(dossier) = app.path().resource_dir() {
        let candidat = dossier.join(NOM_BINNAIRE);
        if candidat.exists() {
            return Ok(candidat);
        }
    }
    Err(format!(
        "binaire sidecar {NOM_BINNAIRE} introuvable (ni à côté de l'exécutable, ni dans les ressources)"
    ))
}

/// Lance le sidecar et attend la ligne `TIA_API_READY port=N`.
pub async fn demarrer(app: tauri::AppHandle) -> Result<SidecarActif, String> {
    // Base partagée : le Rust ouvre `tia.db` AVANT de lancer le sidecar —
    // conversion claire→chiffrée si héritage, clé posée au keyring au premier
    // lancement. Le même littéral `x'…'` (rusqlite pragma_update) sert au
    // Rust et au Python : même dérivation de clé des deux côtés.
    let cle = crate::secret::cle_db().map_err(|e| e.to_string())?;
    {
        let chemin_base = crate::db::chemin_base(&app).map_err(|e| e.to_string())?;
        let _conn =
            crate::db::ouvrir_connexion(&chemin_base).map_err(|e| e.to_string())?;
        // Connexion refermée immédiatement : le fichier n'est plus verrouillé
        // par le Rust quand le process Python l'ouvre à son tour (WAL):
        // multi-process assumé, busy_timeout des deux côtés.
    }

    let chemin = chemin_sidecar(&app)?;
    let mut enfant = tokio::process::Command::new(&chemin)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::piped())
        // Filet de sécurité : le script lit aussi TIA_DB_KEY depuis l'env.
        .env("TIA_DB_KEY", &cle)
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("lancement de {} impossible : {e}", chemin.display()))?;

    // Clé transmise par stdin (1ʳᵉ ligne) : le sidecar la lit au démarrage.
    // Le pipe tamponne l'écriture : aucun ordre imposé avec la lecture stdout.
    if let Some(mut stdin) = enfant.stdin.take() {
        use tokio::io::AsyncWriteExt;
        let ecriture = async {
            stdin.write_all(cle.as_bytes()).await?;
            stdin.write_all(b"\n").await?;
            stdin.shutdown().await
        };
        if let Err(e) = ecriture.await {
            return Err(format!("transmission de la clé au sidecar impossible : {e}"));
        }
    }

    let stdout = enfant
        .stdout
        .take()
        .ok_or_else(|| "stdout du sidecar indisponible".to_string())?;
    let stderr = enfant
        .stderr
        .take()
        .ok_or_else(|| "stderr du sidecar indisponible".to_string())?;

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<u16, String>>();
    // Lecteur stdout : la première ligne contractuelle est gagnante.
    let tache_stdout = tokio::spawn(async move {
        let mut lignes = BufReader::new(stdout).lines();
        while let Ok(Some(ligne)) = lignes.next_line().await {
            if let Some(port) = ligne.strip_prefix("TIA_API_READY port=") {
                let _ = tx.send(
                    port.trim()
                        .parse::<u16>()
                        .map_err(|e| format!("port invalide dans « {ligne} » : {e}")),
                );
                break;
            }
        }
    });
    // Collecteur stderr : garde les dernières lignes pour le diagnostic d'échec.
    let tache_stderr = tokio::spawn(async move {
        let mut lignes = BufReader::new(stderr).lines();
        let mut dernieres: Vec<String> = Vec::new();
        while let Ok(Some(ligne)) = lignes.next_line().await {
            if dernieres.len() >= 10 {
                dernieres.remove(0);
            }
            dernieres.push(ligne);
        }
        dernieres
    });

    match tokio::time::timeout(TIMEOUT_DEMARRAGE, rx).await {
        Ok(Ok(Ok(port))) => {
            tache_stdout.abort();
            Ok(SidecarActif { port, enfant })
        }
        Ok(Ok(Err(e))) => Err(e),
        Ok(Err(_)) => {
            // Canal fermé : le process est mort avant la ligne contractuelle.
            let _ = tache_stdout.await;
            let erreurs = tache_stderr.await.unwrap_or_default();
            Err(format!(
                "le sidecar s'est arrêté avant TIA_API_READY. Dernières erreurs : {}",
                erreurs.join(" | ")
            ))
        }
        Err(_) => Err(format!(
            "délai dépassé ({TIMEOUT_DEMARRAGE:?}) en attendant TIA_API_READY : le sidecar ne répond pas"
        )),
    }
}

/// Arrête le sidecar (fermeture de l'app). Kill immédiat suffisant : le
/// process local n'a pas d'état volatil (SQLite en WAL, transactionnel).
pub async fn arreter(etat: &SidecarEtat) {
    if let Some(mut actif) = etat.prendre() {
        let _ = actif.enfant.kill().await;
    }
}

/// URL de base de l'API locale pour le frontend : `invoke("api_url")` →
/// `http://127.0.0.1:N`. Erreur `SIDECAR_INDISPONIBLE:` (préfixe contractuel
/// lu par le frontend) si le sidecar n'est pas prêt.
#[tauri::command]
pub async fn api_url(etat: tauri::State<'_, SidecarEtat>) -> Result<String, String> {
    match etat.port() {
        Some(port) => Ok(format!("http://127.0.0.1:{port}")),
        None => Err(
            "SIDECAR_INDISPONIBLE: l'API locale n'est pas démarrée (ou pas encore prête)".into(),
        ),
    }
}
