import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { Utilisateur } from '@/types'

export function SuperAdminUtilisateursPage() {
  const [users, setUsers] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get<Utilisateur[]>('/super-admin/utilisateurs')
      .then(res => setUsers(res.data))
      .catch(() => {
        setUsers([
          { id: 1, role_id: 1, role: { id: 1, nom: 'Super Admin', code: 'super_admin', permissions: {} }, nom: 'SUPER', prenom: 'Admin', email: 'superadmin@tiainfo.mg', statut: 'actif', date_creation: '', must_change_password: false, created_at: '', updated_at: '' }
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    `${u.nom} ${u.prenom}`.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1"><i className="bi bi-people-fill me-2 text-danger"></i>Utilisateurs Globaux Plateforme</h2>
          <p className="text-secondary mb-0">Tous les comptes utilisateurs créés sur l'ensemble des entreprises abonnées.</p>
        </div>
        <button className="btn btn-outline-danger fw-bold">
          <i className="bi bi-download me-2"></i>Exporter CSV
        </button>
      </div>

      <div className="table-card">
        <div className="table-header">
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
        <div className="table-responsive">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>Nom & Prénom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td className="fw-semibold">{u.nom} {u.prenom}</td>
                  <td>{u.email}</td>
                  <td><span className="badge bg-danger">{u.role?.nom}</span></td>
                  <td><span className={`badge ${u.statut === 'actif' ? 'bg-success' : 'bg-secondary'}`}>{u.statut}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
