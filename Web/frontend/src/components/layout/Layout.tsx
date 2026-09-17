import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { subscriptionsService } from '@/services/subscriptions.service'
import type { SubscriptionWithPlan } from '@/types'

interface SubscriptionState {
  state: 'essai' | 'actif' | 'expire' | 'sans'
  days_remaining: number | null
  date_fin: string | null
  plan_code: string | null
  plan_nom: string | null
}

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

  const canViewAbonnement = user?.role_code === 'admin_entreprise' || user?.role_code === 'super_admin'
  const [subState, setSubState] = useState<SubscriptionState | null>(null)

  useEffect(() => {
    if (!canViewAbonnement || !user?.entreprise_id) {
      setSubState(null)
      setSubLoading(false)
      return
    }
    subscriptionsService
      .getMySubscriptionState()
      .then(setSubState)
      .catch(() => setSubState(null))
      .finally(() => setSubLoading(false))
  }, [canViewAbonnement, user?.entreprise_id])

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 992)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isExpiringSoon = subState?.state === 'essai' && subState.days_remaining !== null && subState.days_remaining <= 7
  const isExpired = subState?.state === 'expire'
  const isTrial = subState?.state === 'essai' && (subState.days_remaining === null || subState.days_remaining > 7)
  const joursRestants = subState?.days_remaining ?? null

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
        {!subLoading && subState && isTrial && (
          <div className="alert alert-info border-0 rounded-0 mb-0 d-flex align-items-center justify-content-between px-4 py-2" style={{ zIndex: 100 }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-gift me-2 fs-5"></i>
              <span>
                <strong>Essai gratuit {subState.plan_nom ? `— plan ${subState.plan_nom}` : ''}</strong> : accédez à toutes les fonctionnalités pendant encore{' '}
                <strong>{joursRestants} jour{joursRestants !== null && joursRestants !== 1 ? 's' : ''}</strong>.
              </span>
            </div>
            <a href="/pricing" className="btn btn-sm btn-info fw-bold ms-3">Voir les formules</a>
          </div>
        )}
        {!subLoading && subState && isExpiringSoon && (
          <div className="alert alert-warning border-0 rounded-0 mb-0 d-flex align-items-center justify-content-between px-4 py-2" style={{ zIndex: 100 }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-hourglass-split me-2 fs-5"></i>
              <span>
                <strong>Plus que {joursRestants} jour{joursRestants !== null && joursRestants !== 1 ? 's' : ''}</strong> d'essai gratuit. Choisissez votre formule pour ne rien perdre de vos données.
              </span>
            </div>
            <a href="/pricing" className="btn btn-sm btn-warning fw-bold ms-3">Choisir une formule</a>
          </div>
        )}
        {!subLoading && subState && isExpired && (
          <div className="alert alert-danger border-0 rounded-0 mb-0 d-flex align-items-center justify-content-between px-4 py-2" style={{ zIndex: 100 }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-pause-circle me-2 fs-5"></i>
              <span>
                <strong>Votre essai est terminé.</strong> L'accès est en lecture seule : consultez vos données, mais les modifications sont désactivées.
              </span>
            </div>
            <a href="/pricing" className="btn btn-sm btn-danger fw-bold ms-3">Réactiver l'écriture</a>
          </div>
        )}
        {!subLoading && subscription && !subState && isExpired && (
          <div className="alert alert-danger border-0 rounded-0 mb-0 d-flex align-items-center justify-content-between px-4 py-2" style={{ zIndex: 100 }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-x-circle me-2 fs-5"></i>
              <span>Votre abonnement a expiré. Veuillez renouveler votre formule pour continuer à utiliser la plateforme.</span>
            </div>
            <a href="/pricing" className="btn btn-sm btn-danger fw-bold ms-3">Voir les formules</a>
          </div>
        )}
        <main className="flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
