import { useAuthStore } from '@/stores/auth.store'
import { ROLE_MODULES, ROLE_NAMES } from '@/config/roles.config'

export type Permission = string

const ALL_PERMISSIONS: Permission[] = [
  'dashboard:read',
  'chantiers:read', 'chantiers:write', 'chantiers:delete',
  'rh:read', 'rh:write', 'rh:delete',
  'stocks:read', 'stocks:write', 'stocks:delete',
  'commercial:read', 'commercial:write', 'commercial:delete',
  'finance:read', 'finance:write', 'finance:delete',
  'materiels:read', 'materiels:write', 'materiels:delete',
  'alertes:read', 'alertes:write',
  'parametres:read', 'parametres:write',
  'super_admin:read', 'super_admin:write',
]

const PERMISSION_MAP: Record<string, Permission[]> = {
  super_admin: ['*'],
  admin_entreprise: ALL_PERMISSIONS,
  directeur: [
    'dashboard:read',
    'chantiers:read',
    'finance:read',
    'commercial:read', 'commercial:write',
    'rh:read',
    'materiels:read',
    'stocks:read',
    'alertes:read',
  ],
  chef_chantier: [
    'dashboard:read',
    'chantiers:read', 'chantiers:write',
    'rh:read', 'rh:write',
    'materiels:read',
    'stocks:read', 'stocks:write',
    'finance:read',
    'alertes:read',
  ],
  chef_projet: [
    'dashboard:read',
    'chantiers:read', 'chantiers:write', 'chantiers:delete',
    'rh:read', 'rh:write',
    'materiels:read', 'materiels:write',
    'stocks:read',
    'finance:read',
    'alertes:read',
  ],
  comptable: [
    'dashboard:read',
    'finance:read', 'finance:write', 'finance:delete',
    'commercial:read', 'commercial:write',
    'chantiers:read',
    'rh:read',
    'alertes:read',
  ],
  rh: [
    'dashboard:read',
    'rh:read', 'rh:write', 'rh:delete',
    'chantiers:read',
    'alertes:read',
  ],
  materiel: [
    'dashboard:read',
    'materiels:read', 'materiels:write', 'materiels:delete',
    'chantiers:read',
    'alertes:read',
  ],
  magasinier: [
    'dashboard:read',
    'stocks:read', 'stocks:write', 'stocks:delete',
    'chantiers:read',
    'alertes:read',
  ],
  commercial: [
    'dashboard:read',
    'commercial:read', 'commercial:write', 'commercial:delete',
    'chantiers:read',
    'finance:read',
    'alertes:read',
  ],
  employe: [
    'dashboard:read',
    'rh:read',
    'chantiers:read',
    'materiels:read',
    'stocks:read', 'stocks:write',
    'alertes:read',
  ],
  client: [
    'dashboard:read',
    'commercial:read',
    'chantiers:read',
  ],
}

export function usePermissions() {
  const { user } = useAuthStore()
  const roleCode = user?.role_code || 'employe'
  const permissions = PERMISSION_MAP[roleCode] || []
  const allowedModules = ROLE_MODULES[roleCode] || []
  const roleName = ROLE_NAMES[roleCode] || roleCode

  const hasPermission = (permission: Permission): boolean => {
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  }

  const canAccess = (path: string): boolean => {
    if (allowedModules.includes('*')) return true
    return allowedModules.includes(path)
  }

  const isSuperAdmin = roleCode === 'super_admin'
  const isAdminEntreprise = roleCode === 'admin_entreprise'
  const isDirecteur = roleCode === 'directeur'
  const isComptable = roleCode === 'comptable'
  const isChefChantier = roleCode === 'chef_chantier'
  const isChefProjet = roleCode === 'chef_projet'
  const isRH = roleCode === 'rh'
  const isMateriel = roleCode === 'materiel'
  const isMagasinier = roleCode === 'magasinier'
  const isCommercial = roleCode === 'commercial'
  const isEmploye = roleCode === 'employe'
  const isClient = roleCode === 'client'

  return {
    roleCode,
    roleName,
    permissions,
    allowedModules,
    hasPermission,
    canAccess,
    isSuperAdmin,
    isAdminEntreprise,
    isDirecteur,
    isComptable,
    isChefChantier,
    isChefProjet,
    isRH,
    isMateriel,
    isMagasinier,
    isCommercial,
    isEmploye,
    isClient,
  }
}
