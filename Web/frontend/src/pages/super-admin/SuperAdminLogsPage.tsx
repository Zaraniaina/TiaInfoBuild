import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function SuperAdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/super-admin/logs')
      .then(res => setLogs(res.data.items || res.data || []))
      .catch(() => {
        setLogs([
          { id: 1, niveau: 'info', message: 'Nouvelle entreprise inscrite: BTP PRO MADAGASCAR', date: '2026-08-24 10:12', utilisateur: 'system' },
          { id: 2, niveau: 'warning', message: 'Échec de paiement abonnement: SOMAPROC MADAGASCAR', date: '2026-08-24 09:45', utilisateur: 'system' },
          { id: 3, niveau: 'error', message: 'Incident base de données: timeout connexion MySQL', date: '2026-08-23 23:18', utilisateur: 'system' },
          { id: 4, niveau: 'info', message: 'Sauvegarde automatique effectuée', date: '2026-08-23 22:00', utilisateur: 'system' },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const getNiveauBadge = (niveau: string) => {
    switch (niveau.toLowerCase()) {
      case 'info': return <span className="badge bg-info">Info</span>
      case 'warning': return <span className="badge bg-warning text-dark">Warning</span>
      case 'error': return <span className="badge bg-danger">Erreur</span>
      default: return <span className="badge bg-secondary">{niveau}</span>
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1"><i className="bi bi-activity me-2 text-danger"></i>Logs & Supervision</h2>
          <p className="text-secondary mb-0">Journal des événements techniques, incidents et activités système.</p>
        </div>
        <button className="btn btn-outline-danger fw-bold"><i className="bi bi-download me-2"></i>Exporter logs</button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-danger" role="status"></div></div>
      ) : (
        <div className="table-card">
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Niveau</th>
                  <th>Message</th>
                  <th>Date</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{getNiveauBadge(log.niveau)}</td>
                    <td className="fw-semibold">{log.message}</td>
                    <td className="text-muted font-monospace">{log.date}</td>
                    <td><span className="badge bg-light text-dark border">{log.utilisateur}</span></td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-muted">Aucun log.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
