import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { Utilisateur } from '@/types'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { downloadCsv } from '@/utils/csv'

export function SuperAdminUtilisateursPage() {
  const [users, setUsers] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get<Utilisateur[]>('/super-admin/utilisateurs')
      .then(res => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    `${u.nom} ${u.prenom || ''}`.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1 text-secondary"><i className="bi bi-people-fill me-2"></i>Utilisateurs Globaux Plateforme</h2>
          <p className="text-secondary mb-0">Tous les comptes utilisateurs créés sur l'ensemble des entreprises abonnées.</p>
        </div>
        <button
          className="btn btn-outline-secondary fw-bold"
          onClick={() => downloadCsv(
            'utilisateurs-plateforme.csv',
            users.map((u) => ({ nom: `${u.nom} ${u.prenom}`, email: u.email, role: u.role?.nom, statut: u.statut })),
            ['nom', 'email', 'role', 'statut'],
          )}
          disabled={!users.length}
        >
          <i className="bi bi-download me-2"></i>Exporter CSV
        </button>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
          <div className="input-group" style={{ maxWidth: '400px' }}>
            <span className="input-group-text bg-light border-end-0"><i className="bi bi-search"></i></span>
            <input
              type="text"
              className="form-control border-start-0 bg-light"
              placeholder="Rechercher un utilisateur..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Nom & Prénom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-0 border-0">
                    <TableSkeleton rows={6} columns={4} />
                  </td>
                </tr>
              ) : (
                <>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td className="fw-semibold">{u.nom} {u.prenom}</td>
                  <td>{u.email}</td>
                  <td><span className="badge bg-secondary">{u.role?.nom}</span></td>
                  <td><span className={`badge ${u.statut === 'actif' ? 'bg-success bg-opacity-10 text-success border' : 'bg-secondary bg-opacity-10 text-dark border'}`}>{u.statut}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
