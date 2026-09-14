import { useCallback, useEffect, useState } from 'react'
import type { RapportPaie } from '@/types'
import { rhService } from '@/services/rh.service'
import { TableSkeleton } from '@/components/ui/Skeleton'

const MODE_LABELS: Record<string, string> = {
  mensuel: 'Mensuel',
  journalier: 'Journalier',
  horaire: 'Horaire',
  a_la_tache: 'À la tâche',
}

const formaterAriary = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' Ar'

export function RhPaieTab() {
  const now = new Date()
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [rapport, setRapport] = useState<RapportPaie | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await rhService.getPaie(mois, annee)
      setRapport(data)
    } catch {
      setErr('Impossible de charger le rapport de paie.')
      setRapport(null)
    } finally {
      setLoading(false)
    }
  }, [mois, annee])

  useEffect(() => {
    load()
  }, [load])

  const moisSuivant = () => {
    if (mois === 12) { setMois(1); setAnnee(annee + 1) } else { setMois(mois + 1) }
  }
  const moisPrecedent = () => {
    if (mois === 1) { setMois(12); setAnnee(annee - 1) } else { setMois(mois - 1) }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={moisPrecedent}><i className="bi bi-chevron-left"></i></button>
          <span className="fw-bold px-2">{mois} / {annee}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={moisSuivant}><i className="bi bi-chevron-right"></i></button>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise"></i></button>
          <button className="btn btn-outline-secondary fw-bold" onClick={() => rhService.exportPaie(mois, annee)}>
            <i className="bi bi-download me-2"></i>Exporter CSV
          </button>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {loading ? (
        <div className="card border-0 shadow-sm p-3"><TableSkeleton rows={8} columns={6} /></div>
      ) : !rapport || rapport.lignes.length === 0 ? (
        <div className="card border-0 shadow-sm p-4 text-center text-muted">
          Aucune donnée de paie pour {mois}/{annee}
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Employé</th>
                  <th>Mode</th>
                  <th className="d-none d-md-table-cell">Jours validés</th>
                  <th className="d-none d-md-table-cell">Heures sup.</th>
                  <th className="text-end">Brut (Ar)</th>
                </tr>
              </thead>
              <tbody>
                {rapport.lignes.map((l) => (
                  <tr key={l.employe_id}>
                    <td className="fw-semibold">{l.prenom || ''} {l.nom}</td>
                    <td>{MODE_LABELS[l.mode_remuneration] || l.mode_remuneration}</td>
                    <td className="d-none d-md-table-cell font-monospace">{l.jours_valides}</td>
                    <td className="d-none d-md-table-cell font-monospace">{l.heures_sup}h</td>
                    <td className="text-end font-monospace fw-semibold">{formaterAriary(l.brut)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <td colSpan={4} className="text-end fw-bold">TOTAL</td>
                  <td className="text-end font-monospace fw-bold">{formaterAriary(rapport.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}