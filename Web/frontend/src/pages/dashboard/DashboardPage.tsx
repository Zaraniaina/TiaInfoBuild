import { useAuthStore } from '@/stores/auth.store'
import { useNavigate } from 'react-router-dom'
import { RoleBadge } from '@/components/layout/RoleBadge'
import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import {
  SaasTenantsGrowthChart,
  UserActivityLogsChart,
  CaVsDepensesChart,
  DepensesParPosteChart,
  MultiChantiersProgressChart,
  EquipePresenceDailyChart,
  RhEquipesDistributionChart,
  ParcUsageRateChart,
  StockCategoryDistributionChart,
  SalesPipelineChart,
  WorkerPersonalAttendanceChart
} from '@/components/charts/DashboardCharts'
import type { DashboardStats } from '@/types'
import { ROLE_NAMES, ROLE_DASHBOARD_TITLE } from '@/config/roles.config'
import { QRScannerModal } from '@/components/pointage/QRScannerModal'
import { WorkerBadgeCard } from '@/components/pointage/WorkerBadgeCard'

const ROLE_META: Record<string, { greeting: string; alert?: { type: string; icon: string; title: string; text: string } }> = {
  super_admin: {
    greeting: 'Supervision globale de la plateforme SaaS',
    alert: { type: 'danger', icon: 'bi-shield-lock-fill', title: 'Mode Super Admin', text: 'Gestion des abonnements et de la santé globale de la plateforme SaaS.' },
  },
  admin_entreprise: {
    greeting: 'Administration technique, comptes et sécurité de votre entreprise',
    alert: { type: 'primary', icon: 'bi-gear-fill', title: 'Espace Administrateur', text: 'Gestion des accès utilisateurs, audit de sécurité et configuration des paramètres.' },
  },
  directeur: {
    greeting: 'Pilotage stratégique et validation des décisions à fort enjeu',
  },
  comptable: {
    greeting: 'Suivi comptable, contrôle des coûts et trésorerie',
  },
  chef_chantier: {
    greeting: 'Suivi quotidien de votre chantier et pointage de votre équipe',
    alert: { type: 'info', icon: 'bi-building', title: 'Gestion Terrain', text: 'Scannez le badge des ouvriers ou validez votre pointage GPS.' },
  },
  chef_projet: {
    greeting: 'Supervision multi-projets et arbitrage des ressources',
  },
  rh: {
    greeting: 'Gestion du personnel, habilitations BTP et pointages',
  },
  materiel: {
    greeting: 'Gestion du parc d\'engins et planning de maintenance',
  },
  magasinier: {
    greeting: 'Gestion des stocks, entrées/sorties et réapprovisionnements',
  },
  commercial: {
    greeting: 'Suivi du pipeline commercial, devis et factures clients',
  },
  employe: {
    greeting: 'Vos tâches affectées et votre badge officiel de pointage',
    alert: { type: 'success', icon: 'bi-qr-code-scan', title: 'Mon Badge QR', text: 'Présentez votre badge au Chef de Chantier lors de votre arrivée / départ.' },
  },
  client: {
    greeting: 'Suivi de vos projets et état de vos devis / factures',
  },
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const roleCode = user?.role_code || 'employe'
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [showBadgeModal, setShowBadgeModal] = useState(false)

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  const meta = ROLE_META[roleCode] || ROLE_META['employe']
  const dashboardTitle = ROLE_DASHBOARD_TITLE[roleCode] || 'Tableau de bord'

  const renderKpi = (label: string, value: string | number, context?: string, colorClass = 'text-primary') => (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${colorClass}`}>{value}</div>
      {context && <div className="kpi-context">{context}</div>}
    </div>
  )

  const renderAlert = () => {
    if (!meta.alert) return null
    const colors: Record<string, string> = {
      danger: 'bg-danger bg-opacity-10 text-danger',
      primary: 'bg-primary bg-opacity-10 text-primary',
      info: 'bg-info bg-opacity-10 text-info',
      success: 'bg-success bg-opacity-10 text-success',
      warning: 'bg-warning bg-opacity-10 text-warning',
    }
    return (
      <div className={`alert-bar mb-4 ${colors[meta.alert.type] || colors.info}`}>
        <div className="alert-icon"><i className={`bi ${meta.alert.icon}`}></i></div>
        <div>
          <strong>{meta.alert.title}</strong>
          <div className="small mb-0">{meta.alert.text}</div>
        </div>
      </div>
    )
  }

  // 1. SUPER ADMIN SAAS DASHBOARD
  const renderSuperAdmin = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Tenants Actifs', '15', 'Entreprises clientes abonnées', 'text-danger')}
        {renderKpi('Utilisateurs Globaux', '124', 'Comptes actifs sur le SaaS', 'text-dark')}
        {renderKpi('Disponibilité Uptime', '99.9%', 'Plateforme opérationnelle', 'text-success')}
        {renderKpi('Recettes SaaS', '4.5M MGA', 'Mobile Money & Cartes ce mois', 'text-primary')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <SaasTenantsGrowthChart />
          </div>
        </div>
      </div>
    </div>
  )

  // 2. ADMIN ENTREPRISE DASHBOARD
  const renderAdminEntreprise = () => {
    const totalUsers = stats?.nb_utilisateurs ?? 48
    const activeUsers = Math.max(0, totalUsers - (stats?.utilisateurs_inactifs ?? 3))
    const inactiveUsers = stats?.utilisateurs_inactifs ?? 3
    const anomalies = stats?.alertes_recentes?.length ?? 0
    const disponibilite = stats?.uptime ?? 99.9

    return (
      <div>
        {renderAlert()}
        <div className="row g-3 mb-4">
          {renderKpi('Comptes Actifs', String(activeUsers), `Sur ${totalUsers} utilisateurs`, 'text-primary')}
          {renderKpi('Comptes Désactivés', String(inactiveUsers), 'Comptes fermés / en attente', 'text-danger')}
          {renderKpi('Anomalies 24h', String(anomalies), 'Échecs de connexion / alertes', 'text-warning')}
          {renderKpi('Disponibilité', `${disponibilite}%`, 'Système entreprise opérationnel', 'text-success')}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="chart-card">
              <UserActivityLogsChart />
            </div>
          </div>
          <div className="col-lg-4">
            <div className="chart-card">
              <h5 className="fw-bold mb-3"><i className="bi bi-sliders me-2 text-primary"></i>Conformité Paramétrage</h5>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                  <span className="small fw-semibold">Rôles & Permissions RBAC</span>
                  <span className="badge bg-success">Conforme</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                  <span className="small fw-semibold">Format Numérotation Devis</span>
                  <span className="badge bg-success">Actif</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                  <span className="small fw-semibold">Seuils Alertes Budgétaires</span>
                  <span className="badge bg-success">Configuré</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                  <span className="small fw-semibold">Politique Pointage Bureau</span>
                  <span className="badge bg-info">QR Fixe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card border-0 shadow-sm p-4 mb-4">
          <h5 className="fw-bold mb-3"><i className="bi bi-gear-fill me-2 text-primary"></i>Actions rapides administration</h5>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-primary fw-bold" onClick={() => navigate('/settings')}><i className="bi bi-person-gear me-2"></i>Gérer Comptes & Permissions</button>
            <button className="btn btn-outline-dark fw-bold" onClick={() => navigate('/historique-logins')}><i className="bi bi-shield-check me-2"></i>Audit Logs Connexions</button>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/settings')}><i className="bi bi-sliders me-2"></i>Paramètres Entreprise</button>
          </div>
        </div>
      </div>
    )
  }

  // 3. DIRECTION GENERALE / DAF DASHBOARD
  const renderDirecteur = () => {
    const caTotal = stats?.ca_total || 0
    const margeBrute = stats?.marge_brute ?? (caTotal - (stats?.depenses_mois || 0))
    const margeNette = stats?.marge_nette ?? margeBrute * 0.9
    const tauxMarge = caTotal > 0 ? ((margeNette / caTotal) * 100).toFixed(1) : '0.0'
    const alertesCritiques = stats?.alertes_critiques || 0
    const validationsCount = stats?.devis_pending_dg || 0

    return (
      <div>
        {renderAlert()}
        <div className="row g-3 mb-4">
          {renderKpi('Chiffre d\'Affaires Brut', `${caTotal.toLocaleString()} MGA`, 'Consolidé tous chantiers', 'text-primary')}
          {renderKpi('Marge Nette Consolidée', `${margeNette.toLocaleString()} MGA`, `Taux net: ${tauxMarge}%`, 'text-success')}
          {renderKpi('Devis / Budgets à Valider', String(validationsCount), 'Soumis à validation DG', 'text-warning')}
          {renderKpi('Alertes Critiques', String(alertesCritiques), 'Retards & dérives budgétaires', 'text-danger')}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-12">
            <div className="chart-card">
              <CaVsDepensesChart />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 4. COMPTABLE / RESPONSABLE FINANCIER DASHBOARD
  const renderComptable = () => {
    const caTotal = stats?.ca_total || 0
    const depensesMois = stats?.depenses_mois || 0
    const margeNette = stats?.marge_nette ?? (caTotal - depensesMois) * 0.9
    const depassements = stats?.depassements_budgetaires || 0
    const facturesRetard = stats?.factures_en_retard || 0

    return (
      <div>
        {renderAlert()}
        <div className="row g-3 mb-4">
          {renderKpi('Chiffre d\'Affaires', `${caTotal.toLocaleString()} MGA`, 'Consolidé entreprise', 'text-primary')}
          {renderKpi('Dépenses du Mois', `${depensesMois.toLocaleString()} MGA`, 'Matériaux, main d\'œuvre, engins', 'text-danger')}
          {renderKpi('Factures Clients en Retard', String(facturesRetard), 'À relancer rapidement', 'text-warning')}
          {renderKpi('Dépassements Budgétaires', String(depassements), 'Chantiers en surcoût', 'text-danger')}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-12">
            <div className="chart-card">
              <DepensesParPosteChart />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 5. CHEF DE PROJET / DIRECTEUR TECHNIQUE DASHBOARD
  const renderChefProjet = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Chantiers sous Supervision', '5', 'Dans votre périmètre', 'text-primary')}
        {renderKpi('Conflits d\'Affectation', '0', 'Ressources / engins en double', 'text-success')}
        {renderKpi('Avancement Moyen', '74%', 'Physique vs prévu', 'text-info')}
        {renderKpi('Chantiers en Retard', '1', 'Nécessitant un arbitrage', 'text-warning')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <MultiChantiersProgressChart />
          </div>
        </div>
      </div>
    </div>
  )

  // 6. CHEF DE CHANTIER DASHBOARD
  const renderChefChantier = () => {
    const avancementPhysique = stats?.taux_avancement_physique || 78
    const nbIncidents = stats?.incidents_non_resolus || 1

    return (
      <div>
        {renderAlert()}
        <div className="alert-bar mb-4 bg-primary bg-opacity-10 text-primary border-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <strong>Mon Chantier : Construction Immeuble Anosy</strong>
            <div className="small mb-0">Avancement physique: {avancementPhysique}% — Retard: +0 jour</div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-warning fw-bold text-dark" onClick={() => setShowScannerModal(true)}>
              <i className="bi bi-qr-code-scan me-2"></i>Scanner Badges Ouvriers
            </button>
            <button className="btn btn-light fw-bold text-primary" onClick={() => alert('Auto-déclaration GPS enregistrée pour le Chef de Chantier (Catégorie B).')}>
              <i className="bi bi-geo-alt-fill me-2"></i>Mon Auto-Pointage GPS
            </button>
          </div>
        </div>

        <div className="row g-3 mb-4">
          {renderKpi('Avancement Physique', `${avancementPhysique}%`, 'Phase actuelle: Voiles béton B2', 'text-primary')}
          {renderKpi('Présence Équipe', '92%', '19 ouvriers présents sur 20', 'text-success')}
          {renderKpi('Incidents Terrain', String(nbIncidents), 'Incident sécurité à traiter', 'text-warning')}
          {renderKpi('Consommation Ciment', '320 sacs', 'Sur 350 prévus (OK)', 'text-info')}
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-12">
            <div className="chart-card">
              <EquipePresenceDailyChart />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 7. RESPONSABLE RH DASHBOARD
  const renderRH = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Effectif Total', '48', 'Employés enregistrés', 'text-primary')}
        {renderKpi('Taux de Présence Global', '87.5%', 'Présence quotidienne moyenne', 'text-success')}
        {renderKpi('Heures Supp. à Valider', '3', 'En attente d\'approbation', 'text-warning')}
        {renderKpi('Habilitations Expirantes', '2', 'Renouvellement sécurité 30j', 'text-danger')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <RhEquipesDistributionChart />
          </div>
        </div>
      </div>
    </div>
  )

  // 8. RESPONSABLE MATERIEL DASHBOARD
  const renderMateriel = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Parc d\'Engins Total', '19', 'Machines & véhicules', 'text-primary')}
        {renderKpi('Engins Disponibles', '12', 'Prêts pour affectation', 'text-success')}
        {renderKpi('Engins Affectés', '5', 'En service sur chantiers', 'text-info')}
        {renderKpi('Maintenance due', '2', 'Vidanges & révisions 7j', 'text-warning')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <ParcUsageRateChart />
          </div>
        </div>
      </div>
    </div>
  )

  // 9. MAGASINIER / STOCKS DASHBOARD
  const renderMagasinier = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Références en Stock', '142', 'Articles référencés au dépôt', 'text-primary')}
        {renderKpi('Alertes Stock Minimum', stats?.stocks_alerte || 5, 'Réapprovisionnement requis', 'text-warning')}
        {renderKpi('Mouvements 24h', '18', 'Bons de sortie & réceptions', 'text-success')}
        {renderKpi('Ruptures de Stock', '0', 'Aucune rupture sur chantier', 'text-success')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <StockCategoryDistributionChart />
          </div>
        </div>
      </div>
    </div>
  )

  // 10. RESPONSABLE COMMERCIAL DASHBOARD
  const renderCommercial = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Portefeuille Clients', '24', 'Comptes clients BTP', 'text-primary')}
        {renderKpi('Devis en Cours', '8', 'À relancer / négocier', 'text-warning')}
        {renderKpi('Taux de Conversion', '62.5%', 'Devis convertis en contrat', 'text-success')}
        {renderKpi('Pipeline Commercial', '180M MGA', 'Valeur totale négociations', 'text-primary')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <SalesPipelineChart />
          </div>
        </div>
      </div>
    </div>
  )

  // 11. OUVRIER / EMPLOYE TERRAIN DASHBOARD
  const renderEmploye = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Mes Tâches', '2', 'Assignées aujourd\'hui', 'text-primary')}
        {renderKpi('Taux de Réalisation', '85%', 'Tâches terminées dans les délais', 'text-success')}
        {renderKpi('Mes Heures Supp.', '3h', 'Validées cette semaine', 'text-warning')}
        {renderKpi('Mon Taux Présence', '96%', 'Assiduité ce mois', 'text-success')}
      </div>

      <div className="card border-0 shadow-sm p-4 mb-4 bg-gradient text-white" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <h5 className="fw-bold mb-1"><i className="bi bi-qr-code-scan me-2 text-info"></i>Mon Badge Officiel de Pointage</h5>
            <p className="text-secondary small mb-0">Présentez ce QR Code au Chef de Chantier lors de votre arrivée / départ.</p>
          </div>
          <button className="btn btn-info font-semibold fw-bold rounded-pill px-4" onClick={() => setShowBadgeModal(true)}>
            <i className="bi bi-qr-code me-2"></i>Afficher Mon Badge QR
          </button>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm p-4">
            <h5 className="fw-bold mb-3"><i className="bi bi-list-check me-2 text-primary"></i>Mes Tâches Assignées</h5>
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
        <div className="col-lg-4">
          <div className="chart-card">
            <WorkerPersonalAttendanceChart />
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (roleCode) {
      case 'super_admin': return renderSuperAdmin()
      case 'admin_entreprise': return renderAdminEntreprise()
      case 'directeur': return renderDirecteur()
      case 'comptable': return renderComptable()
      case 'chef_chantier': return renderChefChantier()
      case 'chef_projet': return renderChefProjet()
      case 'rh': return renderRH()
      case 'materiel': return renderMateriel()
      case 'magasinier': return renderMagasinier()
      case 'commercial': return renderCommercial()
      case 'employe': return renderEmploye()
      default: return renderEmploye()
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold"><i className="bi bi-speedometer2 me-2 text-primary"></i>{dashboardTitle}</h2>
          <p className="text-secondary mb-0">Bienvenue, <strong>{user?.prenom} {user?.nom}</strong> — {meta.greeting}</p>
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
        renderContent()
      )}

      {/* Modal Scanner QR Code pour Chef de Chantier */}
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onPointageSuccess={() => alert('Pointage enregistré avec succès !')}
      />

      {/* Modal Badge QR Code pour l'Employé */}
      {showBadgeModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 bg-transparent shadow-none">
              <div className="d-flex justify-content-end mb-2">
                <button type="button" className="btn-close btn-close-white fs-4" onClick={() => setShowBadgeModal(false)}></button>
              </div>
              <WorkerBadgeCard
                employe={{
                  id: user?.id || 1,
                  nom: user?.nom || 'OUVRIER',
                  prenom: user?.prenom || 'Jean',
                  poste: 'Ouvrier Qualifié',
                  code_qr_badge: `TIA-EMP-1-${user?.id || 1}-OFFICIEL`,
                  type_contrat: 'CDI',
                  matricule: `EMP-${user?.id || 1}`,
                }}
                onPrint={() => window.print()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
