import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { ROLE_MODULES } from '@/config/roles.config'

export function RoleRedirect() {
  const navigate = useNavigate()
  const roleCode = useAuthStore((s) => s.user?.role_code) || 'employe'
  const allowed = ROLE_MODULES[roleCode] || []
  const target = allowed[0] || '/app/employe'

  useEffect(() => {
    navigate(target, { replace: true })
  }, [navigate, target])

  return null
}
