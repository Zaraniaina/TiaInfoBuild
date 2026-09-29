import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface LogEntry {
  id: number
  utilisateur_id: number
  nom?: string | null
  prenom?: string | null
  email?: string | null
  role?: string | null
  poste?: string | null
  ip_address?: string
  user_agent?: string
  reussi: boolean
  date_connexion: string
}

const initiales = (l: LogEntry): string => {
  const n = (l.nom || '?').charAt(0)
  const p = (l.prenom || '').charAt(0)
  return (n + p).toUpperCase()
}

const identite = (l: LogEntry): string => {
  const nom = [l.prenom, l.nom].filter(Boolean).join(' ')
  return nom || `Utilisateur #${l.utilisateur_id}`
}

export function HistoriqueLoginsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/parametres/audit-logs')
      .then(res => setLogs((res.data as any).items || (res.data as any) || []))
      // Pas de données factices : on n'affiche que les connexions réellement retournées par le backend.
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1"><i className="bi bi-shield-check me-2 text-dark"></i>Historique des Connexions</h2>
          <p className="text-secondary mb-0">Journal d'audit de sécurité des accès utilisateurs</p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Utilisateur</th>
                  <th>Adresse IP</th>
                  <th>Navigateur / OS</th>
                  <th>Statut</th>
                  <th>Date & Heure</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="rounded-circle bg-light border d-inline-flex align-items-center justify-content-center fw-bold text-secondary" style={{ width: 34, height: 34, fontSize: '.75rem', flexShrink: 0 }} aria-hidden="true">
                          {initiales(l)}
                        </span>
                        <div className="lh-sm">
                          <span className="fw-semibold d-block">{identite(l)}</span>
                          <small className="text-muted">
                            {[l.poste || l.role, l.email].filter(Boolean).join(' · ') || `ID ${l.utilisateur_id}`}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="font-monospace">{l.ip_address || '127.0.0.1'}</td>
                    <td className="small text-muted">{l.user_agent || '-'}</td>
                    <td>
                      <span className={`badge ${l.reussi ? 'bg-success bg-opacity-10 text-success border' : 'bg-danger bg-opacity-10 text-danger border'}`}>
                        {l.reussi ? 'Succès' : 'Échec'}
                      </span>
                    </td>
                    <td>{l.date_connexion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
