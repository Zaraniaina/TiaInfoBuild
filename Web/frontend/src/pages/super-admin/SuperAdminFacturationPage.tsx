import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function SuperAdminFacturationPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/super-admin/facturation')
      .then(res => setItems(res.data.items || res.data || []))
      // Pas de données factices : on n'affiche que les factures réellement retournées par le backend.
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'paye': return <span className="badge bg-success">Payé</span>
      case 'en_attente': return <span className="badge bg-warning text-dark">En attente</span>
      case 'en_retard': return <span className="badge bg-danger">En retard</span>
      default: return <span className="badge bg-secondary">{statut}</span>
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1"><i className="bi bi-receipt me-2 text-danger"></i>Facturation SaaS</h2>
          <p className="text-secondary mb-0">Suivi des paiements d'abonnement par entreprise cliente.</p>
        </div>
        <button className="btn btn-outline-danger fw-bold"><i className="bi bi-download me-2"></i>Exporter</button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-danger" role="status"></div></div>
      ) : (
        <div className="table-card">
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Échéance</th>
                  <th>Paiement</th>
                  <th>Moyen</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="fw-semibold">{item.entreprise}</td>
                    <td className="font-monospace">{item.montant?.toLocaleString()} MGA</td>
                    <td>{getStatutBadge(item.statut)}</td>
                    <td className="text-muted">{item.date_echeance}</td>
                    <td className="text-muted">{item.date_paiement || '—'}</td>
                    <td><span className="badge bg-light text-dark border">{item.moyen}</span></td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">Aucune facture.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
