import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { api } from '@/services/api'

export function Topbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { toggleSidebar, sidebarOpen, theme, setTheme } = useUIStore()
  const [notifications, setNotifications] = useState<Array<{ id: number; titre: string }>>([])
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    api.get('/alertes?non_lues=1&size=5').then(res => {
      setNotifications(res.data.items || [])
    }).catch(() => {})
  }, [])

  const confirmLogout = async () => {
    setIsLoggingOut(true)
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout', { refresh_token: refresh })
    } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light'
    setTheme(next)
  }

  const themeIcon = theme === 'light' ? 'bi-sun' : theme === 'dark' ? 'bi-moon' : 'bi-laptop'
  const themeLabel = theme === 'light' ? 'Thème clair' : theme === 'dark' ? 'Thème sombre' : 'Thème auto'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="btn btn-link sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Masquer le menu' : 'Afficher le menu'}
          title={sidebarOpen ? 'Masquer le menu' : 'Afficher le menu'}
        >
          <i className={`bi ${sidebarOpen ? 'bi-chevron-double-left' : 'bi-list'}`}></i>
        </button>
        <h4 className="topbar-title">TIA INFO BUILD</h4>
      </div>

      <div className="topbar-right">
        <button
          className="btn btn-link theme-toggle"
          onClick={cycleTheme}
          aria-label={themeLabel}
          title={themeLabel}
        >
          <i className={`bi ${themeIcon}`}></i>
        </button>

        <div className="topbar-notifications dropdown">
          <button className="btn btn-link notification-btn" data-bs-toggle="dropdown" aria-label="Notifications">
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
          <button className="btn btn-link user-btn" data-bs-toggle="dropdown" aria-label="Menu utilisateur">
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
            <button className="dropdown-item text-danger" onClick={() => setShowLogoutModal(true)}>
              <i className="bi bi-box-arrow-right me-2"></i>Déconnexion
            </button>
          </div>
        </div>
      </div>

      {showLogoutModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold"><i className="bi bi-box-arrow-right me-2 text-danger"></i>Déconnexion</h5>
                <button type="button" className="btn-close" onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut}></button>
              </div>
              <div className="modal-body">
                <p className="mb-0">Voulez-vous vraiment vous déconnecter ? Vous devrez vous reconnecter pour accéder à la plateforme.</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-secondary" onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut}>Annuler</button>
                <button className="btn btn-danger fw-bold" onClick={confirmLogout} disabled={isLoggingOut}>
                  {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showLogoutModal && <div className="modal-backdrop fade show" onClick={() => setShowLogoutModal(false)}></div>}
    </header>
  )
}
