import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { PERMISSION_MAP } from '@/utils/permissions'
import type { RoleCode } from '@/utils/permissions'

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'bi-speedometer2', permission: 'dashboard:read' },
  { path: '/chantiers', label: 'Chantiers', icon: 'bi-building', permission: 'chantiers:read' },
  { path: '/rh', label: 'Ressources Humaines', icon: 'bi-people', permission: 'rh:read' },
  { path: '/stocks', label: 'Stocks', icon: 'bi-box-seam', permission: 'stocks:read' },
  { path: '/commercial', label: 'Commercial', icon: 'bi-cart', permission: 'commercial:read' },
  { path: '/finance', label: 'Finance', icon: 'bi-currency-dollar', permission: 'finance:read' },
  { path: '/materiels', label: 'Matériels', icon: 'bi-tools', permission: 'materiels:read' },
  { path: '/alertes', label: 'Alertes', icon: 'bi-bell', permission: 'alertes:read' },
  { path: '/historique-logins', label: 'Historique', icon: 'bi-clock-history', permission: 'parametres:read' },
  { path: '/settings', label: 'Paramètres', icon: 'bi-gear', permission: 'parametres:read' },
]

export function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { sidebarOpen } = useUIStore()
  const roleCode = user?.role_code || ''

  const hasPermission = (permission: string) => {
    const permissions = PERMISSION_MAP[roleCode as RoleCode] || []
    return permissions['*'] === '*' || permissions[permission] === '*' || permissions[permission]?.includes('read')
  }

  const filteredMenu = menuItems.filter(item => hasPermission(item.permission))

  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <i className="bi bi-building"></i>
          {sidebarOpen && <span className="sidebar-title">TIA INFO BUILD</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredMenu.map(item => {
          const isActive = location.pathname.startsWith(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <i className={`bi ${item.icon}`}></i>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-link logout-btn" onClick={logout}>
          <i className="bi bi-box-arrow-right"></i>
          {sidebarOpen && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
