/* =========================================================================
   TIA INFO BUILD — Configuration des Rôles & Permissions (RBAC)
   Aligné à 100% sur le référentiel roles_tia_builds (11 Rôles Principaux & Sous-rôles).
   ========================================================================= */

export const ROLE_MODULES: Record<string, string[]> = {
  super_admin: [
    '/super-admin',
    '/super-admin/entreprises',
    '/super-admin/utilisateurs',
    '/super-admin/abonnements',
    '/super-admin/facturation',
    '/super-admin/logs',
    '/super-admin/parametres',
    '/dashboard',
  ],
  admin_entreprise: [
    '/dashboard',
    '/chantiers',
    '/finance',
    '/rh',
    '/materiels',
    '/stocks',
    '/commercial',
    '/alertes',
    '/historique-logins',
    '/settings',
  ],
  directeur: [
    '/dashboard',
    '/chantiers',
    '/finance',
    '/commercial',
    '/rh',
    '/materiels',
    '/stocks',
    '/alertes',
  ],
  comptable: [
    '/dashboard',
    '/finance',
    '/commercial',
    '/chantiers',
    '/rh',
    '/alertes',
  ],
  chef_projet: [
    '/dashboard',
    '/chantiers',
    '/rh',
    '/materiels',
    '/stocks',
    '/finance',
    '/alertes',
  ],
  chef_chantier: [
    '/dashboard',
    '/chantiers',
    '/rh',
    '/materiels',
    '/stocks',
    '/finance',
    '/alertes',
  ],
  rh: [
    '/dashboard',
    '/rh',
    '/chantiers',
    '/alertes',
  ],
  materiel: [
    '/dashboard',
    '/materiels',
    '/chantiers',
    '/alertes',
  ],
  magasinier: [
    '/dashboard',
    '/stocks',
    '/chantiers',
    '/alertes',
  ],
  commercial: [
    '/dashboard',
    '/commercial',
    '/chantiers',
    '/finance',
    '/alertes',
  ],
  employe: [
    '/dashboard',
    '/chantiers',
    '/rh',
    '/materiels',
    '/stocks',
    '/alertes',
  ],
  client: [
    '/dashboard',
    '/commercial',
    '/chantiers',
  ],
}

export const ROLE_NAMES: Record<string, string> = {
  super_admin: 'Super Admin SaaS',
  admin_entreprise: 'Admin Entreprise',
  directeur: 'Direction Générale / DAF',
  comptable: 'Comptable / Resp. Financier',
  chef_projet: 'Chef de Projet / Dir. Technique',
  chef_chantier: 'Chef de Chantier / Conducteur',
  rh: 'Responsable RH',
  materiel: 'Responsable Matériel / Parc',
  magasinier: 'Magasinier / Resp. Stocks',
  commercial: 'Responsable Commercial',
  employe: 'Ouvrier / Employé de Terrain',
  client: 'Client',
}

export const ROLE_DASHBOARD_TITLE: Record<string, string> = {
  super_admin: 'Supervision SaaS & Tenants',
  admin_entreprise: 'Administration & Supervision Technique',
  directeur: 'Pilotage Stratégique & Validations',
  comptable: 'Gestion Financière & Comptabilité',
  chef_projet: 'Supervision Multi-Projets & Arbitrage',
  chef_chantier: 'Suivi Chantier & Équipe Terrain',
  rh: 'Gestion RH & Validations Pointages',
  materiel: 'Parc Matériel & Maintenances',
  magasinier: 'Gestion Stocks & Approvisionnement',
  commercial: 'Performance Commerciale & Pipeline',
  employe: 'Mon Espace Terrain & Badge QR',
  client: 'Espace Suivi Projet Client',
}

export const SUB_ROLES: Record<string, string[]> = {
  super_admin: ['Administrateur Système SaaS', 'Support Technique SaaS'],
  admin_entreprise: ['Administrateur Système', 'Administrateur Fonctionnel'],
  directeur: ['Directeur Général', 'Directeur Administratif et Financier (DAF)'],
  comptable: ['Responsable Financier / Contrôleur de Gestion', 'Comptable', 'Assistant Comptable / Paie'],
  chef_projet: ['Directeur Technique', 'Chef de Projet Multi-Chantiers'],
  chef_chantier: ['Conducteur de Travaux', 'Chef de Chantier', "Chef d'Équipe"],
  rh: ['Responsable RH', 'Gestionnaire Paie', 'Assistant RH'],
  materiel: ['Responsable Matériel / Parc', 'Technicien Maintenance', "Chauffeur / Conducteur d'Engin"],
  magasinier: ['Responsable Stocks / Approvisionnement', 'Magasinier Entrepôt', 'Livreur / Chauffeur Logistique'],
  commercial: ['Responsable Commercial', "Chargé d'Affaires", 'Assistant Commercial / ADV'],
  employe: ['Ouvrier Qualifié', 'Manœuvre', "Conducteur d'Engin", 'Apprenti / Stagiaire'],
  client: ['Client Maître d\'Ouvrage', 'Représentant Client'],
}

export interface RolePermissions {
  // Chantiers & Phases
  canCreateChantier: boolean
  canEditChantier: boolean
  canDeleteChantier: boolean
  canValidatePhase: boolean

  // RH & Pointages
  canCreateEmploye: boolean
  canEditEmploye: boolean
  canDeleteEmploye: boolean
  canValidatePointage: boolean
  canScanQR: boolean

  // Finance & Dépenses
  canCreateDepense: boolean
  canValidateDepense: boolean
  canExportFinance: boolean

  // Stocks & Inventaires
  canCreateArticle: boolean
  canAddMouvementStock: boolean
  canDeleteArticle: boolean

  // Matériel & Parc
  canCreateMateriel: boolean
  canAddMaintenance: boolean
  canAssignMateriel: boolean

  // Commercial & Devis
  canCreateClient: boolean
  canCreateDevis: boolean
  canValidateDevis: boolean
  canAddPaiement: boolean

  // Administration & Système
  canAccessSettings: boolean
  canManageUsers: boolean
  canViewAuditLogs: boolean
}

export function getRolePermissions(roleCode: string): RolePermissions {
  const role = roleCode || 'employe'
  const isAdmin = ['super_admin', 'admin_entreprise'].includes(role)
  const isDirecteur = role === 'directeur'
  const isChefProjet = role === 'chef_projet'
  const isChefChantier = role === 'chef_chantier'
  const isComptable = role === 'comptable'
  const isRH = role === 'rh'
  const isMateriel = role === 'materiel'
  const isMagasinier = role === 'magasinier'
  const isCommercial = role === 'commercial'

  return {
    // Chantiers
    canCreateChantier: isAdmin || isDirecteur || isChefProjet,
    canEditChantier: isAdmin || isDirecteur || isChefProjet || isChefChantier,
    canDeleteChantier: isAdmin,
    canValidatePhase: isAdmin || isDirecteur || isChefProjet,

    // RH
    canCreateEmploye: isAdmin || isRH || isDirecteur,
    canEditEmploye: isAdmin || isRH,
    canDeleteEmploye: isAdmin || isRH,
    canValidatePointage: isAdmin || isRH || isChefProjet || isChefChantier,
    canScanQR: isAdmin || isRH || isChefChantier || isChefProjet,

    // Finance
    canCreateDepense: isAdmin || isComptable || isDirecteur || isChefProjet || isChefChantier,
    canValidateDepense: isAdmin || isDirecteur || isComptable,
    canExportFinance: isAdmin || isDirecteur || isComptable,

    // Stocks
    canCreateArticle: isAdmin || isMagasinier || isDirecteur,
    canAddMouvementStock: isAdmin || isMagasinier || isChefChantier || isChefProjet,
    canDeleteArticle: isAdmin || isMagasinier,

    // Matériel
    canCreateMateriel: isAdmin || isMateriel || isDirecteur,
    canAddMaintenance: isAdmin || isMateriel,
    canAssignMateriel: isAdmin || isMateriel || isChefProjet || isChefChantier,

    // Commercial
    canCreateClient: isAdmin || isCommercial || isDirecteur,
    canCreateDevis: isAdmin || isCommercial || isDirecteur,
    canValidateDevis: isAdmin || isDirecteur || isCommercial,
    canAddPaiement: isAdmin || isCommercial || isComptable,

    // Administration & Système
    canAccessSettings: isAdmin,
    canManageUsers: isAdmin,
    canViewAuditLogs: isAdmin || isDirecteur,
  }
}
