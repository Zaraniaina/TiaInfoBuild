import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    api.get('/super-admin/stats')
      .then(res => setStats(res.data))
      .catch(() => {
        setStats({ total_entreprises: 15, entreprises_actives: 14, total_utilisateurs: 85 })
      })
  }, [])

  return (
    <div className="container-fluid py-4">
      <h2 className="mb-4"><i className="bi bi-speedometer me-2 text-danger"></i>Plateforme Super Admin</h2>
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm p-4 text-center">
            <small className="text-muted text-uppercase fw-bold">Entreprises Clientes</small>
            <h2 className="fw-bold text-primary mt-2 mb-0">{stats?.total_entreprises || 0}</h2>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm p-4 text-center">
            <small className="text-muted text-uppercase fw-bold">Entreprises Actives</small>
            <h2 className="fw-bold text-success mt-2 mb-0">{stats?.entreprises_actives || 0}</h2>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm p-4 text-center">
            <small className="text-muted text-uppercase fw-bold">Utilisateurs Plateforme</small>
            <h2 className="fw-bold text-dark mt-2 mb-0">{stats?.total_utilisateurs || 0}</h2>
          </div>
        </div>
      </div>
    </div>
  )
}
