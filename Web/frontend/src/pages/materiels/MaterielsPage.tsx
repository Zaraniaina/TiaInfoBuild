import { useEffect, useState, useMemo } from 'react'
import type { Materiel, Maintenance, MouvementMateriel, CategorieBTP, StatutVGP, Chantier } from '@/types'
import { materielsService } from '@/services/materiels.service'
import { chantiersService } from '@/services/chantiers.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { PageSkeleton } from '@/components/ui/Skeleton'

const PHOTO_ACCEPT = '.jpg,.jpeg,.png'
const MANUEL_ACCEPT = '.pdf'
const VGP_ACCEPT = '.pdf,.jpg,.jpeg,.png'

export function MaterielsPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || 'employe')

  const [activeTab, setActiveTab] = useState<'parc' | 'vgp' | 'transferts' | 'gmao' | 'qrcode'>('parc')
  const [materiels, setMateriels] = useState<Materiel[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [transferts, setTransferts] = useState<MouvementMateriel[]>([])
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)

  // Filtres
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [filterCategorie, setFilterCategorie] = useState<string>('tous')
  const [filterVgp, setFilterVgp] = useState<string>('tous')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showTransfertModal, setShowTransfertModal] = useState(false)
  const [showHorametreModal, setShowHorametreModal] = useState(false)
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  // Selected item
  const [detailMateriel, setDetailMateriel] = useState<Materiel | null>(null)
  const [qrCodeData, setQrCodeData] = useState<{ materiel_id: number; nom: string; numero_serie: string; qr_code_key: string; statut_vgp: string; statut: string } | null>(null)

  // Form states
  const [form, setForm] = useState({
    nom: '',
    marque: '',
    modele: '',
    numero_serie: '',
    immatriculation: '',
    categorie_btp: 'engin_lourd' as CategorieBTP,
    valeur_achat: '',
    heures_moteur: '0',
    statut: 'disponible' as Materiel['statut'],
    organisme_vgp: '',
    date_derniere_vgp: '',
    date_prochaine_vgp: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  // Transfert Form
  const [transfertForm, setTransfertForm] = useState({
    materiel_id: 0,
    chantier_origine_id: '',
    chantier_destination_id: '',
    transporteur: '',
    notes: '',
  })
  const [savingTransfert, setSavingTransfert] = useState(false)

  // Horametre Form
  const [horametreForm, setHorametreForm] = useState({
    heures_moteur: 0,
    kilometrage: 0,
    notes: '',
  })
  const [savingHorametre, setSavingHorametre] = useState(false)

  // Maintenance Form
  const [maintForm, setMaintForm] = useState({
    type: 'Préventive',
    cout: '',
    description: '',
    technicien: '',
    prochaine_date_echeance: '',
  })
  const [savingMaint, setSavingMaint] = useState(false)

  // File Upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingManuel, setUploadingManuel] = useState(false)
  const [uploadingVgp, setUploadingVgp] = useState(false)
  const [normesText, setNormesText] = useState('')
  const [savingNormes, setSavingNormes] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [mats, chs, trs, maints] = await Promise.all([
        materielsService.getAll(),
        chantiersService.getAll().catch(() => []),
        materielsService.getTransferts().catch(() => []),
        materielsService.getMaintenances().catch(() => []),
      ])
      setMateriels(mats || [])
      setChantiers(chs || [])
      setTransferts(trs || [])
      setMaintenances(maints || [])
    } catch (err) {
      console.error('Erreur chargement parc matériel:', err)
      setMateriels([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = materiels.length
    const dispo = materiels.filter(m => m.statut === 'disponible').length
    const enUtil = materiels.filter(m => m.statut === 'en_utilisation').length
    const maint = materiels.filter(m => m.statut === 'en_maintenance' || m.statut === 'en_panne').length
    const vgpPerime = materiels.filter(m => m.statut_vgp === 'perime' || m.statut_vgp === 'echeance_proche').length
    const tauxDispo = total > 0 ? Math.round((dispo / total) * 100) : 0
    return { total, dispo, enUtil, maint, vgpPerime, tauxDispo }
  }, [materiels])

  // Filtered List
  const filteredMateriels = useMemo(() => {
    return materiels.filter(m => {
      const matchSearch = search === '' || 
        m.nom.toLowerCase().includes(search.toLowerCase()) || 
        (m.marque && m.marque.toLowerCase().includes(search.toLowerCase())) ||
        (m.numero_serie && m.numero_serie.toLowerCase().includes(search.toLowerCase())) ||
        (m.immatriculation && m.immatriculation.toLowerCase().includes(search.toLowerCase()))
      
      const matchStatut = filterStatut === 'tous' || m.statut === filterStatut
      const matchCat = filterCategorie === 'tous' || m.categorie_btp === filterCategorie
      const matchVgp = filterVgp === 'tous' || m.statut_vgp === filterVgp

      return matchSearch && matchStatut && matchCat && matchVgp
    })
  }, [materiels, search, filterStatut, filterCategorie, filterVgp])

  // Helpers Badges
  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'disponible': return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-check-circle me-1"></i>Disponible</span>
      case 'en_utilisation': return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1"><i className="bi bi-truck me-1"></i>En Utilisation</span>
      case 'en_maintenance': return <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25 px-2 py-1"><i className="bi bi-tools me-1"></i>En Maintenance</span>
      case 'en_panne': return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i className="bi bi-exclamation-triangle me-1"></i>En Panne</span>
      case 'hors_service': return <span className="badge bg-secondary text-white px-2 py-1"><i className="bi bi-x-circle me-1"></i>Hors Service</span>
      default: return <span className="badge bg-light text-dark border px-2 py-1">{statut}</span>
    }
  }

  const getVgpBadge = (statutVgp?: string) => {
    switch (statutVgp) {
      case 'conforme': return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25"><i className="bi bi-shield-check me-1"></i>VGP Conforme</span>
      case 'echeance_proche': return <span className="badge bg-warning text-dark border border-warning"><i className="bi bi-clock-history me-1"></i>VGP Échéance Proche</span>
      case 'perime': return <span className="badge bg-danger text-white border border-danger fw-bold"><i className="bi bi-shield-x me-1"></i>VGP Périmée</span>
      default: return <span className="badge bg-light text-muted border">Non Assujetti</span>
    }
  }

  const renderCategorieBadge = (cat?: string) => {
    switch (cat) {
      case 'engin_lourd':
        return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25"><i className="bi bi-truck-front me-1"></i>Engin Lourd</span>
      case 'equipement_levage':
        return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25"><i className="bi bi-arrows-move me-1"></i>Levage & Manutention</span>
      case 'vehicule_utilitaire':
        return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25"><i className="bi bi-truck me-1"></i>Véhicule Utilitaire</span>
      case 'petit_outillage':
        return <span className="badge bg-dark bg-opacity-10 text-dark border border-dark border-opacity-25"><i className="bi bi-tools me-1"></i>Petit Outillage</span>
      case 'echafaudage_securite':
        return <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25"><i className="bi bi-shield-lock me-1"></i>Échafaudage & Sécurité</span>
      default:
        return <span className="badge bg-light text-muted border"><i className="bi bi-box-seam me-1"></i>Autre Matériel</span>
    }
  }

  const getCategorieLabel = (cat?: string) => {
    switch (cat) {
      case 'engin_lourd': return 'Engin Lourd'
      case 'equipement_levage': return 'Levage & Manutention'
      case 'vehicule_utilitaire': return 'Véhicule Utilitaire'
      case 'petit_outillage': return 'Petit Outillage'
      case 'echafaudage_securite': return 'Échafaudage & Sécurité'
      default: return 'Autre Matériel'
    }
  }

  // Submit Handler
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await materielsService.create({
        nom: form.nom,
        marque: form.marque || undefined,
        modele: form.modele || undefined,
        numero_serie: form.numero_serie || undefined,
        immatriculation: form.immatriculation || undefined,
        categorie_btp: form.categorie_btp,
        valeur_achat: parseFloat(form.valeur_achat) || 0,
        heures_moteur: parseFloat(form.heures_moteur) || 0,
        statut: form.statut,
        organisme_vgp: form.organisme_vgp || undefined,
        date_derniere_vgp: form.date_derniere_vgp || undefined,
        date_prochaine_vgp: form.date_prochaine_vgp || undefined,
        description: form.description || undefined,
      })
      setShowCreateModal(false)
      setForm({
        nom: '', marque: '', modele: '', numero_serie: '', immatriculation: '',
        categorie_btp: 'engin_lourd', valeur_achat: '', heures_moteur: '0',
        statut: 'disponible', organisme_vgp: '', date_derniere_vgp: '',
        date_prochaine_vgp: '', description: '',
      })
      loadData()
    } catch {
      alert('Erreur lors de la création du matériel')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = (m: Materiel) => {
    setDetailMateriel(m)
    setNormesText(m.normes || '')
    setShowDetailModal(true)
  }

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !detailMateriel) return
    setUploadingPhoto(true)
    try {
      const res = await materielsService.uploadPhoto(detailMateriel.id, file)
      setDetailMateriel({ ...detailMateriel, photo_url: res.photo_url })
      loadData()
    } catch {
      alert('Erreur upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleUploadManuel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !detailMateriel) return
    setUploadingManuel(true)
    try {
      const res = await materielsService.uploadManuel(detailMateriel.id, file)
      setDetailMateriel({ ...detailMateriel, manuel_url: res.manuel_url })
      loadData()
    } catch {
      alert('Erreur upload manuel')
    } finally {
      setUploadingManuel(false)
    }
  }

  const handleUploadVgp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !detailMateriel) return
    setUploadingVgp(true)
    try {
      const res = await materielsService.uploadVGP(detailMateriel.id, file)
      setDetailMateriel({ ...detailMateriel, certificat_vgp_url: res.certificat_vgp_url })
      loadData()
    } catch {
      alert('Erreur upload certificat VGP')
    } finally {
      setUploadingVgp(false)
    }
  }

  const handleSaveNormes = async () => {
    if (!detailMateriel) return
    setSavingNormes(true)
    try {
      await materielsService.update(detailMateriel.id, { normes: normesText })
      setDetailMateriel({ ...detailMateriel, normes: normesText })
      loadData()
    } catch {
      alert('Erreur sauvegarde normes')
    } finally {
      setSavingNormes(false)
    }
  }

  // Create Transfert
  const handleCreateTransfert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transfertForm.materiel_id) return
    setSavingTransfert(true)
    try {
      await materielsService.createTransfert({
        materiel_id: transfertForm.materiel_id,
        chantier_origine_id: transfertForm.chantier_origine_id ? parseInt(transfertForm.chantier_origine_id) : undefined,
        chantier_destination_id: transfertForm.chantier_destination_id ? parseInt(transfertForm.chantier_destination_id) : undefined,
        transporteur: transfertForm.transporteur,
        notes: transfertForm.notes,
      })
      setShowTransfertModal(false)
      loadData()
    } catch {
      alert('Erreur lors de la création du bon de transfert')
    } finally {
      setSavingTransfert(false)
    }
  }

  const handleValiderTransfert = async (id: number) => {
    if (!confirm('Confirmer la réception de ce matériel sur le chantier destination ?')) return
    try {
      await materielsService.validerTransfert(id)
      loadData()
    } catch {
      alert('Erreur validation transfert')
    }
  }

  // Update Horametre
  const handleSaveHorametre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailMateriel) return
    setSavingHorametre(true)
    try {
      const updated = await materielsService.updateHorametre(detailMateriel.id, {
        heures_moteur: horametreForm.heures_moteur,
        kilometrage: horametreForm.kilometrage,
      })
      setDetailMateriel(updated)
      setShowHorametreModal(false)
      loadData()
    } catch {
      alert('Erreur mise à jour horamètre')
    } finally {
      setSavingHorametre(false)
    }
  }

  // Create Maintenance
  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailMateriel) return
    setSavingMaint(true)
    try {
      await materielsService.addMaintenance(detailMateriel.id, {
        type: maintForm.type,
        cout: parseFloat(maintForm.cout) || 0,
        description: maintForm.description,
        technicien: maintForm.technicien,
        prochaine_date_echeance: maintForm.prochaine_date_echeance || undefined,
        date_maintenance: new Date().toISOString().split('T')[0],
      })
      setShowMaintenanceModal(false)
      setMaintForm({ type: 'Préventive', cout: '', description: '', technicien: '', prochaine_date_echeance: '' })
      // Re-fetch detail
      const refreshed = await materielsService.getOne(detailMateriel.id)
      setDetailMateriel(refreshed)
      loadData()
    } catch {
      alert('Erreur enregistrement maintenance')
    } finally {
      setSavingMaint(false)
    }
  }

  // Open QR Modal
  const openQrModal = async (m: Materiel) => {
    try {
      const data = await materielsService.getQRCode(m.id)
      setQrCodeData(data)
      setShowQrModal(true)
    } catch {
      alert('Erreur récupération QR code')
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="container-fluid py-4 px-4">
      {/* Top Banner Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="fw-bold text-dark mb-1">
            <i className="bi bi-truck me-2 text-primary"></i>Gestion du Parc Matériel & Conformité BTP
          </h4>
          <p className="text-muted small mb-0">
            Rôle Responsable Matériel — Suivi des engins, contrôle VGP, carnet de bord horamètre et bons de transfert.
          </p>
        </div>
        <div className="d-flex gap-2">
          {perms.canCreateMateriel && (
            <button className="btn btn-primary shadow-sm rounded-pill px-3" onClick={() => setShowCreateModal(true)}>
              <i className="bi bi-plus-lg me-1"></i>Nouveau Matériel BTP
            </button>
          )}
          <button className="btn btn-outline-secondary rounded-pill px-3" onClick={() => {
            setTransfertForm({ materiel_id: materiels[0]?.id || 0, chantier_origine_id: '', chantier_destination_id: '', transporteur: '', notes: '' })
            setShowTransfertModal(true)
          }}>
            <i className="bi bi-arrow-left-right me-1"></i>Nouveau Transfert
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold">Total Parc</span>
                <span className="badge bg-primary bg-opacity-10 text-primary p-2 rounded-circle"><i className="bi bi-box-seam"></i></span>
              </div>
              <h3 className="fw-bold mb-0">{kpis.total}</h3>
              <small className="text-muted">Équipements répertoriés</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold">Disponibilité</span>
                <span className="badge bg-success bg-opacity-10 text-success p-2 rounded-circle"><i className="bi bi-check-circle"></i></span>
              </div>
              <h3 className="fw-bold mb-0 text-success">{kpis.dispo}</h3>
              <small className="text-muted">Taux d'utilisation: {kpis.tauxDispo}%</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold">Sur Chantier</span>
                <span className="badge bg-info bg-opacity-10 text-info p-2 rounded-circle"><i className="bi bi-geo-alt"></i></span>
              </div>
              <h3 className="fw-bold mb-0 text-info">{kpis.enUtil}</h3>
              <small className="text-muted">En activité terrain</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold">Maintenance/Pannes</span>
                <span className="badge bg-warning bg-opacity-10 text-warning p-2 rounded-circle"><i className="bi bi-tools"></i></span>
              </div>
              <h3 className="fw-bold mb-0 text-warning">{kpis.maint}</h3>
              <small className="text-muted">Interventions en cours</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-4">
          <div className={`card border-0 shadow-sm rounded-3 h-100 ${kpis.vgpPerime > 0 ? 'bg-danger bg-opacity-10 border border-danger' : 'bg-white'}`}>
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className={`small fw-semibold ${kpis.vgpPerime > 0 ? 'text-danger fw-bold' : 'text-muted'}`}>Alertes VGP Réglementaires</span>
                <span className={`badge ${kpis.vgpPerime > 0 ? 'bg-danger text-white' : 'bg-success bg-opacity-10 text-success'} p-2 rounded-circle`}>
                  <i className="bi bi-shield-exclamation"></i>
                </span>
              </div>
              <h3 className={`fw-bold mb-0 ${kpis.vgpPerime > 0 ? 'text-danger' : 'text-dark'}`}>{kpis.vgpPerime}</h3>
              <small className={kpis.vgpPerime > 0 ? 'text-danger fw-semibold' : 'text-muted'}>
                {kpis.vgpPerime > 0 ? 'Contrôles VGP urgents ou périmés !' : 'Tous les contrôles VGP sont à jour'}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <ul className="nav nav-pills custom-pills mb-4 bg-white p-2 rounded-3 shadow-sm border gap-1">
        <li className="nav-item">
          <button className={`nav-item nav-link rounded-2 px-3 fw-semibold ${activeTab === 'parc' ? 'active bg-primary text-white' : 'text-secondary'}`} onClick={() => setActiveTab('parc')}>
            <i className="bi bi-grid me-2"></i>Parc Matériel
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-item nav-link rounded-2 px-3 fw-semibold ${activeTab === 'vgp' ? 'active bg-primary text-white' : 'text-secondary'}`} onClick={() => setActiveTab('vgp')}>
            <i className="bi bi-shield-check me-2"></i>Normes BTP & VGP {kpis.vgpPerime > 0 && <span className="badge bg-danger ms-1">{kpis.vgpPerime}</span>}
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-item nav-link rounded-2 px-3 fw-semibold ${activeTab === 'transferts' ? 'active bg-primary text-white' : 'text-secondary'}`} onClick={() => setActiveTab('transferts')}>
            <i className="bi bi-arrow-left-right me-2"></i>Mouvements & Bons de Transfert ({transferts.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-item nav-link rounded-2 px-3 fw-semibold ${activeTab === 'gmao' ? 'active bg-primary text-white' : 'text-secondary'}`} onClick={() => setActiveTab('gmao')}>
            <i className="bi bi-tools me-2"></i>GMAO & Maintenance ({maintenances.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-item nav-link rounded-2 px-3 fw-semibold ${activeTab === 'qrcode' ? 'active bg-primary text-white' : 'text-secondary'}`} onClick={() => setActiveTab('qrcode')}>
            <i className="bi bi-qr-code-scan me-2"></i>Carnet Horamètre & QR Codes
          </button>
        </li>
      </ul>

      {/* Filter Bar */}
      {activeTab === 'parc' && (
        <div className="card border-0 shadow-sm mb-4 rounded-3">
          <div className="card-body p-3">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-4">
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted"></i></span>
                  <input
                    type="text"
                    className="form-control border-start-0 ps-0"
                    placeholder="Recherche engin, marque, n° de série, immatriculation..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-6 col-md-2">
                <select className="form-select" value={filterCategorie} onChange={(e) => setFilterCategorie(e.target.value)}>
                  <option value="tous">Toutes catégories BTP</option>
                  <option value="engin_lourd">Engins Lourds</option>
                  <option value="equipement_levage">Levage & Manutention</option>
                  <option value="vehicule_utilitaire">Véhicules Utilitaires</option>
                  <option value="petit_outillage">Petit Outillage</option>
                  <option value="echafaudage_securite">Échafaudages & Sécurité</option>
                </select>
              </div>
              <div className="col-6 col-md-2">
                <select className="form-select" value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
                  <option value="tous">Tous statuts</option>
                  <option value="disponible">Disponible</option>
                  <option value="en_utilisation">En Utilisation</option>
                  <option value="en_maintenance">En Maintenance</option>
                  <option value="en_panne">En Panne</option>
                  <option value="hors_service">Hors Service</option>
                </select>
              </div>
              <div className="col-6 col-md-2">
                <select className="form-select" value={filterVgp} onChange={(e) => setFilterVgp(e.target.value)}>
                  <option value="tous">Tous VGP</option>
                  <option value="conforme">Conforme</option>
                  <option value="echeance_proche">Échéance Proche</option>
                  <option value="perime">Périmée</option>
                </select>
              </div>
              <div className="col-6 col-md-2 text-end">
                <button className="btn btn-outline-secondary w-100" onClick={() => { setSearch(''); setFilterStatut('tous'); setFilterCategorie('tous'); setFilterVgp('tous'); }}>
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: PARC MATÉRIEL */}
      {activeTab === 'parc' && (
        <>
          {filteredMateriels.length === 0 ? (
            <div className="text-center py-5 text-muted bg-white rounded-3 shadow-sm">
              <i className="bi bi-truck text-muted" style={{ fontSize: 54 }}></i>
              <h5 className="mt-3">Aucun matériel trouvé</h5>
              <p className="small text-muted">Ajustez vos filtres ou créez une nouvelle fiche matériel BTP.</p>
            </div>
          ) : (
            <div className="row g-3">
              {filteredMateriels.map((m) => (
                <div key={m.id} className="col-12 col-md-6 col-xl-4">
                  <div className="card h-100 border-0 shadow-sm rounded-3 hover-shadow transition">
                    <div className="card-body p-3">
                      <div className="d-flex align-items-start mb-3">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt={m.nom} className="rounded-3 me-3 border" style={{ width: 68, height: 68, objectFit: 'cover' }} />
                        ) : (
                          <div className="bg-light rounded-3 me-3 d-flex align-items-center justify-content-center border" style={{ width: 68, height: 68 }}>
                            <i className="bi bi-truck text-muted fs-3"></i>
                          </div>
                        )}
                        <div className="flex-grow-1 min-w-0">
                          <div className="d-flex justify-content-between align-items-start">
                            <h6 className="fw-bold mb-0 text-truncate">{m.nom}</h6>
                          </div>
                          <div className="mb-2">{renderCategorieBadge(m.categorie_btp)}</div>
                          <div className="d-flex gap-1 flex-wrap">
                            {getStatutBadge(m.statut)}
                            {getVgpBadge(m.statut_vgp)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-light p-2 rounded-2 small mb-3">
                        <div className="row g-1">
                          <div className="col-6"><strong>Marque:</strong> {m.marque || '—'}</div>
                          <div className="col-6"><strong>N° Série:</strong> {m.numero_serie || '—'}</div>
                          <div className="col-6"><strong>Immat:</strong> {m.immatriculation || '—'}</div>
                          <div className="col-6"><strong>Horamètre:</strong> {m.heures_moteur || 0} h</div>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center small text-muted border-top pt-2">
                        <span><strong>Valeur:</strong> {m.valeur_achat ? m.valeur_achat.toLocaleString() + ' MGA' : 'N/A'}</span>
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-light border text-primary" onClick={() => openQrModal(m)} title="QR Code">
                            <i className="bi bi-qr-code"></i>
                          </button>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => openDetail(m)}>
                            <i className="bi bi-eye me-1"></i>Fiche complète
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: NORMES BTP & VGP */}
      {activeTab === 'vgp' && (
        <div className="card border-0 shadow-sm rounded-3">
          <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="mb-0 fw-bold"><i className="bi bi-shield-check text-primary me-2"></i>Registre des Visites Générales Périodiques (VGP)</h6>
            <span className="badge bg-primary bg-opacity-10 text-primary">Conformité Légale BTP</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Équipement / Engin</th>
                    <th>Catégorie BTP</th>
                    <th>N° Série / Immat</th>
                    <th>Organisme VGP</th>
                    <th>Dernier Contrôle</th>
                    <th>Prochain Contrôle</th>
                    <th>Statut VGP</th>
                    <th>Certificat PDF</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materiels.map(m => (
                    <tr key={m.id} className={m.statut_vgp === 'perime' ? 'table-danger' : m.statut_vgp === 'echeance_proche' ? 'table-warning' : ''}>
                      <td className="fw-semibold">{m.nom}</td>
                      <td>{renderCategorieBadge(m.categorie_btp)}</td>
                      <td><small className="text-dark font-monospace">{m.numero_serie || m.immatriculation || '—'}</small></td>
                      <td>{m.organisme_vgp || <span className="text-muted small">Non renseigné</span>}</td>
                      <td>{m.date_derniere_vgp || '—'}</td>
                      <td className="fw-bold">{m.date_prochaine_vgp || '—'}</td>
                      <td>{getVgpBadge(m.statut_vgp)}</td>
                      <td>
                        {m.certificat_vgp_url ? (
                          <a href={m.certificat_vgp_url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-success">
                            <i className="bi bi-file-pdf me-1"></i>PV VGP
                          </a>
                        ) : (
                          <span className="text-muted small">Aucun PV</span>
                        )}
                      </td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => openDetail(m)}>
                          Mettre à jour VGP
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BONS DE TRANSFERT */}
      {activeTab === 'transferts' && (
        <div className="card border-0 shadow-sm rounded-3">
          <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="mb-0 fw-bold"><i className="bi bi-arrow-left-right text-primary me-2"></i>Bons de Mouvement & Transferts Inter-Chantiers</h6>
            <button className="btn btn-sm btn-primary rounded-pill" onClick={() => setShowTransfertModal(true)}>
              <i className="bi bi-plus-lg me-1"></i>Créer un bon de mouvement
            </button>
          </div>
          <div className="card-body p-0">
            {transferts.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-truck text-muted" style={{ fontSize: 40 }}></i>
                <p className="mt-2">Aucun transfert enregistré.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Ref. Matériel</th>
                      <th>Chantier Origine</th>
                      <th>Chantier Destination</th>
                      <th>Transporteur</th>
                      <th>Date Départ</th>
                      <th>Date Réception</th>
                      <th>Statut</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferts.map(t => {
                      const mat = materiels.find(m => m.id === t.materiel_id)
                      const orig = chantiers.find(c => c.id === t.chantier_origine_id)
                      const dest = chantiers.find(c => c.id === t.chantier_destination_id)
                      return (
                        <tr key={t.id}>
                          <td className="fw-bold">{mat?.nom || `Matériel #${t.materiel_id}`}</td>
                          <td>{orig?.nom || 'Dépôt principal'}</td>
                          <td>{dest?.nom || 'Nouveau chantier'}</td>
                          <td>{t.transporteur || '—'}</td>
                          <td>{new Date(t.date_depart).toLocaleDateString()}</td>
                          <td>{t.date_reception ? new Date(t.date_reception).toLocaleDateString() : '—'}</td>
                          <td>
                            {t.statut === 'en_transit' ? (
                              <span className="badge bg-warning text-dark"><i className="bi bi-truck me-1"></i>En Transit</span>
                            ) : t.statut === 'livre' ? (
                              <span className="badge bg-success"><i className="bi bi-check-lg me-1"></i>Reçu / Livré</span>
                            ) : (
                              <span className="badge bg-secondary">{t.statut}</span>
                            )}
                          </td>
                          <td className="text-end">
                            {t.statut === 'en_transit' && (
                              <button className="btn btn-sm btn-success" onClick={() => handleValiderTransfert(t.id)}>
                                Confirmer Réception
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: GMAO & MAINTENANCE */}
      {activeTab === 'gmao' && (
        <div className="card border-0 shadow-sm rounded-3">
          <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 className="mb-0 fw-bold"><i className="bi bi-tools text-primary me-2"></i>Historique des Maintenances & Réparations</h6>
          </div>
          <div className="card-body p-0">
            {maintenances.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-wrench text-muted" style={{ fontSize: 40 }}></i>
                <p className="mt-2">Aucune intervention enregistrée.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Équipement</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Technicien / Prestataire</th>
                      <th>Coût Total</th>
                      <th>Échéance Suivante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenances.map(m => {
                      const mat = materiels.find(x => x.id === m.materiel_id)
                      return (
                        <tr key={m.id}>
                          <td className="fw-bold">{mat?.nom || `Matériel #${m.materiel_id}`}</td>
                          <td>{m.date_maintenance}</td>
                          <td><span className="badge bg-info bg-opacity-10 text-info">{m.type || 'Intervention'}</span></td>
                          <td>{m.description || '—'}</td>
                          <td>{m.technicien || '—'}</td>
                          <td className="fw-bold text-dark">{m.cout?.toLocaleString()} MGA</td>
                          <td>{m.prochaine_date_echeance || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CARNET HORAMÈTRE & QR CODES */}
      {activeTab === 'qrcode' && (
        <div className="row g-3">
          {materiels.map(m => (
            <div key={m.id} className="col-12 col-md-6 col-lg-4">
              <div className="card border-0 shadow-sm rounded-3">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold mb-0">{m.nom}</h6>
                    {getVgpBadge(m.statut_vgp)}
                  </div>
                  <p className="text-muted small mb-2">N° Série: {m.numero_serie || '—'} | Immat: {m.immatriculation || '—'}</p>
                  
                  <div className="bg-light p-3 rounded-3 mb-3 text-center">
                    <div className="row">
                      <div className="col-6 border-end">
                        <small className="text-muted d-block">Horamètre Moteur</small>
                        <span className="fs-5 fw-bold text-primary">{m.heures_moteur || 0} hrs</span>
                      </div>
                      <div className="col-6">
                        <small className="text-muted d-block">Compteur Km</small>
                        <span className="fs-5 fw-bold text-dark">{m.kilometrage || 0} km</span>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary flex-grow-1" onClick={() => {
                      setDetailMateriel(m)
                      setHorametreForm({ heures_moteur: m.heures_moteur || 0, kilometrage: m.kilometrage || 0, notes: '' })
                      setShowHorametreModal(true)
                    }}>
                      <i className="bi bi-speedometer2 me-1"></i>Mettre à jour relevé
                    </button>
                    <button className="btn btn-sm btn-dark" onClick={() => openQrModal(m)} title="Imprimer QR Code">
                      <i className="bi bi-qr-code me-1"></i>Badge QR
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NOUVEAU MATÉRIEL BTP */}
      {showCreateModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'var(--overlay)' }} tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <form onSubmit={handleCreate}>
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title fw-bold"><i className="bi bi-plus-circle me-2"></i>Nouveau Matériel BTP & Engin</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Désignation / Nom de l'engin *</label>
                      <input className="form-control" required placeholder="Ex: Pelle chenille Caterpillar 320" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Catégorie BTP *</label>
                      <select className="form-select" value={form.categorie_btp} onChange={e => setForm({ ...form, categorie_btp: e.target.value as CategorieBTP })}>
                        <option value="engin_lourd">Engin Lourd (Pelle, Bull, Chargeuse)</option>
                        <option value="equipement_levage">Levage & Manutention (Grue, Nacelle, Maniscopic)</option>
                        <option value="vehicule_utilitaire">Véhicule Utilitaire (Camion benne, Camionnette)</option>
                        <option value="petit_outillage">Petit Outillage (Groupe électrogène, Marteau pilon)</option>
                        <option value="echafaudage_securite">Échafaudage & Sécurité</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Marque</label>
                      <input className="form-control" placeholder="Caterpillar, Komatsu..." value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Modèle</label>
                      <input className="form-control" placeholder="320 GX..." value={form.modele} onChange={e => setForm({ ...form, modele: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">N° de Série (Châssis)</label>
                      <input className="form-control font-monospace" placeholder="CAT0320X..." value={form.numero_serie} onChange={e => setForm({ ...form, numero_serie: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Immatriculation</label>
                      <input className="form-control font-monospace text-uppercase" placeholder="1234 TBG" value={form.immatriculation} onChange={e => setForm({ ...form, immatriculation: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Valeur d'Achat (MGA)</label>
                      <input type="number" className="form-control" placeholder="0" min="0" value={form.valeur_achat} onChange={e => setForm({ ...form, valeur_achat: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Horamètre Initial (heures)</label>
                      <input type="number" className="form-control" min="0" value={form.heures_moteur} onChange={e => setForm({ ...form, heures_moteur: e.target.value })} />
                    </div>
                    
                    <div className="col-12 border-top pt-3 mt-3">
                      <h6 className="fw-bold text-primary"><i className="bi bi-shield-check me-1"></i>Conformité VGP Réglementaire</h6>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Organisme de contrôle VGP</label>
                      <input className="form-control" placeholder="Bureau Veritas, Dekra, Apave..." value={form.organisme_vgp} onChange={e => setForm({ ...form, organisme_vgp: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Dernière VGP</label>
                      <input type="date" className="form-control" value={form.date_derniere_vgp} onChange={e => setForm({ ...form, date_derniere_vgp: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Prochaine Échéance VGP</label>
                      <input type="date" className="form-control" value={form.date_prochaine_vgp} onChange={e => setForm({ ...form, date_prochaine_vgp: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreateModal(false)} disabled={saving}>Annuler</button>
                  <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Créer Fiche Matériel'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FICHE DÉTAILLÉE MATÉRIEL */}
      {showDetailModal && detailMateriel && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'var(--overlay)' }} tabIndex={-1}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold"><i className="bi bi-truck me-2"></i>Fiche Technique: {detailMateriel.nom}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDetailModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="row g-4">
                  {/* Photo & PDF Documents */}
                  <div className="col-md-4 border-end">
                    <h6 className="fw-bold mb-3"><i className="bi bi-image me-1"></i>Photo de l'équipement</h6>
                    {detailMateriel.photo_url ? (
                      <img src={detailMateriel.photo_url} alt={detailMateriel.nom} className="img-fluid rounded-3 border mb-3 shadow-sm w-100" style={{ maxHeight: 220, objectFit: 'cover' }} />
                    ) : (
                      <div className="bg-light rounded-3 d-flex align-items-center justify-content-center mb-3 border" style={{ height: 160 }}>
                        <span className="text-muted">Aucune photo</span>
                      </div>
                    )}
                    <label className="btn btn-sm btn-outline-primary w-100 mb-3" style={{ opacity: uploadingPhoto ? 0.6 : 1 }}>
                      {uploadingPhoto ? 'Chargement...' : <><i className="bi bi-upload me-1"></i>Changer la photo</>}
                      <input type="file" accept={PHOTO_ACCEPT} hidden onChange={handleUploadPhoto} />
                    </label>

                    <h6 className="fw-bold border-top pt-3 mb-2"><i className="bi bi-file-earmark-pdf me-1"></i>Documents Techniques</h6>
                    <div className="mb-2">
                      <small className="d-block text-muted">Manuel Constructeur (PDF):</small>
                      {detailMateriel.manuel_url ? (
                        <a href={detailMateriel.manuel_url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-warning w-100 mt-1">
                          <i className="bi bi-download me-1"></i>Consulter le Manuel
                        </a>
                      ) : (
                        <label className="btn btn-xs btn-outline-secondary w-100 mt-1 mb-0">
                          {uploadingManuel ? 'Upload...' : '+ Ajouter Manuel Constructeur'}
                          <input type="file" accept={MANUEL_ACCEPT} hidden onChange={handleUploadManuel} />
                        </label>
                      )}
                    </div>

                    <div className="mb-2 border-top pt-2">
                      <small className="d-block text-muted">Certificat VGP Obligatoire:</small>
                      {detailMateriel.certificat_vgp_url ? (
                        <a href={detailMateriel.certificat_vgp_url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-success w-100 mt-1">
                          <i className="bi bi-shield-check me-1"></i>Voir le PV VGP (PDF)
                        </a>
                      ) : (
                        <label className="btn btn-xs btn-outline-danger w-100 mt-1 mb-0">
                          {uploadingVgp ? 'Upload...' : '+ Upload Certificat VGP'}
                          <input type="file" accept={VGP_ACCEPT} hidden onChange={handleUploadVgp} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Technical Specifications */}
                  <div className="col-md-8">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        {getStatutBadge(detailMateriel.statut)}
                        <span className="ms-2">{getVgpBadge(detailMateriel.statut_vgp)}</span>
                      </div>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => {
                        setShowDetailModal(false)
                        setHorametreForm({ heures_moteur: detailMateriel.heures_moteur || 0, kilometrage: detailMateriel.kilometrage || 0, notes: '' })
                        setShowHorametreModal(true)
                      }}>
                        <i className="bi bi-speedometer2 me-1"></i>Actualiser Horamètre
                      </button>
                    </div>

                    <div className="card bg-light border-0 mb-3">
                      <div className="card-body">
                        <div className="row g-2 small">
                          <div className="col-6"><strong>Marque / Modèle:</strong> {detailMateriel.marque || '—'} {detailMateriel.modele || ''}</div>
                          <div className="col-6"><strong>N° de Série:</strong> {detailMateriel.numero_serie || '—'}</div>
                          <div className="col-6"><strong>Immatriculation:</strong> {detailMateriel.immatriculation || '—'}</div>
                          <div className="col-6"><strong>Valeur d'Achat:</strong> {detailMateriel.valeur_achat ? detailMateriel.valeur_achat.toLocaleString() + ' MGA' : '—'}</div>
                          <div className="col-6"><strong>Horamètre Moteur:</strong> {detailMateriel.heures_moteur || 0} hrs</div>
                          <div className="col-6"><strong>Prochaine VGP:</strong> {detailMateriel.date_prochaine_vgp || '—'}</div>
                        </div>
                      </div>
                    </div>

                    <h6 className="fw-bold"><i className="bi bi-journal-text me-1"></i>Consignes & Normes d'entretien BTP</h6>
                    <textarea
                      className="form-control mb-2"
                      rows={4}
                      placeholder="Indiquez ici la fréquence de graissage, huile préconisée, consignes de sécurité terrain..."
                      value={normesText}
                      onChange={e => setNormesText(e.target.value)}
                    ></textarea>
                    <button className="btn btn-sm btn-success mb-4" onClick={handleSaveNormes} disabled={savingNormes}>
                      {savingNormes ? 'Sauvegarde...' : 'Sauvegarder Consignes'}
                    </button>

                    <div className="d-flex justify-content-between align-items-center border-top pt-3">
                      <h6 className="fw-bold mb-0"><i className="bi bi-tools me-1"></i>Historique des Maintenances ({detailMateriel.maintenances?.length || 0})</h6>
                      <button className="btn btn-xs btn-outline-primary" onClick={() => setShowMaintenanceModal(true)}>
                        + Nouvelle Intervention
                      </button>
                    </div>
                    {detailMateriel.maintenances && detailMateriel.maintenances.length > 0 ? (
                      <div className="table-responsive mt-2">
                        <table className="table table-sm table-hover border">
                          <thead>
                            <tr className="table-light">
                              <th>Date</th>
                              <th>Type</th>
                              <th>Technicien</th>
                              <th>Coût</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailMateriel.maintenances.map(m => (
                              <tr key={m.id}>
                                <td>{m.date_maintenance}</td>
                                <td>{m.type}</td>
                                <td>{m.technicien}</td>
                                <td>{m.cout?.toLocaleString()} MGA</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted small mt-2">Aucune maintenance enregistrée sur cette fiche.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRÉATION BON DE TRANSFERT */}
      {showTransfertModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'var(--overlay)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content border-0 shadow-lg">
              <form onSubmit={handleCreateTransfert}>
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title fw-bold"><i className="bi bi-arrow-left-right me-2"></i>Bon de Mouvement / Transfert Inter-Chantiers</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowTransfertModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Équipement à transférer *</label>
                    <select className="form-select" required value={transfertForm.materiel_id} onChange={e => setTransfertForm({ ...transfertForm, materiel_id: parseInt(e.target.value) })}>
                      <option value={0}>-- Sélectionner un matériel --</option>
                      {materiels.map(m => (
                        <option key={m.id} value={m.id}>{m.nom} ({m.statut})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Chantier d'origine</label>
                    <select className="form-select" value={transfertForm.chantier_origine_id} onChange={e => setTransfertForm({ ...transfertForm, chantier_origine_id: e.target.value })}>
                      <option value="">Dépôt principal / Siège</option>
                      {chantiers.map(c => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Chantier de destination *</label>
                    <select className="form-select" required value={transfertForm.chantier_destination_id} onChange={e => setTransfertForm({ ...transfertForm, chantier_destination_id: e.target.value })}>
                      <option value="">-- Sélectionner le chantier d'arrivée --</option>
                      {chantiers.map(c => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Transporteur / Conducteur</label>
                    <input className="form-control" placeholder="Nom du chauffeur / Remorque..." value={transfertForm.transporteur} onChange={e => setTransfertForm({ ...transfertForm, transporteur: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Notes / Instructions de livraison</label>
                    <textarea className="form-control" rows={2} value={transfertForm.notes} onChange={e => setTransfertForm({ ...transfertForm, notes: e.target.value })}></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowTransfertModal(false)} disabled={savingTransfert}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={savingTransfert}>
                    {savingTransfert ? 'Émission...' : 'Émettre le bon de transfert'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MISE À JOUR HORAMÈTRE */}
      {showHorametreModal && detailMateriel && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'var(--overlay)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content border-0 shadow-lg">
              <form onSubmit={handleSaveHorametre}>
                <div className="modal-header bg-dark text-white">
                  <h5 className="modal-title fw-bold"><i className="bi bi-speedometer2 me-2"></i>Relevé Carnet de Bord: {detailMateriel.nom}</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowHorametreModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nouvelles Heures Horamètre (Moteur)</label>
                    <input type="number" step="0.5" min="0" className="form-control" required value={horametreForm.heures_moteur} onChange={e => setHorametreForm({ ...horametreForm, heures_moteur: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nouveau Kilométrage (Compteur)</label>
                    <input type="number" min="0" className="form-control" value={horametreForm.kilometrage} onChange={e => setHorametreForm({ ...horametreForm, kilometrage: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowHorametreModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-success" disabled={savingHorametre}>
                    {savingHorametre ? 'Mise à jour...' : 'Enregistrer le Relevé'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOUVELLE MAINTENANCE */}
      {showMaintenanceModal && detailMateriel && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'var(--overlay)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content border-0 shadow-lg">
              <form onSubmit={handleAddMaintenance}>
                <div className="modal-header bg-warning text-dark">
                  <h5 className="modal-title fw-bold"><i className="bi bi-tools me-2"></i>Saisie d'Intervention / Reparation</h5>
                  <button type="button" className="btn-close" onClick={() => setShowMaintenanceModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Type d'intervention</label>
                    <select className="form-select" value={maintForm.type} onChange={e => setMaintForm({ ...maintForm, type: e.target.value })}>
                      <option value="Préventive">Préventive (Vidange/Révision)</option>
                      <option value="Curative / Panne">Curative / Reparation Panne</option>
                      <option value="Contrôle Réglementaire">Contrôle Réglementaire VGP</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Coût Réparation (MGA)</label>
                    <input type="number" className="form-control" placeholder="0" value={maintForm.cout} onChange={e => setMaintForm({ ...maintForm, cout: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Description / Travaux effectués</label>
                    <textarea className="form-control" rows={3} required value={maintForm.description} onChange={e => setMaintForm({ ...maintForm, description: e.target.value })}></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Technicien / Prestataire</label>
                    <input className="form-control" placeholder="Nom du technicien..." value={maintForm.technicien} onChange={e => setMaintForm({ ...maintForm, technicien: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Prochaine Échéance Prévisible</label>
                    <input type="date" className="form-control" value={maintForm.prochaine_date_echeance} onChange={e => setMaintForm({ ...maintForm, prochaine_date_echeance: e.target.value })} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowMaintenanceModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-warning" disabled={savingMaint}>
                    {savingMaint ? 'Enregistrement...' : 'Valider la Maintenance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPRESSION QR CODE */}
      {showQrModal && qrCodeData && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'var(--overlay)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content border-0 shadow-lg text-center">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold"><i className="bi bi-qr-code me-2"></i>Étiquette Traçabilité QR Code</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowQrModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="border p-4 rounded-3 bg-white d-inline-block shadow-sm">
                  <h6 className="fw-bold mb-1">{qrCodeData.nom}</h6>
                  <p className="text-muted small mb-2 font-monospace">{qrCodeData.qr_code_key}</p>
                  
                  {/* Visuel simulé du QR Code avec canvas / svg */}
                  <div className="my-3 d-flex justify-content-center">
                    <div className="p-3 bg-light rounded border">
                      <i className="bi bi-qr-code text-dark" style={{ fontSize: 120 }}></i>
                    </div>
                  </div>

                  <span className="badge bg-success mb-2 me-1">{qrCodeData.statut_vgp}</span>
                  <span className="badge bg-primary mb-2">{qrCodeData.statut}</span>
                </div>
                <p className="text-muted small mt-3">Collez cette étiquette sur le châssis de la machine pour permettre aux équipes terrain de scanner sa fiche technique.</p>
              </div>
              <div className="modal-footer justify-content-center">
                <button type="button" className="btn btn-secondary" onClick={() => setShowQrModal(false)}>Fermer</button>
                <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                  <i className="bi bi-printer me-1"></i>Imprimer l'étiquette
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
