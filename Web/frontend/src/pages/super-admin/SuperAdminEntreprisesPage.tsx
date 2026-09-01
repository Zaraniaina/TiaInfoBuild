import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import { subscriptionsService } from '@/services/subscriptions.service'
import type { Entreprise, Plan } from '@/types'

export function SuperAdminEntreprisesPage() {
  const navigate = useNavigate()
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedEntreprise, setSelectedEntreprise] = useState<Entreprise | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    abonnement: 'pro',
    devise: 'MGA',
    admin_nom: '',
    admin_prenom: '',
    admin_email: '',
    admin_password: '',
    admin_telephone: '',
  })

  const fetchEntreprises = () => {
    setLoading(true)
    api.get<Entreprise[]>('/super-admin/entreprises')
      .then(res => setEntreprises(res.data))
      .catch(() => setEntreprises([]))
      .finally(() => setLoading(false))
  }

  const fetchPlans = async () => {
    try {
      const data = await subscriptionsService.getAdminPlans()
      setPlans(data)
    } catch {
      setPlans([])
    }
  }

  useEffect(() => {
    fetchEntreprises()
    fetchPlans()
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
      setFormData({ nom: '', email: '', telephone: '', adresse: '', abonnement: 'pro', devise: 'MGA', admin_nom: '', admin_prenom: '', admin_email: '', admin_password: '', admin_telephone: '' })
      fetchEntreprises()
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la création de l'entreprise")
    } finally {
      setSubmitting(false)
    }
  }

  const openChangePlan = (entreprise: Entreprise) => {
    setSelectedEntreprise(entreprise)
    setSelectedPlanId('')
    setShowPlanModal(true)
  }

  const handleChangePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEntreprise || selectedPlanId === '') return
    setSubmitting(true)
    try {
      await subscriptionsService.createAdminSubscription({
        entreprise_id: selectedEntreprise.id,
        plan_id: Number(selectedPlanId),
        periode: 'mensuel',
        statut: 'actif',
      })
      setShowPlanModal(false)
      setSelectedEntreprise(null)
      setSelectedPlanId('')
      fetchEntreprises()
    } catch {
      alert('Erreur lors du changement de plan.')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = entreprises.filter(e =>
    e.nom.toLowerCase().includes(search.toLowerCase()) ||
    (e.email && e.email.toLowerCase().includes(search.toLowerCase()))
  )

  const getPlanBadge = (plan: string) => {
    const found = plans.find(p => p.code === plan.toLowerCase())
    if (!found) {
      switch (plan.toLowerCase()) {
        case 'premium': return 'bg-primary bg-opacity-10 text-primary border'
        case 'pro': return 'bg-success bg-opacity-10 text-success border'
        case 'enterprise': return 'bg-secondary bg-opacity-10 text-dark border'
        default: return 'bg-light text-dark border'
      }
    }
    return found.actif ? 'bg-success bg-opacity-10 text-success border' : 'bg-secondary bg-opacity-10 text-dark border'
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1"><i className="bi bi-buildings me-2 text-secondary"></i>Entreprises Abonnées (Tenants)</h2>
          <p className="text-secondary mb-0">Gestion du parc des entreprises clientes et des souscriptions SaaS</p>
        </div>
        <button className="btn btn-outline-secondary fw-bold" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>Nouvelle Entreprise
        </button>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
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
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
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
                    <span className={`badge ${e.actif ? 'bg-success bg-opacity-10 text-success border' : 'bg-danger bg-opacity-10 text-danger border'}`}>
                      <i className={`bi ${e.actif ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
                      {e.actif ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-1 justify-content-end">
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => openChangePlan(e)} title="Changer le plan">
                        <i className="bi bi-credit-card"></i>
                      </button>
                      <button
                        className={`btn btn-sm ${e.actif ? 'btn-outline-danger' : 'btn-outline-success'} fw-semibold`}
                        onClick={() => handleToggle(e.id)}
                      >
                        {e.actif ? 'Suspendre' : 'Réactiver'}
                      </button>
                    </div>
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

      {/* Modal Création Entreprise + Admin */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-secondary text-white">
                <h5 className="modal-title fw-bold"><i className="bi bi-building-add me-2"></i>Créer une Entreprise Cliente</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <h6 className="text-secondary mb-3">Informations entreprise</h6>
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
                      <label className="form-label fw-semibold">Adresse</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Adresse de l'entreprise"
                        value={formData.adresse}
                        onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                      />
                    </div>
                    <div className="col-md-3">
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
                    <div className="col-md-3">
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

                  <hr className="my-4" />
                  <h6 className="text-secondary mb-3">Administrateur de l'entreprise</h6>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Nom *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="Nom du responsable"
                        value={formData.admin_nom}
                        onChange={e => setFormData({ ...formData, admin_nom: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Prénom *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="Prénom du responsable"
                        value={formData.admin_prenom}
                        onChange={e => setFormData({ ...formData, admin_prenom: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Email admin *</label>
                      <input
                        type="email"
                        className="form-control"
                        required
                        placeholder="admin@entreprise.mg"
                        value={formData.admin_email}
                        onChange={e => setFormData({ ...formData, admin_email: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Téléphone admin</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="034 00 000 00"
                        value={formData.admin_telephone}
                        onChange={e => setFormData({ ...formData, admin_telephone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Mot de passe admin *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="Mot de passe initial (sera changé à la première connexion)"
                      value={formData.admin_password}
                      onChange={e => setFormData({ ...formData, admin_password: e.target.value })}
                    />
                    <div className="form-text">L'admin devra changer ce mot de passe à sa première connexion.</div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold" disabled={submitting}>
                    {submitting ? 'Création...' : 'Créer l\'Entreprise et son Admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showPlanModal && selectedEntreprise && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Changer le plan — {selectedEntreprise.nom}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPlanModal(false)}></button>
              </div>
              <form onSubmit={handleChangePlan}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nouveau Plan *</label>
                    <select className="form-select" value={selectedPlanId} onChange={e => setSelectedPlanId(Number(e.target.value))}>
                      <option value="">Sélectionner un plan</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.nom} — {p.prix_mensuel.toLocaleString()} Ar/mois</option>)}
                    </select>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPlanModal(false)} disabled={submitting}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Changer le plan'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showPlanModal && <div className="modal-backdrop fade show" onClick={() => setShowPlanModal(false)}></div>}
    </div>
  )
}
