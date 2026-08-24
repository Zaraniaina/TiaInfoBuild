import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { Entreprise } from '@/types'

export function SuperAdminEntreprisesPage() {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    abonnement: 'pro',
    devise: 'MGA',
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchEntreprises = () => {
    setLoading(true)
    api.get<Entreprise[]>('/super-admin/entreprises')
      .then(res => setEntreprises(res.data))
      .catch(() => {
        setEntreprises([
          { id: 1, nom: 'BTP PRO MADAGASCAR SARL', email: 'contact@btppro.mg', abonnement: 'premium', actif: true, date_creation: '2026-01-15', created_at: '', updated_at: '', devise: 'MGA', prefixe_devis: 'DEV', prefixe_facture: 'FAC', prefixe_contrat: 'CTR', tva_defaut: 20, delai_paiement_defaut: 30, validite_devis: 30 },
          { id: 2, nom: 'SOMAPROC MADAGASCAR', email: 'contact@somaproc.mg', abonnement: 'pro', actif: true, date_creation: '2026-02-01', created_at: '', updated_at: '', devise: 'MGA', prefixe_devis: 'DEV', prefixe_facture: 'FAC', prefixe_contrat: 'CTR', tva_defaut: 20, delai_paiement_defaut: 30, validite_devis: 30 }
        ])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchEntreprises()
  }, [])

  const handleToggle = async (id: number) => {
    try {
      await api.post(`/super-admin/entreprises/${id}/desactiver`)
      setEntreprises(prev => prev.map(e => e.id === id ? { ...e, actif: !e.actif } : e))
    } catch {
      alert('Erreur lors du changement de statut')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/super-admin/entreprises', formData)
      setShowModal(false)
      setFormData({ nom: '', email: '', telephone: '', adresse: '', abonnement: 'pro', devise: 'MGA' })
      fetchEntreprises()
    } catch {
      alert('Erreur lors de la création de l\'entreprise')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = entreprises.filter(e =>
    e.nom.toLowerCase().includes(search.toLowerCase()) ||
    (e.email && e.email.toLowerCase().includes(search.toLowerCase()))
  )

  const getPlanBadge = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'premium': return 'bg-primary'
      case 'pro': return 'bg-success'
      case 'enterprise': return 'bg-dark'
      default: return 'bg-secondary'
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1"><i className="bi bi-buildings me-2 text-danger"></i>Entreprises Abonnées (Tenants)</h2>
          <p className="text-secondary mb-0">Gestion du parc des entreprises clientes et des souscriptions SaaS</p>
        </div>
        <button className="btn btn-danger fw-bold" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>Nouvelle Entreprise
        </button>
      </div>

      <div className="table-card mb-4">
        <div className="table-header">
          <div className="input-group" style={{ maxWidth: '400px' }}>
            <span className="input-group-text bg-light border-end-0"><i className="bi bi-search"></i></span>
            <input
              type="text"
              className="form-control border-start-0 bg-light"
              placeholder="Rechercher par nom ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="table-responsive">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Contact</th>
                <th>Plan</th>
                <th>Devise</th>
                <th>Statut</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td>
                    <div className="fw-semibold">{e.nom}</div>
                    <small className="text-muted">ID: #{e.id} | Créé le {e.date_creation || '—'}</small>
                  </td>
                  <td>
                    <div><i className="bi bi-envelope me-1 text-muted"></i>{e.email || '—'}</div>
                    {e.telephone && <small className="text-muted"><i className="bi bi-telephone me-1"></i>{e.telephone}</small>}
                  </td>
                  <td>
                    <span className={`badge ${getPlanBadge(e.abonnement)} text-uppercase px-2 py-1`}>
                      {e.abonnement}
                    </span>
                  </td>
                  <td><span className="badge bg-light text-dark border">{e.devise || 'MGA'}</span></td>
                  <td>
                    <span className={`badge ${e.actif ? 'bg-success' : 'bg-danger'}`}>
                      <i className={`bi ${e.actif ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
                      {e.actif ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="text-end">
                    <button
                      className={`btn btn-sm ${e.actif ? 'btn-outline-danger' : 'btn-outline-success'} fw-semibold`}
                      onClick={() => handleToggle(e.id)}
                    >
                      {e.actif ? 'Suspendre' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    Aucune entreprise trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création Entreprise */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold"><i className="bi bi-building-add me-2"></i>Créer une Entreprise Cliente</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nom de l'entreprise *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="Ex: MADAGASCAR BTP SARL"
                      value={formData.nom}
                      onChange={e => setFormData({ ...formData, nom: e.target.value })}
                    />
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Email de contact</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="contact@entreprise.mg"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Téléphone</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="034 00 000 00"
                        value={formData.telephone}
                        onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Formule Abonnement</label>
                      <select
                        className="form-select"
                        value={formData.abonnement}
                        onChange={e => setFormData({ ...formData, abonnement: e.target.value })}
                      >
                        <option value="gratuit">Gratuit (Essai)</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Devise Principale</label>
                      <select
                        className="form-select"
                        value={formData.devise}
                        onChange={e => setFormData({ ...formData, devise: e.target.value })}
                      >
                        <option value="MGA">MGA (Ariary)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-danger fw-bold" disabled={submitting}>
                    {submitting ? 'Création...' : 'Créer l\'Entreprise'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
