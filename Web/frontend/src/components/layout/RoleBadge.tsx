interface RoleBadgeProps {
  roleCode: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_entreprise: 'Admin',
  directeur: 'Direction',
  chef_chantier: 'Chef Chantier',
  chef_projet: 'Chef Projet',
  comptable: 'Comptable',
  rh: 'RH',
  materiel: 'Matériel',
  magasinier: 'Magasinier',
  commercial: 'Commercial',
  employe: 'Employé',
  client: 'Client',
}

export function RoleBadge({ roleCode }: RoleBadgeProps) {
  const getBadgeClass = (code: string): string => {
    if (code === 'super_admin') return 'badge bg-danger'
    if (code === 'admin_entreprise') return 'badge bg-primary'
    if (['directeur', 'chef_projet'].includes(code)) return 'badge bg-info'
    if (['chef_chantier', 'rh', 'comptable'].includes(code)) return 'badge bg-warning text-dark'
    return 'badge bg-secondary'
  }

  return <span className={getBadgeClass(roleCode)}>{ROLE_LABELS[roleCode] || roleCode}</span>
}
