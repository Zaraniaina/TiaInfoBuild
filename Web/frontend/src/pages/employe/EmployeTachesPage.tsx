import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { TacheTerrain } from '@/types'

const prioriteBadge: Record<string, string> = { basse: 'secondary', normale: 'info', haute: 'warning', urgente: 'danger' }
const statutBadge: Record<string, string> = { a_faire: 'secondary', en_cours: 'primary', terminee: 'success', bloquee: 'warning', annulee: 'danger' }

export function EmployeTachesPage() {
  const [items, setItems] = useState<TacheTerrain[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    employeTerrainService.getTaches()
      .then(setItems)
      .catch(() => setErr('Impossible de charger vos tâches'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const changerStatut = async (tache: TacheTerrain, nouveauStatut: string) => {
    try {
      await employeTerrainService.updateTacheStatut(tache.id, nouveauStatut)
      load()
    } catch { alert('Erreur lors de la mise à jour') }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3">📋 Mes tâches</h5>
      {items.length === 0 ? <div className="text-muted">Aucune tâche assignée</div> : (
        <div className="list-group">
          {items.map((t) => (
            <div key={t.id} className="list-group-item list-group-item-action">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <strong>{t.titre}</strong>
                  {t.ouvrage && <span className="text-muted ms-2 small">({t.ouvrage})</span>}
                  <div className="text-muted small">
                    {t.date_prevue && `Prévue : ${t.date_prevue}`}
                    {t.chantier_id && ` — Chantier #${t.chantier_id}`}
                  </div>
                  {t.description && <div className="small mt-1 text-secondary">{t.description}</div>}
                </div>
                <div className="text-end">
                  <span className={`badge ${prioriteBadge[t.priorite] || 'bg-secondary'} d-block mb-1`}>{t.priorite}</span>
                  <span className={`badge ${statutBadge[t.statut] || 'bg-secondary'}`}>{t.statut}</span>
                  {t.avancement_pct > 0 && <div className="small text-muted mt-1">{t.avancement_pct}%</div>}
                </div>
              </div>
              {t.statut !== 'terminee' && t.statut !== 'annulee' && (
                <div className="mt-2 d-flex gap-1 flex-wrap">
                  {t.statut === 'a_faire' && (
                    <button className="btn btn-sm btn-primary" onClick={() => changerStatut(t, 'en_cours')}>▶️ Commencer</button>
                  )}
                  {t.statut === 'en_cours' && (
                    <button className="btn btn-sm btn-success" onClick={() => changerStatut(t, 'terminee')}>✅ Terminer</button>
                  )}
                  {t.statut !== 'bloquee' && (
                    <button className="btn btn-sm btn-warning" onClick={() => changerStatut(t, 'bloquee')}>🚫 Bloquer</button>
                  )}
                  {t.statut === 'bloquee' && (
                    <button className="btn btn-sm btn-primary" onClick={() => changerStatut(t, 'en_cours')}>▶️ Reprendre</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
