import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Layout } from '@/components/layout/Layout'
import { ROLE_MODULES } from '@/config/roles.config'
import { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  allowedRoles?: string[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (!hydrated) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const roleCode = user?.role_code || 'employe'
  const pathKey = '/' + location.pathname.split('/')[1]

  const allowed = allowedRoles || ROLE_MODULES[roleCode] || []
  if (allowed.length > 0 && !allowed.includes(pathKey)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Layout />
}
