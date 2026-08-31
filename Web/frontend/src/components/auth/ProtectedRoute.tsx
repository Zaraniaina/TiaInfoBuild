import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Layout } from '@/components/layout/Layout'
import { ROLE_MODULES } from '@/config/roles.config'

interface ProtectedRouteProps {
  allowedRoles?: string[]
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp
    if (!exp) return true
    const now = Math.floor(Date.now() / 1000)
    return now >= exp
  } catch {
    return true
  }
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, token, refreshToken } = useAuthStore()
  const location = useLocation()
  const storedRefreshToken = refreshToken || localStorage.getItem('refresh_token')

  const expired = isTokenExpired(token)
  if (!isAuthenticated && !storedRefreshToken) {
    return <Navigate to="/login" replace />
  }

  if (expired && !storedRefreshToken) {
    return <Navigate to="/login" replace />
  }

  // Par défaut on applique le rôle le moins privilégié (employé) afin de ne jamais
  // sur-autoriser un utilisateur dont le rôle n'aurait pas pu être résolu.
  const roleCode = user?.role_code || 'employe'
  const pathKey = '/' + location.pathname.split('/')[1]

  const allowed = allowedRoles || ROLE_MODULES[roleCode] || []
  if (allowed.length > 0 && !allowed.includes(pathKey) && pathKey !== '/') {
    return <Navigate to="/dashboard" replace />
  }

  return <Layout />
}
