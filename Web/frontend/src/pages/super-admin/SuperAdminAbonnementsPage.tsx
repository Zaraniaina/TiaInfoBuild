import { useEffect, useState } from 'react'
import { subscriptionsService } from '@/services/subscriptions.service'
import type { Plan, SubscriptionWithPlan } from '@/types'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/stores/toast.store'

// Plans système : indestructibles (l'API renvoie 409, l'UI masque les actions).
const CODES_SYSTEME = ['essai', 'gratuit']

const getMessage = (err: unknown, fallback: string): string => {
  const detail = (err as { response?: { data?: { detail?: { message?: string } | string } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  return typeof detail === 'object' && detail?.message ? detail.message : fallback
}

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
  const { showToast } = useToast()

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
      showToast('error', 'Chargement impossible', 'Les plans et abonnements n\u2019ont pas pu \u00eatre charg\u00e9s. V\u00e9rifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreatePlan = () => {
    setEditingPlan(null)
    setPlanForm({ nom: '', code: '', description: '', prix_mensuel: 0, prix_annuel: 0, utilisateurs_max: 10, chantiers_max: 3, duree_essai_jours: 0, actif: true })
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
      // Code normalisé : minuscules, sans espaces (anti-doublon côté API aussi)
      const payload = {
        ...planForm,
        code: (planForm.code || '').trim().toLowerCase().replace(/\s+/g, '-'),
      }
      if (editingPlan) {
        await subscriptionsService.updatePlan(editingPlan.id, payload)
        showToast('success', 'Plan modifié', `« ${payload.nom} » a bien été mis à jour.`)
      } else {
        await subscriptionsService.createPlan(payload as Plan)
        showToast('success', 'Plan créé', `« ${payload.nom} » est désormais disponible sur /pricing.`)
      }
      setShowPlanModal(false)
      loadData()
    } catch (err: unknown) {
      showToast('error', 'Enregistrement impossible', getMessage(err, 'Erreur lors de l\u2019enregistrement du plan.'))
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePlan = async (plan: Plan) => {
    if (CODES_SYSTEME.includes(plan.code)) {
      showToast('warning', 'Plan système', `« ${plan.nom} » doit rester actif : il garantit l'essai gratuit et le filet de sécurité des entreprises.`)
      return
    }
    try {
      await subscriptionsService.togglePlan(plan.id)
      showToast('success', plan.actif ? 'Plan désactivé' : 'Plan activé', `« ${plan.nom} » est maintenant ${plan.actif ? 'masqué' : 'visible'} sur /pricing.`)
      loadData()
    } catch (err: unknown) {
      showToast('error', 'Action impossible', getMessage(err, 'Erreur lors de la modification du plan.'))
    }
  }

  const handleDeletePlan = async (plan: Plan) => {
    if (CODES_SYSTEME.includes(plan.code)) {
      showToast('warning', 'Plan système', `« ${plan.nom} » ne peut pas être supprimé : il est requis par le fonctionnement de la plateforme.`)
      return
    }
    if (!confirm(`Supprimer le plan "${plan.nom}" ? Les entreprises déjà abonnées ne seront pas affectées.`)) return
    try {
      await subscriptionsService.deletePlan(plan.id)
      showToast('success', 'Plan supprimé', `« ${plan.nom} » a été retiré du catalogue.`)
      loadData()
    } catch (err: unknown) {
      showToast('error', 'Suppression impossible', getMessage(err, 'Erreur lors de la suppression du plan.'))
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
        statut: subForm.statut as unknown as SubscriptionWithPlan['statut'],
      })
      setShowSubModal(false)
      setSubForm({ entreprise_id: '', plan_id: '', periode: 'mensuel', statut: 'actif' })
      showToast('success', 'Abonnement créé', 'L\u2019entreprise dispose maintenant de sa nouvelle formule.')
      loadData()
    } catch (err: unknown) {
      showToast('error', 'Création impossible', getMessage(err, 'Erreur lors de la création de l\u2019abonnement.'))
    } finally {
      setSubSaving(false)
    }
  }

  const handleCancelSub = async (sub: SubscriptionWithPlan) => {
    if (!confirm('Annuler cet abonnement ?')) return
    try {
      await subscriptionsService.cancelSubscription(sub.id)
      showToast('success', 'Abonnement annulé', `L'abonnement #${sub.id} a été annulé.`)
      loadData()
    } catch (err: unknown) {
      showToast('error', 'Annulation impossible', getMessage(err, 'Erreur lors de l\u2019annulation.'))
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
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <>
          <div className="row g-4 mb-5">
            {plans.map(plan => {
              const isSysteme = CODES_SYSTEME.includes(plan.code)
              return (
                <div key={plan.id} className="col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
                        <h5 className="fw-bold mb-0">{plan.nom}</h5>
                        <div className="d-flex gap-1 flex-shrink-0">
                          {isSysteme && <span className="badge bg-warning bg-opacity-10 text-warning-emphasis border" title="Plan requis par la plateforme">Système</span>}
                          <span className={`badge ${plan.actif ? 'bg-success bg-opacity-10 text-success border' : 'bg-secondary bg-opacity-10 text-dark border'}`}>{plan.actif ? 'Actif' : 'Inactif'}</span>
                        </div>
                      </div>
                      <p className="text-muted small mb-3">{plan.description}</p>
                      <div className="mb-3">
                        <span className="fw-bold text-secondary">
                          {plan.prix_mensuel === 0 && plan.prix_annuel === 0 ? 'Gratuit' : `${plan.prix_mensuel.toLocaleString()} Ar/mois`}
                        </span>
                        {plan.prix_annuel > 0 && <small className="text-muted ms-2">/ {plan.prix_annuel.toLocaleString()} Ar/an</small>}
                      </div>
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <span className="badge bg-light text-dark border">{plan.utilisateurs_max ?? 'Illimité'} employés</span>
                        <span className="badge bg-light text-dark border">{plan.chantiers_max ?? 'Illimités'} chantiers</span>
                        <span className="badge bg-light text-dark border">Clients illimités</span>
                      </div>
                      {plan.entreprises_actives != null && (
                        <p className="small text-secondary mb-3">
                          <i className="bi bi-buildings me-1"></i>
                          {plan.entreprises_actives} entreprise{plan.entreprises_actives > 1 ? 's' : ''} abonnée{plan.entreprises_actives > 1 ? 's' : ''}
                        </p>
                      )}
                      <div className="d-flex gap-2 mt-auto">
                        <button className="btn btn-sm btn-outline-secondary flex-grow-1" onClick={() => openEditPlan(plan)}><i className="bi bi-pencil"></i> Modifier</button>
                        {!isSysteme && (
                          <>
                            <button className={`btn btn-sm ${plan.actif ? 'btn-outline-danger' : 'btn-outline-success'} flex-grow-1`} onClick={() => handleTogglePlan(plan)}>
                              {plan.actif ? 'Désactiver' : 'Activer'}
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" title="Supprimer" onClick={() => handleDeletePlan(plan)}><i className="bi bi-trash"></i></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {plans.length === 0 && (
              <div className="col-12 text-center py-5 text-muted" role="status">
                <i className="bi bi-tags" style={{ fontSize: '2rem' }} aria-hidden="true"></i>
                <p className="mt-2 mb-0">Aucun plan. Créez votre première formule avec « Nouveau Plan ».</p>
              </div>
            )}
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
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
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
                      <label className="form-label fw-semibold">Code * <small className="text-muted fw-normal">(minuscules, sans espace)</small></label>
                      <input className="form-control font-monospace" required pattern="[a-z0-9\-_]+" title="Minuscules, chiffres, tirets uniquement" value={planForm.code || ''} onChange={e => setPlanForm({ ...planForm, code: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea className="form-control" rows={2} value={planForm.description || ''} onChange={e => setPlanForm({ ...planForm, description: e.target.value })}></textarea>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Prix Mensuel (Ar) *</label>
                      <input type="number" min={0} className="form-control font-monospace" required value={planForm.prix_mensuel ?? 0} onChange={e => setPlanForm({ ...planForm, prix_mensuel: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Prix Annuel (Ar) *</label>
                      <input type="number" min={0} className="form-control font-monospace" required value={planForm.prix_annuel ?? 0} onChange={e => setPlanForm({ ...planForm, prix_annuel: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <div className="d-flex justify-content-between align-items-center">
                        <label className="form-label fw-semibold mb-0">Employés Max</label>
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" id="illimite-employes" checked={planForm.utilisateurs_max == null} onChange={e => setPlanForm({ ...planForm, utilisateurs_max: e.target.checked ? null : 10 })} />
                          <label className="form-check-label small" htmlFor="illimite-employes">Illimité</label>
                        </div>
                      </div>
                      <input type="number" min={1} className="form-control font-monospace mt-1" disabled={planForm.utilisateurs_max == null} value={planForm.utilisateurs_max ?? ''} placeholder="Illimité" onChange={e => setPlanForm({ ...planForm, utilisateurs_max: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <div className="d-flex justify-content-between align-items-center">
                        <label className="form-label fw-semibold mb-0">Chantiers Max</label>
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" id="illimite-chantiers" checked={planForm.chantiers_max == null} onChange={e => setPlanForm({ ...planForm, chantiers_max: e.target.checked ? null : 3 })} />
                          <label className="form-check-label small" htmlFor="illimite-chantiers">Illimité</label>
                        </div>
                      </div>
                      <input type="number" min={1} className="form-control font-monospace mt-1" disabled={planForm.chantiers_max == null} value={planForm.chantiers_max ?? ''} placeholder="Illimité" onChange={e => setPlanForm({ ...planForm, chantiers_max: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Durée d'essai incluse (jours)</label>
                      <input type="number" min={0} className="form-control font-monospace" value={planForm.duree_essai_jours ?? 0} onChange={e => setPlanForm({ ...planForm, duree_essai_jours: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6 d-flex align-items-end">
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" id="plan-actif" checked={planForm.actif ?? true} onChange={e => setPlanForm({ ...planForm, actif: e.target.checked })} />
                        <label className="form-check-label" htmlFor="plan-actif">Plan actif (visible sur /pricing)</label>
                      </div>
                    </div>
                    <div className="col-12">
                      <p className="small text-muted mb-0"><i className="bi bi-info-circle me-1"></i>Les clients du portail sont toujours illimités. La limite « Employés Max » s'applique au personnel de l'entreprise.</p>
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
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
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
                      {plans.filter(p => p.actif).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
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
