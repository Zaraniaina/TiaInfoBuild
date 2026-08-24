import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Layout } from '@/components/layout/Layout'

interface ProtectedRouteProps {
  allowedRoles?: string[]
}

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard': ['*'],
  '/chantiers': ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'commercial', 'employe', 'super_admin', 'client'],
  '/rh': ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'rh', 'employe', 'super_admin'],
  '/stocks': ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'magasinier', 'employe', 'super_admin'],
  '/commercial': ['admin_entreprise', 'directeur', 'comptable', 'commercial', 'super_admin', 'client'],
  '/finance': ['admin_entreprise', 'directeur', 'comptable', 'super_admin'],
  '/materiels': ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'materiel', 'employe', 'super_admin'],
  '/alertes': ['admin_entreprise', 'directeur', 'chef_projet', 'chef_chantier', 'rh', 'materiel', 'magasinier', 'commercial', 'comptable', 'super_admin'],
  '/historique-logins': ['super_admin', 'admin_entreprise'],
  '/settings': ['admin_entreprise', 'super_admin'],
  '/client': ['client'],
  '/super-admin': ['super_admin']
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const roleCode = user?.role_code || 'employe'
  const pathKey = '/' + location.pathname.split('/')[1]

  // Role authorization check
  const allowed = allowedRoles || ROUTE_PERMISSIONS[pathKey] || ['*']
  if (allowed[0] !== '*' && !allowed.includes(roleCode)) {
    alert(`Accès refusé : Le rôle "${roleCode.toUpperCase()}" n'est pas autorisé à accéder à ${location.pathname}.`)
    return <Navigate to="/dashboard" replace />
  }

  return <Layout />
}
