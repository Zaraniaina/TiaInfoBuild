import { useAuthStore } from '@/stores/auth.store'
import { RoleBadge } from '@/components/layout/RoleBadge'
import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { CaEvolutionChart, TopChantiersChart, DepensesParCategorieChart } from '@/components/charts/DashboardCharts'
import type { DashboardStats } from '@/types'

export function DashboardPage() {
  const { user } = useAuthStore()
  const roleCode = user?.role_code || 'employe'
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => {
        setStats({
          ca_total: 145000000,
          ca_mois: 145000000,
          depenses_mois: 85000000,
          margin_net: 60000000,
          factures_en_retard: 3,
          factures_retard: 3,
          nb_chantiers_actifs: 12,
          nb_employes: 48,
          nb_articles: 142,
          nb_clients: 24,
          nb_devis: 8,
          devis_pending_dg: 2,
          nb_materiels: 19,
          stocks_alerte: 5,
          attendance_rate: 87.5,
          maintenance_due: 2,
          top_chantiers: [],
          ca_evolution: [],
          alertes_recentes: [],
          activite_recente: []
        })
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-fluid py-4">
      {/* Header générique avec Badge Rôle */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold"><i className="bi bi-speedometer2 me-2 text-primary"></i>Espace de Travail Dédié</h2>
          <p className="text-secondary mb-0">Bienvenue, <strong>{user?.prenom} {user?.nom}</strong> — Vue d'ensemble adaptée à votre rôle</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <RoleBadge roleCode={roleCode} />
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-clockwise me-1"></i> Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : (
        <>
          {/* Rôle 1: Super Admin */}
          {roleCode === 'super_admin' && (
            <div>
              <div className="alert alert-danger bg-danger bg-opacity-10 text-danger border-0 mb-4 d-flex align-items-center">
                <i className="bi bi-shield-lock-fill fs-4 me-3"></i>
                <div>
                  <strong>Mode Super Admin SaaS (Propriétaire de la plateforme)</strong>
                  <div className="small">Supervision globale des entreprises abonnées (tenants), santé réseau et abonnements.</div>
                </div>
              </div>
              <div className="row g-3 mb-4">
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Tenants Actifs</small>
                    <h2 className="fw-bold text-danger mt-2 mb-0">15</h2>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Utilisateurs Globaux</small>
                    <h2 className="fw-bold text-dark mt-2 mb-0">124</h2>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Santé Uptime</small>
                    <h2 className="fw-bold text-success mt-2 mb-0">99.9%</h2>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Recettes SaaS (Mobile Money)</small>
                    <h2 className="fw-bold text-primary mt-2 mb-0">4.5M MGA</h2>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rôle 2: Admin Entreprise */}
          {roleCode === 'admin_entreprise' && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center border-start border-4 border-primary">
                    <small className="text-muted text-uppercase fw-bold">Comptes Utilisateurs</small>
                    <h2 className="fw-bold text-primary mt-2 mb-0">48</h2>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center border-start border-4 border-success">
                    <small className="text-muted text-uppercase fw-bold">Rôles Attribués</small>
                    <h2 className="fw-bold text-success mt-2 mb-0">11</h2>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center border-start border-4 border-warning">
                    <small className="text-muted text-uppercase fw-bold">Connexions 24h</small>
                    <h2 className="fw-bold text-warning mt-2 mb-0">34</h2>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center border-start border-4 border-danger">
                    <small className="text-muted text-uppercase fw-bold">Alertes Sécurité</small>
                    <h2 className="fw-bold text-danger mt-2 mb-0">0</h2>
                  </div>
                </div>
              </div>
              <div className="card border-0 shadow-sm p-4 mb-4">
                <h5 className="fw-bold mb-3"><i className="bi bi-gear-fill me-2 text-primary"></i>Raccourcis Administration Technique</h5>
                <div className="d-flex gap-2 flex-wrap">
                  <a href="/settings" className="btn btn-primary fw-bold"><i className="bi bi-person-gear me-2"></i>Gérer les Comptes & Rôles</a>
                  <a href="/historique-logins" className="btn btn-outline-dark fw-bold"><i className="bi bi-shield-check me-2"></i>Audit des Logs de Connexion</a>
                  <a href="/settings" className="btn btn-outline-secondary"><i className="bi bi-sliders me-2"></i>Paramètres TVA & Devise</a>
                </div>
              </div>
            </div>
          )}

          {/* Rôle 3: Direction Générale (DG / DAF) */}
          {roleCode === 'directeur' && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Chiffre d'Affaires Brut</small>
                    <h3 className="fw-bold text-primary mt-2 mb-0">{(stats?.ca_total || 0).toLocaleString()} MGA</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Résultat Net Consolidé</small>
                    <h3 className="fw-bold text-success mt-2 mb-0">+ {(stats?.margin_net || 0).toLocaleString()} MGA</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Devis à Valider (DG)</small>
                    <h3 className="fw-bold text-warning mt-2 mb-0">{stats?.devis_pending_dg || 2}</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Alertes Risque Chantiers</small>
                    <h3 className="fw-bold text-danger mt-2 mb-0">1</h3>
                  </div>
                </div>
              </div>
              <div className="row g-4 mb-4">
                <div className="col-lg-8">
                  <div className="card border-0 shadow-sm p-3">
                    <h5 className="fw-bold mb-3"><i className="bi bi-graph-up-arrow me-2 text-success"></i>Performance Financière Consolidée</h5>
                    <CaEvolutionChart />
                  </div>
                </div>
                <div className="col-lg-4">
                  <div className="card border-0 shadow-sm p-3">
                    <h5 className="fw-bold mb-3"><i className="bi bi-check-circle-fill me-2 text-warning"></i>Validations requises (DG)</h5>
                    <div className="list-group list-group-flush">
                      <div className="list-group-item px-0 py-2">
                        <div className="fw-bold">Devis #DEV-2026-004</div>
                        <small className="text-muted">Client SODIAT — Montant: 85 000 000 MGA</small>
                        <div className="mt-1"><button className="btn btn-sm btn-success py-0 me-1" onClick={() => alert('Devis Approuvé par DG !')}>Approuver</button></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rôle 4: Comptable / Financier */}
          {roleCode === 'comptable' && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Encaissements du mois</small>
                    <h3 className="fw-bold text-success mt-2 mb-0">45 000 000 MGA</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Factures en retard</small>
                    <h3 className="fw-bold text-danger mt-2 mb-0">{stats?.factures_retard || 3}</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Dépenses à valider</small>
                    <h3 className="fw-bold text-warning mt-2 mb-0">4</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Marge Moyenne Réelle</small>
                    <h3 className="fw-bold text-primary mt-2 mb-0">19.4%</h3>
                  </div>
                </div>
              </div>
              <div className="d-flex gap-2 mb-4">
                <a href="/finance" className="btn btn-primary fw-bold"><i className="bi bi-wallet2 me-2"></i>Saisir une Dépense</a>
                <a href="/commercial" className="btn btn-outline-success fw-bold"><i className="bi bi-receipt me-2"></i>Relancer les Impayés</a>
              </div>
            </div>
          )}

          {/* Rôle 5: Chef de Projet */}
          {roleCode === 'chef_projet' && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Portefeuille Chantiers</small>
                    <h3 className="fw-bold text-primary mt-2 mb-0">5 Chantiers</h3>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Conflits d'Affectation</small>
                    <h3 className="fw-bold text-warning mt-2 mb-0">0</h3>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Avancement Moyen</small>
                    <h3 className="fw-bold text-success mt-2 mb-0">74%</h3>
                  </div>
                </div>
              </div>
               <div className="card border-0 shadow-sm p-3 mb-4">
                 <h5 className="fw-bold mb-3"><i className="bi bi-building-gear me-2 text-primary"></i>Supervision Multi-Projets</h5>
                 <div style={{ height: '320px' }}>
                   <TopChantiersChart />
                 </div>
               </div>
            </div>
          )}

          {/* Rôle 6: Chef de Chantier */}
          {roleCode === 'chef_chantier' && (
            <div>
              <div className="card bg-primary text-white border-0 shadow-sm p-4 mb-4">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div>
                    <h4 className="fw-bold mb-1"><i className="bi bi-building me-2"></i>Chantier : Construction Immeuble Anosy</h4>
                    <p className="mb-0 text-white-50">Chef de chantier référent | Avancement physique: 65%</p>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-warning fw-bold text-dark" onClick={() => alert('Code QR Généré pour la journée !\nValide sur site Anosy.')}>
                      <i className="bi bi-qr-code-scan me-2"></i>Générer QR Pointage Équipe
                    </button>
                    <button className="btn btn-light fw-bold text-primary" onClick={() => alert('Auto-déclaration GPS Enregistrée (Latitude: -18.91, Longitude: 47.52)')}>
                      <i className="bi bi-geo-alt-fill me-2"></i>Pointage GPS Personnel
                    </button>
                  </div>
                </div>
              </div>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Équipe Présente</small>
                    <h3 className="fw-bold text-success mt-2 mb-0">14 / 15</h3>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Incidents du Jour</small>
                    <h3 className="fw-bold text-danger mt-2 mb-0">0</h3>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Demandes Matériel</small>
                    <h3 className="fw-bold text-info mt-2 mb-0">1 En attente</h3>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rôle 7: Responsable RH */}
          {roleCode === 'rh' && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Total Effectif RH</small>
                    <h3 className="fw-bold text-primary mt-2 mb-0">48</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Taux de Présence Jour</small>
                    <h3 className="fw-bold text-success mt-2 mb-0">87.5%</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Heures Sup. à Valider</small>
                    <h3 className="fw-bold text-warning mt-2 mb-0">3</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Habilitations à Renouveler</small>
                    <h3 className="fw-bold text-danger mt-2 mb-0">2</h3>
                  </div>
                </div>
              </div>
              <div className="d-flex gap-2">
                <a href="/rh" className="btn btn-primary fw-bold"><i className="bi bi-calendar-check me-2"></i>Valider la Grille des Pointages</a>
                <a href="/rh" className="btn btn-outline-secondary fw-bold"><i className="bi bi-person-plus me-2"></i>Ajouter un Salarié</a>
              </div>
            </div>
          )}

          {/* Rôle 8: Responsable Matériel */}
          {roleCode === 'materiel' && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Parc Engins Total</small>
                    <h3 className="fw-bold text-dark mt-2 mb-0">19</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Engins Disponibles</small>
                    <h3 className="fw-bold text-success mt-2 mb-0">12</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Engins Affectés</small>
                    <h3 className="fw-bold text-primary mt-2 mb-0">5</h3>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">En Maintenance / Panne</small>
                    <h3 className="fw-bold text-warning mt-2 mb-0">2</h3>
                  </div>
                </div>
              </div>
              <a href="/materiels" className="btn btn-info text-white fw-bold"><i className="bi bi-tools me-2"></i>Planifier une Maintenance</a>
            </div>
          )}

          {/* Rôle 9: Magasinier / Stocks */}
          {roleCode === 'magasinier' && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Total Références Stock</small>
                    <h3 className="fw-bold text-dark mt-2 mb-0">142</h3>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Alertes Stock Bas</small>
                    <h3 className="fw-bold text-warning mt-2 mb-0">{stats?.stocks_alerte || 5}</h3>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Mouvements 24h</small>
                    <h3 className="fw-bold text-success mt-2 mb-0">18</h3>
                  </div>
                </div>
              </div>
              <a href="/stocks" className="btn btn-warning fw-bold text-dark"><i className="bi bi-box-arrow-in-down me-2"></i>Enregistrer Entrée/Sortie Stock</a>
            </div>
          )}

           {/* Rôle 10: Commercial */}
           {roleCode === 'commercial' && (
             <div>
               <div className="row g-3 mb-4">
                 <div className="col-md-3">
                   <div className="card border-0 shadow-sm p-3 text-center">
                     <small className="text-muted text-uppercase fw-bold">Portefeuille Clients</small>
                     <h3 className="fw-bold text-dark mt-2 mb-0">24</h3>
                   </div>
                 </div>
                 <div className="col-md-3">
                   <div className="card border-0 shadow-sm p-3 text-center">
                     <small className="text-muted text-uppercase fw-bold">Devis en Cours</small>
                     <h3 className="fw-bold text-primary mt-2 mb-0">8</h3>
                   </div>
                 </div>
                 <div className="col-md-3">
                   <div className="card border-0 shadow-sm p-3 text-center">
                     <small className="text-muted text-uppercase fw-bold">Taux de Conversion</small>
                     <h3 className="fw-bold text-success mt-2 mb-0">62.5%</h3>
                   </div>
                 </div>
                 <div className="col-md-3">
                   <div className="card border-0 shadow-sm p-3 text-center">
                     <small className="text-muted text-uppercase fw-bold">Pipeline CA Proposé</small>
                     <h3 className="fw-bold text-info mt-2 mb-0">180M MGA</h3>
                   </div>
                 </div>
               </div>
               <div className="card border-0 shadow-sm p-3 mb-4">
                 <h5 className="fw-bold mb-3"><i className="bi bi-graph-up-arrow me-2 text-success"></i>Performance Commerciale</h5>
                 <div style={{ height: '280px' }}>
                   <TopChantiersChart />
                 </div>
               </div>
               <a href="/commercial" className="btn btn-primary fw-bold"><i className="bi bi-file-earmark-plus me-2"></i>Rédiger un Devis Client</a>
             </div>
           )}

          {/* Rôle 11: Ouvrier / Employé Terrain */}
          {roleCode === 'employe' && (
            <div>
              <div className="card bg-success text-white border-0 shadow-sm p-4 mb-4">
                <h4 className="fw-bold mb-2"><i className="bi bi-qr-code-scan me-2"></i>Mon Espace Pointage Terrain</h4>
                <p className="mb-3 text-white-50">Scannez le QR Code affiché par votre Chef de Chantier pour valider votre prise de poste.</p>
                <button className="btn btn-light text-success font-monospace fw-bold py-3" onClick={() => alert('Scanner QR Activé !\nPlacez l\'appareil face au code du Chef de Chantier.')}>
                  <i className="bi bi-camera me-2 fs-5"></i>Scanner QR Code Chantier
                </button>
              </div>

              <div className="card border-0 shadow-sm p-4">
                <h5 className="fw-bold mb-3"><i className="bi bi-list-check me-2 text-primary"></i>Mes Tâches Assignées Aujourd'hui</h5>
                <div className="list-group list-group-flush">
                  <div className="list-group-item px-0 py-3 d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1 fw-bold">Coffrage voile B2 — Zone Nord</h6>
                      <small className="text-muted">Chantier Immeuble Anosy</small>
                    </div>
                    <span className="badge bg-warning text-dark">En cours</span>
                  </div>
                  <div className="list-group-item px-0 py-3 d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1 fw-bold">Pose armature ferraillage Ø12</h6>
                      <small className="text-muted">Chantier Immeuble Anosy</small>
                    </div>
                    <span className="badge bg-secondary">À faire</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rôle 12: Client */}
          {roleCode === 'client' && (
            <div>
              <div className="alert alert-info bg-info bg-opacity-10 text-info border-0 mb-4 d-flex align-items-center">
                <i className="bi bi-person-badge fs-4 me-3"></i>
                <div>
                  <strong>Espace Client</strong>
                  <div className="small">Suivi de vos projets, devis et factures.</div>
                </div>
              </div>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Mes Projets</small>
                    <h3 className="fw-bold text-primary mt-2 mb-0">0</h3>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Devis en Cours</small>
                    <h3 className="fw-bold text-warning mt-2 mb-0">0</h3>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm p-3 text-center">
                    <small className="text-muted text-uppercase fw-bold">Factures</small>
                    <h3 className="fw-bold text-success mt-2 mb-0">0</h3>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Widgets communs d'analyse graphiques */}
          {['super_admin', 'admin_entreprise', 'directeur', 'comptable', 'chef_projet', 'commercial'].includes(roleCode) && (
            <div className="row g-4 mt-2">
              <div className="col-lg-8">
                <div className="card border-0 shadow-sm p-3">
                  <h5 className="fw-bold mb-3"><i className="bi bi-graph-up me-2 text-primary"></i>Évolution Générale de l'Activité</h5>
                  <div style={{ height: '320px' }}>
                    <CaEvolutionChart />
                  </div>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="card border-0 shadow-sm p-3">
                  <h5 className="fw-bold mb-3"><i className="bi bi-pie-chart me-2 text-warning"></i>Dépenses par Poste</h5>
                  <div style={{ height: '320px' }}>
                    <DepensesParCategorieChart />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
