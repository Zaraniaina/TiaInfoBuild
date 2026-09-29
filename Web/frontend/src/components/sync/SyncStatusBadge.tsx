import { useCallback, useEffect, useRef, useState } from 'react'
import { isDesktop, isDesktopBuild } from '@/utils/buildMode'
import { apiLocaleUrl, redirectionSidecarActivee } from '@/services/sidecar'
import {
  dbQuery,
  getSyncStatus,
  syncNow,
  type SyncRunResult,
  type SyncStatusResult,
} from '@/services/desktopClient'

interface LigneJournal {
  cle: string
  texte: string
}

const STATUT_INITIAL: SyncStatusResult = {
  online: true,
  pending: 0,
  last_sync_at: null,
  conflicts: 0,
}

/** Extrait « HH:MM » d'un horodatage ISO. */
function heureCourte(valeur: string | null): string | null {
  if (!valeur) return null
  const m = /T(\d{2}:\d{2})/.exec(valeur)
  if (m) return m[1]
  const d = new Date(valeur)
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return null
}

/**
 * Badge d'état de synchronisation (desktop uniquement) dans le Topbar.
 * Pastille : verte « Synchronisé hh:mm », orange « N en attente », grise
 * « Hors-ligne », rouge « Conflits (n) ». Clic → panneau avec synchronisation
 * manuelle + lecture seule de `_sync_outbox` / `_sync_conflicts`.
 */
export function SyncStatusBadge() {
  const [statut, setStatut] = useState<SyncStatusResult>(STATUT_INITIAL)
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [dernierCycle, setDernierCycle] = useState<SyncRunResult | null>(null)
  const [journalOuvert, setJournalOuvert] = useState(false)
  const [file, setFile] = useState<LigneJournal[]>([])
  const [conflits, setConflits] = useState<LigneJournal[]>([])
  const [journalErreur, setJournalErreur] = useState<string | null>(null)
  const [apiLocale, setApiLocale] = useState<string | null | 'sonde'>(null)
  const conteneurRef = useRef<HTMLDivElement>(null)

  const rafraichir = useCallback(async () => {
    if (!isDesktop()) return
    try {
      const s = await getSyncStatus()
      setStatut({
        online: !!s.online,
        pending: Number(s.pending ?? 0),
        last_sync_at: s.last_sync_at ?? null,
        conflicts: Number(s.conflicts ?? 0),
      })
    } catch (err) {
      // Couche sync indisponible : on considère l'appareil hors-ligne.
      console.warn('[sync] Statut de synchronisation indisponible :', err)
      setStatut((prev) => ({ ...prev, online: false }))
    }
  }, [])

  // Polling 30 s + au focus de la fenêtre.
  useEffect(() => {
    if (!isDesktopBuild()) return
    void rafraichir()
    const minuterie = setInterval(() => void rafraichir(), 30_000)
    const onFocus = () => void rafraichir()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(minuterie)
      window.removeEventListener('focus', onFocus)
    }
  }, [rafraichir])

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return
    const onClickOutside = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [ouvert])

  if (!isDesktopBuild() || !isDesktop()) return null

  const synchroniser = async () => {
    setEnCours(true)
    setDernierCycle(null)
    try {
      const resultat = await syncNow()
      setDernierCycle(resultat)
      await rafraichir()
    } catch (err) {
      setDernierCycle({ pushed: 0, pulled: 0, conflicts: 0, error: String(err) })
    } finally {
      setEnCours(false)
    }
  }

  // Diagnostic sidecar (API locale `tia-api.exe`) : état de préparation
  // revérifié à chaque ouverture du menu (le démarrage prend plusieurs
  // dizaines de secondes : extraction onefile + uvicorn).
  const sonderApiLocale = useCallback(async () => {
    if (!isDesktop()) return
    setApiLocale('sonde')
    setApiLocale((await apiLocaleUrl()) ?? null)
  }, [])

  const chargerJournal = async () => {
    const ouvrir = !journalOuvert
    setJournalOuvert(ouvrir)
    if (!ouvrir) return
    try {
      const outbox = await dbQuery(
        'SELECT seq, entity, op, client_ts, pushed FROM _sync_outbox ORDER BY seq DESC LIMIT 20',
      )
      setFile(
        outbox.map((r) => ({
          cle: `outbox-${String(r.seq)}`,
          texte: `#${String(r.seq)} ${String(r.entity)} (${String(r.op)}) — ${String(r.client_ts ?? '')}${r.pushed === 1 ? ' ✓' : ' ⏳'}`,
        })),
      )
      const journals = await dbQuery(
        'SELECT id, entity, entity_id, resolved_at FROM _sync_conflicts ORDER BY id DESC LIMIT 20',
      )
      setConflits(
        journals.map((r) => ({
          cle: `conflit-${String(r.id)}`,
          texte: `${String(r.entity)} #${String(r.entity_id)} — ${r.resolved_at ? String(r.resolved_at) : 'non résolu'}`,
        })),
      )
      setJournalErreur(null)
    } catch (err) {
      console.warn('[sync] Lecture du journal de synchronisation impossible :', err)
      setJournalErreur('Journal de synchronisation indisponible pour le moment.')
    }
  }

  // Pastille : conflit > hors-ligne > en attente > synchronisé.
  let classe = 'bg-success'
  let icone = 'bi-check2-circle'
  let libelle: string
  if (statut.conflicts > 0) {
    classe = 'bg-danger'
    icone = 'bi-exclamation-octagon'
    libelle = `Conflits (${statut.conflicts})`
  } else if (!statut.online) {
    classe = 'bg-secondary'
    icone = 'bi-cloud-slash'
    libelle = 'Hors-ligne'
  } else if (statut.pending > 0) {
    classe = 'bg-warning text-dark'
    icone = 'bi-hourglass-split'
    libelle = `${statut.pending} en attente`
  } else {
    const heure = heureCourte(statut.last_sync_at)
    libelle = heure ? `Synchronisé ${heure}` : 'Synchronisé'
  }

  const dernierCycleAffiche = dernierCycle
    ? `Envoyé ${dernierCycle.pushed} · Reçu ${dernierCycle.pulled} · Conflits ${dernierCycle.conflicts}`
    : null

  return (
    <div ref={conteneurRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-link sync-status-btn"
        onClick={() => {
          setOuvert((v) => !v)
          void sonderApiLocale()
        }}
        aria-label="État de la synchronisation"
        aria-expanded={ouvert}
        title="Synchronisation des données"
      >
        <span className={`badge rounded-pill d-inline-flex align-items-center gap-1 ${classe}`}>
          <i className={`bi ${icone}`} aria-hidden="true"></i>
          {libelle}
        </span>
      </button>

      {ouvert && (
        <div
          className="dropdown-menu dropdown-menu-end show shadow border-0"
          style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1050, minWidth: 290 }}
        >
          <div className="dropdown-header fw-bold">
            <i className="bi bi-arrow-repeat me-2 text-primary"></i>Synchronisation
          </div>
          <div className="px-3 pb-2 small">
            <div className="d-flex justify-content-between">
              <span className="text-muted">État</span>
              <span className="fw-semibold">{statut.online ? 'En ligne' : 'Hors-ligne'}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">En attente</span>
              <span className="fw-semibold">{statut.pending}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Dernière synchro</span>
              <span className="fw-semibold">{heureCourte(statut.last_sync_at) ?? '—'}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Conflits</span>
              <span className="fw-semibold">{statut.conflicts}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span
                className="text-muted"
                title="Backend FastAPI embarqué (tia-api.exe) — API locale offline"
              >
                API locale
              </span>
              <span
                className={
                  apiLocale && apiLocale !== 'sonde'
                    ? 'fw-semibold text-success'
                    : 'fw-semibold'
                }
              >
                {apiLocale === 'sonde' ? 'Vérification…' : apiLocale ? 'Prête' : 'Indisponible'}
              </span>
            </div>
          </div>

          {redirectionSidecarActivee() && (
            <div className="mx-3 mb-2 small text-muted border-top pt-2">
              <i className="bi bi-flask me-1" aria-hidden="true"></i>
              Expérimental : UI pilotée par l'API locale
              {apiLocale && apiLocale !== 'sonde' ? ` — ${apiLocale}` : ''}
            </div>
          )}

          <button
            type="button"
            className="dropdown-item"
            onClick={() => void sonderApiLocale()}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>Revérifier l'API locale
          </button>

          {dernierCycleAffiche && (
            <div className="mx-3 mb-2 small text-muted border-top pt-2">{dernierCycleAffiche}</div>
          )}
          {dernierCycle?.error && (
            <div className="mx-3 mb-2 small text-danger">
              <i className="bi bi-exclamation-triangle me-1"></i>
              Échec : {dernierCycle.error}
            </div>
          )}

          <button type="button" className="dropdown-item" onClick={() => void synchroniser()} disabled={enCours}>
            {enCours ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                Synchronisation...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-repeat me-2"></i>Synchroniser maintenant
              </>
            )}
          </button>
          <button type="button" className="dropdown-item text-muted" onClick={() => void chargerJournal()}>
            <i className="bi bi-journal-text me-2"></i>
            {journalOuvert ? 'Masquer les conflits' : 'Voir les conflits'}
          </button>

          {journalOuvert && (
            <div className="border-top px-3 py-2 small" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {journalErreur && <div className="text-warning mb-1">{journalErreur}</div>}
              <div className="fw-semibold text-muted text-uppercase" style={{ fontSize: '0.7rem' }}>
                File d'attente (_sync_outbox)
              </div>
              {file.length === 0 ? (
                <div className="text-muted">Aucune opération en attente.</div>
              ) : (
                file.map((l) => <div key={l.cle} className="text-truncate" title={l.texte}>{l.texte}</div>)
              )}
              <div className="fw-semibold text-muted text-uppercase mt-2" style={{ fontSize: '0.7rem' }}>
                Journal des conflits (_sync_conflicts)
              </div>
              {conflits.length === 0 ? (
                <div className="text-muted">Aucun conflit journalisé.</div>
              ) : (
                conflits.map((l) => <div key={l.cle} className="text-truncate" title={l.texte}>{l.texte}</div>)
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
