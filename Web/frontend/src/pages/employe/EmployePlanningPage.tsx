import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'

export function EmployePlanningPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    employeTerrainService.getPlanning()
      .then(setItems)
      .catch(() => setErr('Impossible de charger le planning'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3"><i className="bi bi-calendar-week"></i> Mon planning</h5>
      {items.length === 0 ? <div className="text-muted">Aucune activité planifiée</div> : (
        <div className="list-group">
          {items.map((p, i) => (
            <div key={i} className="list-group-item">
              <div className="d-flex justify-content-between">
                <div>
                  <strong>{p.titre || p.description || 'Activité'}</strong>
                  {p.chantier && <div className="text-muted small"><i className="bi bi-geo-alt"></i> {p.chantier}</div>}
                  {p.date_prevue && <div className="text-muted small"><i className="bi bi-calendar-week"></i> {p.date_prevue}</div>}
                </div>
                {p.statut && <span className="badge bg-secondary">{p.statut}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
