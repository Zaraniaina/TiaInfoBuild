import { useEffect, useState } from 'react'
import type { Employe, Pointage, Equipe, HeureSupplementaire } from '@/types'
import { rhService } from '@/services/rh.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { QRScannerModal } from '@/components/pointage/QRScannerModal'
import { WorkerBadgeCard } from '@/components/pointage/WorkerBadgeCard'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { RhCongesTab } from './RhCongesTab'
import { RhPaieTab } from './RhPaieTab'
import { RhEmployeDocsModal } from './RhEmployeDocsModal'

const POSTES_BTP = [
  'Conducteur de Travaux',
  'Chef de Chantier',
  'Chef d\'Équipe',
  'Maçon Qualifié (Cat. III/IV)',
  'Ferrailleur / Armaturier',
  'Coffreur-Boiseur',
  'Conducteur d\'Engins (CACES)',
  'Électricien BTP',
  'Plombier-Sanitaire',
  'Peintre / Applicateur',
  'Magasinier / Gestionnaire Stock',
  'Topographe / Géomètre',
  'Mécanicien Engins BTP',
  'Manœuvre BTP',
  'Directeur Technique',
  'Comptable / Gestionnaire RH',
]

export function RhPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')
  const [activeTab, setActiveTab] = useState<'employes' | 'pointages' | 'equipes' | 'heures-sup' | 'conges' | 'paie'>('employes')

  // State
  const [employes, setEmployes] = useState<Employe[]>([])
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [heuresSup, setHeuresSup] = useState<HeureSupplementaire[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [contratFilter, setContratFilter] = useState('')

  // Modals
  const [showEmployeModal, setShowEmployeModal] = useState(false)
  const [showChangementPosteModal, setShowChangementPosteModal] = useState(false)
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [selectedBadgeEmploye, setSelectedBadgeEmploye] = useState<Employe | null>(null)
  const [docsEmployeId, setDocsEmployeId] = useState<number | null>(null)
  const [selectedEmploye, setSelectedEmploye] = useState<Employe | null>(null)
  const [employeForm, setEmployeForm] = useState<Partial<Employe>>({})
  const [posteForm, setPosteForm] = useState({
    nouveau_poste: '',
    nouveau_salaire: 0,
    date_effet: new Date().toISOString().split('T')[0],
    motif: ''
  })

  const openNewEmployeModal = () => {
    const year = new Date().getFullYear()
    const count = employes.length + 1
    const prefix = employeForm.type_contrat === 'JOURNALIER' ? 'JRN' : 'EMP'
    setSelectedEmploye(null)
    setEmployeForm({
      matricule: `${prefix}-${year}-${String(count).padStart(3, '0')}`,
      type_contrat: 'CDI',
      statut: 'actif',
      salaire_base: 0,
      poste: POSTES_BTP[3],
      mode_remuneration: 'mensuel',
      solde_conges_annuel: 30,
      statut_declaration: 'cnaps_ostie',
    })
    setShowEmployeModal(true)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'employes') {
        const data = await rhService.getEmployes({ search, statut: statutFilter })
        setEmployes(data)
      } else if (activeTab === 'pointages') {
        const data = await rhService.getPointages()
        setPointages(data)
      } else if (activeTab === 'equipes') {
        const data = await rhService.getEquipes()
        setEquipes(data)
      } else if (activeTab === 'heures-sup') {
        const data = await rhService.getHeuresSup()
        setHeuresSup(data)
      }
    } catch {
      setEmployes([])
      setPointages([])
      setEquipes([])
      setHeuresSup([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeTab, search, statutFilter, contratFilter])

  const handleSaveEmploye = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedEmploye) {
        await rhService.updateEmploye(selectedEmploye.id, employeForm)
      } else {
        await rhService.createEmploye(employeForm)
      }
      setShowEmployeModal(false)
      loadData()
    } catch {
      alert('Erreur lors de l\'enregistrement de l\'employé.')
    }
  }

  const handleChangePosteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmploye) return
    try {
      await rhService.changePoste(selectedEmploye.id, posteForm)
      alert('Changement de poste enregistré !')
      setShowChangementPosteModal(false)
      loadData()
    } catch {
      alert('Erreur lors du changement de poste.')
    }
  }

  const exportEmployesCSV = () => {
    const headers = ['Matricule', 'Nom', 'Prenom', 'Poste', 'Contrat', 'Telephone', 'Statut']
    const rows = employes.map(e => [e.matricule, e.nom, e.prenom, e.poste, e.type_contrat, e.telephone, e.statut])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'employes_export.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredEmployes = employes.filter(e => {
    if (contratFilter && e.type_contrat !== contratFilter) return false
    return true
  })

  return (
    <div className="container-fluid py-4">
      {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h2 className="mb-1 text-secondary"><i className="bi bi-people me-2"></i>Ressources Humaines</h2>
            <p className="text-secondary mb-0">Gestion du personnel BTP, des pointages, des équipes et de la paie</p>
          </div>
          {activeTab === 'employes' && (
            <div className="d-flex gap-2">
                {perms.canGenerateQR && (
                  <button className="btn btn-outline-secondary fw-bold" onClick={() => setShowScannerModal(true)}>
                    <i className="bi bi-qr-code-scan me-2"></i>Scanner Pointage
                  </button>
                )}
              {perms.canCreateEmploye && (
                <button className="btn btn-outline-secondary fw-bold" onClick={openNewEmployeModal}>
                  <i className="bi bi-person-plus me-2"></i>Nouvel employé
                </button>
              )}
            </div>
          )}
        </div>

      {/* Main Tabs */}
      <ul className="nav nav-pills mb-4 p-2 rounded shadow-sm">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'employes' ? 'active' : ''}`} onClick={() => setActiveTab('employes')}>
            <i className="bi bi-person-badge me-2"></i>Employés
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'pointages' ? 'active' : ''}`} onClick={() => setActiveTab('pointages')}>
            <i className="bi bi-calendar-check me-2"></i>Pointages
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'equipes' ? 'active' : ''}`} onClick={() => setActiveTab('equipes')}>
            <i className="bi bi-diagram-3 me-2"></i>Équipes
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'heures-sup' ? 'active' : ''}`} onClick={() => setActiveTab('heures-sup')}>
            <i className="bi bi-clock-history me-2"></i>Heures Sup.
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'conges' ? 'active' : ''}`} onClick={() => setActiveTab('conges')}>
            <i className="bi bi-calendar2-week me-2"></i>Congés
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'paie' ? 'active' : ''}`} onClick={() => setActiveTab('paie')}>
            <i className="bi bi-cash-coin me-2"></i>Paie
          </button>
        </li>
      </ul>

      {/* Tab Content */}
      {loading ? (
        <div className="card border-0 shadow-sm p-3">
          <TableSkeleton rows={8} columns={6} />
        </div>
      ) : activeTab === 'employes' ? (
        <div>
          {/* Filter bar */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="input-group">
                    <span className="input-group-text bg-light"><i className="bi bi-search text-muted"></i></span>
                    <input
                      type="text"
                      className="form-control bg-light"
                      placeholder="Rechercher un employé..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <select className="form-select bg-light" value={statutFilter} onChange={e => setStatutFilter(e.target.value)}>
                    <option value="">Tous les statuts</option>
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                    <option value="suspendu">Suspendu</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <select className="form-select bg-light" value={contratFilter} onChange={e => setContratFilter(e.target.value)}>
                    <option value="">Tous les contrats</option>
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="JOURNALIER">Journalier</option>
                    <option value="INTERIM">Intérim</option>
                    <option value="STAGE">Stage</option>
                  </select>
                </div>
                <div className="col-md-2 d-flex gap-2 justify-content-end">
                  <button className="btn btn-outline-secondary" onClick={exportEmployesCSV}>
                    <i className="bi bi-download me-1"></i>Exporter
                  </button>
                  <button className="btn btn-outline-secondary" onClick={loadData}>
                    <i className="bi bi-arrow-clockwise"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Employé</th>
                    <th>Poste actuel</th>
                    <th className="d-none d-md-table-cell">Contrat</th>
                    <th className="d-none d-lg-table-cell">Salaire base</th>
                    <th className="d-none d-lg-table-cell">Embauche</th>
                    <th>Statut</th>
                    <th style={{ width: '130px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-muted">
                        <i className="bi bi-person-x display-6 d-block mb-3"></i>
                        Aucun employé trouvé
                        <div className="mt-3">
                         <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedEmploye(null); setEmployeForm({ type_contrat: 'CDI', statut: 'actif', salaire_base: 0 }); setShowEmployeModal(true); }}>
                           <i className="bi bi-person-plus me-1"></i>Nouvel employé
                         </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployes.map(emp => (
                      <tr key={emp.id}>
                        <td className="font-monospace small fw-bold text-secondary">{emp.matricule || `EMP-00${emp.id}`}</td>
                        <td className="fw-semibold text-dark">{emp.nom} {emp.prenom}</td>
                        <td>{emp.poste}</td>
                        <td className="d-none d-md-table-cell"><span className="badge bg-light text-dark border">{emp.type_contrat}</span></td>
                        <td className="d-none d-lg-table-cell fw-bold">{emp.salaire_base?.toLocaleString()} MGA</td>
                        <td className="d-none d-lg-table-cell small">{emp.date_embauche || '-'}</td>
                        <td>
                          <span className={`badge ${emp.statut === 'actif' ? 'badge-actif' : 'badge-inactif'}`}>
                            {emp.statut}
                          </span>
                        </td>
                        <td>
                         <button className="btn btn-sm btn-outline-secondary btn-sm" onClick={() => { setSelectedBadgeEmploye(emp); setShowBadgeModal(true); }}>
                           <i className="bi bi-qr-code"></i>
                         </button>
                         <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => { setSelectedEmploye(emp); setPosteForm({ nouveau_poste: emp.poste || '', nouveau_salaire: emp.salaire_base || 0, date_effet: new Date().toISOString().split('T')[0], motif: '' }); setShowChangementPosteModal(true); }}>
                           <i className="bi bi-briefcase"></i>
                         </button>
                         <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedEmploye(emp); setEmployeForm(emp); setShowEmployeModal(true); }}>
                           <i className="bi bi-pencil"></i>
                         </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'pointages' ? (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-1 fw-bold"><i className="bi bi-calendar-check me-2"></i>Journal & Validation des Pointages</h5>
              <p className="text-muted small mb-0">Pointages QR Code, Auto-déclarations GPS & Régularisations (Politique transverse v2.0)</p>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary fw-bold" onClick={() => alert('Génération du QR Code Chantier du Jour:\n\nCode: CHT-QR-2026-0822\nValide pour: Chantier Anosy\nHeure: ' + new Date().toLocaleTimeString())}>
                <i className="bi bi-qr-code me-2"></i>Générer QR Code Chantier
              </button>
              <button className="btn btn-outline-secondary fw-bold" onClick={() => alert('Pointage Enregistré avec Succès !\n\nMode: Scan QR Code Site\nHeure: ' + new Date().toLocaleTimeString() + '\nStatut: En attente validation RH')}>
                <i className="bi bi-qr-code-scan me-2"></i>Simuler Scan Ouvrier
              </button>
            </div>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="card-header py-3 d-flex justify-content-between align-items-center" style={{ background: 'var(--tia-bg-surface)' }}>
              <h6 className="mb-0 fw-bold">Pointages de la journée</h6>
              <input type="date" className="form-control form-control-sm w-auto" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Employé / Intervenant</th>
                    <th>Mode Pointage</th>
                    <th>Date & Heure</th>
                    <th>Heures Totales</th>
                    <th>Statut Validation</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pointages.map(pt => (
                    <tr key={pt.id}>
                      <td className="fw-semibold">
                        <div>Employé #{pt.employe_id}</div>
                        <small className="text-muted">Chantier #1 - Anosy</small>
                      </td>
                      <td>
                           <span className="badge bg-light text-dark border">
                             <i className="bi bi-qr-code-scan me-1 text-muted"></i>QR Code Site
                           </span>
                      </td>
                      <td>{pt.date_jour}</td>
                       <td><span className="badge bg-primary bg-opacity-10 text-primary border">{pt.heures_total}h</span></td>
                       <td><span className="badge bg-success bg-opacity-10 text-success border text-capitalize">{pt.type}</span></td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-success me-1" onClick={() => alert('Pointage validé par RH !')}>
                          <i className="bi bi-check-lg"></i> Validé
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'equipes' ? (
        <div className="row g-4">
          {equipes.map(eq => (
            <div key={eq.id} className="col-md-4">
              <div className="card border-0 shadow-sm h-100 kpi-card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="fw-bold mb-0 text-dark">{eq.nom}</h5>
                    <span className="badge bg-success bg-opacity-10 text-success">Active</span>
                  </div>
                  <p className="text-muted small mb-0"><i className="bi bi-person-badge me-2"></i>Chef d'équipe ID: {eq.chef_equipe_id || '-'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'conges' ? (
        <RhCongesTab />
      ) : activeTab === 'paie' ? (
        <RhPaieTab />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Employé</th>
                  <th>Date HS</th>
                  <th>Nombre d'heures</th>
                  <th>Majoration</th>
                  <th>Motif</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {heuresSup.map(hs => (
                  <tr key={hs.id}>
                    <td className="fw-semibold">Employé #{hs.employe_id}</td>
                    <td>{hs.date_hs}</td>
                      <td><span className="badge bg-light text-dark border font-monospace">{hs.nb_heures}h</span></td>
                      <td>+{hs.taux_majoration}%</td>
                      <td>{hs.motif || '-'}</td>
                      <td>
                        <span className={`badge ${hs.statut === 'validee' ? 'bg-success bg-opacity-10 text-success border' : hs.statut === 'refusee' ? 'bg-danger bg-opacity-10 text-danger border' : 'bg-warning bg-opacity-10 text-dark border'}`}>
                          {hs.statut}
                        </span>
                      </td>
                      <td>
                        {hs.statut === 'en_attente' && (
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-secondary" onClick={() => rhService.validateHeureSup(hs.id, 'validee').then(loadData)}>
                              Approuver
                            </button>
                            <button className="btn btn-outline-secondary" onClick={() => rhService.validateHeureSup(hs.id, 'refusee').then(loadData)}>
                              Rejeter
                            </button>
                          </div>
                        )}
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add Employe */}
      {showEmployeModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {selectedEmploye ? 'Éditer l\'employé' : 'Nouvel employé'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEmployeModal(false)}></button>
              </div>
              <form onSubmit={handleSaveEmploye}>
                <div className="modal-body">
                  <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Matricule (Auto-généré) *</label>
                        <div className="input-group">
                          <input type="text" className="form-control font-monospace fw-bold" required value={employeForm.matricule || ''} onChange={e => setEmployeForm({...employeForm, matricule: e.target.value})} />
                          <button className="btn btn-outline-secondary" type="button" onClick={() => {
                            const year = new Date().getFullYear()
                            const count = employes.length + 1
                            const prefix = employeForm.type_contrat === 'JOURNALIER' ? 'JRN' : 'EMP'
                            setEmployeForm({...employeForm, matricule: `${prefix}-${year}-${String(count).padStart(3, '0')}`})
                          }}>
                            <i className="bi bi-arrow-clockwise"></i>
                          </button>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Nom *</label>
                        <input type="text" className="form-control" required value={employeForm.nom || ''} onChange={e => setEmployeForm({...employeForm, nom: e.target.value})} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Prénom *</label>
                        <input type="text" className="form-control" value={employeForm.prenom || ''} onChange={e => setEmployeForm({...employeForm, prenom: e.target.value})} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Poste Métier BTP *</label>
                        <select className="form-select" required value={employeForm.poste || ''} onChange={e => setEmployeForm({...employeForm, poste: e.target.value})}>
                          <option value="">Sélectionner un métier BTP...</option>
                          {POSTES_BTP.map((p, i) => (
                            <option key={i} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Type de Contrat</label>
                        <select className="form-select" value={employeForm.type_contrat || 'CDI'} onChange={e => setEmployeForm({...employeForm, type_contrat: e.target.value as any})}>
                          <option value="CDI">CDI (Permanent)</option>
                          <option value="CDD">CDD (Projet/Chantier)</option>
                          <option value="JOURNALIER">Journalier (Main d'œuvre Tâcheron)</option>
                          <option value="INTERIM">Intérim / Sous-traitance</option>
                          <option value="STAGE">Stage / Apprentissage</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Salaire de Base (MGA)</label>
                        <input type="number" className="form-control font-monospace" value={employeForm.salaire_base || 0} onChange={e => setEmployeForm({...employeForm, salaire_base: Number(e.target.value)})} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Téléphone / Mobile Money</label>
                        <input type="text" className="form-control" placeholder="+261 34 00 000 00" value={employeForm.telephone || ''} onChange={e => setEmployeForm({...employeForm, telephone: e.target.value})} />
                      </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Mode de Rémunération</label>
                      <select className="form-select" value={employeForm.mode_remuneration || 'mensuel'} onChange={e => setEmployeForm({...employeForm, mode_remuneration: e.target.value as any})}>
                        <option value="mensuel">Mensuel</option>
                        <option value="journalier">Journalier</option>
                        <option value="horaire">Horaire</option>
                        <option value="a_la_tache">À la tâche</option>
                      </select>
                    </div>
                    {(employeForm.mode_remuneration === 'journalier' || employeForm.mode_remuneration === 'horaire') && (
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Taux {employeForm.mode_remuneration === 'journalier' ? 'journalier' : 'horaire'} (MGA)
                        </label>
                        <input type="number" className="form-control font-monospace" value={employeForm.taux_journalier || employeForm.taux_horaire || 0} onChange={e => setEmployeForm({...employeForm, [employeForm.mode_remuneration === 'journalier' ? 'taux_journalier' : 'taux_horaire']: Number(e.target.value)})} />
                      </div>
                    )}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Solde congés annuel (jours)</label>
                      <input type="number" min={0} step={0.5} className="form-control font-monospace" value={employeForm.solde_conges_annuel ?? 30} onChange={e => setEmployeForm({...employeForm, solde_conges_annuel: Number(e.target.value)})} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">N° CNAPS</label>
                      <input type="text" className="form-control" value={employeForm.numero_cnaps || ''} onChange={e => setEmployeForm({...employeForm, numero_cnaps: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">N° OSTIE</label>
                      <input type="text" className="form-control" value={employeForm.numero_ostie || ''} onChange={e => setEmployeForm({...employeForm, numero_ostie: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Statut Déclaration</label>
                      <select className="form-select" value={employeForm.statut_declaration || 'non_declare'} onChange={e => setEmployeForm({...employeForm, statut_declaration: e.target.value as any})}>
                        <option value="non_declare">Non déclaré</option>
                        <option value="cnaps">CNAPS</option>
                        <option value="cnaps_ostie">CNAPS + OSTIE</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEmployeModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Changement de Poste */}
      {showChangementPosteModal && selectedEmploye && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Changement de Poste - {selectedEmploye.nom} {selectedEmploye.prenom}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowChangementPosteModal(false)}></button>
              </div>
              <form onSubmit={handleChangePosteSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nouveau Poste *</label>
                    <input type="text" className="form-control" required value={posteForm.nouveau_poste} onChange={e => setPosteForm({ ...posteForm, nouveau_poste: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nouveau Salaire de Base (MGA)</label>
                    <input type="number" className="form-control font-monospace" value={posteForm.nouveau_salaire} onChange={e => setPosteForm({ ...posteForm, nouveau_salaire: Number(e.target.value) })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Date de prise d'effet *</label>
                    <input type="date" className="form-control" required value={posteForm.date_effet} onChange={e => setPosteForm({ ...posteForm, date_effet: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Motif du changement</label>
                    <textarea className="form-control" rows={2} value={posteForm.motif} onChange={e => setPosteForm({ ...posteForm, motif: e.target.value })}></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowChangementPosteModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-outline-secondary fw-bold">Valider le changement</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Badge QR Code */}
      {showBadgeModal && selectedBadgeEmploye && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 bg-transparent shadow-none">
              <div className="d-flex justify-content-end mb-2">
                <button type="button" className="btn-close btn-close-white fs-4" onClick={() => setShowBadgeModal(false)}></button>
              </div>
              <WorkerBadgeCard employe={selectedBadgeEmploye} onPrint={() => window.print()} />
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner QR Code */}
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onPointageSuccess={() => loadData()}
      />
    </div>
  )
}
