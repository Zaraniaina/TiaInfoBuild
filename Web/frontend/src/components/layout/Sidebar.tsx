import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { ROLE_MODULES, ROLE_NAMES } from '@/config/roles.config'
import { BrandLogo } from '@/components/brand/BrandLogo'

const MODULE_META: Record<string, { label: string; icon: string; section: string }> = {
  '/app/employe': { label: 'Mon Espace Terrain', icon: 'bi-person-badge', section: 'Principal' },
  '/app/employe/profil': { label: 'Mon profil', icon: 'bi-person', section: 'Espace Terrain' },
  '/app/employe/chantiers': { label: 'Mes chantiers', icon: 'bi-building', section: 'Espace Terrain' },
  '/app/employe/taches': { label: 'Mes tâches', icon: 'bi-list-check', section: 'Espace Terrain' },
  '/app/employe/travaux': { label: 'Travaux réalisés', icon: 'bi-hammer', section: 'Espace Terrain' },
  '/app/employe/rapports': { label: 'Rapports journaliers', icon: 'bi-file-text', section: 'Espace Terrain' },
  '/app/employe/photos': { label: 'Photos', icon: 'bi-camera', section: 'Espace Terrain' },
  '/app/employe/signalements': { label: 'Signalements', icon: 'bi-exclamation-triangle', section: 'Espace Terrain' },
  '/app/employe/notifications': { label: 'Notifications', icon: 'bi-bell', section: 'Espace Terrain' },
  '/app/employe/planning': { label: 'Mon planning', icon: 'bi-calendar', section: 'Espace Terrain' },
    '/app/employe/documents': { label: 'Documents', icon: 'bi-folder', section: 'Espace Terrain' },
  '/app/employe/badge': { label: 'Mon badge QR', icon: 'bi-qr-code', section: 'Espace Terrain' },
  '/app/employe/conges': { label: 'Mes congés', icon: 'bi-calendar2-week', section: 'Espace Terrain' },

  '/app/dashboard': { label: 'Tableau de bord', icon: 'bi-speedometer2', section: 'Principal' },
  '/app/super-admin': { label: 'Dashboard SaaS', icon: 'bi-shield-lock', section: 'Plateforme SaaS' },
  '/app/super-admin/entreprises': { label: 'Entreprises', icon: 'bi-building', section: 'Plateforme SaaS' },
  '/app/super-admin/utilisateurs': { label: 'Utilisateurs Globaux', icon: 'bi-people', section: 'Plateforme SaaS' },
  '/app/super-admin/abonnements': { label: 'Abonnements', icon: 'bi-credit-card', section: 'Plateforme SaaS' },
  '/app/super-admin/facturation': { label: 'Facturation SaaS', icon: 'bi-receipt', section: 'Plateforme SaaS' },
  '/app/super-admin/logs': { label: 'Logs & Supervision', icon: 'bi-activity', section: 'Plateforme SaaS' },
  '/app/super-admin/email': { label: 'Configuration Email / SMTP', icon: 'bi-envelope-paper', section: 'Plateforme SaaS' },
  '/app/super-admin/paiement': { label: 'Passerelle de Paiement', icon: 'bi-router', section: 'Plateforme SaaS' },
  '/app/super-admin/parametres': { label: 'Paramètres Plateforme', icon: 'bi-gear', section: 'Plateforme SaaS' },
  '/app/chantiers': { label: 'Chantiers & Phases', icon: 'bi-building', section: 'Pilotage' },
  '/app/risques-climatiques': { label: 'Risques climatiques', icon: 'bi-cloud-lightning-rain', section: 'Pilotage' },
  '/app/finance': { label: 'Finances & Dépenses', icon: 'bi-currency-exchange', section: 'Finances' },
  '/app/rh': { label: 'Employés & Pointages', icon: 'bi-people', section: 'Ressources Humaines' },
  '/app/materiels': { label: 'Matériels & Engins', icon: 'bi-tools', section: 'Matériel & Parc' },
  '/app/stocks': { label: 'Articles & Inventaire', icon: 'bi-box-seam', section: 'Stocks & Logistique' },
  '/app/achats': { label: 'Achats fournisseurs', icon: 'bi-cart-check', section: 'Stocks & Logistique' },
  '/app/commercial': { label: 'Clients & Devis', icon: 'bi-cart', section: 'Commercial' },
  '/app/alertes': { label: 'Alertes Système', icon: 'bi-bell', section: 'Administration' },
  '/app/historique-logins': { label: 'Audit Connexions', icon: 'bi-clock-history', section: 'Administration' },
  '/app/settings': { label: 'Utilisateurs & Paramètres', icon: 'bi-gear', section: 'Administration' },
  '/app/pricing': { label: 'Tarifs & Abonnement', icon: 'bi-tag', section: 'Administration' },
  '/app/client': { label: 'Tableau de bord', icon: 'bi-speedometer2', section: 'Espace Client' },
  '/app/client/profil': { label: 'Mon profil', icon: 'bi-person', section: 'Espace Client' },
  '/app/client/demandes': { label: 'Mes demandes', icon: 'bi-envelope', section: 'Espace Client' },
  '/app/client/projets': { label: 'Mes projets', icon: 'bi-building', section: 'Espace Client' },
  '/app/client/devis': { label: 'Mes devis', icon: 'bi-file-earmark-text', section: 'Espace Client' },
  '/app/client/contrats': { label: 'Mes contrats', icon: 'bi-file-earmark-check', section: 'Espace Client' },
  '/app/client/avenants': { label: 'Mes avenants', icon: 'bi-file-earmark-plus', section: 'Espace Client' },
  '/app/client/chantiers': { label: 'Mes chantiers', icon: 'bi-hammer', section: 'Espace Client' },
  '/app/client/avancement': { label: 'Avancement travaux', icon: 'bi-bar-chart', section: 'Espace Client' },
  '/app/client/situations': { label: 'Situations travaux', icon: 'bi-clipboard-data', section: 'Espace Client' },
  '/app/client/factures': { label: 'Mes factures', icon: 'bi-receipt', section: 'Espace Client' },
  '/app/client/paiements': { label: 'Mes paiements', icon: 'bi-credit-card', section: 'Espace Client' },
  '/app/client/documents': { label: 'Mes documents', icon: 'bi-folder', section: 'Espace Client' },
  '/app/client/notifications': { label: 'Notifications', icon: 'bi-bell', section: 'Espace Client' },
  '/app/client/parametres': { label: 'Paramètres', icon: 'bi-gear', section: 'Espace Client' },
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
          <BrandLogo size={34} withName={!collapsed && !showMobile} />
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
          <Link to="/" className="sidebar-link text-decoration-none" title={collapsed ? 'Retour au site' : undefined}>
            <i className="bi bi-globe"></i>
            {!collapsed && <span>Retour au site</span>}
          </Link>
          {!collapsed && user && (
            <div className="user-info d-flex align-items-center gap-2 mb-2">
              {user.photo ? (
                <img src={user.photo} alt="Avatar" className="rounded-circle border" style={{ width: '36px', height: '36px', objectFit: 'cover' }} />
              ) : (
                <div className="avatar-badge">
                  {user.prenom?.[0] || 'U'}{user.nom?.[0] || ''}
                </div>
              )}
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
