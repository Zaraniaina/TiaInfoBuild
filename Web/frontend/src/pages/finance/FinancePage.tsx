import { useEffect, useState } from 'react'
import type { Depense, RapportFinancier } from '@/types'
import { financeService } from '@/services/finance.service'

export function FinancePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'depenses' | 'rapports'>('overview')
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [rapports, setRapports] = useState<RapportFinancier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ description: '', montant: '', categorie: 'divers', date_depense: '' })
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'depenses') {
        const data = await financeService.getDepenses()
        setDepenses(data)
      } else if (activeTab === 'rapports') {
        const data = await financeService.getRapports()
        setRapports(data)
      }
    } catch {
      setDepenses([
        { id: 1, entreprise_id: 1, description: 'Achat Carburant Engins', categorie: 'transport', montant: 4500000, date_depense: '2026-08-14', taux_tva: 20, statut: 'validee', is_deleted: false, created_at: '', updated_at: '' },
        { id: 2, entreprise_id: 1, description: 'Fournitures de bureau', categorie: 'divers', montant: 850000, date_depense: '2026-08-16', taux_tva: 20, statut: 'en_attente', is_deleted: false, created_at: '', updated_at: '' }
      ])
      setRapports([
        { id: 1, entreprise_id: 1, periode: '2026-08', chiffre_affaires: 145000000, depenses_total: 85000000, marge: 60000000, date_generation: '2026-08-18', is_deleted: false, created_at: '', updated_at: '' }
      ])
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

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1"><i className="bi bi-bank me-2 text-primary"></i>Gestion Financière</h2>
          <p className="text-secondary mb-0">Suivez la trésorerie, la rentabilité, les dépenses et les bilans financiers</p>
        </div>
        {activeTab === 'depenses' && (
          <button className="btn btn-primary fw-bold" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-circle me-2"></i>Nouvelle Dépense
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <ul className="nav nav-pills mb-4 bg-white p-2 rounded shadow-sm">
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
