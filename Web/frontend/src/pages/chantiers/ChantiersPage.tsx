import { useEffect, useState } from 'react'
import type { Chantier, Employe } from '@/types'
import { chantiersService, type ProjetTransformable } from '@/services/chantiers.service'
import { rhService } from '@/services/rh.service'
import { QRScannerModal } from '@/components/pointage/QRScannerModal'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { TableSkeleton } from '@/components/ui/Skeleton'

export function ChantiersPage() {
  const { user } = useAuthStore()
  const roleCode = user?.role_code || 'employe'
  const perms = getRolePermissions(roleCode)

  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [sortOption, setSortOption] = useState('dateCreation_desc')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
  const [selectedChantier, setSelectedChantier] = useState<Chantier | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrData, setQrData] = useState<{ qr_token: string; chantier_nom: string; date_validite: string } | null>(null)
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [showTransformModal, setShowTransformModal] = useState(false)
  const [projetsTransformables, setProjetsTransformables] = useState<ProjetTransformable[]>([])
  const [transformLoading, setTransformLoading] = useState(false)
  const [activeTabModal, setActiveTabModal] = useState<'infos' | 'budget' | 'phases' | 'incidents' | 'ressources'>('infos')
  const [activeDetailTab, setActiveDetailTab] = useState<'general' | 'phases' | 'incidents' | 'budget'>('general')

  // Form State
  const [formData, setFormData] = useState<Partial<Chantier>>({
    nom: '',
    numero: '',
    statut: 'planification',
    budget_prevu: 0,
    marge_cible: 15,
    tva: 20,
    description: ''
  })

  const openCreateChantierModal = () => {
    const year = new Date().getFullYear()
    const count = chantiers.length + 1
    setSelectedChantier(null)
    setFormData({
      numero: `CHT-${year}-${String(count).padStart(3, '0')}`,
      nom: '',
      statut: 'planification',
      budget_prevu: 0,
      marge_cible: 15,
      tva: 20,
      description: ''
    })
    setActiveTabModal('infos')
    setShowModal(true)
  }

  const loadChantiers = async () => {
    setLoading(true)
    try {
      const data = await chantiersService.getAll({ search: searchTerm, statut: statutFilter })
      setChantiers(data)
    } catch {
      setChantiers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChantiers()
    rhService.getEmployes().then(setEmployes).catch(() => setEmployes([]))
  }, [searchTerm, statutFilter])

  const openTransformModal = async () => {
    setShowTransformModal(true)
    try {
      const data = await chantiersService.getProjetsTransformables()
      setProjetsTransformables(data)
    } catch {
      setProjetsTransformables([])
    }
  }

  const handleTransform = async (projetId: number) => {
    setTransformLoading(true)
    try {
      await chantiersService.transformerProjet(projetId)
      setShowTransformModal(false)
      alert('Chantier créé avec succès depuis le projet.')
      loadChantiers()
    } catch {
      alert('Erreur lors de la création du chantier.')
    } finally {
      setTransformLoading(false)
    }
  }

  useEffect(() => {
    if (showDetailModal && selectedChantier) {
      chantiersService.getById(selectedChantier.id).then(data => setSelectedChantier(data)).catch(() => {})
    }
  }, [showDetailModal])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedChantier) {
        await chantiersService.update(selectedChantier.id, formData)
      } else {
        await chantiersService.create(formData)
      }
      setShowModal(false)
      loadChantiers()
    } catch {
      alert('Erreur lors de la sauvegarde du chantier.')
    }
  }

  const exportCSV = () => {
    const headers = ['Numero', 'Nom', 'Statut', 'Budget Prevu', 'Budget Reel', 'Date Debut']
    const rows = chantiers.map(c => [c.numero, c.nom, c.statut, c.budget_prevu, c.budget_reel, c.date_debut])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'chantiers_export.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleGenerateQR = async (chantierId: number) => {
    try {
      const data = await chantiersService.generateQR(chantierId)
      setQrData({ qr_token: data.qr_token, chantier_nom: data.chantier_nom, date_validite: data.date_validite })
      setShowQRModal(true)
    } catch {
      alert('Erreur lors de la génération du QR code')
    }
  }

  const handleAddPhase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChantier) return
    const form = e.target as HTMLFormElement
    const nom = (form.elements.namedItem('phase_nom') as HTMLInputElement).value
    const ordre = parseInt((form.elements.namedItem('phase_ordre') as HTMLInputElement).value || '0')
    try {
      await chantiersService.addPhase(selectedChantier.id, { nom, ordre, avancement_pct: 0, statut: 'non_commencee', budget: 0 })
      alert('Phase ajoutée')
      setShowDetailModal(false)
      setShowDetailModal(true)
    } catch {
      alert('Erreur lors de l\'ajout de la phase')
    }
  }

  const handleAddIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChantier) return
    const form = e.target as HTMLFormElement
    const titre = (form.elements.namedItem('incident_titre') as HTMLInputElement).value
    const gravite = (form.elements.namedItem('incident_gravite') as HTMLSelectElement).value as any
    const typeAlea = (form.elements.namedItem('incident_type_alea') as HTMLSelectElement).value || undefined
    const imputabilite = (form.elements.namedItem('incident_imputabilite') as HTMLSelectElement).value || undefined
    const joursStr = (form.elements.namedItem('incident_jours') as HTMLInputElement).value
    const impactArretJours = joursStr ? parseInt(joursStr, 10) : undefined
    try {
      await chantiersService.addIncident(selectedChantier.id, {
        titre,
        gravite,
        statut: 'signale',
        type_alea: typeAlea,
        imputabilite: typeAlea ? imputabilite : undefined,
        impact_arret_jours: typeAlea ? impactArretJours : undefined,
      })
      alert('Incident signalé')
      setShowDetailModal(false)
      setShowDetailModal(true)
    } catch {
      alert('Erreur lors du signalement de l\'incident')
    }
  }

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'en_cours': return <span className="badge bg-secondary bg-opacity-10 text-dark border px-3 py-2 rounded-pill fw-semibold">En cours</span>
      case 'planification': return <span className="badge bg-light text-dark border px-3 py-2 rounded-pill fw-semibold">Planifié</span>
      case 'suspendu': return <span className="badge bg-warning bg-opacity-10 text-dark border px-3 py-2 rounded-pill fw-semibold">Suspendu</span>
      case 'termine': return <span className="badge bg-success bg-opacity-10 text-success border px-3 py-2 rounded-pill fw-semibold">Terminé</span>
      case 'annule': case 'arrete': return <span className="badge bg-danger bg-opacity-10 text-danger border px-3 py-2 rounded-pill fw-semibold">Arrêté</span>
      default: return <span className="badge bg-light text-dark border px-3 py-2 rounded-pill">{statut}</span>
    }
  }

  // Filtered & Sorted list
  const filteredChantiers = [...chantiers].sort((a, b) => {
    if (sortOption === 'nom_asc') return a.nom.localeCompare(b.nom)
    if (sortOption === 'budget_desc') return (b.budget_prevu || 0) - (a.budget_prevu || 0)
    return b.id - a.id
  })

  return (
    <div className="container-fluid py-4">
      {/* Header avec actions */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h2 className="mb-1 text-secondary"><i className="bi bi-building me-2"></i>Chantiers</h2>
            <p className="text-secondary mb-0">Gestion et suivi des chantiers</p>
          </div>

          {perms.canCreateChantier && (
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedChantier(null); setFormData({}); setShowModal(true); }}>
              <i className="bi bi-plus-lg me-1"></i>Nouveau chantier
            </button>
          )}
          {perms.canCreateChantier && (
            <button className="btn btn-outline-primary fw-bold ms-2" onClick={openTransformModal}>
              <i className="bi bi-arrow-repeat me-1"></i>Transformer un projet en chantier
            </button>
          )}
        </div>

      {/* Filtres et recherche */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-center">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-light"><i className="bi bi-search text-muted"></i></span>
                <input
                  type="text"
                  className="form-control bg-light"
                  placeholder="Rechercher un chantier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="col-md-3">
              <select className="form-select bg-light" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                <option value="planification">Planifié</option>
                <option value="en_cours">En cours</option>
                <option value="termine">Terminé</option>
                <option value="arrete">Arrêté</option>
              </select>
            </div>

            <div className="col-md-2">
              <select className="form-select bg-light" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                <option value="dateCreation_desc">Plus récents</option>
                <option value="dateCreation_asc">Plus anciens</option>
                <option value="nom_asc">Nom A-Z</option>
                <option value="budget_desc">Budget décroissant</option>
              </select>
            </div>

            <div className="col-md-3 d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={exportCSV}>
                <i className="bi bi-download me-1"></i>Exporter
              </button>

              <button className="btn btn-outline-secondary" onClick={loadChantiers}>
                <i className="bi bi-arrow-clockwise"></i>
              </button>

              <div className="btn-group" role="group">
                <button
                  className={`btn ${viewMode === 'table' ? 'btn-outline-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('table')}
                  title="Vue Tableau"
                >
                  <i className="bi bi-table"></i>
                </button>
                <button
                  className={`btn ${viewMode === 'cards' ? 'btn-outline-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('cards')}
                  title="Vue Cartes"
                >
                  <i className="bi bi-grid-fill"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card border-0 shadow-sm p-3">
          <TableSkeleton rows={6} columns={6} />
        </div>
      ) : filteredChantiers.length === 0 ? (
        <div className="card border-0 shadow-sm text-center py-5">
          <div className="card-body">
            <i className="bi bi-building display-1 text-secondary"></i>
            <h4 className="mt-3 fw-bold text-secondary">Aucun chantier</h4>
            <p className="text-secondary">Commencez par créer votre premier chantier</p>
            <button className="btn btn-outline-secondary fw-bold" onClick={() => { setSelectedChantier(null); setFormData({}); setShowModal(true); }}>
              <i className="bi bi-plus-lg me-1"></i>Créer un chantier
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="row g-4">
          {filteredChantiers.map((c) => (
            <div key={c.id} className="col-xl-4 col-md-6">
              <div className="card border-0 shadow-sm h-100 kpi-card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="badge bg-light text-dark border font-monospace">{c.numero}</span>
                    {getStatutBadge(c.statut)}
                  </div>
                  <h5 className="card-title fw-bold text-dark mb-2">{c.nom}</h5>
                  <p className="text-muted small mb-3 text-truncate">{c.description || 'Aucune description'}</p>

                   <div className="mb-3">
                     <div className="d-flex justify-content-between small mb-1">
                       <span className="text-muted">Budget consommé</span>
                       <span className="fw-bold">{c.budget_reel?.toLocaleString()} / {c.budget_prevu?.toLocaleString()} MGA</span>
                     </div>
                     <div className="progress" style={{ height: '6px' }}>
                       <div
                         className="progress-bar bg-secondary"
                         style={{ width: `${Math.min(100, (c.budget_reel / (c.budget_prevu || 1)) * 100)}%` }}
                       ></div>
                     </div>
                   </div>

                  <div className="row g-2 text-center border-top pt-3 mt-3 small">
                    <div className="col-6">
                      <span className="text-muted d-block">Début</span>
                       <strong className="text-dark">{c.date_debut || 'Non définie'}</strong>
                    </div>
                    <div className="col-6">
                      <span className="text-muted d-block">Fin prévue</span>
                       <strong className="text-dark">{c.date_fin_prevue || 'Non définie'}</strong>
                    </div>
                  </div>
                </div>
                   <div className="card-footer bg-light border-0 d-flex justify-content-between align-items-center py-2">
                  <button className="btn btn-sm btn-link text-secondary p-0 fw-semibold" onClick={() => { setSelectedChantier(c); setShowDetailModal(true); }}>
                    <i className="bi bi-eye me-1"></i> Voir détails
                  </button>
                  <div className="d-flex gap-1">
                   {perms.canGenerateQR && (
                     <>
                       <button className="btn btn-sm btn-outline-secondary" onClick={() => handleGenerateQR(c.id)} title="Générer QR Chantier">
                         <i className="bi bi-qr-code-scan"></i>
                       </button>
                       <button className="btn btn-sm btn-outline-secondary" onClick={() => { setShowScannerModal(true); setSelectedChantier(c); }} title="Scanner badge employé">
                         <i className="bi bi-phone-vibrate"></i>
                       </button>
                     </>
                   )}
                   {perms.canEditChantier && (
                     <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedChantier(c); setFormData(c); setShowModal(true); }}>
                       <i className="bi bi-pencil"></i>
                     </button>
                   )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Chantier</th>
                  <th>Numéro</th>
                  <th className="d-none d-md-table-cell">Dates</th>
                  <th className="d-none d-lg-table-cell">Budget prévu</th>
                  <th className="d-none d-lg-table-cell">Budget consommé</th>
                  <th>Statut</th>
                  <th className="text-end" style={{ width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredChantiers.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-bold text-secondary">{c.id}</td>
                    <td className="fw-semibold text-dark">{c.nom}</td>
                    <td className="font-monospace small">{c.numero}</td>
                    <td className="font-monospace small text-muted">{c.date_debut || '-'} <i className="bi bi-arrow-right"></i> {c.date_fin_prevue || '-'}</td>
                    <td className="d-none d-lg-table-cell">{c.budget_prevu?.toLocaleString()} MGA</td>
                    <td className="d-none d-lg-table-cell text-secondary fw-semibold">{c.budget_reel?.toLocaleString()} MGA</td>
                    <td>{getStatutBadge(c.statut)}</td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1 align-items-center justify-content-end">
                           {perms.canGenerateQR && (
                             <button className="btn btn-sm btn-outline-secondary" onClick={() => handleGenerateQR(c.id)} title="QR Pointage">
                               <i className="bi bi-qr-code-scan"></i>
                             </button>
                           )}
                         <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedChantier(c); setShowDetailModal(true); }}>
                           <i className="bi bi-eye"></i>
                         </button>
                        {perms.canEditChantier && (
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedChantier(c); setFormData(c); setShowModal(true); }}>
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modale Nouveau/Édition Chantier avec onglets */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-building me-2"></i>{selectedChantier ? 'Éditer le Chantier' : 'Nouveau chantier'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>

              <div className="modal-body p-0">
                <ul className="nav nav-tabs px-3 pt-2 bg-light border-bottom">
                  <li className="nav-item">
                    <button className={`nav-link ${activeTabModal === 'infos' ? 'active fw-bold' : ''}`} onClick={() => setActiveTabModal('infos')}>
                      <i className="bi bi-info-circle me-1"></i>Informations
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${activeTabModal === 'budget' ? 'active fw-bold' : ''}`} onClick={() => setActiveTabModal('budget')}>
                      <i className="bi bi-currency-exchange me-1"></i>Budget
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${activeTabModal === 'phases' ? 'active fw-bold' : ''}`} onClick={() => setActiveTabModal('phases')}>
                      <i className="bi bi-list-task me-1"></i>Phases
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${activeTabModal === 'incidents' ? 'active fw-bold' : ''}`} onClick={() => setActiveTabModal('incidents')}>
                      <i className="bi bi-exclamation-triangle me-1"></i>Incidents
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${activeTabModal === 'ressources' ? 'active fw-bold' : ''}`} onClick={() => setActiveTabModal('ressources')}>
                      <i className="bi bi-people me-1"></i>Ressources
                    </button>
                  </li>
                </ul>

                <form id="formChantier" onSubmit={handleSave} className="p-4">
                  {activeTabModal === 'infos' && (
                    <div className="row g-3">
                      <div className="col-md-8">
                        <label className="form-label fw-semibold">Nom du chantier *</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          value={formData.nom || ''}
                          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Numéro (Auto-généré)</label>
                        <div className="input-group">
                          <input
                            type="text"
                            className="form-control font-monospace fw-bold"
                            placeholder="CHT-2026-XXX"
                            value={formData.numero || ''}
                            onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                          />
                          <button className="btn btn-outline-secondary" type="button" onClick={() => {
                            const year = new Date().getFullYear()
                            const count = chantiers.length + 1
                            setFormData({ ...formData, numero: `CHT-${year}-${String(count).padStart(3, '0')}` })
                          }}>
                            <i className="bi bi-arrow-clockwise"></i>
                          </button>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Chef de Projet / Conducteur de Travaux</label>
                        <select
                          className="form-select"
                          value={formData.chef_projet_id || ''}
                          onChange={(e) => setFormData({ ...formData, chef_projet_id: e.target.value ? Number(e.target.value) : undefined })}
                        >
                          <option value="">Sélectionner un Conducteur de Travaux...</option>
                          {employes.map((e) => (
                            <option key={e.id} value={e.id}>{e.prenom || ''} {e.nom} ({e.poste || 'Cadre BTP'})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Chef de Chantier / Responsable Site</label>
                        <select
                          className="form-select"
                          value={formData.chef_chantier_id || ''}
                          onChange={(e) => setFormData({ ...formData, chef_chantier_id: e.target.value ? Number(e.target.value) : undefined })}
                        >
                          <option value="">Sélectionner un Chef de Chantier...</option>
                          {employes.map((e) => (
                            <option key={e.id} value={e.id}>{e.prenom || ''} {e.nom} ({e.poste || 'Chef de Site'})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Statut</label>
                        <select
                          className="form-select"
                          value={formData.statut}
                          onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                        >
                          <option value="planification">Planifié</option>
                          <option value="en_cours">En cours</option>
                          <option value="suspendu">Suspendu</option>
                          <option value="termine">Terminé</option>
                          <option value="annule">Arrêté</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Adresse du chantier</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.adresse || ''}
                          onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Date Début</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.date_debut || ''}
                          onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Date Fin Prévue</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.date_fin_prevue || ''}
                          onChange={(e) => setFormData({ ...formData, date_fin_prevue: e.target.value })}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Description</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={formData.description || ''}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        ></textarea>
                      </div>
                    </div>
                  )}

                  {activeTabModal === 'budget' && (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Budget Prévu (MGA)</label>
                        <input
                          type="number"
                          className="form-control font-monospace fs-5"
                          value={formData.budget_prevu || 0}
                          onChange={(e) => setFormData({ ...formData, budget_prevu: Number(e.target.value) })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Budget Prévisionnel (MGA)</label>
                        <input
                          type="number"
                          className="form-control font-monospace fs-5"
                          value={formData.budget_previsionnel || 0}
                          onChange={(e) => setFormData({ ...formData, budget_previsionnel: Number(e.target.value) })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Marge Cible (%)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.marge_cible || 15}
                          onChange={(e) => setFormData({ ...formData, marge_cible: Number(e.target.value) })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Taux TVA (%)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.tva || 20}
                          onChange={(e) => setFormData({ ...formData, tva: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}

                  {activeTabModal === 'phases' && (
                    <div>
                      <h6 className="fw-bold mb-3">Phases du chantier</h6>
                      {selectedChantier && selectedChantier.phases && selectedChantier.phases.length > 0 ? (
                        <div className="list-group mb-3">
                          {selectedChantier.phases.map(p => (
                            <div key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                              <div>
                                <h6 className="mb-0 fw-semibold">{p.nom}</h6>
                                <small className="text-muted">Ordre: {p.ordre}</small>
                              </div>
                              <div className="d-flex align-items-center gap-3">
                                <div className="progress" style={{ width: '120px', height: '8px' }}>
                                  <div className="progress-bar bg-secondary" style={{ width: `${p.avancement_pct}%` }}></div>
                                </div>
                                <span className="fw-bold">{p.avancement_pct}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted small mb-3">Aucune phase configurée pour ce chantier.</p>
                      )}
                      {perms.canReportTask && (
                        <form onSubmit={handleAddPhase} className="border-top pt-3">
                          <h6 className="fw-bold mb-2">Ajouter une phase</h6>
                          <div className="row g-2">
                            <div className="col-md-6">
                              <input type="text" className="form-control" name="phase_nom" placeholder="Nom de la phase" required />
                            </div>
                            <div className="col-md-3">
                              <input type="number" className="form-control" name="phase_ordre" placeholder="Ordre" defaultValue={0} min={0} />
                            </div>
                            <div className="col-md-3">
                              <button type="submit" className="btn btn-outline-secondary w-100">Ajouter</button>
                            </div>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {activeTabModal === 'incidents' && (
                    <div>
                      <h6 className="fw-bold mb-3">Incidents signalés</h6>
                      {selectedChantier && selectedChantier.incidents && selectedChantier.incidents.length > 0 ? (
                        <div className="list-group mb-3">
                          {selectedChantier.incidents.map(inc => (
                            <div key={inc.id} className="list-group-item d-flex justify-content-between align-items-center">
                              <div>
                                 <h6 className="mb-0 fw-semibold text-secondary">
                                   {inc.type_alea && <span className="badge bg-info bg-opacity-10 text-info border me-1" title="Aléa climatique">🌤️</span>}
                                   {inc.titre}
                                 </h6>
                                <small className="text-muted">
                                  Date: {inc.date_incident}
                                  {inc.date_fin && ` → ${inc.date_fin}`}
                                  {inc.impact_arret_jours ? ` · ${inc.impact_arret_jours} j d'arrêt` : ''}
                                  {inc.imputabilite === 'climatique' && ' · climatique (négociable)'}
                                  {inc.imputabilite === 'entreprise' && ' · imputable entreprise'}
                                  {inc.imputabilite === 'client' && ' · imputable client'}
                                </small>
                              </div>
                                 <span className={`badge ${inc.statut === 'resolu' ? 'bg-success bg-opacity-10 text-success border' : 'bg-warning bg-opacity-10 text-dark border'}`}>
                                   {inc.statut === 'resolu' ? 'Résolu' : 'En cours'}
                                 </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted small mb-3">Aucun incident signalé.</p>
                      )}
                      {perms.canReportTask && (
                        <form onSubmit={handleAddIncident} className="border-top pt-3">
                          <h6 className="fw-bold mb-2">Signaler un incident</h6>
                          <div className="row g-2">
                            <div className="col-md-6">
                              <input type="text" className="form-control" name="incident_titre" placeholder="Titre de l'incident" required />
                            </div>
                            <div className="col-md-3">
                              <select className="form-select" name="incident_gravite">
                                <option value="faible">Faible</option>
                                <option value="moyenne">Moyenne</option>
                                <option value="elevee">Élevée</option>
                                <option value="critique">Critique</option>
                              </select>
                            </div>
                            <div className="col-md-3">
                              <button type="submit" className="btn btn-outline-secondary w-100">Signaler</button>
                            </div>
                          </div>
                          <div className="row g-2 mt-1">
                            <div className="col-md-3">
                              <select className="form-select" name="incident_type_alea" defaultValue="">
                                <option value="">Type d'aléa (optionnel)</option>
                                <option value="cyclone">🌪️ Cyclone</option>
                                <option value="inondation">💧 Inondation</option>
                                <option value="pluies_intenses">🌧️ Pluies intenses</option>
                                <option value="secheresse">☀️ Sécheresse</option>
                                <option value="route_coupee">🚧 Route coupée</option>
                                <option value="coupure_electricite">⚡ Coupure d'électricité</option>
                                <option value="autre">Autre aléa climatique</option>
                              </select>
                            </div>
                            <div className="col-md-4">
                              <select className="form-select" name="incident_imputabilite" defaultValue="climatique">
                                <option value="climatique">Imputabilité : climatique (négociable)</option>
                                <option value="entreprise">Imputabilité : entreprise</option>
                                <option value="client">Imputabilité : client</option>
                                <option value="indetermine">Imputabilité : indéterminée</option>
                              </select>
                            </div>
                            <div className="col-md-3">
                              <input type="number" className="form-control" name="incident_jours" min={0} placeholder="Jours d'arrêt" />
                            </div>
                            <div className="col-md-2 d-flex align-items-center">
                              <small className="text-muted">Aléa climatique documenté → retard négociable</small>
                            </div>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {activeTabModal === 'ressources' && (
                    <div>
                      <h6 className="fw-bold mb-3">Ressources & Matériels affectés</h6>
                      <p className="text-muted small">Gestion des équipes et des équipements.</p>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                    <button type="submit" className="btn btn-outline-secondary fw-bold">Enregistrer</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Multi-Tabs */}
      {showDetailModal && selectedChantier && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title fw-bold mb-0">{selectedChantier.nom}</h5>
                  <small className="font-monospace text-muted">{selectedChantier.numero}</small>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDetailModal(false)}></button>
              </div>
              <div className="modal-body p-0">
                <ul className="nav nav-tabs px-3 pt-2 bg-light border-bottom">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeDetailTab === 'general' ? 'active fw-bold' : ''}`}
                      onClick={() => setActiveDetailTab('general')}
                    >
                      <i className="bi bi-info-circle me-1"></i>Général
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeDetailTab === 'phases' ? 'active fw-bold' : ''}`}
                      onClick={() => setActiveDetailTab('phases')}
                    >
                      <i className="bi bi-diagram-3 me-1"></i>Phases & Avancement
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeDetailTab === 'incidents' ? 'active fw-bold' : ''}`}
                      onClick={() => setActiveDetailTab('incidents')}
                    >
                      <i className="bi bi-exclamation-triangle me-1"></i>Incidents
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeDetailTab === 'budget' ? 'active fw-bold' : ''}`}
                      onClick={() => setActiveDetailTab('budget')}
                    >
                      <i className="bi bi-cash-stack me-1"></i>Budget & Rentabilité
                    </button>
                  </li>
                </ul>

                <div className="p-4">
                  {activeDetailTab === 'general' && (
                    <>
                    <div className="row g-3 mb-2">
                      {(selectedChantier as any).impact_climatique && (
                        <>
                        <div className="col-md-4">
                          <div className="p-3 bg-light rounded text-center border-start border-warning border-4">
                            <small className="text-muted d-block">Jours d'arrêt climatique documentés</small>
                            <h4 className="fw-bold text-secondary mb-0">{(selectedChantier as any).impact_climatique.jours_arret_climatique} j</h4>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="p-3 bg-light rounded text-center border-start border-danger border-4">
                            <small className="text-muted d-block">Retard brut</small>
                            <h4 className="fw-bold text-secondary mb-0">{(selectedChantier as any).impact_climatique.retard_brut_jours} j</h4>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="p-3 bg-light rounded text-center border-start border-success border-4">
                            <small className="text-muted d-block">Retard net (après aléas négociables)</small>
                            <h4 className="fw-bold text-secondary mb-0">{(selectedChantier as any).impact_climatique.retard_net_jours} j</h4>
                          </div>
                        </div>
                        </>
                      )}
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <p><strong>Description:</strong> {selectedChantier.description || '-'}</p>
                        <p><strong>Statut:</strong> {getStatutBadge(selectedChantier.statut)}</p>
                        <p><strong>Localisation:</strong> {selectedChantier.adresse || 'Antananarivo'}</p>
                      </div>
                      <div className="col-md-6">
                        <p><strong>Date début:</strong> {selectedChantier.date_debut || '-'}</p>
                        <p><strong>Date fin prévue:</strong> {selectedChantier.date_fin_prevue || '-'}</p>
                        <p><strong>Marge cible:</strong> {selectedChantier.marge_cible}%</p>
                      </div>
                    </div>
                    </>
                  )}

                  {activeDetailTab === 'phases' && (
                    <div>
                      <h6 className="fw-bold mb-3">Liste des Phases</h6>
                      {selectedChantier.phases && selectedChantier.phases.length > 0 ? (
                        <div className="list-group">
                          {selectedChantier.phases.map(p => (
                            <div key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                              <div>
                                <h6 className="mb-0 fw-semibold">{p.nom}</h6>
                                <small className="text-muted">Ordre: {p.ordre}</small>
                              </div>
                              <div className="d-flex align-items-center gap-3">
                                <div className="progress" style={{ width: '120px', height: '8px' }}>
                                  <div className="progress-bar bg-secondary" style={{ width: `${p.avancement_pct}%` }}></div>
                                </div>
                                <span className="fw-bold">{p.avancement_pct}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">Aucune phase configurée.</p>
                      )}
                    </div>
                  )}

                  {activeDetailTab === 'incidents' && (
                    <div>
                      <h6 className="fw-bold mb-3">Historique des Incidents</h6>
                      {selectedChantier.incidents && selectedChantier.incidents.length > 0 ? (
                        <div className="list-group">
                          {selectedChantier.incidents.map(inc => (
                            <div key={inc.id} className="list-group-item d-flex justify-content-between align-items-center">
                              <div>
                                 <h6 className="mb-0 fw-semibold text-secondary">
                                   {inc.type_alea && <span className="badge bg-info bg-opacity-10 text-info border me-1" title="Aléa climatique">🌤️</span>}
                                   {inc.titre}
                                 </h6>
                                <small className="text-muted">
                                  Date: {inc.date_incident}
                                  {inc.date_fin && ` → ${inc.date_fin}`}
                                  {inc.impact_arret_jours ? ` · ${inc.impact_arret_jours} j d'arrêt` : ''}
                                  {inc.imputabilite === 'climatique' && ' · climatique (négociable)'}
                                  {inc.imputabilite === 'entreprise' && ' · imputable entreprise'}
                                  {inc.imputabilite === 'client' && ' · imputable client'}
                                </small>
                              </div>
                               <span className={`badge ${inc.statut === 'resolu' ? 'bg-success bg-opacity-10 text-success border' : 'bg-warning bg-opacity-10 text-dark border'}`}>
                                 {inc.statut === 'resolu' ? 'Résolu' : 'En cours'}
                               </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">Aucun incident signalé.</p>
                      )}
                    </div>
                  )}

                  {activeDetailTab === 'budget' && (
                    <div className="row g-3">
                      <div className="col-md-4">
                         <div className="p-3 bg-light rounded text-center">
                           <small className="text-muted d-block">Budget Prévu</small>
                           <h4 className="fw-bold text-secondary mb-0">{selectedChantier.budget_prevu?.toLocaleString()} MGA</h4>
                         </div>
                       </div>
                       <div className="col-md-4">
                         <div className="p-3 bg-light rounded text-center">
                           <small className="text-muted d-block">Budget Consommé</small>
                           <h4 className="fw-bold text-secondary mb-0">{selectedChantier.budget_reel?.toLocaleString()} MGA</h4>
                         </div>
                       </div>
                       <div className="col-md-4">
                         <div className="p-3 bg-light rounded text-center">
                           <small className="text-muted d-block">Solde Restant</small>
                           <h4 className="fw-bold text-secondary mb-0">
                             {((selectedChantier.budget_prevu || 0) - (selectedChantier.budget_reel || 0)).toLocaleString()} MGA
                           </h4>
                         </div>
                       </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button className="btn btn-outline-secondary" onClick={() => setShowDetailModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal (pour scanner badges employés depuis un chantier) */}
      {showScannerModal && selectedChantier && (
        <QRScannerModal isOpen={showScannerModal} onClose={() => setShowScannerModal(false)} chantierId={selectedChantier.id} onPointageSuccess={() => { setShowScannerModal(false); loadChantiers(); }} />
      )}

      {/* Modal QR Pointage */}
      {showQRModal && qrData && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-center">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">QR Code Pointage</h5>
                <button type="button" className="btn-close" onClick={() => setShowQRModal(false)}></button>
              </div>
              <div className="modal-body py-4">
                <div className="p-4 rounded d-inline-block mb-3" style={{ background: 'var(--tia-bg-surface)' }}>
                  <div style={{ width: '200px', height: '200px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem' }}>
                    QR TOKEN:<br/>{qrData.qr_token.slice(0, 20)}...
                  </div>
                </div>
                <p className="mb-1 fw-bold">{qrData.chantier_nom}</p>
                <p className="text-muted small">Valide pour la journée du {qrData.date_validite}</p>
                <p className="text-muted small font-monospace">Token: {qrData.qr_token}</p>
              </div>
              <div className="modal-footer justify-content-center">
                <button className="btn btn-outline-secondary" onClick={() => setShowQRModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTransformModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold"><i className="bi bi-arrow-repeat me-2"></i>Transformer un projet en chantier</h5>
                <button type="button" className="btn-close" onClick={() => setShowTransformModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3">
                  Crée un chantier depuis un projet avec un contrat actif. Le chantier reprend le nom, le client et le montant contractuel du projet.
                </p>
                {projetsTransformables.length === 0 ? (
                  <div className="alert alert-info mb-0">Aucun projet contractualisé en attente de chantier.</div>
                ) : (
                  <table className="table table-hover align-middle">
                    <thead>
                      <tr><th>Réf. projet</th><th>Nom</th><th>Client</th><th>Contrat</th><th>Montant</th><th></th></tr>
                    </thead>
                    <tbody>
                      {projetsTransformables.map(pj => (
                        <tr key={pj.projet_id}>
                          <td className="font-monospace small">{pj.reference || '-'}</td>
                          <td>{pj.nom || '-'}</td>
                          <td>{pj.client_id || '-'}</td>
                          <td className="font-monospace small">{pj.contrat_reference || '-'}</td>
                          <td>{pj.montant_contrat ? pj.montant_contrat.toLocaleString('fr-FR') : 0} Ar</td>
                          <td>
                            <button className="btn btn-sm btn-primary" disabled={transformLoading} onClick={() => handleTransform(pj.projet_id)}>
                              {transformLoading ? 'Création...' : 'Créer le chantier'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowTransformModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showTransformModal && <div className="modal-backdrop fade show" onClick={() => setShowTransformModal(false)}></div>}
    </div>
  )
}
