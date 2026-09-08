import { useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { ChantierTerrain } from '@/types'

const statutBadge: Record<string, string> = {
  planification: 'secondary', en_cours: 'success', suspendu: 'warning', termine: 'dark', annule: 'danger',
}

export function EmployeChantiersPage() {
  const [items, setItems] = useState<ChantierTerrain[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    employeTerrainService.getChantiers()
      .then(setItems)
      .catch(() => setErr('Impossible de charger vos chantiers'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (err) return <div className="alert alert-danger m-3">{err}</div>

  return (
    <div className="container-fluid py-3">
      <h5 className="mb-3"><i className="bi bi-cone-striped"></i> Mes chantiers</h5>
      {items.length === 0 ? <div className="text-muted">Aucun chantier affecté</div> : (
        <div className="row g-2">
          {items.map((c) => (
            <div key={c.id} className="col-12 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>{c.nom}</strong>
                      <div className="text-muted small">{c.numero}</div>
                    </div>
                    <span className={`badge ${statutBadge[c.statut] || 'bg-secondary'}`}>{c.statut}</span>
                  </div>
                  {c.adresse && <div className="text-muted small mt-1"><i className="bi bi-geo-alt"></i> {c.adresse}</div>}
                  {c.date_debut && <div className="text-muted small">Début : {c.date_debut}</div>}
                  {c.date_fin_prevue && <div className="text-muted small">Fin prévue : {c.date_fin_prevue}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
