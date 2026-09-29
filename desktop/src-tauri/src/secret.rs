//! Clé de chiffrement de la base locale (plan §5 — « chiffrement de la base »).
//!
//! Ordre de résolution :
//! 1. `TIA_DB_KEY` (environnement) — tests, CI, usage expert. 64 caractères
//!    hexadécimaux (32 octets) ;
//! 2. credential store OS via `keyring` (Windows Credential Manager) :
//!    service `tia-info-build`, entrée `db-key`. Créée paresseusement au
//!    premier lancement : 32 octets aléatoires (`getrandom`) stockés en hex —
//!    jamais de clé codée en dur ni dans un fichier.
//!
//! La clé est TOUJOURS renvoyée en hexadécimal pur : `db::appliquer_chiffrement`
//! l'applique en littéral SQL `x'…'` (aucune apostrophe possible → aucune
//! injection, conforme aux règles du projet).

use crate::db::CmdError;

/// Service du credential store OS (namespace de l'application).
const SERVICE: &str = "tia-info-build";
/// Nom de l'entrée : la clé de chiffrement de `tia.db`.
const ENTREE: &str = "db-key";

/// Renvoie la clé de chiffrement de la base (hex, 64 caractères).
///
/// - si `TIA_DB_KEY` est défini : valide et renvoie cette clé ;
/// - sinon : lit la clé au keyring, ou la génère et l'y enregistre
///   (premier lancement).
pub fn cle_db() -> Result<String, CmdError> {
    if let Ok(cle) = std::env::var("TIA_DB_KEY") {
        let cle = cle.trim().to_ascii_lowercase();
        valider_cle(&cle)?;
        return Ok(cle);
    }
    let entree = keyring::Entry::new(SERVICE, ENTREE)
        .map_err(|e| CmdError::Interne(format!("credential store OS inaccessible : {e}")))?;
    match entree.get_password() {
        Ok(cle) => {
            let cle = cle.trim().to_ascii_lowercase();
            valider_cle(&cle)?;
            Ok(cle)
        }
        Err(keyring::Error::NoEntry) => {
            // Premier lancement : clé neuve, générée puis confiée au keyring.
            let cle = generer_cle()?;
            entree.set_password(&cle).map_err(|e| {
                CmdError::Interne(format!("impossible d'enregistrer la clé au keyring : {e}"))
            })?;
            Ok(cle)
        }
        Err(e) => Err(CmdError::Interne(format!(
            "lecture de la clé au keyring impossible : {e}"
        ))),
    }
}

/// 32 octets cryptographiquement aléatoires, rendus en hexadécimal (64 car.).
fn generer_cle() -> Result<String, CmdError> {
    let mut octets = [0u8; 32];
    getrandom::getrandom(&mut octets)
        .map_err(|e| CmdError::Interne(format!("génération aléatoire de la clé impossible : {e}")))?;
    Ok(octets.iter().map(|o| format!("{o:02x}")).collect())
}

/// Une clé valide = exactement 64 caractères hexadécimaux (32 octets).
fn valider_cle(cle: &str) -> Result<(), CmdError> {
    if cle.len() == 64 && cle.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(CmdError::Interne(
            "clé de chiffrement invalide : 64 caractères hexadécimaux attendus (32 octets)."
                .to_string(),
        ))
    }
}
