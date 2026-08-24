import { usePermissions } from '@/hooks/usePermissions'

interface PermissionGuardProps {
  permission?: string
  module?: string
  anyOf?: string[]
  children: React.ReactNode
}

export function PermissionGuard({ permission, module, anyOf, children }: PermissionGuardProps) {
  const { hasPermission, canAccess } = usePermissions()

  if (permission && !hasPermission(permission)) return null
  if (module && !canAccess(module)) return null
  if (anyOf && !anyOf.some(p => hasPermission(p) || (p.startsWith('/') ? canAccess(p) : false))) return null

  return <>{children}</>
}
