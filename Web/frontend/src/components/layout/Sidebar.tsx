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
    label: 'Plateforme SaaS',
    items: [
      { path: '/super-admin', label: 'Gestion SaaS & Tenants', icon: 'bi-shield-lock', roles: ['super_admin'] },
      { path: '/dashboard', label: 'Tableau de bord', icon: 'bi-speedometer2' }
    ]
  },
  {
    label: 'Pilotage & Chantiers',
    items: [
      { path: '/chantiers', label: 'Chantiers & Phases', icon: 'bi-building', roles: ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'commercial', 'employe', 'super_admin', 'client'] }
    ]
  },
  {
    label: 'Finances',
    items: [
      { path: '/finance', label: 'Finances & Dépenses', icon: 'bi-currency-exchange', roles: ['admin_entreprise', 'directeur', 'comptable', 'super_admin'] }
    ]
  },
  {
    label: 'Ressources Humaines',
    items: [
      { path: '/rh', label: 'Employés & Pointages', icon: 'bi-people', roles: ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'rh', 'employe', 'super_admin'] }
    ]
  },
  {
    label: 'Matériel & Parc',
    items: [
      { path: '/materiels', label: 'Matériels & Engins', icon: 'bi-tools', roles: ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'materiel', 'employe', 'super_admin'] }
    ]
  },
  {
    label: 'Stocks & Logistique',
    items: [
      { path: '/stocks', label: 'Articles & Inventaire', icon: 'bi-box-seam', roles: ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'magasinier', 'employe', 'super_admin'] }
    ]
  },
  {
    label: 'Commercial',
    items: [
      { path: '/commercial', label: 'Clients & Devis', icon: 'bi-cart', roles: ['admin_entreprise', 'directeur', 'comptable', 'commercial', 'super_admin', 'client'] }
    ]
  },
  {
    label: 'Administration & Sécurité',
    items: [
      { path: '/alertes', label: 'Alertes Système', icon: 'bi-bell', roles: ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'rh', 'materiel', 'magasinier', 'commercial', 'comptable', 'super_admin'] },
      { path: '/historique-logins', label: 'Audit Connexions', icon: 'bi-clock-history', roles: ['super_admin', 'admin_entreprise'] },
      { path: '/settings', label: 'Utilisateurs & Paramètres', icon: 'bi-gear', roles: ['admin_entreprise', 'super_admin'] }
    ]
  }
]

export function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()

  const roleCode = user?.role_code || 'employe'

  return (
    <>
      <aside className={`sidebar${sidebarOpen ? ' show' : ''}`}>
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
                      onClick={() => {
                        if (window.innerWidth < 992) toggleSidebar()
                      }}
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
    </>
  )
}
