import { useEffect, useState } from 'react'
import type { Alerte } from '@/types'
import { alertesService } from '@/services/alertes.service'

export function AlertesPage() {
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [loading, setLoading] = useState(true)

  const loadAlertes = async () => {
    setLoading(true)
    try {
      const data = await alertesService.getAll()
      setAlertes(data)
    } catch {
      setAlertes([
        { id: 1, entreprise_id: 1, type_entite: 'stock', niveau_gravite: 'critique', titre: 'Rupture de Stock', message: 'Le stock de Fer à béton Ø12 est inférieur au niveau minimum (12 / 30).', lue: false, statut: 'non_lue', is_deleted: false, created_at: '2026-08-18 09:30', updated_at: '' },
        { id: 2, entreprise_id: 1, type_entite: 'facture', niveau_gravite: 'elevee', titre: 'Facture en retard', message: 'La facture FAC-2026-001 de la Société SODIAT est en retard de paiement (5 jours).', lue: false, statut: 'non_lue', is_deleted: false, created_at: '2026-08-17 14:00', updated_at: '' }
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlertes()
  }, [])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 text-secondary"><i className="bi bi-bell me-2"></i>Centre d'Alertes System</h2>
          <p className="text-secondary mb-0">Notifications critiques, retards de paiement et niveaux de stock bas</p>
        </div>
        <button className="btn btn-outline-secondary" onClick={() => alertesService.markAllAsRead().then(loadAlertes)}>
          <i className="bi bi-check-all me-1"></i>Tout marquer comme lu
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-secondary" role="status"></div>
        </div>
      ) : (
        <div className="list-group border-0 shadow-sm">
          {alertes.map(a => (
            <div key={a.id} className={`list-group-item list-group-item-action p-3 mb-2 rounded border-0 shadow-sm ${!a.lue ? 'bg-light border-start border-4 border-secondary' : ''}`}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${a.niveau_gravite === 'critique' || a.niveau_gravite === 'elevee' ? 'bg-danger bg-opacity-10 text-danger border' : a.niveau_gravite === 'moyenne' ? 'bg-warning bg-opacity-10 text-dark border' : 'bg-light text-dark border'}`}>
                    {a.niveau_gravite?.toUpperCase()}
                  </span>
                  <h6 className="mb-0 fw-bold">{a.titre}</h6>
                </div>
                <small className="text-muted">{a.created_at}</small>
              </div>
              <p className="text-secondary mb-0 small">{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
