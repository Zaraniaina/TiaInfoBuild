import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Layout } from '@/components/layout/Layout'
import { ROLE_MODULES } from '@/config/roles.config'

interface ProtectedRouteProps {
  allowedRoles?: string[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, token } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }

  const roleCode = user?.role_code || 'admin_entreprise'
  const pathKey = '/' + location.pathname.split('/')[1]

  const allowed = allowedRoles || ROLE_MODULES[roleCode] || []
  if (allowed.length > 0 && !allowed.includes(pathKey) && pathKey !== '/') {
    return <Navigate to="/dashboard" replace />
  }

  return <Layout />
}
