import { useEffect, useState } from 'react'
import type { Depense, RapportFinancier } from '@/types'
import { financeService } from '@/services/finance.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'

interface BudgetOverrun {
  id: number
  nom: string
  numero: string
  budget_prevu: number
  budget_reel: number
  depassement: number
  taux_depassement: number
  statut: string
}

interface ClientOutstanding {
  client_id: number
  nom: string
  entreprise: string
  encours_max: number
  encours_actuel: number
  depassement: number
  nb_factures_impayees: number
  depasse_limite: boolean
}

export function FinancePage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')
  const [activeTab, setActiveTab] = useState<'overview' | 'depenses' | 'rapports' | 'budget' | 'paiements' | 'encours'>('overview')
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [rapports, setRapports] = useState<RapportFinancier[]>([])
  const [overruns, setOverruns] = useState<BudgetOverrun[]>([])
  const [paymentDelays, setPaymentDelays] = useState<any[]>([])
  const [clientOutstanding, setClientOutstanding] = useState<ClientOutstanding[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ description: '', montant: '', categorie: 'divers', date_depense: '' })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'depenses') {
        const data = await financeService.getDepenses()
        setDepenses(data)
      } else if (activeTab === 'rapports') {
        const data = await financeService.getRapports()
        setRapports(data)
      } else if (activeTab === 'budget') {
        const data = await financeService.getBudgetOverruns()
        setOverruns(data.overruns || [])
      } else if (activeTab === 'paiements') {
        const data = await financeService.getPaymentDelays()
        setPaymentDelays(data.delais || [])
      } else if (activeTab === 'encours') {
        const data = await financeService.getClientOutstanding()
        setClientOutstanding(data.clients || [])
      }
    } catch {
      setDepenses([])
      setRapports([])
      setOverruns([])
      setPaymentDelays([])
      setClientOutstanding([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeTab])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await financeService.createDepense({
        description: form.description,
        montant: parseFloat(form.montant),
        categorie: form.categorie,
        date_depense: form.date_depense || new Date().toISOString().split('T')[0],
        taux_tva: 20,
        statut: 'en_attente',
      })
      setShowModal(false)
      setForm({ description: '', montant: '', categorie: 'divers', date_depense: '' })
      loadData()
    } catch {
      alert('Erreur lors de la création de la dépense')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateRapport = async () => {
    const now = new Date()
    const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setGenerating(true)
    try {
      await financeService.generateRapport(periode)
      alert(`Rapport ${periode} généré avec succès`)
      loadData()
    } catch {
      alert('Erreur lors de la génération du rapport')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1"><i className="bi bi-bank me-2 text-primary"></i>Gestion Financière</h2>
          <p className="text-secondary mb-0">Suivez la trésorerie, la rentabilité, les dépenses et les bilans financiers</p>
        </div>
        {activeTab === 'depenses' && perms.canCreateDepense && (
          <button className="btn btn-primary fw-bold" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-circle me-2"></i>Nouvelle Dépense
          </button>
        )}
        {activeTab === 'rapports' && perms.canExportFinance && (
          <button className="btn btn-primary fw-bold" onClick={handleGenerateRapport} disabled={generating}>
            <i className="bi bi-file-earmark-bar-graph me-2"></i>{generating ? 'Génération...' : 'Générer Rapport'}
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <ul className="nav nav-pills mb-4 p-2 rounded shadow-sm">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <i className="bi bi-pie-chart me-2"></i>Vue Globale & P&L
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'depenses' ? 'active' : ''}`} onClick={() => setActiveTab('depenses')}>
            <i className="bi bi-wallet2 me-2"></i>Dépenses & Achats
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'budget' ? 'active' : ''}`} onClick={() => setActiveTab('budget')}>
            <i className="bi bi-graph-up-arrow me-2"></i>Budget & Dépassements
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'paiements' ? 'active' : ''}`} onClick={() => setActiveTab('paiements')}>
            <i className="bi bi-cash-coin me-2"></i>Paiements & Délais
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'encours' ? 'active' : ''}`} onClick={() => setActiveTab('encours')}>
            <i className="bi bi-person-badge me-2"></i>Encours Clients
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'rapports' ? 'active' : ''}`} onClick={() => setActiveTab('rapports')}>
            <i className="bi bi-file-earmark-bar-graph me-2"></i>Rapports Financiers
          </button>
        </li>
      </ul>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : activeTab === 'overview' ? (
        <div>
          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm text-center p-4">
                <small className="text-muted text-uppercase fw-bold">Chiffre d'Affaires Brut</small>
                <h2 className="fw-bold text-success mt-2 mb-0">145 000 000 MGA</h2>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm text-center p-4">
                <small className="text-muted text-uppercase fw-bold">Dépenses Cumulées</small>
                <h2 className="fw-bold text-danger mt-2 mb-0">85 000 000 MGA</h2>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm text-center p-4">
                <small className="text-muted text-uppercase fw-bold">Résultat Net</small>
                <h2 className="fw-bold text-primary mt-2 mb-0">+ 60 000 000 MGA</h2>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'depenses' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Description</th>
                  <th>Catégorie</th>
                  <th>Montant</th>
                  <th>Date</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {depenses.map(dep => (
                  <tr key={dep.id}>
                    <td className="fw-semibold">{dep.description}</td>
                    <td><span className="badge bg-light text-dark text-capitalize">{dep.categorie || 'Autre'}</span></td>
                    <td className="fw-bold text-danger">{dep.montant?.toLocaleString()} MGA</td>
                    <td>{dep.date_depense}</td>
                    <td>
                      <span className={`badge ${dep.statut === 'validee' ? 'bg-success' : dep.statut === 'refusee' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                        {dep.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'budget' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Chantier</th>
                  <th>Budget Prévu</th>
                  <th>Budget Réel</th>
                  <th>Dépassement</th>
                  <th>Taux</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {overruns.map(o => (
                  <tr key={o.id}>
                    <td className="fw-semibold">{o.nom}</td>
                    <td className="font-monospace">{o.budget_prevu.toLocaleString()} MGA</td>
                    <td className="font-monospace text-danger">{o.budget_reel.toLocaleString()} MGA</td>
                    <td className="font-monospace fw-bold text-danger">+{o.depassement.toLocaleString()} MGA</td>
                    <td>
                      <span className={`badge ${o.taux_depassement > 10 ? 'bg-danger' : 'bg-warning text-dark'}`}>
                        +{o.taux_depassement}%
                      </span>
                    </td>
                    <td><span className="badge bg-secondary">{o.statut}</span></td>
                  </tr>
                ))}
                {overruns.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">Aucun dépassement budgétaire.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'paiements' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Facture</th>
                  <th>Montant</th>
                  <th>Échéance</th>
                  <th>Paiement</th>
                  <th>Délai (jours)</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {paymentDelays.map((p, idx) => (
                  <tr key={idx}>
                    <td className="fw-semibold">{p.numero}</td>
                    <td className="font-monospace">{p.montant.toLocaleString()} MGA</td>
                    <td>{p.date_echeance}</td>
                    <td>{p.date_paiement}</td>
                    <td>
                      <span className={`badge ${p.en_retard ? 'bg-danger' : 'bg-success'}`}>
                        {p.delai_jours > 0 ? `+${p.delai_jours}` : p.delai_jours}
                      </span>
                    </td>
                    <td><span className="badge bg-info">Payée</span></td>
                  </tr>
                ))}
                {paymentDelays.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">Aucune donnée de paiement.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'encours' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Client</th>
                  <th>Entreprise</th>
                  <th>Encours Actuel</th>
                  <th>Limite</th>
                  <th>Dépassement</th>
                  <th>Nb Factures Impayées</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {clientOutstanding.map((c, idx) => (
                  <tr key={idx}>
                    <td className="fw-semibold">{c.nom}</td>
                    <td className="text-muted">{c.entreprise || '—'}</td>
                    <td className="font-monospace text-danger fw-bold">{c.encours_actuel.toLocaleString()} MGA</td>
                    <td className="font-monospace text-muted">{c.encours_max.toLocaleString()} MGA</td>
                    <td className="font-monospace fw-bold text-danger">{c.depassement.toLocaleString()} MGA</td>
                    <td className="text-muted">{c.nb_factures_impayees}</td>
                    <td>
                      <span className={`badge ${c.depasse_limite ? 'bg-danger' : 'bg-success'}`}>
                        {c.depasse_limite ? 'Dépassé' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
                {clientOutstanding.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-4 text-muted">Aucun encours client.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Période</th>
                  <th>CA</th>
                  <th>Dépenses Total</th>
                  <th>Marge Net</th>
                  <th>Date Génération</th>
                </tr>
              </thead>
              <tbody>
                {rapports.map(r => (
                  <tr key={r.id}>
                    <td className="fw-semibold font-monospace">{r.periode}</td>
                    <td>{r.chiffre_affaires?.toLocaleString()} MGA</td>
                    <td>{r.depenses_total?.toLocaleString()} MGA</td>
                    <td className="fw-bold text-success">{r.marge?.toLocaleString()} MGA</td>
                    <td>{r.date_generation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nouvelle Dépense */}
      {showModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleCreate}>
                <div className="modal-header">
                  <h5 className="modal-title">Nouvelle Dépense</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <input className="form-control" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Montant (MGA)</label>
                    <input type="number" className="form-control" required min="0" step="0.01" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Catégorie</label>
                    <select className="form-select" value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })}>
                      <option value="transport">Transport</option>
                      <option value="materiaux">Matériaux</option>
                      <option value="main_oeuvre">Main d'œuvre</option>
                      <option value="divers">Divers</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-control" value={form.date_depense} onChange={e => setForm({ ...form, date_depense: e.target.value })} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showModal && <div className="modal-backdrop fade show" onClick={() => setShowModal(false)}></div>}
    </div>
  )
}
