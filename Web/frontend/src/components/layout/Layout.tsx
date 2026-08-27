import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/stores/ui.store'
import { useEffect, useState } from 'react'

export function Layout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const hydrateThemeFromBackend = useUIStore((s) => s.hydrateThemeFromBackend)
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
        <main className="flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
