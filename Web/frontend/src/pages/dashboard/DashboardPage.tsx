import { useAuthStore } from '@/stores/auth.store'
import { RoleBadge } from '@/components/layout/RoleBadge'
import { useEffect, useState } from 'react'
import { api } from '@/services/api'

interface Stats {
  ca_total: number
  nb_chantiers_actifs: number
  nb_employes: number
  nb_clients: number
  nb_devis: number
  nb_materiels: number
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.get('/dashboard/stats').then(res => setStats(res.data)).catch(() => {})
  }, [])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Dashboard</h2>
          <p className="text-muted mb-0">Bienvenue, {user?.prenom} {user?.nom}</p>
        </div>
        <RoleBadge roleCode={user?.role_code || ''} />
      </div>

      {stats && (
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="kpi-card">
              <div className="kpi-icon"><i className="bi bi-currency-dollar"></i></div>
              <div className="kpi-value">{stats.ca_total?.toLocaleString('fr-FR')} MGA</div>
              <div className="kpi-label">Chiffre d'affaires</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card">
              <div className="kpi-icon"><i className="bi bi-building"></i></div>
              <div className="kpi-value">{stats.nb_chantiers_actifs}</div>
              <div className="kpi-label">Chantiers actifs</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card">
              <div className="kpi-icon"><i className="bi bi-people"></i></div>
              <div className="kpi-value">{stats.nb_employes}</div>
              <div className="kpi-label">Employés</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="kpi-card">
              <div className="kpi-icon"><i className="bi bi-person-badge"></i></div>
              <div className="kpi-value">{stats.nb_clients}</div>
              <div className="kpi-label">Clients</div>
            </div>
          </div>
        </div>
      )}

      <div className="row">
        <div className="col-md-8">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Actions rapides</h5>
            </div>
            <div className="card-body">
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-tia-primary">Nouveau devis</button>
                <button className="btn btn-outline-primary">Nouvelle facture</button>
                <button className="btn btn-outline-primary">Nouveau chantier</button>
                <button className="btn btn-outline-primary">Nouveau client</button>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Statut</h5>
            </div>
            <div className="card-body">
              <p className="text-muted">Module en cours de développement.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
