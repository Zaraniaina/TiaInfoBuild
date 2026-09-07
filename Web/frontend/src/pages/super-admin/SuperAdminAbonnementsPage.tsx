import { useEffect, useState } from 'react'
import { subscriptionsService } from '@/services/subscriptions.service'
import type { Plan, SubscriptionWithPlan } from '@/types'

export function SuperAdminAbonnementsPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [planForm, setPlanForm] = useState<Partial<Plan>>({})
  const [saving, setSaving] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  const [subForm, setSubForm] = useState({ entreprise_id: '', plan_id: '', periode: 'mensuel', statut: 'actif' })
  const [subSaving, setSubSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [plansData, subsData] = await Promise.all([
        subscriptionsService.getAdminPlans(),
        subscriptionsService.getSubscriptions(),
      ])
      setPlans(plansData)
      setSubscriptions(subsData)
    } catch {
      setPlans([])
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreatePlan = () => {
    setEditingPlan(null)
    setPlanForm({ nom: '', code: '', description: '', prix_mensuel: 0, prix_annuel: 0, utilisateurs_max: 5, chantiers_max: 3, stockage_go: 5, duree_essai_jours: 30, actif: true })
    setShowPlanModal(true)
  }

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan)
    setPlanForm({ ...plan })
    setShowPlanModal(true)
  }

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingPlan) {
        await subscriptionsService.updatePlan(editingPlan.id, planForm)
      } else {
        await subscriptionsService.createPlan(planForm as Plan)
      }
      setShowPlanModal(false)
      loadData()
    } catch {
      alert('Erreur lors de l\'enregistrement du plan.')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePlan = async (plan: Plan) => {
    try {
      await subscriptionsService.togglePlan(plan.id)
      loadData()
    } catch {
      alert('Erreur lors de la modification du plan.')
    }
  }

  const handleDeletePlan = async (plan: Plan) => {
    if (!confirm(`Supprimer le plan "${plan.nom}" ?`)) return
    try {
      await subscriptionsService.deletePlan(plan.id)
      loadData()
    } catch {
      alert('Erreur lors de la suppression du plan.')
    }
  }

  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubSaving(true)
    try {
      await subscriptionsService.createAdminSubscription({
        entreprise_id: Number(subForm.entreprise_id),
        plan_id: Number(subForm.plan_id),
        periode: subForm.periode as 'mensuel' | 'annuel',
        statut: subForm.statut as any,
      })
      setShowSubModal(false)
      setSubForm({ entreprise_id: '', plan_id: '', periode: 'mensuel', statut: 'actif' })
      loadData()
    } catch {
      alert('Erreur lors de la création de l\'abonnement.')
    } finally {
      setSubSaving(false)
    }
  }

  const handleCancelSub = async (sub: SubscriptionWithPlan) => {
    if (!confirm('Annuler cet abonnement ?')) return
    try {
      await subscriptionsService.cancelSubscription(sub.id)
      loadData()
    } catch {
      alert('Erreur lors de l\'annulation.')
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1 text-secondary"><i className="bi bi-credit-card me-2"></i>Abonnements & Plans</h2>
          <p className="text-secondary mb-0">Gestion des formules d'abonnement proposées aux entreprises clientes.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary fw-bold" onClick={() => setShowSubModal(true)}><i className="bi bi-plus-circle me-2"></i>Nouvel Abonnement</button>
          <button className="btn btn-outline-secondary fw-bold" onClick={openCreatePlan}><i className="bi bi-plus-circle me-2"></i>Nouveau Plan</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-secondary" role="status"></div></div>
      ) : (
        <>
          <div className="row g-4 mb-5">
            {plans.map(plan => (
              <div key={plan.id} className="col-md-6 col-lg-4">
                <div className={`card border-0 shadow-sm h-100 ${plan.code === 'pro' ? 'border-primary border-2' : ''}`}>
                  {plan.code === 'pro' && (
                    <div className="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-primary"><i className="bi bi-star-fill"></i> Plus populaire</div>
                  )}
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="fw-bold mb-0">{plan.nom}</h5>
                      <span className={`badge ${plan.actif ? 'bg-success bg-opacity-10 text-success border' : 'bg-secondary bg-opacity-10 text-dark border'}`}>{plan.actif ? 'Actif' : 'Inactif'}</span>
                    </div>
                    <p className="text-muted small mb-3">{plan.description}</p>
                    <div className="mb-3">
                      <span className="fw-bold text-secondary">
                        {plan.prix_mensuel === 0 && plan.prix_annuel === 0 ? 'Sur devis' : `${plan.prix_mensuel.toLocaleString()} Ar/mois`}
                      </span>
                      {plan.prix_annuel > 0 && <small className="text-muted ms-2">/ {plan.prix_annuel.toLocaleString()} Ar/an</small>}
                    </div>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <span className="badge bg-light text-dark border">{plan.utilisateurs_max} utilisateurs</span>
                      <span className="badge bg-light text-dark border">{plan.chantiers_max} chantiers</span>
                      <span className="badge bg-light text-dark border">{plan.stockage_go} Go</span>
                    </div>
                    <div className="d-flex gap-2 mt-auto">
                      <button className="btn btn-sm btn-outline-secondary flex-grow-1" onClick={() => openEditPlan(plan)}><i className="bi bi-pencil"></i> Modifier</button>
                      <button className={`btn btn-sm ${plan.actif ? 'btn-outline-danger' : 'btn-outline-success'} flex-grow-1`} onClick={() => handleTogglePlan(plan)}>
                        {plan.actif ? 'Désactiver' : 'Activer'}
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => handleDeletePlan(plan)}><i className="bi bi-trash"></i></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h5 className="fw-bold mb-3 text-secondary"><i className="bi bi-diagram-3 me-2"></i>Abonnements actifs</h5>
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Entreprise</th>
                    <th>Plan</th>
                    <th>Période</th>
                    <th>Statut</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(sub => (
                    <tr key={sub.id}>
                      <td className="font-monospace">{sub.id}</td>
                      <td className="fw-semibold">Entreprise #{sub.entreprise_id}</td>
                      <td>{sub.plan?.nom || `Plan #${sub.plan_id}`}</td>
                      <td className="text-capitalize">{sub.periode || 'mensuel'}</td>
                      <td>
                        <span className={`badge ${sub.statut === 'actif' ? 'bg-success bg-opacity-10 text-success border' : sub.statut === 'essai' ? 'bg-info bg-opacity-10 text-info border' : 'bg-secondary bg-opacity-10 text-dark border'}`}>
                          {sub.statut}
                        </span>
                      </td>
                      <td className="small">{sub.date_debut ? new Date(sub.date_debut).toLocaleDateString() : '-'}</td>
                      <td className="small">{sub.date_fin ? new Date(sub.date_fin).toLocaleDateString() : '-'}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => handleCancelSub(sub)}>Annuler</button>
                      </td>
                    </tr>
                  ))}
                  {subscriptions.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-4 text-muted">Aucun abonnement enregistré.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showPlanModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{editingPlan ? 'Éditer le Plan' : 'Nouveau Plan'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPlanModal(false)}></button>
              </div>
              <form onSubmit={handleSavePlan}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Nom *</label>
                      <input className="form-control" required value={planForm.nom || ''} onChange={e => setPlanForm({ ...planForm, nom: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Code *</label>
                      <input className="form-control font-monospace" required value={planForm.code || ''} onChange={e => setPlanForm({ ...planForm, code: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea className="form-control" rows={2} value={planForm.description || ''} onChange={e => setPlanForm({ ...planForm, description: e.target.value })}></textarea>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Prix Mensuel (Ar) *</label>
                      <input type="number" className="form-control font-monospace" required value={planForm.prix_mensuel || 0} onChange={e => setPlanForm({ ...planForm, prix_mensuel: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Prix Annuel (Ar) *</label>
                      <input type="number" className="form-control font-monospace" required value={planForm.prix_annuel || 0} onChange={e => setPlanForm({ ...planForm, prix_annuel: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Utilisateurs Max</label>
                      <input type="number" className="form-control font-monospace" value={planForm.utilisateurs_max || 5} onChange={e => setPlanForm({ ...planForm, utilisateurs_max: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Chantiers Max</label>
                      <input type="number" className="form-control font-monospace" value={planForm.chantiers_max || 3} onChange={e => setPlanForm({ ...planForm, chantiers_max: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Stockage (Go)</label>
                      <input type="number" className="form-control font-monospace" value={planForm.stockage_go || 5} onChange={e => setPlanForm({ ...planForm, stockage_go: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Durée Essai (jours)</label>
                      <input type="number" className="form-control font-monospace" value={planForm.duree_essai_jours || 30} onChange={e => setPlanForm({ ...planForm, duree_essai_jours: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6 d-flex align-items-center">
                      <div className="form-check mt-4">
                        <input className="form-check-input" type="checkbox" checked={planForm.actif ?? true} onChange={e => setPlanForm({ ...planForm, actif: e.target.checked })} />
                        <label className="form-check-label">Plan actif</label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPlanModal(false)} disabled={saving}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showPlanModal && <div className="modal-backdrop fade show" onClick={() => setShowPlanModal(false)}></div>}

      {showSubModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Nouvel Abonnement</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowSubModal(false)}></button>
              </div>
              <form onSubmit={handleCreateSub}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Entreprise ID *</label>
                    <input type="number" className="form-control font-monospace" required value={subForm.entreprise_id} onChange={e => setSubForm({ ...subForm, entreprise_id: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Plan *</label>
                    <select className="form-select" value={subForm.plan_id} onChange={e => setSubForm({ ...subForm, plan_id: e.target.value })}>
                      <option value="">Sélectionner un plan</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Période</label>
                    <select className="form-select" value={subForm.periode} onChange={e => setSubForm({ ...subForm, periode: e.target.value })}>
                      <option value="mensuel">Mensuel</option>
                      <option value="annuel">Annuel</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Statut</label>
                    <select className="form-select" value={subForm.statut} onChange={e => setSubForm({ ...subForm, statut: e.target.value })}>
                      <option value="actif">Actif</option>
                      <option value="essai">Essai</option>
                      <option value="suspendu">Suspendu</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowSubModal(false)} disabled={subSaving}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold" disabled={subSaving}>{subSaving ? 'Enregistrement...' : 'Créer'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showSubModal && <div className="modal-backdrop fade show" onClick={() => setShowSubModal(false)}></div>}
    </div>
  )
}
