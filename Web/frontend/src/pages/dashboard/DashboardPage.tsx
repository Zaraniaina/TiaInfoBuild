import { useAuthStore } from '@/stores/auth.store'
import { RoleBadge } from '@/components/layout/RoleBadge'
import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { CaEvolutionChart, TopChantiersChart, DepensesParCategorieChart } from '@/components/charts/DashboardCharts'
import type { DashboardStats } from '@/types'
import { ROLE_NAMES, ROLE_DASHBOARD_TITLE } from '@/config/roles.config'

const ROLE_META: Record<string, { greeting: string; alert?: { type: string; icon: string; title: string; text: string } }> = {
  super_admin: {
    greeting: 'Supervision globale de la plateforme SaaS',
    alert: { type: 'danger', icon: 'bi-shield-lock-fill', title: 'Mode Super Admin', text: 'Accès global à tous les tenants et à la santé de la plateforme.' },
  },
  admin_entreprise: {
    greeting: 'Administration technique et sécurité de votre entreprise',
    alert: { type: 'primary', icon: 'bi-gear-fill', title: 'Espace Admin', text: 'Gestion des comptes, paramètres et supervision technique.' },
  },
  directeur: {
    greeting: 'Pilotage stratégique et validation des décisions métier',
  },
  comptable: {
    greeting: 'Suivi comptable, budgétaire et facturation',
  },
  chef_chantier: {
    greeting: 'Suivi quotidien de votre chantier et de votre équipe',
    alert: { type: 'info', icon: 'bi-building', title: 'Chantier en cours', text: 'Générez le QR code de pointage et déclarez les incidents.' },
  },
  chef_projet: {
    greeting: 'Supervision multi-projets et arbitrage des ressources',
  },
  rh: {
    greeting: 'Gestion du personnel, pointages et habilitations',
  },
  materiel: {
    greeting: 'Parc matériel, disponibilités et maintenance',
  },
  magasinier: {
    greeting: 'Stocks, entrées/sorties et réapprovisionnement',
  },
  commercial: {
    greeting: 'Pipeline commercial, devis et suivi client',
  },
  employe: {
    greeting: 'Vos tâches, votre pointage et votre équipe',
    alert: { type: 'success', icon: 'bi-qr-code-scan', title: 'Pointage', text: 'Scannez le QR code du Chef de Chantier pour pointer.' },
  },
  client: {
    greeting: 'Suivi de vos projets, devis et factures',
  },
}

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

  const meta = ROLE_META[roleCode] || ROLE_META['employe']
  const roleName = ROLE_NAMES[roleCode] || roleCode
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

  const renderSuperAdmin = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Tenants Actifs', '15', 'Entreprises abonnées', 'text-danger')}
        {renderKpi('Utilisateurs Globaux', '124', 'Tous tenants confondus', 'text-dark')}
        {renderKpi('Santé Uptime', '99.9%', 'Disponibilité globale', 'text-success')}
        {renderKpi('Recettes SaaS', '4.5M MGA', 'Mobile Money ce mois', 'text-primary')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="chart-card">
            <h5><i className="bi bi-graph-up me-2 text-primary"></i>Activité globale</h5>
            <div style={{ height: '320px' }}><CaEvolutionChart /></div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="chart-card">
            <h5><i className="bi bi-pie-chart me-2 text-warning"></i>Répartition par module</h5>
            <div style={{ height: '320px' }}><DepensesParCategorieChart /></div>
          </div>
        </div>
      </div>
    </div>
  )

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
          {renderKpi('Comptes Désactivés', String(inactiveUsers), 'À réactiver ou supprimer', 'text-danger')}
          {renderKpi('Anomalies 24h', String(anomalies), 'Accès suspects / échecs', 'text-warning')}
          {renderKpi('Disponibilité', `${disponibilite}%`, 'Plateforme opérationnelle', 'text-success')}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="chart-card">
              <h5><i className="bi bi-people me-2 text-primary"></i>Activité des comptes</h5>
              <div style={{ height: '320px' }}><CaEvolutionChart /></div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="chart-card">
              <h5><i className="bi bi-sliders me-2 text-primary"></i>Cohérence configuration</h5>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge bg-success">Seuils OK</span>
                <span className="badge bg-success">Catégories OK</span>
                <span className="badge bg-success">TVA OK</span>
                <span className="badge bg-warning text-dark">1 alerte stock</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card border-0 shadow-sm p-4 mb-4">
          <h5 className="fw-bold mb-3"><i className="bi bi-gear-fill me-2 text-primary"></i>Actions rapides administration</h5>
          <div className="d-flex gap-2 flex-wrap">
            <a href="/settings" className="btn btn-primary fw-bold"><i className="bi bi-person-gear me-2"></i>Gérer les comptes & rôles</a>
            <a href="/historique-logins" className="btn btn-outline-dark fw-bold"><i className="bi bi-shield-check me-2"></i>Audit & logs de connexion</a>
            <a href="/settings" className="btn btn-outline-secondary"><i className="bi bi-sliders me-2"></i>Paramètres entreprise</a>
          </div>
        </div>
      </div>
    )
  }

  const renderDirecteur = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Chiffre d\'Affaires Brut', `${(stats?.ca_total || 0).toLocaleString()} MGA`, 'Consolidé tous chantiers', 'text-primary')}
        {renderKpi('Résultat Net', `+ ${(stats?.margin_net || 0).toLocaleString()} MGA`, 'Prévu vs réel', 'text-success')}
        {renderKpi('Devis à Valider', stats?.devis_pending_dg || 2, 'En attente de validation DG', 'text-warning')}
        {renderKpi('Alertes Critiques', '1', 'Budget / Délai / Stock', 'text-danger')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="chart-card">
            <h5><i className="bi bi-graph-up-arrow me-2 text-success"></i>Performance Financière Consolidée</h5>
            <div style={{ height: '320px' }}><CaEvolutionChart /></div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="chart-card">
            <h5><i className="bi bi-check-circle-fill me-2 text-warning"></i>Validations requises</h5>
            <div className="list-group list-group-flush">
              <div className="list-group-item px-0 py-2">
                <div className="fw-bold">Devis #DEV-2026-004</div>
                <small className="text-muted">Client SODIAT — 85 000 000 MGA</small>
                <div className="mt-1">
                  <button className="btn btn-sm btn-success py-0 me-1" onClick={() => alert('Devis Approuvé par DG !')}>Approuver</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderComptable = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Encaissements du mois', '45 000 000 MGA', 'Sur 30 jours', 'text-success')}
        {renderKpi('Factures en retard', stats?.factures_retard || 3, 'À relancer', 'text-danger')}
        {renderKpi('Dépenses à valider', '4', 'En attente de validation', 'text-warning')}
        {renderKpi('Marge Moyenne', '19.4%', 'Réelle vs prévue', 'text-primary')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="chart-card">
            <h5><i className="bi bi-graph-up me-2 text-success"></i>Évolution des encaissements</h5>
            <div style={{ height: '320px' }}><CaEvolutionChart /></div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="chart-card">
            <h5><i className="bi bi-pie-chart me-2 text-warning"></i>Dépenses par poste</h5>
            <div style={{ height: '320px' }}><DepensesParCategorieChart /></div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderChefChantier = () => (
    <div>
      {renderAlert()}
      <div className="alert-bar mb-4 bg-primary bg-opacity-10 text-primary border-0">
        <div className="alert-icon"><i className="bi bi-building"></i></div>
        <div>
          <strong>Chantier : Construction Immeuble Anosy</strong>
          <div className="small mb-0">Avancement physique: 65% — Budget consommé: 62%</div>
        </div>
        <div className="ms-auto d-flex gap-2">
          <button className="btn btn-warning fw-bold text-dark" onClick={() => alert('QR Code généré pour la journée !')}>
            <i className="bi bi-qr-code-scan me-2"></i>QR Pointage
          </button>
          <button className="btn btn-light fw-bold text-primary" onClick={() => alert('Auto-déclaration GPS enregistrée.')}>
            <i className="bi bi-geo-alt-fill me-2"></i>Pointer
          </button>
        </div>
      </div>
      <div className="row g-3 mb-4">
        {renderKpi("Équipe Présente", "14 / 15", "Aujourd'hui", 'text-success')}
        {renderKpi('Incidents du jour', '0', 'Aucun incident déclaré', 'text-danger')}
        {renderKpi('Retard Planning', '0 jour', 'Dans les délais', 'text-success')}
        {renderKpi('Demandes Matériel', '1', 'En attente', 'text-warning')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="chart-card">
            <h5><i className="bi bi-bar-chart me-2 text-primary"></i>Avancement vs Budget</h5>
            <div style={{ height: '320px' }}><TopChantiersChart /></div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="chart-card">
            <h5><i className="bi bi-people me-2 text-primary"></i>Présence équipe</h5>
            <div style={{ height: '320px' }}><DepensesParCategorieChart /></div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderChefProjet = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Chantiers Actifs', '5', 'Dans votre périmètre', 'text-primary')}
        {renderKpi('Conflits Affectation', '0', 'À résoudre', 'text-warning')}
        {renderKpi('Avancement Moyen', '74%', 'Physique vs financier', 'text-success')}
        {renderKpi('Retards Critiques', '1', 'À arbitrer', 'text-danger')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <h5><i className="bi bi-building-gear me-2 text-primary"></i>Supervision Multi-Projets</h5>
            <div style={{ height: '320px' }}><TopChantiersChart /></div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderRH = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Effectif Total', '48', 'Employés actifs', 'text-primary')}
        {renderKpi('Taux Présence', '87.5%', 'Moyenne journalière', 'text-success')}
        {renderKpi('Heures Sup. à Valider', '3', 'Cette semaine', 'text-warning')}
        {renderKpi('Habilitations à Renouveler', '2', 'Dans les 30 jours', 'text-danger')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="chart-card">
            <h5><i className="bi bi-calendar-check me-2 text-primary"></i>Présence par chantier</h5>
            <div style={{ height: '320px' }}><CaEvolutionChart /></div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="chart-card">
            <h5><i className="bi bi-pie-chart me-2 text-warning"></i>Répartition équipes</h5>
            <div style={{ height: '320px' }}><DepensesParCategorieChart /></div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderMateriel = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Parc Total', '19', 'Engins et outils', 'text-primary')}
        {renderKpi('Disponibles', '12', 'Prêts à affecter', 'text-success')}
        {renderKpi('Affectés', '5', 'Sur chantiers', 'text-primary')}
        {renderKpi('En Maintenance', '2', 'Échéances à venir', 'text-warning')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <h5><i className="bi bi-tools me-2 text-primary"></i>Taux d'utilisation du parc</h5>
            <div style={{ height: '320px' }}><TopChantiersChart /></div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderMagasinier = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Références Stock', '142', 'Articles référencés', 'text-primary')}
        {renderKpi('Alertes Stock Bas', stats?.stocks_alerte || 5, 'À réapprovisionner', 'text-warning')}
        {renderKpi('Mouvements 24h', '18', 'Entrées + sorties', 'text-success')}
        {renderKpi('Ruptures ce mois', '0', 'Aucune rupture', 'text-success')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="chart-card">
            <h5><i className="bi bi-box-seam me-2 text-primary"></i>Consommation par chantier</h5>
            <div style={{ height: '320px' }}><CaEvolutionChart /></div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="chart-card">
            <h5><i className="bi bi-pie-chart me-2 text-warning"></i>Catégories de stock</h5>
            <div style={{ height: '320px' }}><DepensesParCategorieChart /></div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderCommercial = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Portefeuille Clients', '24', 'Clients actifs', 'text-primary')}
        {renderKpi('Devis en Cours', '8', 'À convertir', 'text-warning')}
        {renderKpi('Taux Conversion', '62.5%', 'Devis → Contrat', 'text-success')}
        {renderKpi('Pipeline CA', '180M MGA', 'En négociation', 'text-primary')}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <h5><i className="bi bi-graph-up-arrow me-2 text-success"></i>Performance Commerciale</h5>
            <div style={{ height: '320px' }}><TopChantiersChart /></div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderEmploye = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Mes Tâches', '2', 'Affectées aujourd\'hui', 'text-primary')}
        {renderKpi('Taux Réalisation', '75%', 'Ce mois', 'text-success')}
        {renderKpi('Heures Sup.', '3h', 'Cette semaine', 'text-warning')}
        {renderKpi('Présence', '96%', 'Ce mois', 'text-success')}
      </div>
      <div className="card border-0 shadow-sm p-4 mb-4">
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
  )

  const renderClient = () => (
    <div>
      {renderAlert()}
      <div className="row g-3 mb-4">
        {renderKpi('Mes Projets', '0', 'En cours', 'text-primary')}
        {renderKpi('Devis en Cours', '0', 'À signer', 'text-warning')}
        {renderKpi('Factures', '0', 'En attente de paiement', 'text-success')}
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
      case 'client': return renderClient()
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
    </div>
  )
}
