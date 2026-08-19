import { useAuthStore } from '@/stores/auth.store'
import { RoleBadge } from '@/components/layout/RoleBadge'
import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { CaEvolutionChart, TopChantiersChart, DepensesParCategorieChart } from '@/components/charts/DashboardCharts'

interface Stats {
  ca_total?: number
  nb_chantiers_actifs?: number
  nb_employes?: number
  nb_clients?: number
  nb_devis?: number
  nb_materiels?: number
  factures_retard?: number
  stocks_alerte?: number
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => {
        // Mock default stats if backend is not yet populated
        setStats({
          ca_total: 145000000,
          nb_chantiers_actifs: 12,
          nb_employes: 48,
          nb_clients: 24,
          nb_devis: 8,
          nb_materiels: 19,
          factures_retard: 3,
          stocks_alerte: 5
        })
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1"><i className="bi bi-speedometer2 me-2"></i>Tableau de bord</h2>
          <p className="text-secondary mb-0">Bienvenue, {user?.prenom} {user?.nom} — Vue d'ensemble de votre activité</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <RoleBadge roleCode={user?.role_code || ''} />
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-clockwise me-1"></i> Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards Header */}
          <div className="row g-3 mb-4">
            <div className="col-xl-3 col-md-6">
              <div className="card kpi-card h-100 border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <p className="text-muted mb-1 small fw-semibold text-uppercase">Chiffre d'Affaires</p>
                      <h3 className="mb-0 text-primary fw-bold">
                        {(stats?.ca_total || 0).toLocaleString('fr-FR')} MGA
                      </h3>
                    </div>
                    <div className="kpi-icon bg-primary bg-opacity-10 text-primary rounded-circle p-3">
                      <i className="bi bi-currency-dollar fs-4"></i>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="badge bg-success bg-opacity-10 text-success">
                      <i className="bi bi-graph-up-arrow me-1"></i> +14% ce mois
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="card kpi-card h-100 border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <p className="text-muted mb-1 small fw-semibold text-uppercase">Chantiers Actifs</p>
                      <h3 className="mb-0 text-dark fw-bold">{stats?.nb_chantiers_actifs || 0}</h3>
                    </div>
                    <div className="kpi-icon bg-info bg-opacity-10 text-info rounded-circle p-3">
                      <i className="bi bi-building fs-4"></i>
                    </div>
                  </div>
                  <div className="mt-3">
                    <small className="text-muted">Progression globale: <span className="fw-semibold">68%</span></small>
                    <div className="progress mt-1" style={{ height: '4px' }}>
                      <div className="progress-bar bg-info" style={{ width: '68%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="card kpi-card h-100 border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <p className="text-muted mb-1 small fw-semibold text-uppercase">Effectif RH</p>
                      <h3 className="mb-0 text-success fw-bold">{stats?.nb_employes || 0}</h3>
                    </div>
                    <div className="kpi-icon bg-success bg-opacity-10 text-success rounded-circle p-3">
                      <i className="bi bi-people fs-4"></i>
                    </div>
                  </div>
                  <div className="mt-3">
                    <small className="text-muted">Présents aujourd'hui: <span className="fw-semibold text-success">42 / 48</span></small>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="card kpi-card h-100 border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <p className="text-muted mb-1 small fw-semibold text-uppercase">Alertes Stocks & Factures</p>
                      <h3 className="mb-0 text-warning fw-bold">
                        {(stats?.stocks_alerte || 0) + (stats?.factures_retard || 0)}
                      </h3>
                    </div>
                    <div className="kpi-icon bg-warning bg-opacity-10 text-warning rounded-circle p-3">
                      <i className="bi bi-exclamation-triangle fs-4"></i>
                    </div>
                  </div>
                  <div className="mt-3">
                    <small className="text-muted">
                      <span className="text-danger fw-semibold">{stats?.factures_retard} factures</span> en retard
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="row g-4 mb-4">
            <div className="col-lg-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 py-3">
                  <h5 className="card-title mb-0 fw-bold"><i className="bi bi-graph-up me-2 text-primary"></i>Évolution du Chiffre d'Affaires</h5>
                </div>
                <div className="card-body">
                  <CaEvolutionChart />
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 py-3">
                  <h5 className="card-title mb-0 fw-bold"><i className="bi bi-pie-chart me-2 text-warning"></i>Dépenses par Catégorie</h5>
                </div>
                <div className="card-body d-flex align-items-center justify-content-center">
                  <DepensesParCategorieChart />
                </div>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 py-3">
                  <h5 className="card-title mb-0 fw-bold"><i className="bi bi-bar-chart me-2 text-success"></i>Top Chantiers par Budget</h5>
                </div>
                <div className="card-body">
                  <TopChantiersChart />
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0 fw-bold"><i className="bi bi-lightning-charge me-2 text-primary"></i>Actions Rapides</h5>
                </div>
                <div className="card-body">
                  <div className="d-grid gap-2">
                    <a href="/commercial" className="btn btn-outline-primary text-start p-3">
                      <i className="bi bi-plus-circle-fill me-2 fs-5"></i>Créer un nouveau devis
                    </a>
                    <a href="/chantiers" className="btn btn-outline-secondary text-start p-3">
                      <i className="bi bi-building-add me-2 fs-5"></i>Nouveau chantier
                    </a>
                    <a href="/rh" className="btn btn-outline-success text-start p-3">
                      <i className="bi bi-person-plus-fill me-2 fs-5"></i>Ajouter un employé
                    </a>
                    <a href="/stocks" className="btn btn-outline-warning text-start p-3">
                      <i className="bi bi-box-arrow-in-down me-2 fs-5"></i>Entrée de stock
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
