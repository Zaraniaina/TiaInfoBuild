import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/services/api'
import { Layout } from '@/components/layout/Layout'
import { ROLE_MODULES } from '@/config/roles.config'
import { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  allowedRoles?: string[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, token, setUser, logout } = useAuthStore()
  const location = useLocation()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const checkAuth = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me')
          if (isMounted && res.data?.user) {
            setUser(res.data.user)
          }
        } catch {
          if (isMounted) {
            logout()
          }
        }
      }
      if (isMounted) setLoading(false)
    }
    checkAuth()
    return () => {
      isMounted = false
    }
  }, [token, setUser, logout])

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
      </div>
    )
  }

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
