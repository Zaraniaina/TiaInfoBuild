import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { api } from '@/services/api'

export function Topbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { toggleSidebar, sidebarOpen } = useUIStore()
  const [notifications, setNotifications] = useState<Array<{ id: number; titre: string }>>([])

  useEffect(() => {
    api.get('/alertes?non_lues=1&size=5').then(res => {
      setNotifications(res.data.items || [])
    }).catch(() => {})
  }, [])

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout', { refresh_token: refresh })
    } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn btn-link sidebar-toggle" onClick={toggleSidebar}>
          <i className={`bi ${sidebarOpen ? 'bi-chevron-double-left' : 'bi-list'}`}></i>
        </button>
        <h4 className="topbar-title">TIA INFO BUILD</h4>
      </div>

      <div className="topbar-right">
        <div className="topbar-notifications dropdown">
          <button className="btn btn-link notification-btn" data-bs-toggle="dropdown">
            <i className="bi bi-bell"></i>
            {notifications.length > 0 && (
              <span className="notification-badge">{notifications.length}</span>
            )}
          </button>
          <div className="dropdown-menu dropdown-menu-end">
            <div className="dropdown-header">Notifications</div>
            {notifications.length === 0 ? (
              <div className="dropdown-item text-muted">Aucune notification</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="dropdown-item">{n.titre}</div>
              ))
            )}
          </div>
        </div>

        <div className="topbar-user dropdown">
          <button className="btn btn-link user-btn" data-bs-toggle="dropdown">
            <div className="user-avatar">
              <i className="bi bi-person"></i>
            </div>
            <span className="user-name d-none d-md-inline">
              {user?.prenom} {user?.nom}
            </span>
            <i className="bi bi-chevron-down ms-1"></i>
          </button>
          <div className="dropdown-menu dropdown-menu-end">
            <div className="dropdown-item">
              <small className="text-muted">{user?.email}</small>
            </div>
            <div className="dropdown-divider"></div>
            <button className="dropdown-item" onClick={() => navigate('/settings')}>
              <i className="bi bi-gear me-2"></i>Paramètres
            </button>
            <button className="dropdown-item text-danger" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-2"></i>Déconnexion
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
