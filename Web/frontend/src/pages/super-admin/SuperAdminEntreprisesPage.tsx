import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { Entreprise } from '@/types'

export function SuperAdminEntreprisesPage() {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Entreprise[]>('/super-admin/entreprises')
      .then(res => setEntreprises(res.data))
      .catch(() => {
        setEntreprises([
          { id: 1, nom: 'TIA INFO BUILD SARL', email: 'admin@tia.mg', abonnement: 'premium', actif: true, date_creation: '2026-01-01', created_at: '', updated_at: '', devise: 'MGA', prefixe_devis: 'DEV', prefixe_facture: 'FAC', prefixe_contrat: 'CTR', tva_defaut: 20, delai_paiement_defaut: 30, validite_devis: 30 }
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2><i className="bi bi-buildings me-2 text-danger"></i>Gestion des Entreprises Clientes</h2>
        <button className="btn btn-danger"><i className="bi bi-plus-circle me-2"></i>Nouvelle Entreprise</button>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status"></div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nom Entreprise</th>
                  <th>Email</th>
                  <th>Abonnement</th>
                  <th>Statut</th>
                  <th>Date Création</th>
                </tr>
              </thead>
              <tbody>
                {entreprises.map(e => (
                  <tr key={e.id}>
                    <td className="fw-bold">{e.nom}</td>
                    <td>{e.email || '—'}</td>
                    <td><span className="badge bg-primary text-uppercase">{e.abonnement}</span></td>
                    <td><span className={`badge ${e.actif ? 'bg-success' : 'bg-secondary'}`}>{e.actif ? 'Actif' : 'Inactif'}</span></td>
                    <td>{e.date_creation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
