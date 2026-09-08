import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

export function EmployeLayout() {
  const { user } = useAuthStore()
  if (user?.role_code !== 'employe') {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
