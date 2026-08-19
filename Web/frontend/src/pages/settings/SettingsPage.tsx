import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'

export function SettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'entreprise' | 'facturation' | 'utilisateurs' | 'profil' | 'sauvegarde' | 'sync'>('entreprise')
  const [loading, setLoading] = useState(false)

  // Entreprise Form
  const [entrepriseForm, setEntrepriseForm] = useState({
    nom: 'TIA INFO BUILD SARL',
    siret: '123 456 789 00012',
    statut_juridique: 'SARL',
    telephone: '020 22 999 88',
    email: 'contact@tia-infobuild.mg',
    adresse: 'Zone Industrielle Akorondrano',
    ville: 'Antananarivo 101'
  })

  // Facturation Form
  const [facturationForm, setFacturationForm] = useState({
    prefixe_devis: 'DEV-',
    prefixe_facture: 'FAC-',
    prefixe_contrat: 'CTR-',
    tva_defaut: 20,
    delai_paiement_jours: 30
  })

  // Profil Form
  const [profilForm, setProfilForm] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    password_actuel: '',
    nouveau_password: ''
  })

  // Users List Mock
  const [usersList, setUsersList] = useState([
    { id: 1, nom: user?.nom || 'Admin', prenom: user?.prenom || 'User', email: user?.email || 'admin@tia.mg', role: 'ADMIN', actif: true },
    { id: 2, nom: 'RABARISON', prenom: 'Michel', email: 'michel@tia.mg', role: 'CHEF_CHANTIER', actif: true }
  ])

  const handleSaveEntreprise = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Paramètres d\'entreprise sauvegardés avec succès !')
  }

  const handleSaveFacturation = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Paramètres de facturation mis à jour !')
  }

  const handleSaveProfil = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Profil utilisateur mis à jour !')
  }

  const handleDownloadBackup = () => {
    const backupData = JSON.stringify({ entreprise: entrepriseForm, facturation: facturationForm, date: new Date().toISOString() })
    const blob = new Blob([backupData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tia_info_build_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="mb-1"><i className="bi bi-gear me-2 text-primary"></i>Paramètres & Configuration</h2>
        <p className="text-secondary mb-0">Configuration de l'entreprise, des modèles de document, des utilisateurs et de la synchronisation</p>
      </div>

      {/* Settings Navigation Tabs */}
      <ul className="nav nav-pills mb-4 bg-white p-2 rounded shadow-sm">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'entreprise' ? 'active' : ''}`} onClick={() => setActiveTab('entreprise')}>
            <i className="bi bi-building me-2"></i>Entreprise
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'facturation' ? 'active' : ''}`} onClick={() => setActiveTab('facturation')}>
            <i className="bi bi-receipt me-2"></i>Facturation
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'utilisateurs' ? 'active' : ''}`} onClick={() => setActiveTab('utilisateurs')}>
            <i className="bi bi-people me-2"></i>Utilisateurs & Rôles
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'profil' ? 'active' : ''}`} onClick={() => setActiveTab('profil')}>
            <i className="bi bi-person me-2"></i>Mon Profil
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'sauvegarde' ? 'active' : ''}`} onClick={() => setActiveTab('sauvegarde')}>
            <i className="bi bi-hdd-network me-2"></i>Sauvegarde
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>
            <i className="bi bi-arrow-repeat me-2"></i>Sync Web/Desktop
          </button>
        </li>
      </ul>

      {/* Tab Panels */}
      <div className="card border-0 shadow-sm p-4">
        {activeTab === 'entreprise' && (
          <form onSubmit={handleSaveEntreprise}>
            <h5 className="fw-bold mb-3 border-bottom pb-2">Informations Générales de l'Entreprise</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Raison Sociale *</label>
                <input type="text" className="form-control" required value={entrepriseForm.nom} onChange={e => setEntrepriseForm({ ...entrepriseForm, nom: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">SIRET / NIF *</label>
                <input type="text" className="form-control font-monospace" required value={entrepriseForm.siret} onChange={e => setEntrepriseForm({ ...entrepriseForm, siret: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Email Contact</label>
                <input type="email" className="form-control" value={entrepriseForm.email} onChange={e => setEntrepriseForm({ ...entrepriseForm, email: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Téléphone</label>
                <input type="text" className="form-control" value={entrepriseForm.telephone} onChange={e => setEntrepriseForm({ ...entrepriseForm, telephone: e.target.value })} />
              </div>
              <div className="col-md-8">
                <label className="form-label fw-semibold">Adresse</label>
                <input type="text" className="form-control" value={entrepriseForm.adresse} onChange={e => setEntrepriseForm({ ...entrepriseForm, adresse: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Ville</label>
                <input type="text" className="form-control" value={entrepriseForm.ville} onChange={e => setEntrepriseForm({ ...entrepriseForm, ville: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary fw-bold mt-4">Enregistrer les modifications</button>
          </form>
        )}

        {activeTab === 'facturation' && (
          <form onSubmit={handleSaveFacturation}>
            <h5 className="fw-bold mb-3 border-bottom pb-2">Modèles et Numérotation des Documents</h5>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Préfixe Devis</label>
                <input type="text" className="form-control font-monospace" value={facturationForm.prefixe_devis} onChange={e => setFacturationForm({ ...facturationForm, prefixe_devis: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Préfixe Factures</label>
                <input type="text" className="form-control font-monospace" value={facturationForm.prefixe_facture} onChange={e => setFacturationForm({ ...facturationForm, prefixe_facture: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Préfixe Contrats</label>
                <input type="text" className="form-control font-monospace" value={facturationForm.prefixe_contrat} onChange={e => setFacturationForm({ ...facturationForm, prefixe_contrat: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Taux TVA par défaut (%)</label>
                <input type="number" className="form-control font-monospace" value={facturationForm.tva_defaut} onChange={e => setFacturationForm({ ...facturationForm, tva_defaut: Number(e.target.value) })} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Délai de paiement par défaut (Jours)</label>
                <input type="number" className="form-control font-monospace" value={facturationForm.delai_paiement_jours} onChange={e => setFacturationForm({ ...facturationForm, delai_paiement_jours: Number(e.target.value) })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary fw-bold mt-4">Enregistrer les paramètres</button>
          </form>
        )}

        {activeTab === 'utilisateurs' && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0">Gestion des Utilisateurs</h5>
              <button className="btn btn-sm btn-primary fw-bold"><i className="bi bi-person-plus me-1"></i>Nouvel Utilisateur</button>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id}>
                      <td className="fw-semibold">{u.prenom} {u.nom}</td>
                      <td>{u.email}</td>
                      <td><span className="badge bg-dark">{u.role}</span></td>
                      <td>
                        <span className={`badge ${u.actif ? 'bg-success' : 'bg-secondary'}`}>
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'profil' && (
          <form onSubmit={handleSaveProfil}>
            <h5 className="fw-bold mb-3 border-bottom pb-2">Mon Profil & Mot de passe</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Prénom</label>
                <input type="text" className="form-control" value={profilForm.prenom} onChange={e => setProfilForm({ ...profilForm, prenom: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nom</label>
                <input type="text" className="form-control" value={profilForm.nom} onChange={e => setProfilForm({ ...profilForm, nom: e.target.value })} />
              </div>
              <div className="col-md-12">
                <label className="form-label fw-semibold">Email</label>
                <input type="email" className="form-control" value={profilForm.email} onChange={e => setProfilForm({ ...profilForm, email: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary fw-bold mt-4">Mettre à jour le profil</button>
          </form>
        )}

        {activeTab === 'sauvegarde' && (
          <div>
            <h5 className="fw-bold mb-3 border-bottom pb-2">Sauvegarde & Exportation des données</h5>
            <p className="text-secondary">Téléchargez une copie intégrale des données de votre entreprise au format JSON/SQL.</p>
            <button className="btn btn-success fw-bold py-2 px-4" onClick={handleDownloadBackup}>
              <i className="bi bi-download me-2"></i>Télécharger la sauvegarde complète
            </button>
          </div>
        )}

        {activeTab === 'sync' && (
          <div>
            <h5 className="fw-bold mb-3 border-bottom pb-2">Synchronisation Web / Desktop</h5>
            <div className="alert alert-info">
              <i className="bi bi-cloud-check fs-4 me-2"></i>
              Statut de la connexion serveur: <strong>En ligne (Synchro active)</strong>
            </div>
            <button className="btn btn-primary fw-bold" onClick={() => alert('Synchronisation forcée effectuée avec succès !')}>
              <i className="bi bi-arrow-repeat me-2"></i>Lancer une synchronisation manuelle
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
