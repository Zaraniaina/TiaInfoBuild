import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function SuperAdminAbonnementsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/super-admin/abonnements')
      .then(res => setItems(res.data.items || res.data || []))
      .catch(() => {
        setItems([
          { id: 1, nom: 'Pro', prix: 150000, utilisateurs_max: 10, chantiers_max: 5, stockage_go: 10, actif: true },
          { id: 2, nom: 'Premium', prix: 350000, utilisateurs_max: 25, chantiers_max: 15, stockage_go: 50, actif: true },
          { id: 3, nom: 'Enterprise', prix: 750000, utilisateurs_max: 999, chantiers_max: 999, stockage_go: 200, actif: true },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1"><i className="bi bi-credit-card me-2 text-danger"></i>Abonnements & Plans</h2>
          <p className="text-secondary mb-0">Gestion des formules d'abonnement proposées aux entreprises clientes.</p>
        </div>
        <button className="btn btn-danger fw-bold"><i className="bi bi-plus-circle me-2"></i>Nouveau Plan</button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-danger" role="status"></div></div>
      ) : (
        <div className="row g-4">
          {items.map(plan => (
            <div key={plan.id} className="col-md-4">
              <div className="kpi-card h-100">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="kpi-label">Plan {plan.nom}</div>
                    <div className="kpi-value text-primary">{plan.prix?.toLocaleString()} MGA</div>
                    <div className="kpi-context">/ mois</div>
                  </div>
                  <span className={`badge ${plan.actif ? 'bg-success' : 'bg-secondary'}`}>{plan.actif ? 'Actif' : 'Inactif'}</span>
                </div>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="badge bg-light text-dark border">{plan.utilisateurs_max} utilisateurs</span>
                  <span className="badge bg-light text-dark border">{plan.chantiers_max} chantiers</span>
                  <span className="badge bg-light text-dark border">{plan.stockage_go} Go</span>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-primary flex-grow-1">Modifier</button>
                  <button className={`btn btn-sm ${plan.actif ? 'btn-outline-danger' : 'btn-outline-success'} flex-grow-1`}>
                    {plan.actif ? 'Désactiver' : 'Activer'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
