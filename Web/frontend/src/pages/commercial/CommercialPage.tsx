import { useEffect, useState } from 'react'
import type { Devis, Facture, Client, Contrat, Paiement, LigneDevis, LigneFacture } from '@/types'
import { commercialService } from '@/services/commercial.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { useToastStore } from '@/stores/toast.store'

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

  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [factureForm, setFactureForm] = useState<Partial<Facture>>({
    numero: '',
    client_id: 1,
    type: 'standard',
    montant_ht: 0,
    tva: 20,
    montant_ttc: 0,
    statut: 'emis'
  })

  // Lignes de devis (éléments éditables dans la modal)
  // Chaque ligne peut être partielle avant création côté serveur
  const [lines, setLines] = useState<Partial<LigneDevis>[]>([])
  const [factureLines, setFactureLines] = useState<Partial<LigneFacture>[]>([])

  // Clients modal state
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientForm, setClientForm] = useState<Partial<Client>>({ nom: '', email: '', telephone: '', adresse: '' })
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const { addToast } = useToastStore()

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
        // gérer les lignes: créer / mettre à jour / supprimer
        for (const l of lines) {
          if (l._deleted) {
            if (l.id) {
              await commercialService.deleteLigneDevis(selectedDevis.id, l.id)
            }
            continue
          }
          const linePayload = {
            description: l.description,
            quantite: Number(l.quantite || 0),
            prix_unitaire: Number(l.prix_unitaire || 0),
            remise: Number(l.remise || 0),
            taux_tva: Number(l.taux_tva || 0),
            total_ht: Number(l.total_ht || 0),
            total_ttc: Number(l.total_ttc || 0),
            ordre: l.ordre || 0,
            article_id: l.article_id || null,
          }
          if (l.id) {
            await commercialService.updateLigneDevis(selectedDevis.id, l.id, linePayload)
          } else {
            await commercialService.createLigneDevis(selectedDevis.id, linePayload)
          }
        }
      } else {
        // inclure les lignes à la création
        const payloadWithLines = { ...payload, lignes: lines.filter(l => !l._deleted).map(l => ({
          description: l.description,
          quantite: Number(l.quantite || 0),
          prix_unitaire: Number(l.prix_unitaire || 0),
          remise: Number(l.remise || 0),
          taux_tva: Number(l.taux_tva || 0),
          total_ht: Number(l.total_ht || 0),
          total_ttc: Number(l.total_ttc || 0),
          ordre: l.ordre || 0,
          article_id: l.article_id || null,
        })) }
        await commercialService.createDevis(payloadWithLines)
      }
      setShowDevisModal(false)
      loadData()
    } catch {
      alert('Erreur lors de l\'enregistrement du devis.')
    }
  }

  const addEmptyLine = () => {
    setLines(prev => [...prev, { description: '', categorie: 'materiaux', quantite: 1, prix_unitaire: 0, remise: 0, taux_tva: devisForm.tva || 20, total_ht: 0, total_ttc: 0, ordre: prev.length + 1 }])
  }

  const updateLineField = (index: number, field: keyof Partial<LigneDevis>, value: any) => {
    setLines(prev => {
      const copy = [...prev]
      const l: Partial<LigneDevis> = { ...copy[index] }
      ;(l as any)[field] = value
      const q = Number(l.quantite || 0)
      const pu = Number(l.prix_unitaire || 0)
      const remise = Number(l.remise || 0)
      const tva = Number(l.taux_tva ?? devisForm.tva ?? 0)
      l.total_ht = q * pu * (1 - remise / 100)
      l.total_ttc = (l.total_ht || 0) * (1 + tva / 100)
      copy[index] = l
      return copy
    })
  }

  const markLineDeleted = (index: number) => {
    setLines(prev => {
      const copy = [...prev]
      const l = { ...copy[index] }
      // if has id, mark as _deleted to call delete on save; else remove immediately
      if (l.id) {
        l._deleted = true
        copy[index] = l
        return copy
      }
      copy.splice(index, 1)
      return copy
    })
  }

  const handleSaveFacture = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const ht = Number(factureForm.montant_ht || 0)
      const tvaVal = Number(factureForm.tva || 20)
      const ttc = ht + (ht * tvaVal / 100)
      const payload = { ...factureForm, montant_ttc: ttc, lignes: factureLines.filter(l => !l._deleted).map(l => ({
        description: l.description,
        quantite: Number(l.quantite || 0),
        prix_unitaire: Number(l.prix_unitaire || 0),
        remise: Number(l.remise || 0),
        taux_tva: Number(l.taux_tva || 0),
        total_ht: Number(l.total_ht || 0),
        total_ttc: Number(l.total_ttc || 0),
        ordre: l.ordre || 0,
        article_id: l.article_id || null,
        categorie: l.categorie || null,
      })) }

      if (selectedFacture) {
        await commercialService.updateFacture(selectedFacture.id, payload)
        for (const l of factureLines) {
          if (l._deleted) {
            if (l.id) {
              await commercialService.deleteLigneFacture(selectedFacture.id, l.id)
            }
            continue
          }
          const linePayload = {
            description: l.description,
            quantite: Number(l.quantite || 0),
            prix_unitaire: Number(l.prix_unitaire || 0),
            remise: Number(l.remise || 0),
            taux_tva: Number(l.taux_tva || 0),
            total_ht: Number(l.total_ht || 0),
            total_ttc: Number(l.total_ttc || 0),
            ordre: l.ordre || 0,
            article_id: l.article_id || null,
            categorie: l.categorie || null,
          }
          if (l.id) {
            await commercialService.updateLigneFacture(selectedFacture.id, l.id, linePayload)
          } else {
            await commercialService.createLigneFacture(selectedFacture.id, linePayload)
          }
        }
      } else {
        await commercialService.createFacture(payload)
      }
      setShowFactureModal(false)
      loadData()
    } catch {
      alert('Erreur lors de l\'enregistrement de la facture.')
    }
  }

  const addEmptyFactureLine = () => {
    setFactureLines(prev => [...prev, { description: '', categorie: 'materiaux', quantite: 1, prix_unitaire: 0, remise: 0, taux_tva: factureForm.tva || 20, total_ht: 0, total_ttc: 0, ordre: prev.length + 1 }])
  }

  const updateFactureLineField = (index: number, field: keyof Partial<LigneFacture>, value: any) => {
    setFactureLines(prev => {
      const copy = [...prev]
      const l: Partial<LigneFacture> = { ...copy[index] }
      ;(l as any)[field] = value
      const q = Number(l.quantite || 0)
      const pu = Number(l.prix_unitaire || 0)
      const remise = Number(l.remise || 0)
      const tva = Number(l.taux_tva ?? factureForm.tva ?? 0)
      l.total_ht = q * pu * (1 - remise / 100)
      l.total_ttc = (l.total_ht || 0) * (1 + tva / 100)
      copy[index] = l
      return copy
    })
  }

  const markFactureLineDeleted = (index: number) => {
    setFactureLines(prev => {
      const copy = [...prev]
      const l = { ...copy[index] }
      if (l.id) {
        l._deleted = true
        copy[index] = l
        return copy
      }
      copy.splice(index, 1)
      return copy
    })
  }

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await commercialService.createClient(clientForm)
      // result contains { data, headers }
      const headers = (result && (result as any).headers) || {}
      const userId = headers['x-utilisateur-cree'] || headers['X-Utilisateur-Cree'] || headers['x-utilisateur-cree'.toLowerCase()]
      const tempPwd = headers['x-utilisateur-temppwd'] || headers['X-Utilisateur-TempPwd'] || headers['x-utilisateur-temppwd'.toLowerCase()]
      setShowClientModal(false)
      await loadData()
      if (userId) {
        try {
          const blob = await commercialService.downloadUtilisateurBonCreation(Number(userId), tempPwd)
          const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `bon-creation-${userId}.pdf`)
          document.body.appendChild(link)
          link.click()
          link.remove()
          window.URL.revokeObjectURL(url)
          addToast({ type: 'success', title: 'Client créé', message: 'Bon de création téléchargé.' })
        } catch (e) {
          addToast({ type: 'warning', title: 'Client créé', message: 'Client créé mais impossible de télécharger le PDF.' })
        }
      } else {
        addToast({ type: 'success', title: 'Client créé', message: 'Le client a été créé.' })
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible de créer le client.' })
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
            <h2 className="mb-1 text-secondary"><i className="bi bi-cart me-2"></i>Commercial & Facturation</h2>
            <p className="text-secondary mb-0">Gestion de la relation client, des devis, des contrats et du suivi des encaissements</p>
          </div>
          {activeTab === 'devis' && perms.canCreateDevis && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedDevis(null); setDevisForm({ numero: `DEV-2026-00${devisList.length + 1}`, montant_ht: 0, tva: 20, statut: 'brouillon' }); setShowDevisModal(true); }}>
              <i className="bi bi-plus-lg me-2"></i>Nouveau Devis
            </button>
          )}
          {activeTab === 'clients' && perms.canCreateClient && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedClient(null); setClientForm({ nom: '', email: '', telephone: '', adresse: '' }); setShowClientModal(true); }}>
              <i className="bi bi-person-plus me-2"></i>Nouveau Client
            </button>
          )}
          {activeTab === 'factures' && perms.canCreateDevis && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => {
              setSelectedFacture(null)
              setFactureForm({ numero: `FAC-2026-00${factures.length + 1}`, client_id: factures.length ? factures[0].client_id : 1, type: 'standard', montant_ht: 0, tva: 20, montant_ttc: 0, statut: 'emis' })
              setFactureLines([])
              setShowFactureModal(true)
            }}>
              <i className="bi bi-plus-lg me-2"></i>Nouvelle Facture
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
          <div className="spinner-border text-secondary" role="status"></div>
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
                     <td className="font-monospace fw-bold text-dark">{d.numero}</td>
                     <td className="fw-semibold">Client #{d.client_id}</td>
                     <td>{d.objet}</td>
                     <td className="font-monospace">{d.montant_ht?.toLocaleString()} MGA</td>
                     <td className="font-monospace fw-bold text-dark">{d.montant_ttc?.toLocaleString()} MGA</td>
                     <td>
                       <span className={`badge ${d.statut === 'accepte' ? 'bg-success bg-opacity-10 text-success border' : d.statut === 'envoye' ? 'bg-light text-dark border' : 'bg-light text-dark border'}`}>
                         {d.statut}
                       </span>
                     </td>
                     <td>
                       <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => { setSelectedDevis(d); setDevisForm(d); setShowDevisModal(true); }}>
                         <i className="bi bi-pencil"></i>
                       </button>
                       {d.statut === 'accepte' && (
                         <button className="btn btn-sm btn-outline-success" onClick={async () => {
                           try {
                             await commercialService.convertDevisToContrat(d.id)
                             addToast({ type: 'success', title: 'Transformé', message: 'Le devis a été transformé en contrat.' })
                             setActiveTab('contrats')
                             loadData()
                           } catch (e) {
                             addToast({ type: 'error', title: 'Erreur', message: 'Impossible de transformer le devis.' })
                           }
                         }}>
                           <i className="bi bi-file-earmark-check"></i>
                         </button>
                       )}
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
                  <th>Montant HT</th>
                  <th>TVA</th>
                  <th>Montant TTC</th>
                  <th>Déjà Payé</th>
                  <th>Reste à Payer</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {factures.map(f => {
                  const ht = f.montant_ht || 0
                  const tva = f.montant_tva || 0
                  const ttc = f.montant_ttc || 0
                  const paye = f.montant_paye || 0
                  const reste = f.reste_a_payer || (ttc - paye)
                  return (
                    <tr key={f.id}>
                      <td className="font-monospace fw-bold text-dark">{f.numero}</td>
                      <td className="fw-semibold">Client #{f.client_id}</td>
                      <td className="font-monospace">{ht.toLocaleString()} MGA</td>
                      <td className="font-monospace text-secondary">{tva.toLocaleString()} MGA</td>
                      <td className="font-monospace fw-bold">{ttc.toLocaleString()} MGA</td>
                      <td className="font-monospace text-secondary">{paye.toLocaleString()} MGA</td>
                      <td className="font-monospace text-secondary fw-bold">{reste.toLocaleString()} MGA</td>
                      <td>
                        <span className={`badge ${f.statut === 'payee' ? 'bg-success bg-opacity-10 text-success border' : f.statut === 'partiellement_payee' ? 'bg-warning bg-opacity-10 text-dark border' : 'bg-danger bg-opacity-10 text-danger border'}`}>
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
                       <span className="badge bg-primary bg-opacity-10 text-primary border">Client BTP</span>
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
                     <td className="font-monospace fw-bold text-secondary">{ctr.montant?.toLocaleString()} MGA</td>
                     <td className="small text-muted">{ctr.date_debut} → {ctr.date_fin}</td>
                     <td><span className="badge bg-success bg-opacity-10 text-success border">{ctr.statut}</span></td>
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
                    <td className="font-monospace fw-bold text-secondary">+{p.montant?.toLocaleString()} MGA</td>
                    <td><span className="badge bg-light text-dark border">{p.mode_paiement}</span></td>
                    <td className="font-monospace small text-muted">{p.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Client Builder */}
      {showClientModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{selectedClient ? 'Éditer le Client' : 'Créer un Client'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowClientModal(false)}></button>
              </div>
              <form onSubmit={handleSaveClient}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-semibold">Nom *</label>
                      <input type="text" className="form-control" required value={clientForm.nom || ''} onChange={e => setClientForm({ ...clientForm, nom: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Email</label>
                      <input type="email" className="form-control" value={clientForm.email || ''} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Téléphone</label>
                      <input type="text" className="form-control" value={clientForm.telephone || ''} onChange={e => setClientForm({ ...clientForm, telephone: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Adresse</label>
                      <input type="text" className="form-control" value={clientForm.adresse || ''} onChange={e => setClientForm({ ...clientForm, adresse: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowClientModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Créer le client</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Facture Builder */}
      {showFactureModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{selectedFacture ? 'Éditer la Facture' : 'Créer une Facture'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowFactureModal(false)}></button>
              </div>
              <form onSubmit={handleSaveFacture}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Numéro Facture *</label>
                      <input type="text" className="form-control font-monospace" required value={factureForm.numero || ''} onChange={e => setFactureForm({ ...factureForm, numero: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Type</label>
                      <select className="form-select" value={factureForm.type || 'standard'} onChange={e => setFactureForm({ ...factureForm, type: e.target.value })}>
                        <option value="standard">Standard</option>
                        <option value="acompte">Acompte</option>
                        <option value="solde">Solde</option>
                        <option value="avoir">Avoir</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Statut</label>
                      <select className="form-select" value={factureForm.statut || 'emis'} onChange={e => setFactureForm({ ...factureForm, statut: e.target.value })}>
                        <option value="emis">Émise</option>
                        <option value="envoye">Envoyée</option>
                        <option value="payee">Payée</option>
                        <option value="partiellement_payee">Partiellement payée</option>
                        <option value="en_retard">En retard</option>
                        <option value="annulee">Annulée</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Montant HT (MGA) *</label>
                      <input type="number" className="form-control font-monospace fs-5" required value={factureForm.montant_ht || 0} onChange={e => setFactureForm({ ...factureForm, montant_ht: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">TVA (%)</label>
                      <input type="number" className="form-control font-monospace" value={factureForm.tva || 20} onChange={e => setFactureForm({ ...factureForm, tva: Number(e.target.value) })} />
                    </div>
                    <div className="col-12 p-3 bg-light rounded text-center">
                      <small className="text-muted d-block">Montant Calculé TTC</small>
                      <h3 className="fw-bold text-secondary mb-0">
                        {((Number(factureForm.montant_ht || 0)) * (1 + (Number(factureForm.tva || 20) / 100))).toLocaleString()} MGA
                      </h3>
                    </div>
                    <div className="col-12 mt-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">Lignes de facture</h6>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addEmptyFactureLine}><i className="bi bi-plus-lg me-1"></i>Ajouter ligne</button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th style={{ width: '160px' }}>Catégorie</th>
                              <th>Description</th>
                              <th style={{ width: '90px' }}>Quantité</th>
                              <th style={{ width: '140px' }}>Prix Unitaire</th>
                              <th style={{ width: '90px' }}>Remise %</th>
                              <th style={{ width: '90px' }}>TVA %</th>
                              <th style={{ width: '140px' }}>Total TTC</th>
                              <th style={{ width: '60px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {factureLines.filter(l => !l._deleted).map((l, idx) => (
                              <tr key={idx}>
                                <td>
                                  <select className="form-select form-select-sm" value={l.categorie || 'materiaux'} onChange={e => updateFactureLineField(idx, 'categorie', e.target.value)}>
                                    <option value="materiaux">Matériaux</option>
                                    <option value="main-d_œuvre">Main-d'œuvre</option>
                                    <option value="materiel_et_engins">Matériel et engins</option>
                                    <option value="prestations">Prestations</option>
                                    <option value="sous_traitance">Sous-traitance</option>
                                    <option value="autres_frais">Autres frais</option>
                                  </select>
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" value={l.description || ''} onChange={e => updateFactureLineField(idx, 'description', e.target.value)} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" type="number" value={l.quantite || 0} onChange={e => updateFactureLineField(idx, 'quantite', Number(e.target.value))} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" type="number" value={l.prix_unitaire || 0} onChange={e => updateFactureLineField(idx, 'prix_unitaire', Number(e.target.value))} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" type="number" value={l.remise || 0} onChange={e => updateFactureLineField(idx, 'remise', Number(e.target.value))} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" type="number" value={l.taux_tva || factureForm.tva || 20} onChange={e => updateFactureLineField(idx, 'taux_tva', Number(e.target.value))} />
                                </td>
                                <td className="font-monospace">{Number(l.total_ttc || 0).toLocaleString()} MGA</td>
                                <td>
                                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => markFactureLineDeleted(idx)}><i className="bi bi-trash"></i></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowFactureModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Générer la facture</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
