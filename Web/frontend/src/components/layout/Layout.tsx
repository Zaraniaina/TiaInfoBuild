import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { subscriptionsService } from '@/services/subscriptions.service'
import type { SubscriptionWithPlan } from '@/types'

export function Layout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const hydrateThemeFromBackend = useUIStore((s) => s.hydrateThemeFromBackend)
  const user = useAuthStore((s) => s.user)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 992)
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [now, setNow] = useState<number>(0)

  useEffect(() => {
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 60 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    hydrateThemeFromBackend()
  }, [hydrateThemeFromBackend])

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 992)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

    const canViewAbonnement = user?.role_code === 'admin_entreprise' || user?.role_code === 'super_admin'

  useEffect(() => {
    if (!canViewAbonnement || !user?.entreprise_id) {
      setSubLoading(false)
      return
    }
    subscriptionsService.getMySubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null))
      .finally(() => setSubLoading(false))
  }, [canViewAbonnement, user?.entreprise_id])

  const isExpiringSoon = now > 0 && subscription?.date_prochain_renouvellement
    ? new Date(subscription.date_prochain_renouvellement) <= new Date(now + 7 * 24 * 60 * 60 * 1000)
    : false

  const isExpired = now > 0 && subscription?.date_fin
    ? new Date(subscription.date_fin) < new Date(now)
    : false

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
        {!subLoading && subscription && isExpired && (
          <div className="alert alert-danger border-0 rounded-0 mb-0 d-flex align-items-center justify-content-between px-4 py-2" style={{ zIndex: 100 }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-x-circle me-2 fs-5"></i>
              <span>Votre abonnement a expiré. Veuillez renouveler votre formule pour continuer à utiliser la plateforme.</span>
            </div>
            <a href="/pricing" className="btn btn-sm btn-danger fw-bold ms-3">Voir les formules</a>
          </div>
        )}
        {!subLoading && subscription && isExpiringSoon && !isExpired && (
          <div className="alert alert-warning border-0 rounded-0 mb-0 d-flex align-items-center justify-content-between px-4 py-2" style={{ zIndex: 100 }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle me-2 fs-5"></i>
              <span>Votre abonnement expire bientôt (le {subscription.date_fin ? new Date(subscription.date_fin).toLocaleDateString() : 'prochainement'}). Pensez à renouveler.</span>
            </div>
            <a href="/pricing" className="btn btn-sm btn-warning fw-bold ms-3">Renouveler</a>
          </div>
        )}
        <main className="flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
