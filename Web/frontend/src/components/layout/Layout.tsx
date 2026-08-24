import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/stores/ui.store'

export function Layout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  return (
    <div className="app-shell">
      <Sidebar />
      {sidebarOpen && (
        <div
          className="sidebar-backdrop show"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
      <div className={`main-area${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        <Topbar />
        <main className="flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
