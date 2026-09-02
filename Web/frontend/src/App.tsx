import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { scheduleTokenRefresh, cancelTokenRefresh } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ClientLoginPage } from '@/pages/auth/ClientLoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ChantiersPage } from '@/pages/chantiers/ChantiersPage'
import { RhPage } from '@/pages/rh/RhPage'
import { StocksPage } from '@/pages/stocks/StocksPage'
import { CommercialPage } from '@/pages/commercial/CommercialPage'
import { FinancePage } from '@/pages/finance/FinancePage'
import { MaterielsPage } from '@/pages/materiels/MaterielsPage'
import { AlertesPage } from '@/pages/alertes/AlertesPage'
import { HistoriqueLoginsPage } from '@/pages/historique-logins/HistoriqueLoginsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { SuperAdminDashboardPage } from '@/pages/super-admin/SuperAdminDashboardPage'
import { SuperAdminEntreprisesPage } from '@/pages/super-admin/SuperAdminEntreprisesPage'
import { SuperAdminUtilisateursPage } from '@/pages/super-admin/SuperAdminUtilisateursPage'
import { SuperAdminAbonnementsPage } from '@/pages/super-admin/SuperAdminAbonnementsPage'
import { SuperAdminFacturationPage } from '@/pages/super-admin/SuperAdminFacturationPage'
import { SuperAdminLogsPage } from '@/pages/super-admin/SuperAdminLogsPage'
import { SuperAdminParametresPage } from '@/pages/super-admin/SuperAdminParametresPage'
import { ClientPage } from '@/pages/client/ClientPage'
import { EmployePage } from '@/pages/employe/EmployePage'
import { RoleRedirect } from '@/components/auth/RoleRedirect'
import { PricingPage } from '@/pages/pricing/PricingPage'

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
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="chantiers" element={<ChantiersPage />} />
        <Route path="rh" element={<RhPage />} />
        <Route path="stocks" element={<StocksPage />} />
        <Route path="commercial" element={<CommercialPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="materiels" element={<MaterielsPage />} />
        <Route path="alertes" element={<AlertesPage />} />
        <Route path="historique-logins" element={<HistoriqueLoginsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      <Route path="client" element={<ClientPage />} />
      <Route path="employe" element={<EmployePage />} />
      <Route path="pricing" element={<PricingPage />} />
        <Route path="super-admin">
          <Route index element={<SuperAdminDashboardPage />} />
          <Route path="entreprises" element={<SuperAdminEntreprisesPage />} />
          <Route path="utilisateurs" element={<SuperAdminUtilisateursPage />} />
          <Route path="abonnements" element={<SuperAdminAbonnementsPage />} />
          <Route path="facturation" element={<SuperAdminFacturationPage />} />
          <Route path="logs" element={<SuperAdminLogsPage />} />
          <Route path="parametres" element={<SuperAdminParametresPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
