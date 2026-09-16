import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { downloadCsv } from '@/utils/csv'

export function SuperAdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/super-admin/logs')
      .then(res => setLogs(res.data.items || res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  const getNiveauBadge = (niveau: string) => {
    switch (niveau.toLowerCase()) {
      case 'info': return <span className="badge bg-light text-dark border">Info</span>
      case 'warning': return <span className="badge bg-warning bg-opacity-10 text-dark border">Warning</span>
      case 'error': return <span className="badge bg-danger bg-opacity-10 text-dark border">Erreur</span>
      default: return <span className="badge bg-light text-dark border">{niveau}</span>
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1 text-secondary"><i className="bi bi-activity me-2"></i>Logs & Supervision</h2>
          <p className="text-secondary mb-0">Journal des événements techniques, incidents et activités système.</p>
        </div>
        <button
          className="btn btn-outline-secondary fw-bold"
          onClick={() => downloadCsv('logs-systeme.csv', logs, ['niveau', 'message', 'date', 'utilisateur'])}
          disabled={!logs.length}
        ><i className="bi bi-download me-2"></i>Exporter logs</button>
      </div>

      {loading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead className="table-light">
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
