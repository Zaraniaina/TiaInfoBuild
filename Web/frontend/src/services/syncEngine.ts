/**
 * Moteur de synchronisation desktop (plan §6.3) — démarrage UNIQUEMENT en mode
 * desktop : à l'amorce (`bootDesktop()`), toutes les 5 minutes, et à la reprise
 * du réseau (événement `online` du navigateur). Exécutions en tâche de fond,
 * silencieuses (erreurs loguées en français dans la console), jamais concurrentes
 * (mutex simple en mémoire).
 */
import { isDesktop } from '@/utils/buildMode'
import { bootDesktop, syncNow } from './desktopClient'

const INTERVALLE_SYNCHRO_MS = 5 * 60 * 1000

let demarre = false
let enCours = false
let minuterie: ReturnType<typeof setInterval> | null = null

/** Cycle de synchronisation mutualisé : une seule exécution à la fois. */
async function cycle(source: string): Promise<void> {
  if (enCours) {
    console.info(`[sync] Cycle déjà en cours (${source}) : exécution ignorée.`)
    return
  }
  enCours = true
  try {
    const resultat = await syncNow()
    if (resultat.error) {
      console.warn(`[sync] Synchronisation (${source}) terminée avec erreur :`, resultat.error)
    }
  } catch (err) {
    console.warn(`[sync] Échec de la synchronisation (${source}) :`, err)
  } finally {
    enCours = false
  }
}

function lorsReseauRetabli(): void {
  void cycle('reprise du réseau')
}

/** Démarre le moteur (no-op hors desktop ou si déjà démarré). */
export function startSyncEngine(): void {
  if (!isDesktop() || demarre) return
  demarre = true

  bootDesktop()
    .then(async (info) => {
      console.info(`[sync] Base locale prête : ${info.db_path} (schéma v${info.schema_version})`)
      await cycle('démarrage')
    })
    .catch((err) => {
      console.warn("[sync] Échec de l'amorçage de la base locale :", err)
    })

  minuterie = setInterval(() => {
    void cycle('minuterie 5 min')
  }, INTERVALLE_SYNCHRO_MS)

  window.addEventListener('online', lorsReseauRetabli)
}

/** Arrête le moteur (nettoyage d'effet React). */
export function stopSyncEngine(): void {
  if (!demarre) return
  demarre = false
  if (minuterie) {
    clearInterval(minuterie)
    minuterie = null
  }
  window.removeEventListener('online', lorsReseauRetabli)
}
