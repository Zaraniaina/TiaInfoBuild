import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { PERMISSION_MAP } from '@/utils/permissions'
import type { RoleCode } from '@/utils/permissions'

interface PermissionGuardProps {
  permission: string
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const { user } = useAuthStore()
  const permissions = PERMISSION_MAP[user?.role_code as RoleCode] || []
  const hasAccess = permissions['*'] === '*' || permissions[permission] === '*' || permissions[permission]?.includes('read')

  if (!hasAccess) return <>{fallback}</>
  return <>{children}</>
}
