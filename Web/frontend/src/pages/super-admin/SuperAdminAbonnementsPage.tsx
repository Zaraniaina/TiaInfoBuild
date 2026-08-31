import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function SuperAdminAbonnementsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/super-admin/abonnements')
      .then(res => setItems(res.data.items || res.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1 text-secondary"><i className="bi bi-credit-card me-2"></i>Abonnements & Plans</h2>
          <p className="text-secondary mb-0">Gestion des formules d'abonnement proposées aux entreprises clientes.</p>
        </div>
        <button className="btn btn-outline-secondary fw-bold" onClick={() => alert('Création de plan disponible prochainement')}><i className="bi bi-plus-circle me-2"></i>Nouveau Plan</button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-secondary" role="status"></div></div>
      ) : (
        <div className="row g-4">
          {items.map(plan => (
            <div key={plan.id} className="col-md-4">
              <div className="kpi-card border-0 shadow-sm h-100">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="kpi-label text-secondary">Plan {plan.nom}</div>
                     <div className="kpi-value text-secondary">{plan.prix?.toLocaleString()} MGA</div>
                    <div className="kpi-context text-muted">/ mois</div>
                  </div>
                  <span className={`badge ${plan.actif ? 'bg-success bg-opacity-10 text-success border' : 'bg-secondary bg-opacity-10 text-dark border'}`}>{plan.actif ? 'Actif' : 'Inactif'}</span>
                </div>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="badge bg-light text-dark border">{plan.utilisateurs_max} utilisateurs</span>
                  <span className="badge bg-light text-dark border">{plan.chantiers_max} chantiers</span>
                  <span className="badge bg-light text-dark border">{plan.stockage_go} Go</span>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-secondary flex-grow-1" onClick={() => alert('Modification de plan disponible prochainement')}>Modifier</button>
                  <button className={`btn btn-sm ${plan.actif ? 'btn-outline-danger' : 'btn-outline-success'} flex-grow-1`} onClick={() => alert('Activation / Désactivation disponible prochainement')}>
                    {plan.actif ? 'Désactiver' : 'Activer'}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="col-12 text-center py-5 text-muted">Aucun abonnement enregistré.</div>
          )}
        </div>
      )}
    </div>
  )
}
