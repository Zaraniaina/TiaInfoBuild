import { useEffect, useState } from 'react'
import type { Devis, Facture, Client, Contrat, Paiement, LigneDevis, LigneFacture, Chantier, Avenant, StatutDevis, TypeClient, TypeFacture, StatutFacture, StatutChantier } from '@/types'
import { commercialService } from '@/services/commercial.service'
import { chantiersService } from '@/services/chantiers.service'
import { avenantsService } from '@/services/avenants.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { useToastStore } from '@/stores/toast.store'
import { DemandeTravauxTab } from './DemandeTravauxTab'
import { ProjetsTab } from './ProjetsTab'
import { MetresTab } from './MetresTab'
import { SituationsTab } from './SituationsTab'

type LigneDevisRow = Partial<LigneDevis> & { _deleted?: boolean }
type LigneFactureRow = Partial<LigneFacture> & { _deleted?: boolean }
type ChantierFormState = Partial<Chantier> & { contrat_id?: number }

export function CommercialPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')

  const [activeTab, setActiveTab] = useState<'devis' | 'factures' | 'clients' | 'contrats' | 'paiements' | 'chantiers' | 'avenants' | 'demandes' | 'projets' | 'metres' | 'situations'>('devis')

  const [devisList, setDevisList] = useState<Devis[]>([])
  const [factures, setFactures] = useState<Facture[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [avenants, setAvenants] = useState<Avenant[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')

  // Modals
  const [showDevisModal, setShowDevisModal] = useState(false)
  const [showFactureModal, setShowFactureModal] = useState(false)
  const [showPaiementModal, setShowPaiementModal] = useState(false)
  const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null)
  const [devisForm, setDevisForm] = useState<Partial<Devis>>({
    numero: 'DEV-2026-001',
    client_id: undefined,
    objet: '',
    montant_ht: 0,
    tva: 20,
    montant_ttc: 0,
    statut: 'brouillon'
  })

  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [factureForm, setFactureForm] = useState<Partial<Facture>>({
    numero: '',
    client_id: undefined,
    type: 'standard',
    montant_ht: 0,
    tva: 20,
    montant_ttc: 0,
    statut: 'emis'
  })

  const [paiementForm, setPaiementForm] = useState<Partial<Paiement>>({
    facture_id: undefined,
    montant: 0,
    mode_paiement: 'virement',
    reference: '',
    notes: ''
  })

  // Lignes de devis (éléments éditables dans la modal)
  // Chaque ligne peut être partielle avant création côté serveur
  const [lines, setLines] = useState<LigneDevisRow[]>([])
  const [factureLines, setFactureLines] = useState<LigneFactureRow[]>([])

  // Clients modal state
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientForm, setClientForm] = useState<Partial<Client>>({ type: 'particulier', civilite: 'M.', nom: '', prenom: '', email: '', telephone: '', adresse: '', entreprise: '', siret: '', numero_tva: '' })
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedChantier, setSelectedChantier] = useState<Chantier | null>(null)
  const [showChantierModal, setShowChantierModal] = useState(false)
  const [chantierForm, setChantierForm] = useState<ChantierFormState>({ nom: '', numero: '', statut: 'planification', budget_prevu: 0, marge_cible: 15, tva: 20, description: '' })
  const [selectedAvenant, setSelectedAvenant] = useState<Avenant | null>(null)
  const [showAvenantModal, setShowAvenantModal] = useState(false)
  const [avenantForm, setAvenantForm] = useState<Partial<Avenant>>({ numero: '', description: '', impact_montant: 0, statut: 'propose', contrat_id: undefined })
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
      } else if (activeTab === 'chantiers') {
        const data = await chantiersService.getAll()
        setChantiers(data)
      } else if (activeTab === 'avenants') {
        const data = await avenantsService.getAll()
        setAvenants(data)
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
            description: l.description ?? '',
            quantite: Number(l.quantite || 0),
            prix_unitaire: Number(l.prix_unitaire || 0),
            remise: Number(l.remise || 0),
            taux_tva: Number(l.taux_tva || 0),
            total_ht: Number(l.total_ht || 0),
            total_ttc: Number(l.total_ttc || 0),
            ordre: l.ordre || 0,
            article_id: l.article_id || undefined,
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
          description: l.description ?? '',
          quantite: Number(l.quantite || 0),
          prix_unitaire: Number(l.prix_unitaire || 0),
          remise: Number(l.remise || 0),
          taux_tva: Number(l.taux_tva || 0),
          total_ht: Number(l.total_ht || 0),
          total_ttc: Number(l.total_ttc || 0),
          ordre: l.ordre || 0,
          article_id: l.article_id || undefined,
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
        description: l.description ?? '',
        quantite: Number(l.quantite || 0),
        prix_unitaire: Number(l.prix_unitaire || 0),
        remise: Number(l.remise || 0),
        taux_tva: Number(l.taux_tva || 0),
        total_ht: Number(l.total_ht || 0),
        total_ttc: Number(l.total_ttc || 0),
        ordre: l.ordre || 0,
        article_id: l.article_id || undefined,
        categorie: l.categorie || undefined,
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
            description: l.description ?? '',
            quantite: Number(l.quantite || 0),
            prix_unitaire: Number(l.prix_unitaire || 0),
            remise: Number(l.remise || 0),
            taux_tva: Number(l.taux_tva || 0),
            total_ht: Number(l.total_ht || 0),
            total_ttc: Number(l.total_ttc || 0),
            ordre: l.ordre || 0,
            article_id: l.article_id || undefined,
            categorie: l.categorie || undefined,
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
          const blob = await commercialService.downloadUtilisateurBonCreation(Number(userId), tempPwd, `${window.location.origin}/client-login`)
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

  const handleSaveChantier = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedChantier) {
        await chantiersService.update(selectedChantier.id, chantierForm)
        addToast({ type: 'success', title: 'Chantier mis à jour', message: 'Le chantier a été modifié.' })
      } else {
        await chantiersService.create(chantierForm)
        addToast({ type: 'success', title: 'Chantier créé', message: 'Le chantier a été créé.' })
      }
      setShowChantierModal(false)
      loadData()
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible d\'enregistrer le chantier.' })
    }
  }

  const handleSaveAvenant = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!avenantForm.contrat_id) {
        addToast({ type: 'error', title: 'Erreur', message: 'Veuillez sélectionner un contrat.' })
        return
      }
      if (selectedAvenant) {
        await avenantsService.update(selectedAvenant.id, avenantForm)
        addToast({ type: 'success', title: 'Avenant mis à jour', message: 'L\'avenant a été modifié.' })
      } else {
        await avenantsService.create(avenantForm.contrat_id, avenantForm)
        addToast({ type: 'success', title: 'Avenant créé', message: 'L\'avenant a été créé.' })
      }
      setShowAvenantModal(false)
      loadData()
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible d\'enregistrer l\'avenant.' })
    }
  }

  const handleSavePaiement = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const facture = factures.find(f => f.id === paiementForm.facture_id)
      if (!facture) {
        addToast({ type: 'error', title: 'Erreur', message: 'Veuillez sélectionner une facture.' })
        return
      }
      const paye = facture.montant_paye || 0
      const ttc = facture.montant_ttc || 0
      const reste = (ttc - paye)
      if (paiementForm.montant && paiementForm.montant > reste) {
        addToast({ type: 'error', title: 'Erreur', message: `Le montant du paiement (${paiementForm.montant.toLocaleString()} MGA) dépasse le reste à payer (${reste.toLocaleString()} MGA).` })
        return
      }
      await commercialService.createPaiement(paiementForm)
      setShowPaiementModal(false)
      setPaiementForm({ facture_id: undefined, montant: 0, mode_paiement: 'virement', reference: '', notes: '' })
      loadData()
      addToast({ type: 'success', title: 'Paiement enregistré', message: 'Le paiement a été ajouté.' })
    } catch {
      addToast({ type: 'error', title: 'Erreur', message: 'Impossible d\'enregistrer le paiement.' })
    }
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h2 className="mb-1 text-secondary"><i className="bi bi-cart me-2"></i>Commercial & Facturation</h2>
            <p className="text-secondary mb-0">Gestion du cycle client complet : demandes, projets, métrés, devis, contrats, situations et suivi des encaissements</p>
          </div>
          {activeTab === 'devis' && perms.canCreateDevis && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedDevis(null); setDevisForm({ numero: `DEV-2026-00${devisList.length + 1}`, client_id: undefined, montant_ht: 0, tva: 20, statut: 'brouillon' }); setShowDevisModal(true); }}>
              <i className="bi bi-plus-lg me-2"></i>Nouveau Devis
            </button>
          )}
          {activeTab === 'clients' && perms.canCreateClient && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedClient(null); setClientForm({ nom: '', email: '', telephone: '', adresse: '' }); setShowClientModal(true); }}>
              <i className="bi bi-person-plus me-2"></i>Nouveau Client
            </button>
          )}
          {activeTab === 'factures' && perms.canCreateFacture && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => {
              setSelectedFacture(null)
              setFactureForm({ numero: `FAC-2026-00${factures.length + 1}`, client_id: undefined, type: 'standard', montant_ht: 0, tva: 20, montant_ttc: 0, statut: 'emis' })
              setFactureLines([])
              setShowFactureModal(true)
            }}>
              <i className="bi bi-plus-lg me-2"></i>Nouvelle Facture
            </button>
          )}
          {activeTab === 'paiements' && perms.canAddPaiement && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setPaiementForm({ facture_id: undefined, montant: 0, mode_paiement: 'virement', reference: '', notes: '' }); setShowPaiementModal(true); }}>
              <i className="bi bi-plus-lg me-2"></i>Nouveau Paiement
            </button>
          )}
          {activeTab === 'chantiers' && perms.canCreateChantier && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedChantier(null); setChantierForm({ nom: '', numero: '', statut: 'planification', budget_prevu: 0, marge_cible: 15, tva: 20, description: '', client_id: undefined, contrat_id: undefined }); setShowChantierModal(true); }}>
              <i className="bi bi-plus-lg me-2"></i>Nouveau Chantier
            </button>
          )}
          {activeTab === 'avenants' && perms.canCreateDevis && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedAvenant(null); setAvenantForm({ numero: '', description: '', impact_montant: 0, statut: 'propose', contrat_id: undefined }); setShowAvenantModal(true); }}>
              <i className="bi bi-plus-lg me-2"></i>Nouvel Avenant
            </button>
          )}
          {activeTab === 'demandes' && perms.canCreateDemande && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => document.getElementById('btn-nouvelle-demande')?.click()}>
              <i className="bi bi-plus-lg me-2"></i>Nouvelle Demande
            </button>
          )}
          {activeTab === 'projets' && perms.canCreateProjet && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => document.getElementById('btn-nouveau-projet')?.click()}>
              <i className="bi bi-plus-lg me-2"></i>Nouveau Projet
            </button>
          )}
          {activeTab === 'metres' && perms.canCreateMetre && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => document.getElementById('btn-nouveau-metre')?.click()}>
              <i className="bi bi-plus-lg me-2"></i>Nouveau Métré
            </button>
          )}
          {activeTab === 'situations' && perms.canCreateSituation && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => document.getElementById('btn-nouvelle-situation')?.click()}>
              <i className="bi bi-plus-lg me-2"></i>Nouvelle Situation
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
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'chantiers' ? 'active' : ''}`} onClick={() => setActiveTab('chantiers')}>
            <i className="bi bi-building me-2"></i>Chantiers
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'avenants' ? 'active' : ''}`} onClick={() => setActiveTab('avenants')}>
            <i className="bi bi-file-earmark-plus me-2"></i>Avenants
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'demandes' ? 'active' : ''}`} onClick={() => setActiveTab('demandes')}>
            <i className="bi bi-inbox me-2"></i>Demandes
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'projets' ? 'active' : ''}`} onClick={() => setActiveTab('projets')}>
            <i className="bi bi-briefcase me-2"></i>Projets
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'metres' ? 'active' : ''}`} onClick={() => setActiveTab('metres')}>
            <i className="bi bi-rulers me-2"></i>Métrés
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'situations' ? 'active' : ''}`} onClick={() => setActiveTab('situations')}>
            <i className="bi bi-clipboard2-data me-2"></i>Situations
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
                  <th>No Devis</th>
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
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => { setSelectedDevis(d); setDevisForm(d); setShowDevisModal(true); }}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        {d.statut === 'brouillon' && perms.canValidateDevis && (
                          <button className="btn btn-sm btn-outline-primary me-1" onClick={async () => {
                            try {
                              await commercialService.updateDevis(d.id, { ...d, statut: 'envoye' })
                              addToast({ type: 'success', title: 'Envoyé', message: 'Le devis a été envoyé au client.' })
                              loadData()
                            } catch {
                              addToast({ type: 'error', title: 'Erreur', message: 'Impossible d\'envoyer le devis.' })
                            }
                          }}>
                            <i className="bi bi-send"></i>
                          </button>
                        )}
                        {d.statut === 'envoye' && perms.canValidateDevis && (
                          <>
                            <button className="btn btn-sm btn-outline-success me-1" onClick={async () => {
                              try {
                                await commercialService.validerDevis(d.id, true)
                                addToast({ type: 'success', title: 'Validé', message: 'Le devis a été accepté.' })
                                loadData()
                              } catch {
                                addToast({ type: 'error', title: 'Erreur', message: 'Impossible de valider le devis.' })
                              }
                            }}>
                              <i className="bi bi-check-lg"></i>
                            </button>
                            <button className="btn btn-sm btn-outline-danger me-1" onClick={async () => {
                              try {
                                await commercialService.validerDevis(d.id, false)
                                addToast({ type: 'warning', title: 'Refusé', message: 'Le devis a été refusé.' })
                                loadData()
                              } catch {
                                addToast({ type: 'error', title: 'Erreur', message: 'Impossible de refuser le devis.' })
                              }
                            }}>
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </>
                        )}
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
                  <th>No Facture</th>
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
                    <p className="text-muted small mb-1"><i className="bi bi-envelope me-2"></i>{c.email || '-'}</p>
                    <p className="text-muted small mb-0"><i className="bi bi-telephone me-2"></i>{c.telephone || '-'}</p>
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
                     <td className="small text-muted">{ctr.date_debut} <i className="bi bi-arrow-right"></i> {ctr.date_fin}</td>
                     <td><span className="badge bg-success bg-opacity-10 text-success border">{ctr.statut}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'chantiers' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>No Chantier</th>
                  <th>Nom</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Budget Prévu</th>
                  <th>Budget Réel</th>
                  <th>Date Début</th>
                  <th>Date Fin Prévue</th>
                </tr>
              </thead>
              <tbody>
                {chantiers.map(c => (
                  <tr key={c.id}>
                    <td className="font-monospace fw-bold text-dark">{c.numero}</td>
                    <td className="fw-semibold">{c.nom}</td>
                    <td>{c.client_id ? `Client #${c.client_id}` : '-'}</td>
                    <td>
                      <span className={`badge ${c.statut === 'en_cours' ? 'bg-success bg-opacity-10 text-success border' : c.statut === 'termine' ? 'bg-light text-dark border' : 'bg-warning bg-opacity-10 text-dark border'}`}>
                        {c.statut}
                      </span>
                    </td>
                    <td className="font-monospace">{c.budget_prevu?.toLocaleString()} MGA</td>
                    <td className="font-monospace text-secondary">{c.budget_reel?.toLocaleString()} MGA</td>
                    <td className="small text-muted">{c.date_debut || '-'}</td>
                    <td className="small text-muted">{c.date_fin_prevue || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'avenants' ? (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>No Avenant</th>
                  <th>Contrat</th>
                  <th>Description</th>
                  <th>Impact Montant</th>
                  <th>Date Signature</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {avenants.map(a => (
                  <tr key={a.id}>
                    <td className="font-monospace fw-bold text-dark">{a.numero}</td>
                    <td className="fw-semibold">Contrat #{a.contrat_id}</td>
                    <td>{a.description || '-'}</td>
                    <td className="font-monospace">{a.impact_montant?.toLocaleString()} MGA</td>
                    <td className="small text-muted">{a.date_signature || '-'}</td>
                    <td>
                      <span className={`badge ${a.statut === 'signe' ? 'bg-success bg-opacity-10 text-success border' : 'bg-warning bg-opacity-10 text-dark border'}`}>
                        {a.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'demandes' ? (
        <DemandeTravauxTab />
      ) : activeTab === 'projets' ? (
        <ProjetsTab />
      ) : activeTab === 'metres' ? (
        <MetresTab />
      ) : activeTab === 'situations' ? (
        <SituationsTab />
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
                    <td className="font-monospace small text-muted">{p.reference || '-'}</td>
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
                    <div className="col-12">
                      <label className="form-label fw-semibold">Client *</label>
                      <select className="form-select" required value={devisForm.client_id || ''} onChange={e => setDevisForm({ ...devisForm, client_id: Number(e.target.value) })}>
                        <option value="">Sélectionner un client</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.entreprise || `${c.nom} ${c.prenom}`}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Numéro Devis *</label>
                      <input type="text" className="form-control font-monospace" required value={devisForm.numero || ''} onChange={e => setDevisForm({ ...devisForm, numero: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Statut</label>
                      <select className="form-select" value={devisForm.statut || 'brouillon'} onChange={e => setDevisForm({ ...devisForm, statut: e.target.value as StatutDevis })}>
                        <option value="brouillon">Brouillon</option>
                        <option value="envoye">Envoyé</option>
                        <option value="accepte">Accepté</option>
                        <option value="refuse">Refusé</option>
                        <option value="expire">Expiré</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Objet</label>
                      <input type="text" className="form-control" value={devisForm.objet || ''} onChange={e => setDevisForm({ ...devisForm, objet: e.target.value })} />
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
                      <small className="text-muted d-block">Montant Calculé TTC</small>
                      <h3 className="fw-bold text-secondary mb-0">
                        {((Number(devisForm.montant_ht || 0)) * (1 + (Number(devisForm.tva || 20) / 100))).toLocaleString()} MGA
                      </h3>
                    </div>
                    <div className="col-12 mt-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">Lignes de devis</h6>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addEmptyLine}><i className="bi bi-plus-lg me-1"></i>Ajouter ligne</button>
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
                            {lines.filter(l => !l._deleted).map((l, idx) => (
                              <tr key={idx}>
                                <td>
                                  <select className="form-select form-select-sm" value={l.categorie || 'materiaux'} onChange={e => updateLineField(idx, 'categorie', e.target.value)}>
                                    <option value="materiaux">Matériaux</option>
                                    <option value="main-d_oeuvre">Main-d'oeuvre</option>
                                    <option value="materiel_et_engins">Matériel et engins</option>
                                    <option value="prestations">Prestations</option>
                                    <option value="sous_traitance">Sous-traitance</option>
                                    <option value="autres_frais">Autres frais</option>
                                  </select>
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" value={l.description || ''} onChange={e => updateLineField(idx, 'description', e.target.value)} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" type="number" value={l.quantite || 0} onChange={e => updateLineField(idx, 'quantite', Number(e.target.value))} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" type="number" value={l.prix_unitaire || 0} onChange={e => updateLineField(idx, 'prix_unitaire', Number(e.target.value))} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" type="number" value={l.remise || 0} onChange={e => updateLineField(idx, 'remise', Number(e.target.value))} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" type="number" value={l.taux_tva || devisForm.tva || 20} onChange={e => updateLineField(idx, 'taux_tva', Number(e.target.value))} />
                                </td>
                                <td className="font-monospace">{Number(l.total_ttc || 0).toLocaleString()} MGA</td>
                                <td>
                                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => markLineDeleted(idx)}><i className="bi bi-trash"></i></button>
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
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowDevisModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Générer le devis</button>
                </div>
              </form>
            </div>
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
                      <label className="form-label fw-semibold">Type de client *</label>
                      <select className="form-select" required value={clientForm.type || 'particulier'} onChange={e => setClientForm({ ...clientForm, type: e.target.value as TypeClient })}>
                        <option value="particulier">Particulier</option>
                        <option value="entreprise">Entreprise</option>
                        <option value="administration_publique">Administration publique</option>
                        <option value="association">Association</option>
                        <option value="ong">ONG</option>
                        <option value="promoteur_immobilier">Promoteur immobilier</option>
                      </select>
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Civilité</label>
                      <select className="form-select" value={clientForm.civilite || ''} onChange={e => setClientForm({ ...clientForm, civilite: e.target.value })}>
                        <option value="">-</option>
                        <option value="M">M.</option>
                        <option value="Mme">Mme</option>
                        <option value="Mx">Mx</option>
                      </select>
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Nom *</label>
                      <input type="text" className="form-control" required value={clientForm.nom || ''} onChange={e => setClientForm({ ...clientForm, nom: e.target.value })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Prénom</label>
                      <input type="text" className="form-control" value={clientForm.prenom || ''} onChange={e => setClientForm({ ...clientForm, prenom: e.target.value })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Entreprise / Raison sociale</label>
                      <input type="text" className="form-control" value={clientForm.entreprise || ''} onChange={e => setClientForm({ ...clientForm, entreprise: e.target.value })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">SIRET</label>
                      <input type="text" className="form-control" value={clientForm.siret || ''} onChange={e => setClientForm({ ...clientForm, siret: e.target.value })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">No TVA</label>
                      <input type="text" className="form-control" value={clientForm.numero_tva || ''} onChange={e => setClientForm({ ...clientForm, numero_tva: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Email</label>
                      <input type="email" className="form-control" value={clientForm.email || ''} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Téléphone</label>
                      <input type="text" className="form-control" value={clientForm.telephone || ''} onChange={e => setClientForm({ ...clientForm, telephone: e.target.value })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Portable</label>
                      <input type="text" className="form-control" value={clientForm.portable || ''} onChange={e => setClientForm({ ...clientForm, portable: e.target.value })} />
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
                    <label className="form-label fw-semibold">Client *</label>
                    <select className="form-select" required value={factureForm.client_id || ''} onChange={e => setFactureForm({ ...factureForm, client_id: Number(e.target.value) })}>
                      <option value="">Sélectionner un client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.entreprise || `${c.nom} ${c.prenom}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Numéro Facture *</label>
                    <input type="text" className="form-control font-monospace" required value={factureForm.numero || ''} onChange={e => setFactureForm({ ...factureForm, numero: e.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Type</label>
                    <select className="form-select" value={factureForm.type || 'standard'} onChange={e => setFactureForm({ ...factureForm, type: e.target.value as TypeFacture })}>
                      <option value="standard">Standard</option>
                      <option value="acompte">Acompte</option>
                      <option value="solde">Solde</option>
                      <option value="avoir">Avoir</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Statut</label>
                    <select className="form-select" value={factureForm.statut || 'emis'} onChange={e => setFactureForm({ ...factureForm, statut: e.target.value as StatutFacture })}>
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
                                    <option value="main-d_oeuvre">Main-d'oeuvre</option>
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

      {/* Modal Paiement Builder */}
      {showPaiementModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Enregistrer un Paiement</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaiementModal(false)}></button>
              </div>
              <form onSubmit={handleSavePaiement}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-semibold">Facture *</label>
                      <select className="form-select" required value={paiementForm.facture_id || ''} onChange={e => {
                        const factureId = Number(e.target.value)
                        setPaiementForm({ ...paiementForm, facture_id: factureId || undefined, montant: 0 })
                      }}>
                        <option value="">Sélectionner une facture</option>
                        {factures.map(f => {
                          const paye = f.montant_paye || 0
                          const ttc = f.montant_ttc || 0
                          const reste = (ttc - paye)
                          return (
                            <option key={f.id} value={f.id}>{f.numero} - Reste: {reste.toLocaleString()} MGA</option>
                          )
                        })}
                      </select>
                    </div>
                    {paiementForm.facture_id && (() => {
                      const facture = factures.find(f => f.id === paiementForm.facture_id)
                      if (!facture) return null
                      const paye = facture.montant_paye || 0
                      const ttc = facture.montant_ttc || 0
                      const reste = (ttc - paye)
                      return (
                        <div className="col-12">
                          <div className="alert alert-info py-2 mb-0">
                            <small>Montant TTC: <strong>{ttc.toLocaleString()} MGA</strong> | Déjà payé: <strong>{paye.toLocaleString()} MGA</strong> | Reste à payer: <strong>{reste.toLocaleString()} MGA</strong></small>
                          </div>
                        </div>
                      )
                    })()}
                    <div className="col-12">
                      <label className="form-label fw-semibold">Montant (MGA) *</label>
                      <input type="number" className="form-control" required min="0" step="0.01" value={paiementForm.montant || 0} onChange={e => setPaiementForm({ ...paiementForm, montant: Number(e.target.value) })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Mode de règlement</label>
                      <select className="form-select" value={paiementForm.mode_paiement || 'virement'} onChange={e => setPaiementForm({ ...paiementForm, mode_paiement: e.target.value })}>
                        <option value="virement">Virement</option>
                        <option value="cheque">Chèque</option>
                        <option value="espece">Espèce</option>
                        <option value="mobile_money">Mobile Money</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Référence transaction</label>
                      <input type="text" className="form-control" value={paiementForm.reference || ''} onChange={e => setPaiementForm({ ...paiementForm, reference: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Notes</label>
                      <textarea className="form-control" rows={2} value={paiementForm.notes || ''} onChange={e => setPaiementForm({ ...paiementForm, notes: e.target.value })}></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPaiementModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Enregistrer le paiement</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chantier Builder */}
      {showChantierModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{selectedChantier ? 'Éditer le Chantier' : 'Créer un Chantier'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowChantierModal(false)}></button>
              </div>
              <form onSubmit={handleSaveChantier}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Nom *</label>
                      <input type="text" className="form-control" required value={chantierForm.nom || ''} onChange={e => setChantierForm({ ...chantierForm, nom: e.target.value })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Numéro</label>
                      <input type="text" className="form-control font-monospace" value={chantierForm.numero || ''} onChange={e => setChantierForm({ ...chantierForm, numero: e.target.value })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Statut</label>
                      <select className="form-select" value={chantierForm.statut || 'planification'} onChange={e => setChantierForm({ ...chantierForm, statut: e.target.value as StatutChantier })}>
                        <option value="planification">Planification</option>
                        <option value="en_cours">En cours</option>
                        <option value="termine">Terminé</option>
                        <option value="resilie">Résilié</option>
                      </select>
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Contrat</label>
                      <select className="form-select" value={chantierForm.contrat_id || ''} onChange={e => setChantierForm({ ...chantierForm, contrat_id: Number(e.target.value) || undefined })}>
                        <option value="">Sélectionner un contrat</option>
                        {contrats.map(ctr => (
                          <option key={ctr.id} value={ctr.id}>{ctr.reference}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Client</label>
                      <select className="form-select" value={chantierForm.client_id || ''} onChange={e => setChantierForm({ ...chantierForm, client_id: Number(e.target.value) || undefined })}>
                        <option value="">Sélectionner un client</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.entreprise || `${c.nom} ${c.prenom}`}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Budget prévu (MGA)</label>
                      <input type="number" className="form-control font-monospace" value={chantierForm.budget_prevu || 0} onChange={e => setChantierForm({ ...chantierForm, budget_prevu: Number(e.target.value) })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Marge cible (%)</label>
                      <input type="number" className="form-control font-monospace" value={chantierForm.marge_cible || 0} onChange={e => setChantierForm({ ...chantierForm, marge_cible: Number(e.target.value) })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea className="form-control" rows={2} value={chantierForm.description || ''} onChange={e => setChantierForm({ ...chantierForm, description: e.target.value })}></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowChantierModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Créer le chantier</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Modal Avenant Builder */}
      {showAvenantModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{selectedAvenant ? 'Éditer l\'Avenant' : 'Créer un Avenant'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAvenantModal(false)}></button>
              </div>
              <form onSubmit={handleSaveAvenant}>
                <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Contrat *</label>
                    <select className="form-select" required value={avenantForm.contrat_id || ''} onChange={e => setAvenantForm({ ...avenantForm, contrat_id: Number(e.target.value) })}>
                      <option value="">Sélectionner un contrat</option>
                      {contrats.map(ctr => (
                        <option key={ctr.id} value={ctr.id}>{ctr.reference}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">No Avenant *</label>
                    <input type="text" className="form-control font-monospace" required value={avenantForm.numero || ''} onChange={e => setAvenantForm({ ...avenantForm, numero: e.target.value })} />
                  </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea className="form-control" rows={2} value={avenantForm.description || ''} onChange={e => setAvenantForm({ ...avenantForm, description: e.target.value })}></textarea>
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Impact montant (MGA)</label>
                      <input type="number" className="form-control font-monospace" value={avenantForm.impact_montant || 0} onChange={e => setAvenantForm({ ...avenantForm, impact_montant: Number(e.target.value) })} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Date signature</label>
                      <input type="date" className="form-control" value={avenantForm.date_signature || ''} onChange={e => setAvenantForm({ ...avenantForm, date_signature: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Statut</label>
                      <select className="form-select" value={avenantForm.statut || 'propose'} onChange={e => setAvenantForm({ ...avenantForm, statut: e.target.value })}>
                        <option value="propose">Proposé</option>
                        <option value="signe">Signé</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAvenantModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Créer l'avenant</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
