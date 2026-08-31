import { useEffect, useState } from 'react'
import type { Devis, Facture, Client, Contrat, Paiement } from '@/types'
import { commercialService } from '@/services/commercial.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'

export function CommercialPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')

  const [activeTab, setActiveTab] = useState<'devis' | 'factures' | 'clients' | 'contrats' | 'paiements'>('devis')

  const [devisList, setDevisList] = useState<Devis[]>([])
  const [factures, setFactures] = useState<Facture[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')

  // Modals
  const [showDevisModal, setShowDevisModal] = useState(false)
  const [showFactureModal, setShowFactureModal] = useState(false)
  const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null)
  const [devisForm, setDevisForm] = useState<Partial<Devis>>({
    numero: 'DEV-2026-001',
    client_id: 1,
    objet: '',
    montant_ht: 0,
    tva: 20,
    montant_ttc: 0,
    statut: 'brouillon'
  })

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'devis') {
        const data = await commercialService.getDevis()
        setDevisList(data)
      } else if (activeTab === 'factures') {
        const data = await commercialService.getFactures()
        setFactures(data)
      } else if (activeTab === 'clients') {
        const data = await commercialService.getClients()
        setClients(data)
      } else if (activeTab === 'contrats') {
        const data = await commercialService.getContrats()
        setContrats(data)
      } else if (activeTab === 'paiements') {
        const data = await commercialService.getPaiements()
        setPaiements(data)
      }
    } catch {
      setDevisList([])
      setFactures([])
      setClients([])
      setContrats([])
      setPaiements([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeTab, search])

  const handleSaveDevis = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const ht = Number(devisForm.montant_ht || 0)
      const tvaVal = Number(devisForm.tva || 20)
      const ttc = ht + (ht * tvaVal / 100)
      const payload = { ...devisForm, montant_ttc: ttc }

      if (selectedDevis) {
        await commercialService.updateDevis(selectedDevis.id, payload)
      } else {
        await commercialService.createDevis(payload)
      }
      setShowDevisModal(false)
      loadData()
    } catch {
      alert('Erreur lors de l\'enregistrement du devis.')
    }
  }

  const exportClientsCSV = () => {
    const headers = ['Nom', 'Prenom', 'Entreprise', 'Email', 'Telephone', 'Adresse']
    const rows = clients.map(c => [c.nom, c.prenom, c.entreprise, c.email, c.telephone, c.adresse])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'clients_export.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1"><i className="bi bi-cart me-2 text-primary"></i>Commercial & Facturation</h2>
          <p className="text-secondary mb-0">Gestion de la relation client, des devis, des contrats et du suivi des encaissements</p>
        </div>
        {activeTab === 'devis' && perms.canCreateDevis && (
          <button className="btn btn-primary fw-bold" onClick={() => { setSelectedDevis(null); setDevisForm({ numero: `DEV-2026-00${devisList.length + 1}`, montant_ht: 0, tva: 20, statut: 'brouillon' }); setShowDevisModal(true); }}>
            <i className="bi bi-plus-lg me-2"></i>Nouveau Devis
          </button>
        )}
        {activeTab === 'clients' && perms.canCreateClient && (
          <button className="btn btn-primary fw-bold" onClick={() => { setSelectedClient(null); setClientForm({ nom: '', email: '', telephone: '', adresse: '' }); setShowClientModal(true); }}>
            <i className="bi bi-person-plus me-2"></i>Nouveau Client
          </button>
        )}
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills mb-4 p-2 rounded shadow-sm">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'devis' ? 'active' : ''}`} onClick={() => setActiveTab('devis')}>
            <i className="bi bi-file-earmark-text me-2"></i>Devis
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'factures' ? 'active' : ''}`} onClick={() => setActiveTab('factures')}>
            <i className="bi bi-receipt me-2"></i>Factures
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')}>
            <i className="bi bi-person-badge me-2"></i>Clients
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'contrats' ? 'active' : ''}`} onClick={() => setActiveTab('contrats')}>
            <i className="bi bi-file-earmark-check me-2"></i>Contrats
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'paiements' ? 'active' : ''}`} onClick={() => setActiveTab('paiements')}>
            <i className="bi bi-cash-coin me-2"></i>Paiements
          </button>
        </li>
      </ul>

      {/* Content */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : activeTab === 'devis' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N° Devis</th>
                  <th>Client</th>
                  <th>Objet</th>
                  <th>Montant HT</th>
                  <th>Montant TTC</th>
                  <th>Statut</th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devisList.map(d => (
                  <tr key={d.id}>
                    <td className="font-monospace fw-bold text-primary">{d.numero}</td>
                    <td className="fw-semibold">Client #{d.client_id}</td>
                    <td>{d.objet}</td>
                    <td className="font-monospace">{d.montant_ht?.toLocaleString()} MGA</td>
                    <td className="font-monospace fw-bold text-dark">{d.montant_ttc?.toLocaleString()} MGA</td>
                    <td>
                      <span className={`badge ${d.statut === 'accepte' ? 'bg-success' : d.statut === 'envoye' ? 'bg-info' : 'bg-secondary'}`}>
                        {d.statut}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedDevis(d); setDevisForm(d); setShowDevisModal(true); }}>
                        <i className="bi bi-pencil"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'factures' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N° Facture</th>
                  <th>Client</th>
                  <th>Montant TTC</th>
                  <th>Déjà Payé</th>
                  <th>Reste à Payer</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {factures.map(f => {
                  const reste = (f.montant_ttc || 0) - (f.montant_paye || 0)
                  return (
                    <tr key={f.id}>
                      <td className="font-monospace fw-bold text-dark">{f.numero}</td>
                      <td className="fw-semibold">Client #{f.client_id}</td>
                      <td className="font-monospace fw-bold">{f.montant_ttc?.toLocaleString()} MGA</td>
                      <td className="font-monospace text-success">{f.montant_paye?.toLocaleString()} MGA</td>
                      <td className="font-monospace text-danger fw-bold">{reste.toLocaleString()} MGA</td>
                      <td>
                        <span className={`badge ${f.statut === 'payee' ? 'bg-success' : f.statut === 'partiellement_payee' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                          {f.statut}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'clients' ? (
        <div>
          <div className="d-flex justify-content-end mb-3">
            <button className="btn btn-outline-secondary" onClick={exportClientsCSV}>
              <i className="bi bi-download me-1"></i>Exporter Clients CSV
            </button>
          </div>
          <div className="row g-4">
            {clients.map(c => (
              <div key={c.id} className="col-md-6">
                <div className="card border-0 shadow-sm h-100 kpi-card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="fw-bold text-dark mb-0">{c.entreprise || `${c.nom} ${c.prenom}`}</h5>
                      <span className="badge bg-primary bg-opacity-10 text-primary">Client BTP</span>
                    </div>
                    <p className="text-muted small mb-1"><i className="bi bi-person me-2"></i>Contact: {c.nom} {c.prenom}</p>
                    <p className="text-muted small mb-1"><i className="bi bi-envelope me-2"></i>{c.email || '—'}</p>
                    <p className="text-muted small mb-0"><i className="bi bi-telephone me-2"></i>{c.telephone || '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'contrats' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Référence</th>
                  <th>Objet Contrat</th>
                  <th>Montant Global</th>
                  <th>Période Execution</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {contrats.map(ctr => (
                  <tr key={ctr.id}>
                    <td className="font-monospace fw-bold text-dark">{ctr.reference}</td>
                    <td>{ctr.objet}</td>
                    <td className="font-monospace fw-bold text-primary">{ctr.montant?.toLocaleString()} MGA</td>
                    <td className="small text-muted">{ctr.date_debut} → {ctr.date_fin}</td>
                    <td><span className="badge bg-success">{ctr.statut}</span></td>
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
                  <th>Facture ID</th>
                  <th>Date Paiement</th>
                  <th>Montant Encaisse</th>
                  <th>Mode de Règlement</th>
                  <th>Réf. Transaction</th>
                </tr>
              </thead>
              <tbody>
                {paiements.map(p => (
                  <tr key={p.id}>
                    <td className="fw-semibold">Facture #{p.facture_id}</td>
                    <td>{p.date_paiement}</td>
                    <td className="font-monospace fw-bold text-success">+{p.montant?.toLocaleString()} MGA</td>
                    <td><span className="badge bg-light text-dark border">{p.mode_paiement}</span></td>
                    <td className="font-monospace small text-muted">{p.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Devis Builder */}
      {showDevisModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{selectedDevis ? 'Éditer le Devis' : 'Créer un Devis'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDevisModal(false)}></button>
              </div>
              <form onSubmit={handleSaveDevis}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Numéro Devis *</label>
                      <input type="text" className="form-control font-monospace" required value={devisForm.numero || ''} onChange={e => setDevisForm({ ...devisForm, numero: e.target.value })} />
                    </div>
                    <div className="col-md-8">
                      <label className="form-label fw-semibold">Objet du Devis *</label>
                      <input type="text" className="form-control" required value={devisForm.objet || ''} onChange={e => setDevisForm({ ...devisForm, objet: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Montant HT (MGA) *</label>
                      <input type="number" className="form-control font-monospace fs-5" required value={devisForm.montant_ht || 0} onChange={e => setDevisForm({ ...devisForm, montant_ht: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">TVA (%)</label>
                      <input type="number" className="form-control font-monospace" value={devisForm.tva || 20} onChange={e => setDevisForm({ ...devisForm, tva: Number(e.target.value) })} />
                    </div>
                    <div className="col-12 p-3 bg-light rounded text-center">
                      <small className="text-muted d-block">Montant Calculé TTC (Estimation)</small>
                      <h3 className="fw-bold text-success mb-0">
                        {((Number(devisForm.montant_ht || 0)) * (1 + (Number(devisForm.tva || 20) / 100))).toLocaleString()} MGA
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDevisModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary fw-bold">Générer le devis</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
