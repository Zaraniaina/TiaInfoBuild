import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

export function ClientLayout() {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return <Navigate to="/client-login" replace />
  }

  if (user.role_code !== 'client') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
