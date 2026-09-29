import { useEffect, useState } from 'react'
import type { Depense, RapportFinancier, Chantier, Fournisseur } from '@/types'
import { financeService } from '@/services/finance.service'
import { chantiersService } from '@/services/chantiers.service'
import { stocksService } from '@/services/stocks.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { TableSkeleton } from '@/components/ui/Skeleton'

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
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [overruns, setOverruns] = useState<BudgetOverrun[]>([])
  const [paymentDelays, setPaymentDelays] = useState<any[]>([])
  const [clientOutstanding, setClientOutstanding] = useState<ClientOutstanding[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    reference_piece: '',
    description: '',
    montant: '',
    categorie: 'materiaux',
    date_depense: '',
    chantier_id: '',
    fournisseur_id: '',
    mode_paiement: 'virement',
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const openNewDepenseModal = () => {
    const year = new Date().getFullYear()
    const nextNum = String(depenses.length + 1).padStart(3, '0')
    setForm({
      reference_piece: `FAC-ACHAT-${year}-${nextNum}`,
      description: '',
      montant: '',
      categorie: 'materiaux',
      date_depense: new Date().toISOString().split('T')[0],
      chantier_id: '',
      fournisseur_id: '',
      mode_paiement: 'virement',
    })
    setShowModal(true)
  }

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
    chantiersService.getAll().then(setChantiers).catch(() => setChantiers([]))
    stocksService.getFournisseurs().then(setFournisseurs).catch(() => setFournisseurs([]))
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
        chantier_id: form.chantier_id ? Number(form.chantier_id) : undefined,
        fournisseur_id: form.fournisseur_id ? Number(form.fournisseur_id) : undefined,
        mode_paiement: form.mode_paiement,
        reference_piece: form.reference_piece,
        taux_tva: 20,
        statut: 'en_attente',
      } as any)
      setShowModal(false)
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
            <h2 className="mb-1 text-secondary"><i className="bi bi-bank me-2"></i>Gestion Financière & Comptabilité BTP</h2>
            <p className="text-secondary mb-0">Suivez la trésorerie, la rentabilité par chantier, les décomptes et bilans financiers</p>
          </div>
          {activeTab === 'depenses' && perms.canCreateDepense && (
            <button className="btn btn-outline-secondary fw-bold" onClick={openNewDepenseModal}>
              <i className="bi bi-plus-circle me-2"></i>Nouvelle Dépense / Achat BTP
            </button>
          )}
          {activeTab === 'rapports' && perms.canExportFinance && (
            <button className="btn btn-outline-secondary fw-bold" onClick={handleGenerateRapport} disabled={generating}>
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
        <TableSkeleton rows={8} columns={6} />
      ) : activeTab === 'overview' ? (
        <div>
          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm text-center p-4">
                <small className="text-muted text-uppercase fw-bold">Chiffre d'Affaires Brut</small>
                <h2 className="fw-bold text-secondary mt-2 mb-0">145 000 000 MGA</h2>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm text-center p-4">
                <small className="text-muted text-uppercase fw-bold">Dépenses Cumulées</small>
                <h2 className="fw-bold text-secondary mt-2 mb-0">85 000 000 MGA</h2>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm text-center p-4">
                <small className="text-muted text-uppercase fw-bold">Résultat Net</small>
                <h2 className="fw-bold text-secondary mt-2 mb-0">+ 60 000 000 MGA</h2>
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
                    <td className="fw-bold text-secondary">{dep.montant?.toLocaleString()} MGA</td>
                    <td>{dep.date_depense}</td>
                    <td>
                      <span className={`badge ${dep.statut === 'validee' ? 'bg-success bg-opacity-10 text-success border' : dep.statut === 'refusee' ? 'bg-danger bg-opacity-10 text-danger border' : 'bg-warning bg-opacity-10 text-dark border'}`}>
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
                    <td className="font-monospace text-secondary">{o.budget_prevu.toLocaleString()} MGA</td>
                    <td className="font-monospace text-secondary">{o.budget_reel.toLocaleString()} MGA</td>
                    <td className="font-monospace fw-bold text-secondary">+{o.depassement.toLocaleString()} MGA</td>
                    <td>
                      <span className={`badge ${o.taux_depassement > 10 ? 'bg-danger bg-opacity-10 text-danger border' : 'bg-warning bg-opacity-10 text-dark border'}`}>
                        +{o.taux_depassement}%
                      </span>
                    </td>
                    <td><span className="badge bg-light text-dark border">{o.statut}</span></td>
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
                      <span className={`badge ${p.en_retard ? 'bg-danger bg-opacity-10 text-danger border' : 'bg-success bg-opacity-10 text-success border'}`}>
                        {p.delai_jours > 0 ? `+${p.delai_jours}` : p.delai_jours}
                      </span>
                    </td>
                    <td><span className="badge bg-light text-dark border">Payée</span></td>
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
                    <td className="text-muted">{c.entreprise || '-'}</td>
                    <td className="font-monospace text-secondary fw-bold">{c.encours_actuel.toLocaleString()} MGA</td>
                    <td className="font-monospace text-muted">{c.encours_max.toLocaleString()} MGA</td>
                    <td className="font-monospace fw-bold text-secondary">{c.depassement.toLocaleString()} MGA</td>
                    <td className="text-muted">{c.nb_factures_impayees}</td>
                    <td>
                      <span className={`badge ${c.depasse_limite ? 'bg-danger bg-opacity-10 text-danger border' : 'bg-success bg-opacity-10 text-success border'}`}>
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
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }} tabIndex={-1}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleCreate}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Nouvelle Dépense / Achat BTP</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Référence Pièce / Facture *</label>
                      <div className="input-group">
                        <input className="form-control font-monospace fw-bold" required value={form.reference_piece} onChange={e => setForm({ ...form, reference_piece: e.target.value })} />
                        <button className="btn btn-outline-secondary" type="button" onClick={() => {
                          const year = new Date().getFullYear()
                          const nextNum = String(depenses.length + 1).padStart(3, '0')
                          setForm({ ...form, reference_piece: `FAC-ACHAT-${year}-${nextNum}` })
                        }}>
                          <i className="bi bi-arrow-clockwise"></i>
                        </button>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Description / Libellé *</label>
                      <input className="form-control" required placeholder="Achat de ciment, carburant touret..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Montant TTC (MGA) *</label>
                      <input type="number" className="form-control font-monospace fs-5 fw-bold" required min="0" step="1" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Catégorie BTP *</label>
                      <select className="form-select" value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })}>
                        <option value="materiaux">Matériaux & Agglomérats</option>
                        <option value="location_materiel">Location Matériel / Engins</option>
                        <option value="carburant">Carburant & Transport Logistique</option>
                        <option value="main_oeuvre">Main d'œuvre / Sous-traitance / Tâcherons</option>
                        <option value="outillage">Outillage & Équipements Magasin</option>
                        <option value="taxes_organismes">Taxes, CNAPS & OSTIE</option>
                        <option value="divers">Divers & Frais Généraux</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Chantier d'Imputation (Combobox)</label>
                      <select className="form-select" value={form.chantier_id} onChange={e => setForm({ ...form, chantier_id: e.target.value })}>
                        <option value="">Sélectionner un chantier...</option>
                        {chantiers.map((c) => (
                          <option key={c.id} value={c.id}>{c.numero ? `[${c.numero}] ` : ''}{c.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Fournisseur / Prestataire (Combobox)</label>
                      <select className="form-select" value={form.fournisseur_id} onChange={e => setForm({ ...form, fournisseur_id: e.target.value })}>
                        <option value="">Sélectionner un fournisseur...</option>
                        {fournisseurs.map((f) => (
                          <option key={f.id} value={f.id}>{f.nom} ({f.code || 'Fournisseur'})</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Mode de Règlement</label>
                      <select className="form-select" value={form.mode_paiement} onChange={e => setForm({ ...form, mode_paiement: e.target.value })}>
                        <option value="virement">Virement Bancaire (BNI / BOA / SG)</option>
                        <option value="mvola">Mobile Money — MVola</option>
                        <option value="orange_money">Mobile Money — Orange Money</option>
                        <option value="cheque">Chèque Bancaire</option>
                        <option value="especes">Caisse / Espèces</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Date de la dépense</label>
                      <input type="date" className="form-control" value={form.date_depense} onChange={e => setForm({ ...form, date_depense: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)} disabled={saving}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold" disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Enregistrer la dépense'}
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
