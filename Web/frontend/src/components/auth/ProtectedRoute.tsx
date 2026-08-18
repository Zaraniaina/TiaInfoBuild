import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Layout } from '@/components/layout/Layout'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Layout />
}
