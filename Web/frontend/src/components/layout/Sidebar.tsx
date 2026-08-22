import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { RoleBadge } from './RoleBadge'

interface SectionGroup {
  label: string
  items: {
    path: string
    label: string
    icon: string
    roles?: string[]
  }[]
}

const navSections: SectionGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { path: '/dashboard', label: 'Tableau de bord', icon: 'bi-speedometer2' },
      { path: '/chantiers', label: 'Chantiers', icon: 'bi-building', roles: ['super_admin', 'admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'employe'] }
    ]
  },
  {
    label: 'Finances',
    items: [
      { path: '/finance', label: 'Finances & Dépenses', icon: 'bi-currency-exchange', roles: ['super_admin', 'admin_entreprise', 'directeur', 'comptable'] }
    ]
  },
  {
    label: 'Ressources Humaines',
    items: [
      { path: '/rh', label: 'Employés & Pointages', icon: 'bi-people', roles: ['super_admin', 'admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'rh', 'employe'] }
    ]
  },
  {
    label: 'Matériel',
    items: [
      { path: '/materiels', label: 'Matériels & Engins', icon: 'bi-tools', roles: ['super_admin', 'admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'materiel'] }
    ]
  },
  {
    label: 'Stocks',
    items: [
      { path: '/stocks', label: 'Articles & Inventaire', icon: 'bi-box-seam', roles: ['super_admin', 'admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'magasinier', 'employe'] }
    ]
  },
  {
    label: 'Commercial',
    items: [
      { path: '/commercial', label: 'Clients & Devis', icon: 'bi-cart', roles: ['super_admin', 'admin_entreprise', 'directeur', 'comptable', 'commercial'] }
    ]
  },
  {
    label: 'Administration',
    items: [
      { path: '/super-admin', label: 'Gestion SaaS', icon: 'bi-shield-lock', roles: ['super_admin'] },
      { path: '/alertes', label: 'Alertes Système', icon: 'bi-bell', roles: ['super_admin', 'admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'rh', 'materiel', 'magasinier', 'commercial', 'comptable'] },
      { path: '/historique-logins', label: 'Historique connexions', icon: 'bi-clock-history', roles: ['super_admin', 'admin_entreprise'] },
      { path: '/settings', label: 'Paramètres', icon: 'bi-gear', roles: ['super_admin', 'admin_entreprise', 'directeur'] }
    ]
  }
]

export function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { sidebarOpen } = useUIStore()

  const roleCode = user?.role_code || 'employe'

  return (
    <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-brand">
        <div className="mark">TB</div>
        {sidebarOpen && (
          <div>
            <div className="brand-name">TIA INFO BUILD</div>
            <div className="brand-sub">Gestion BTP</div>
          </div>
        )}
      </div>

      {sidebarOpen && user && (
        <div className="px-3 py-2 text-center">
          <RoleBadge roleCode={roleCode} />
        </div>
      )}

      <nav className="sidebar-nav">
        {navSections.map((section, idx) => {
          const visibleItems = section.items.filter(item => !item.roles || item.roles.includes(roleCode))
          if (visibleItems.length === 0) return null

          return (
            <div key={idx} className="mb-2">
              {sidebarOpen && (
                <div className="sidebar-section-label">
                  {section.label}
                </div>
              )}
              {visibleItems.map(item => {
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
            </div>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        {sidebarOpen && user && (
          <div className="user-info d-flex align-items-center gap-2 mb-2">
            <div className="avatar-badge bg-warning text-dark font-monospace fw-bold px-2 py-1 rounded">
              {user.prenom?.[0] || 'U'}{user.nom?.[0] || ''}
            </div>
            <div className="flex-grow-1 text-truncate">
              <div className="small fw-semibold text-white text-truncate">{user.prenom} {user.nom}</div>
              <small className="text-muted text-truncate d-block" style={{ fontSize: '0.72rem' }}>{user.email}</small>
            </div>
          </div>
        )}
        <button className="sidebar-link w-100 border-0 bg-transparent text-danger mt-1" onClick={logout}>
          <i className="bi bi-box-arrow-right"></i>
          {sidebarOpen && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
