import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'

export function Layout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const hydrateThemeFromBackend = useUIStore((s) => s.hydrateThemeFromBackend)
  const user = useAuthStore((s) => s.user)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 992)

  useEffect(() => {
    hydrateThemeFromBackend()
  }, [hydrateThemeFromBackend])

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 992)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="app-shell">
      <Sidebar />
      {sidebarOpen && !isDesktop && (
        <div
          className="sidebar-backdrop show"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
      <div className={`main-area${isDesktop && !sidebarOpen ? ' sidebar-collapsed' : ''}`}>
        <Topbar />
        {user?.must_change_password && (
          <div className="alert alert-warning border-0 rounded-0 mb-0 d-flex align-items-center justify-content-between px-4 py-2" style={{ zIndex: 100 }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-shield-exclamation me-2 fs-5"></i>
              <span>Vous utilisez actuellement un mot de passe temporaire. Pour la sécurité de votre compte, veuillez le modifier dès maintenant.</span>
            </div>
            <button
              className="btn btn-sm btn-warning fw-bold ms-3"
              onClick={() => window.dispatchEvent(new Event('open-change-password-modal'))}
            >
              Modifier mon mot de passe
            </button>
          </div>
        )}
        <main className="flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
