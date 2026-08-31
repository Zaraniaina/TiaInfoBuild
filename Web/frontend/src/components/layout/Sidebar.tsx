import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { RoleBadge } from './RoleBadge'
import { ROLE_MODULES, ROLE_NAMES } from '@/config/roles.config'

const MODULE_META: Record<string, { label: string; icon: string; section: string }> = {
  '/dashboard': { label: 'Tableau de bord', icon: 'bi-speedometer2', section: 'Principal' },
  '/super-admin': { label: 'Dashboard SaaS', icon: 'bi-shield-lock', section: 'Plateforme SaaS' },
  '/super-admin/entreprises': { label: 'Entreprises', icon: 'bi-building', section: 'Plateforme SaaS' },
  '/super-admin/utilisateurs': { label: 'Utilisateurs Globaux', icon: 'bi-people', section: 'Plateforme SaaS' },
  '/super-admin/abonnements': { label: 'Abonnements', icon: 'bi-credit-card', section: 'Plateforme SaaS' },
  '/super-admin/facturation': { label: 'Facturation SaaS', icon: 'bi-receipt', section: 'Plateforme SaaS' },
  '/super-admin/logs': { label: 'Logs & Supervision', icon: 'bi-activity', section: 'Plateforme SaaS' },
  '/super-admin/parametres': { label: 'Paramètres Plateforme', icon: 'bi-gear', section: 'Plateforme SaaS' },
  '/chantiers': { label: 'Chantiers & Phases', icon: 'bi-building', section: 'Pilotage' },
  '/finance': { label: 'Finances & Dépenses', icon: 'bi-currency-exchange', section: 'Finances' },
  '/rh': { label: 'Employés & Pointages', icon: 'bi-people', section: 'Ressources Humaines' },
  '/materiels': { label: 'Matériels & Engins', icon: 'bi-tools', section: 'Matériel & Parc' },
  '/stocks': { label: 'Articles & Inventaire', icon: 'bi-box-seam', section: 'Stocks & Logistique' },
  '/commercial': { label: 'Clients & Devis', icon: 'bi-cart', section: 'Commercial' },
  '/alertes': { label: 'Alertes Système', icon: 'bi-bell', section: 'Administration' },
  '/historique-logins': { label: 'Audit Connexions', icon: 'bi-clock-history', section: 'Administration' },
  '/settings': { label: 'Utilisateurs & Paramètres', icon: 'bi-gear', section: 'Administration' },
}

export function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 992)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 992)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const roleCode = user?.role_code || 'employe'
  const allowedPaths = ROLE_MODULES[roleCode] || []
  const roleName = ROLE_NAMES[roleCode] || roleCode

  const collapsed = isDesktop ? !sidebarOpen : false
  const showMobile = !isDesktop ? sidebarOpen : false

  const sections: Record<string, Record<string, { label: string; icon: string }>> = {}
  for (const path of allowedPaths) {
    const meta = MODULE_META[path]
    if (!meta) continue
    if (!sections[meta.section]) sections[meta.section] = {}
    sections[meta.section][path] = { label: meta.label, icon: meta.icon }
  }

  const confirmLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <>
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${showMobile ? ' show' : ''}`}>
        <div className="sidebar-brand">
          <div className="mark">TB</div>
          {!collapsed && !showMobile && (
            <div>
              <div className="brand-name">TIA INFO BUILD</div>
              <div className="brand-sub">Gestion BTP</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-3 py-2 text-center">
            <span className="role-badge">{roleName}</span>
          </div>
        )}

        <nav className="sidebar-nav">
          {Object.entries(sections).map(([sectionName, items]) => (
            <div key={sectionName} className="mb-2">
              {!collapsed && (
                <div className="sidebar-section-label">
                  {sectionName}
                </div>
              )}
              {Object.entries(items).map(([path, meta]) => {
                const bestMatch = allowedPaths
    .filter(p => location.pathname === p || (p !== '/' && location.pathname.startsWith(p + '/')))
    .sort((a, b) => b.length - a.length)[0]
  const isActive = bestMatch === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    title={collapsed ? meta.label : undefined}
                    onClick={() => {
                      if (!isDesktop) toggleSidebar()
                    }}
                  >
                    <i className={`bi ${meta.icon}`}></i>
                    {!collapsed && <span>{meta.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          {!collapsed && user && (
            <div className="user-info d-flex align-items-center gap-2 mb-2">
              <div className="avatar-badge">
                {user.prenom?.[0] || 'U'}{user.nom?.[0] || ''}
              </div>
              <div className="flex-grow-1 text-truncate">
                <div className="small fw-semibold text-truncate" style={{ color: 'var(--tia-text-primary)' }}>{user.prenom} {user.nom}</div>
                <small className="text-muted text-truncate d-block" style={{ fontSize: '0.72rem' }}>{user.email}</small>
              </div>
            </div>
          )}
          <button className="sidebar-link w-100 border-0 bg-transparent text-danger mt-1" onClick={() => setShowLogoutModal(true)} title={collapsed ? 'Déconnexion' : undefined}>
            <i className="bi bi-box-arrow-right"></i>
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>
      {showMobile && (
        <div
          className="sidebar-backdrop show"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {showLogoutModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold"><i className="bi bi-box-arrow-right me-2 text-danger"></i>Déconnexion</h5>
                <button type="button" className="btn-close" onClick={() => setShowLogoutModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="mb-0">Voulez-vous vraiment vous déconnecter ? Vous devrez vous reconnecter pour accéder à la plateforme.</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-secondary" onClick={() => setShowLogoutModal(false)}>Annuler</button>
                <button className="btn btn-danger fw-bold" onClick={confirmLogout}>Se déconnecter</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showLogoutModal && <div className="modal-backdrop fade show" onClick={() => setShowLogoutModal(false)}></div>}
    </>
  )
}
