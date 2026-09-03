import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { scheduleTokenRefresh, cancelTokenRefresh } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ClientLoginPage } from '@/pages/auth/ClientLoginPage'
import { RoleRedirect } from '@/components/auth/RoleRedirect'
import { PricingPage } from '@/pages/pricing/PricingPage'

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ChantiersPage = lazy(() => import('@/pages/chantiers/ChantiersPage').then((m) => ({ default: m.ChantiersPage })))
const RhPage = lazy(() => import('@/pages/rh/RhPage').then((m) => ({ default: m.RhPage })))
const StocksPage = lazy(() => import('@/pages/stocks/StocksPage').then((m) => ({ default: m.StocksPage })))
const CommercialPage = lazy(() => import('@/pages/commercial/CommercialPage').then((m) => ({ default: m.CommercialPage })))
const FinancePage = lazy(() => import('@/pages/finance/FinancePage').then((m) => ({ default: m.FinancePage })))
const MaterielsPage = lazy(() => import('@/pages/materiels/MaterielsPage').then((m) => ({ default: m.MaterielsPage })))
const AlertesPage = lazy(() => import('@/pages/alertes/AlertesPage').then((m) => ({ default: m.AlertesPage })))
const HistoriqueLoginsPage = lazy(() => import('@/pages/historique-logins/HistoriqueLoginsPage').then((m) => ({ default: m.HistoriqueLoginsPage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const SuperAdminDashboardPage = lazy(() => import('@/pages/super-admin/SuperAdminDashboardPage').then((m) => ({ default: m.SuperAdminDashboardPage })))
const SuperAdminEntreprisesPage = lazy(() => import('@/pages/super-admin/SuperAdminEntreprisesPage').then((m) => ({ default: m.SuperAdminEntreprisesPage })))
const SuperAdminUtilisateursPage = lazy(() => import('@/pages/super-admin/SuperAdminUtilisateursPage').then((m) => ({ default: m.SuperAdminUtilisateursPage })))
const SuperAdminAbonnementsPage = lazy(() => import('@/pages/super-admin/SuperAdminAbonnementsPage').then((m) => ({ default: m.SuperAdminAbonnementsPage })))
const SuperAdminFacturationPage = lazy(() => import('@/pages/super-admin/SuperAdminFacturationPage').then((m) => ({ default: m.SuperAdminFacturationPage })))
const SuperAdminLogsPage = lazy(() => import('@/pages/super-admin/SuperAdminLogsPage').then((m) => ({ default: m.SuperAdminLogsPage })))
const SuperAdminParametresPage = lazy(() => import('@/pages/super-admin/SuperAdminParametresPage').then((m) => ({ default: m.SuperAdminParametresPage })))
const ClientPage = lazy(() => import('@/pages/client/ClientPage').then((m) => ({ default: m.ClientPage })))
const EmployePage = lazy(() => import('@/pages/employe/EmployePage').then((m) => ({ default: m.EmployePage })))

function PageFallback() {
  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  )
}

function App() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (token) scheduleTokenRefresh()
    return () => cancelTokenRefresh()
  }, [token])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/client-login" element={<ClientLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/" element={<ProtectedRoute />}>
        <Route index element={<RoleRedirect />} />
        <Route path="dashboard" element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>} />
        <Route path="chantiers" element={<Suspense fallback={<PageFallback />}><ChantiersPage /></Suspense>} />
        <Route path="rh" element={<Suspense fallback={<PageFallback />}><RhPage /></Suspense>} />
        <Route path="stocks" element={<Suspense fallback={<PageFallback />}><StocksPage /></Suspense>} />
        <Route path="commercial" element={<Suspense fallback={<PageFallback />}><CommercialPage /></Suspense>} />
        <Route path="finance" element={<Suspense fallback={<PageFallback />}><FinancePage /></Suspense>} />
        <Route path="materiels" element={<Suspense fallback={<PageFallback />}><MaterielsPage /></Suspense>} />
        <Route path="alertes" element={<Suspense fallback={<PageFallback />}><AlertesPage /></Suspense>} />
        <Route path="historique-logins" element={<Suspense fallback={<PageFallback />}><HistoriqueLoginsPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>} />
        <Route path="client" element={<Suspense fallback={<PageFallback />}><ClientPage /></Suspense>} />
        <Route path="employe" element={<Suspense fallback={<PageFallback />}><EmployePage /></Suspense>} />
        <Route path="pricing" element={<Suspense fallback={<PageFallback />}><PricingPage /></Suspense>} />
        <Route path="super-admin">
          <Route index element={<Suspense fallback={<PageFallback />}><SuperAdminDashboardPage /></Suspense>} />
          <Route path="entreprises" element={<Suspense fallback={<PageFallback />}><SuperAdminEntreprisesPage /></Suspense>} />
          <Route path="utilisateurs" element={<Suspense fallback={<PageFallback />}><SuperAdminUtilisateursPage /></Suspense>} />
          <Route path="abonnements" element={<Suspense fallback={<PageFallback />}><SuperAdminAbonnementsPage /></Suspense>} />
          <Route path="facturation" element={<Suspense fallback={<PageFallback />}><SuperAdminFacturationPage /></Suspense>} />
          <Route path="logs" element={<Suspense fallback={<PageFallback />}><SuperAdminLogsPage /></Suspense>} />
          <Route path="parametres" element={<Suspense fallback={<PageFallback />}><SuperAdminParametresPage /></Suspense>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
