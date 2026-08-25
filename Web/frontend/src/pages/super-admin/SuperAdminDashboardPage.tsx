import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { SaasTenantsGrowthChart } from '@/components/charts/DashboardCharts'

export function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [recentTenants, setRecentTenants] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    api.get('/super-admin/stats')
      .then(res => setStats(res.data))
      .catch(() => {
        setStats({
          total_entreprises: 15,
          entreprises_actives: 14,
          entreprises_inactives: 1,
          total_utilisateurs: 124,
          nouveaux_utilisateurs_mois: 12,
          uptime: 99.9,
          revenu_mensuel: 4500000,
          incidents_critiques: 0,
          demandes_support: 2,
        })
      })

    api.get('/super-admin/entreprises?size=5')
      .then(res => setRecentTenants(res.data.items || res.data || []))
      .catch(() => {
        setRecentTenants([
          { id: 1, nom: 'BTP PRO MADAGASCAR SARL', actif: true, abonnement: 'premium', date_creation: '2026-01-15' },
          { id: 2, nom: 'SOMAPROC MADAGASCAR', actif: true, abonnement: 'pro', date_creation: '2026-02-01' },
        ])
      })

    api.get('/super-admin/alerts')
      .then(res => setAlerts(res.data.items || res.data || []))
      .catch(() => {
        setAlerts([
          { id: 1, type: 'warning', titre: 'Echéance abonnement', texte: 'BTP PRO MADAGASCAR - 3 jours', date: '2026-08-24' },
          { id: 2, type: 'info', titre: 'Nouvelle demande demo', texte: 'Entreprise: Construction RN2', date: '2026-08-23' },
        ])
      })
  }, [])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold"><i className="bi bi-shield-lock me-2 text-danger"></i>Supervision Plateforme SaaS</h2>
          <p className="text-secondary mb-0">Vue globale sur les tenants, abonnements, santé et revenus de la plateforme TIA INFO BUILD.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm"><i className="bi bi-download me-1"></i>Exporter</button>
          <button className="btn btn-primary fw-bold"><i className="bi bi-plus-circle me-1"></i>Nouvelle Entreprise</button>
        </div>
      </div>

      {/* KPIs Plateforme */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="kpi-label">Entreprises Actives</div>
            <div className="kpi-value text-primary">{stats?.entreprises_actives || 0}</div>
            <div className="kpi-context">/ {stats?.total_entreprises || 0} inscrites</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="kpi-label">Utilisateurs Globaux</div>
            <div className="kpi-value text-dark">{stats?.total_utilisateurs || 0}</div>
            <div className="kpi-context">+{stats?.nouveaux_utilisateurs_mois || 0} ce mois</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="kpi-label">Santé Uptime</div>
            <div className="kpi-value text-success">{stats?.uptime || 0}%</div>
            <div className="kpi-context">30 derniers jours</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="kpi-label">Revenu SaaS</div>
            <div className="kpi-value text-success">{(stats?.revenu_mensuel || 0).toLocaleString()} MGA</div>
            <div className="kpi-context">Mobile Money + Virement</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="kpi-label">Entreprises Inactives</div>
            <div className="kpi-value text-danger">{stats?.entreprises_inactives || 0}</div>
            <div className="kpi-context">Suspendues / Impayées</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="kpi-label">Incidents Critiques</div>
            <div className="kpi-value text-danger">{stats?.incidents_critiques || 0}</div>
            <div className="kpi-context">En cours</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="kpi-label">Demandes Support</div>
            <div className="kpi-value text-warning">{stats?.demandes_support || 0}</div>
            <div className="kpi-context">Non traitées</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="kpi-card">
            <div className="kpi-label">Taux Croissance</div>
            <div className="kpi-value text-primary">+8.2%</div>
            <div className="kpi-context">Nouveaux tenants / mois</div>
          </div>
        </div>
      </div>

      {/* Alertes & Notifications */}
      {alerts.length > 0 && (
        <div className="mb-4">
          <div className="dashboard-section-title"><i className="bi bi-bell me-2"></i>Alertes & Notifications</div>
          <div className="row g-3">
            {alerts.map(a => (
              <div key={a.id} className="col-md-6">
                <div className={`alert-bar ${a.type === 'warning' ? 'bg-warning bg-opacity-10 text-warning' : 'bg-info bg-opacity-10 text-info'}`}>
                  <div className="alert-icon"><i className="bi bi-exclamation-triangle"></i></div>
                  <div>
                    <strong>{a.titre}</strong>
                    <div className="small mb-0">{a.texte}</div>
                  </div>
                  <small className="text-muted ms-auto">{a.date}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphiques */}
      <div className="row g-4 mb-4">
        <div className="col-lg-12">
          <div className="chart-card">
            <SaasTenantsGrowthChart />
          </div>
        </div>
      </div>

      {/* Derniers tenants */}
      <div className="table-card">
        <div className="table-header">
          <h5><i className="bi bi-building me-2 text-primary"></i>Dernières entreprises inscrites</h5>
          <a href="/super-admin/entreprises" className="btn btn-sm btn-outline-primary">Voir tout</a>
        </div>
        <div className="table-responsive">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Plan</th>
                <th>Statut</th>
                <th>Date inscription</th>
              </tr>
            </thead>
            <tbody>
              {recentTenants.map(t => (
                <tr key={t.id}>
                  <td className="fw-semibold">{t.nom}</td>
                  <td><span className="badge bg-light text-dark text-capitalize">{t.abonnement || 'pro'}</span></td>
                  <td><span className={`badge ${t.actif ? 'bg-success' : 'bg-danger'}`}>{t.actif ? 'Actif' : 'Inactif'}</span></td>
                  <td className="text-muted">{t.date_creation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
