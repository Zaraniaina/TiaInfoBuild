import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { scheduleTokenRefresh, cancelTokenRefresh } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { isDesktop } from '@/utils/buildMode'
import { startSyncEngine, stopSyncEngine } from '@/services/syncEngine'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ClientLoginPage } from '@/pages/auth/ClientLoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage'
import { OnlineRequiredGate } from '@/components/auth/OnlineRequiredGate'
import { RoleRedirect } from '@/components/auth/RoleRedirect'
import { PricingPage } from '@/pages/pricing/PricingPage'

/* Condition de build PURE (VITE_BUILD_TARGET), testée uniquement à la
   compilation : en build desktop, la LandingPage n'est jamais importée →
   absente du bundle (règle « pas de vitrine », plan §8) ; en build web,
   ActivationPage suit la règle inverse.
   NOTE : expression littérale (et non `isDesktopBuild()`) pour que Vite la
   remplace statiquement et que Rollup élimine l'import dynamique inutilisé. */
const IS_DESKTOP_BUILD = import.meta.env.VITE_BUILD_TARGET === 'desktop'

const LandingPage = IS_DESKTOP_BUILD
  ? null
  : lazy(() => import('@/pages/landing/LandingPage').then((m) => ({ default: m.LandingPage })))

/* ActivationPage n'existe QUE dans le build desktop (règle inverse de la
   vitrine) : en build web, l'import dynamique est éliminé à la compilation. */
const ActivationPage = IS_DESKTOP_BUILD
  ? lazy(() => import('@/pages/auth/ActivationPage').then((m) => ({ default: m.ActivationPage })))
  : null

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ChantiersPage = lazy(() => import('@/pages/chantiers/ChantiersPage').then((m) => ({ default: m.ChantiersPage })))
const RisquesClimatiquesPage = lazy(() => import('@/pages/chantiers/RisquesClimatiquesPage').then((m) => ({ default: m.RisquesClimatiquesPage })))
const RhPage = lazy(() => import('@/pages/rh/RhPage').then((m) => ({ default: m.RhPage })))
const StocksPage = lazy(() => import('@/pages/stocks/StocksPage').then((m) => ({ default: m.StocksPage })))
const AchatsPage = lazy(() => import('@/pages/achats/AchatsPage').then((m) => ({ default: m.AchatsPage })))
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
const SuperAdminMailPage = lazy(() => import('@/pages/super-admin/SuperAdminMailPage').then((m) => ({ default: m.SuperAdminMailPage })))
const SuperAdminPaiementPage = lazy(() => import('@/pages/super-admin/SuperAdminPaiementPage').then((m) => ({ default: m.SuperAdminPaiementPage })))
const ClientLayout = lazy(() => import('@/pages/client/ClientLayout').then((m) => ({ default: m.ClientLayout })))
const EmployeLayout = lazy(() => import('@/pages/employe/EmployeLayout').then((m) => ({ default: m.EmployeLayout })))
const EmployeDashboard = lazy(() => import('@/pages/employe/EmployePage').then((m) => ({ default: m.EmployePage })))
const EmployeProfil = lazy(() => import('@/pages/employe/EmployeProfilPage').then((m) => ({ default: m.EmployeProfilPage })))
const EmployeChantiers = lazy(() => import('@/pages/employe/EmployeChantiersPage').then((m) => ({ default: m.EmployeChantiersPage })))
const EmployeTaches = lazy(() => import('@/pages/employe/EmployeTachesPage').then((m) => ({ default: m.EmployeTachesPage })))
const EmployeTravaux = lazy(() => import('@/pages/employe/EmployeTravauxPage').then((m) => ({ default: m.EmployeTravauxPage })))
const EmployeRapports = lazy(() => import('@/pages/employe/EmployeRapportsPage').then((m) => ({ default: m.EmployeRapportsPage })))
const EmployePhotos = lazy(() => import('@/pages/employe/EmployePhotosPage').then((m) => ({ default: m.EmployePhotosPage })))
const EmployeSignalements = lazy(() => import('@/pages/employe/EmployeSignalementsPage').then((m) => ({ default: m.EmployeSignalementsPage })))
const EmployeNotificationsPage = lazy(() => import('@/pages/employe/EmployeNotificationsPage').then((m) => ({ default: m.EmployeNotificationsPage })))
const EmployeDocuments = lazy(() => import('@/pages/employe/EmployeDocumentsPage').then((m) => ({ default: m.EmployeDocumentsPage })))
const EmployePlanning = lazy(() => import('@/pages/employe/EmployePlanningPage').then((m) => ({ default: m.EmployePlanningPage })))
const EmployeBadge = lazy(() => import('@/pages/employe/EmployeBadgePage').then((m) => ({ default: m.EmployeBadgePage })))
const EmployeConges = lazy(() => import('@/pages/employe/EmployeCongesPage').then((m) => ({ default: m.EmployeCongesPage })))

const ClientDashboard = lazy(() => import('@/pages/client/ClientDashboard').then((m) => ({ default: m.ClientDashboard })))

const ClientProfil = lazy(() => import('@/pages/client/ClientProfil').then((m) => ({ default: m.ClientProfil })))
const ClientDemandesPage = lazy(() => import('@/pages/client/ClientDemandesPage').then((m) => ({ default: m.ClientDemandesPage })))
const ClientProjetsPage = lazy(() => import('@/pages/client/ClientProjetsPage').then((m) => ({ default: m.ClientProjetsPage })))
const ClientDevisPage = lazy(() => import('@/pages/client/ClientDevisPage').then((m) => ({ default: m.ClientDevisPage })))
const ClientContratsPage = lazy(() => import('@/pages/client/ClientContratsPage').then((m) => ({ default: m.ClientContratsPage })))
const ClientAvenantsPage = lazy(() => import('@/pages/client/ClientAvenantsPage').then((m) => ({ default: m.ClientAvenantsPage })))
const ClientChantiersPage = lazy(() => import('@/pages/client/ClientChantiersPage').then((m) => ({ default: m.ClientChantiersPage })))
const ClientAvancementPage = lazy(() => import('@/pages/client/ClientAvancementPage').then((m) => ({ default: m.ClientAvancementPage })))
const ClientSituationsPage = lazy(() => import('@/pages/client/ClientSituationsPage').then((m) => ({ default: m.ClientSituationsPage })))
const ClientFacturesPage = lazy(() => import('@/pages/client/ClientFacturesPage').then((m) => ({ default: m.ClientFacturesPage })))
const ClientPaiementsPage = lazy(() => import('@/pages/client/ClientPaiementsPage').then((m) => ({ default: m.ClientPaiementsPage })))
const ClientDocumentsPage = lazy(() => import('@/pages/client/ClientDocumentsPage').then((m) => ({ default: m.ClientDocumentsPage })))
const ClientNotificationsPage = lazy(() => import('@/pages/client/ClientNotificationsPage').then((m) => ({ default: m.ClientNotificationsPage })))
const ClientParametresPage = lazy(() => import('@/pages/client/ClientParametresPage').then((m) => ({ default: m.ClientParametresPage })))


import { DesktopLoadingScreen } from '@/components/desktop/DesktopLoadingScreen'

function PageFallback() {
  if (IS_DESKTOP_BUILD) {
    return <DesktopLoadingScreen />
  }
  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  )
}

/* Anciennes URLs de l'app (ex. /dashboard) -> /app/dashboard.
   Préserve les favoris et liens partagés d'avant la vitrine. */
const LEGACY_APP_PREFIXES = [
  '/dashboard', '/chantiers', '/rh', '/stocks', '/commercial', '/finance',
  '/materiels', '/alertes', '/historique-logins', '/settings', '/super-admin',
  '/employe', '/client',
]

function LegacyAppRedirect() {
  const { pathname } = useLocation()
  const isAppPath = LEGACY_APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (isAppPath) return <Navigate to={`/app${pathname}`} replace />
  return <Navigate to="/" replace />
}

function App() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (token) scheduleTokenRefresh()
    return () => cancelTokenRefresh()
  }, [token])

  // Moteur de synchronisation : démarrage uniquement dans la WebView Tauri.
  useEffect(() => {
    if (isDesktop()) startSyncEngine()
    return () => stopSyncEngine()
  }, [])

  return (
    <Routes>
      {/* ===== Site vitrine public (web) / connexion directe (desktop) ===== */}
      <Route
        path="/"
        element={
          IS_DESKTOP_BUILD ? (
            <Navigate to="/login" replace />
          ) : (
            <Suspense fallback={<PageFallback />}>{LandingPage ? <LandingPage /> : null}</Suspense>
          )
        }
      />
      <Route path="/login" element={<LoginPage />} />
      {IS_DESKTOP_BUILD && (
        <Route
          path="/activation"
          element={
            <Suspense fallback={<PageFallback />}>{ActivationPage ? <ActivationPage /> : null}</Suspense>
          }
        />
      )}
      <Route path="/client-login" element={<ClientLoginPage />} />
      <Route
        path="/register"
        element={
          <OnlineRequiredGate>
            <RegisterPage />
          </OnlineRequiredGate>
        }
      />
      <Route
        path="/register-entreprise"
        element={
          <OnlineRequiredGate>
            <RegisterPage />
          </OnlineRequiredGate>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <OnlineRequiredGate>
            <ForgotPasswordPage />
          </OnlineRequiredGate>
        }
      />
      <Route
        path="/reset-password"
        element={
          <OnlineRequiredGate>
            <ResetPasswordPage />
          </OnlineRequiredGate>
        }
      />
      <Route
        path="/verify-email"
        element={
          <OnlineRequiredGate>
            <VerifyEmailPage />
          </OnlineRequiredGate>
        }
      />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/app" element={<ProtectedRoute />}>
        <Route index element={<RoleRedirect />} />
        <Route path="dashboard" element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>} />
        <Route path="chantiers" element={<Suspense fallback={<PageFallback />}><ChantiersPage /></Suspense>} />
        <Route path="rh" element={<Suspense fallback={<PageFallback />}><RhPage /></Suspense>} />
        <Route path="stocks" element={<Suspense fallback={<PageFallback />}><StocksPage /></Suspense>} />
        <Route path="commercial" element={<Suspense fallback={<PageFallback />}><CommercialPage /></Suspense>} />
        <Route path="finance" element={<Suspense fallback={<PageFallback />}><FinancePage /></Suspense>} />
        <Route path="materiels" element={<Suspense fallback={<PageFallback />}><MaterielsPage /></Suspense>} />
        <Route path="alertes" element={<Suspense fallback={<PageFallback />}><AlertesPage /></Suspense>} />
        <Route path="risques-climatiques" element={<Suspense fallback={<PageFallback />}><RisquesClimatiquesPage /></Suspense>} />
        <Route path="achats" element={<Suspense fallback={<PageFallback />}><AchatsPage /></Suspense>} />
        <Route path="historique-logins" element={<Suspense fallback={<PageFallback />}><HistoriqueLoginsPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>} />
        <Route path="client" element={<Suspense fallback={<PageFallback />}><ClientLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<PageFallback />}><ClientDashboard /></Suspense>} />
          <Route path="profil" element={<Suspense fallback={<PageFallback />}><ClientProfil /></Suspense>} />
          <Route path="demandes" element={<Suspense fallback={<PageFallback />}><ClientDemandesPage /></Suspense>} />
          <Route path="projets" element={<Suspense fallback={<PageFallback />}><ClientProjetsPage /></Suspense>} />
          <Route path="devis" element={<Suspense fallback={<PageFallback />}><ClientDevisPage /></Suspense>} />
          <Route path="contrats" element={<Suspense fallback={<PageFallback />}><ClientContratsPage /></Suspense>} />
          <Route path="avenants" element={<Suspense fallback={<PageFallback />}><ClientAvenantsPage /></Suspense>} />
          <Route path="chantiers" element={<Suspense fallback={<PageFallback />}><ClientChantiersPage /></Suspense>} />
          <Route path="avancement" element={<Suspense fallback={<PageFallback />}><ClientAvancementPage /></Suspense>} />
          <Route path="situations" element={<Suspense fallback={<PageFallback />}><ClientSituationsPage /></Suspense>} />
          <Route path="factures" element={<Suspense fallback={<PageFallback />}><ClientFacturesPage /></Suspense>} />
          <Route path="paiements" element={<Suspense fallback={<PageFallback />}><ClientPaiementsPage /></Suspense>} />
          <Route path="documents" element={<Suspense fallback={<PageFallback />}><ClientDocumentsPage /></Suspense>} />
          <Route path="notifications" element={<Suspense fallback={<PageFallback />}><ClientNotificationsPage /></Suspense>} />
          <Route path="parametres" element={<Suspense fallback={<PageFallback />}><ClientParametresPage /></Suspense>} />
        </Route>
        <Route path="employe" element={<Suspense fallback={<PageFallback />}><EmployeLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<PageFallback />}><EmployeDashboard /></Suspense>} />
          <Route path="profil" element={<Suspense fallback={<PageFallback />}><EmployeProfil /></Suspense>} />
          <Route path="chantiers" element={<Suspense fallback={<PageFallback />}><EmployeChantiers /></Suspense>} />
          <Route path="taches" element={<Suspense fallback={<PageFallback />}><EmployeTaches /></Suspense>} />
          <Route path="travaux" element={<Suspense fallback={<PageFallback />}><EmployeTravaux /></Suspense>} />
          <Route path="rapports" element={<Suspense fallback={<PageFallback />}><EmployeRapports /></Suspense>} />
          <Route path="photos" element={<Suspense fallback={<PageFallback />}><EmployePhotos /></Suspense>} />
          <Route path="signalements" element={<Suspense fallback={<PageFallback />}><EmployeSignalements /></Suspense>} />
                    <Route path="notifications" element={<Suspense fallback={<PageFallback />}><EmployeNotificationsPage /></Suspense>} />
          <Route path="planning" element={<Suspense fallback={<PageFallback />}><EmployePlanning /></Suspense>} />
          <Route path="documents" element={<Suspense fallback={<PageFallback />}><EmployeDocuments /></Suspense>} />
          <Route path="badge" element={<Suspense fallback={<PageFallback />}><EmployeBadge /></Suspense>} />
          <Route path="conges" element={<Suspense fallback={<PageFallback />}><EmployeConges /></Suspense>} />

        </Route>
        <Route path="pricing" element={<Suspense fallback={<PageFallback />}><PricingPage /></Suspense>} />
        <Route path="super-admin">
          <Route index element={<Suspense fallback={<PageFallback />}><SuperAdminDashboardPage /></Suspense>} />
          <Route path="entreprises" element={<Suspense fallback={<PageFallback />}><SuperAdminEntreprisesPage /></Suspense>} />
          <Route path="utilisateurs" element={<Suspense fallback={<PageFallback />}><SuperAdminUtilisateursPage /></Suspense>} />
          <Route path="abonnements" element={<Suspense fallback={<PageFallback />}><SuperAdminAbonnementsPage /></Suspense>} />
          <Route path="facturation" element={<Suspense fallback={<PageFallback />}><SuperAdminFacturationPage /></Suspense>} />
          <Route path="logs" element={<Suspense fallback={<PageFallback />}><SuperAdminLogsPage /></Suspense>} />
          <Route path="parametres" element={<Suspense fallback={<PageFallback />}><SuperAdminParametresPage /></Suspense>} />
          <Route path="email" element={<Suspense fallback={<PageFallback />}><SuperAdminMailPage /></Suspense>} />
          <Route path="paiement" element={<Suspense fallback={<PageFallback />}><SuperAdminPaiementPage /></Suspense>} />
        </Route>
      </Route>
      <Route path="*" element={<LegacyAppRedirect />} />
    </Routes>
  )
}

export default App
