import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { Utilisateur } from '@/types'

export function SuperAdminUtilisateursPage() {
  const [users, setUsers] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="container-fluid py-4">
      <h2 className="mb-4"><i className="bi bi-people-fill me-2 text-danger"></i>Utilisateurs Globaux Plateforme</h2>
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status"></div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nom & Prénom</th>
                  <th>Email</th>
                  <th>Rôle Global</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="fw-bold">{u.nom} {u.prenom}</td>
                    <td>{u.email}</td>
                    <td><span className="badge bg-danger">{u.role?.nom}</span></td>
                    <td><span className="badge bg-success">{u.statut}</span></td>
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
