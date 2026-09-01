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
    '/pricing',
  ],
  admin_entreprise: [
    // Restreint selon roles_tia_builds/01_admin_entreprise.md :
    // accès uniquement à l'administration (utilisateurs, paramètres), KPI/dashboard,
    // historique de connexion et page tarifs (pricing).
    '/dashboard',
    '/historique-logins',
    '/settings',
    '/pricing',
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
    '/pricing',
  ],
  comptable: [
    '/dashboard',
    '/finance',
    '/commercial',
    '/chantiers',
    '/rh',
    '/alertes',
    '/pricing',
  ],
  chef_projet: [
    '/dashboard',
    '/chantiers',
    '/rh',
    '/materiels',
    '/stocks',
    '/finance',
    '/alertes',
    '/pricing',
  ],
  chef_chantier: [
    '/dashboard',
    '/chantiers',
    '/rh',
    '/materiels',
    '/stocks',
    '/finance',
    '/alertes',
    '/pricing',
  ],
  rh: [
    '/dashboard',
    '/rh',
    '/chantiers',
    '/alertes',
    '/pricing',
  ],
  materiel: [
    '/dashboard',
    '/materiels',
    '/chantiers',
    '/alertes',
    '/pricing',
  ],
  magasinier: [
    '/dashboard',
    '/stocks',
    '/chantiers',
    '/alertes',
    '/pricing',
  ],
  commercial: [
    '/dashboard',
    '/commercial',
    '/chantiers',
    '/finance',
    '/alertes',
    '/pricing',
  ],
  employe: [
    // Pas d'accès au dashboard global pour l'ouvrier (accès mobile limité)
    '/chantiers',
    '/rh',
    '/materiels',
    '/stocks',
    '/alertes',
    '/pricing',
  ],
  client: [
    '/dashboard',
    '/commercial',
    '/chantiers',
    '/pricing',
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
  // Actions terrain & tâches
  canReportTask: boolean
  canDeclareConsumption: boolean
  canGenerateQR: boolean

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
  canCreateFacture: boolean
  canValidateDevis: boolean
  canAddPaiement: boolean

  // Administration & Système
  canAccessSettings: boolean
  canManageUsers: boolean
  canViewAuditLogs: boolean
  // Abonnements / offres
  canManageSubscription: boolean
}

export function getRolePermissions(roleCode: string): RolePermissions {
  const role = roleCode || 'employe'
  // Pour `admin_entreprise` le périmètre est restreint (gestion utilisateurs, paramètres,
  // abonnement, KPI/dashboard et audit). Nous refusons l'accès aux modules métier.
  if (role === 'admin_entreprise') {
    return {
      // Chantiers & Phases
      canCreateChantier: false,
      canEditChantier: false,
      canDeleteChantier: false,
      canValidatePhase: false,

      // RH & Pointages
      canCreateEmploye: false,
      canEditEmploye: false,
      canDeleteEmploye: false,
      canValidatePointage: false,
      canScanQR: false,

      // Finance & Dépenses
      canCreateDepense: false,
      canValidateDepense: false,
      canExportFinance: false,

      // Stocks & Inventaires
      canCreateArticle: false,
      canAddMouvementStock: false,
      canDeleteArticle: false,

      // Matériel & Parc
      canCreateMateriel: false,
      canAddMaintenance: false,
      canAssignMateriel: false,

      // Commercial & Devis
      canCreateClient: false,
      canCreateDevis: false,
      canCreateFacture: false,
      canValidateDevis: false,
      canAddPaiement: false,

      // Administration & Système
      canAccessSettings: true,
      canManageUsers: true,
      canViewAuditLogs: true,
      // Gestion abonnement tenant
      canManageSubscription: true,
      // Actions terrain non autorisées
      canReportTask: false,
      canDeclareConsumption: false,
      canGenerateQR: false,
    }
  }
  const isAdmin = ['super_admin'].includes(role)
  const isDirecteur = role === 'directeur'
  const isChefProjet = role === 'chef_projet'
  const isChefChantier = role === 'chef_chantier'
  const isComptable = role === 'comptable'
  const isRH = role === 'rh'
  const isMateriel = role === 'materiel'
  const isMagasinier = role === 'magasinier'
  const isCommercial = role === 'commercial'
  const isEmploye = role === 'employe'

  return {
    // Chantiers
    // Création réservée à l'Admin SaaS et au Chef de Projet (DG consulte/valide)
    canCreateChantier: isAdmin || isChefProjet,
    canEditChantier: isAdmin || isChefProjet || isChefChantier,
    canDeleteChantier: isAdmin,
    canValidatePhase: isAdmin || isDirecteur || isChefProjet,

    // RH
    canCreateEmploye: isAdmin || isRH,
    canEditEmploye: isAdmin || isRH,
    canDeleteEmploye: isAdmin || isRH,
    canValidatePointage: isAdmin || isRH || isChefProjet || isChefChantier,
    // L'ouvrier doit pouvoir scanner le QR code depuis son mobile
    canScanQR: isEmploye || isAdmin || isRH || isChefChantier || isChefProjet,
    // Actions terrain & tâches
    canReportTask: isChefChantier || isChefProjet || isEmploye,
    canDeclareConsumption: isChefChantier || isMagasinier || isEmploye,
    canGenerateQR: isChefChantier || isMagasinier || isChefProjet || isAdmin,

    // Finance
    // Saisie opérationnelle : Comptable, Chef de Chantier et Chef de Projet peuvent créer
    canCreateDepense: isAdmin || isComptable || isChefProjet || isChefChantier,
    canValidateDepense: isAdmin || isDirecteur || isComptable,
    canExportFinance: isAdmin || isDirecteur || isComptable,

    // Stocks
    // Création d'articles: magasinier et admin; mouvements: magasinier et chef chantier
    canCreateArticle: isAdmin || isMagasinier,
    canAddMouvementStock: isAdmin || isMagasinier || isChefChantier,
    canDeleteArticle: isAdmin || isMagasinier,

    // Matériel
    canCreateMateriel: isAdmin || isMateriel,
    canAddMaintenance: isAdmin || isMateriel,
    canAssignMateriel: isAdmin || isMateriel || isChefProjet || isChefChantier,

    // Commercial
    canCreateClient: isAdmin || isCommercial,
    // Le Directeur valide mais ne crée pas les devis courants
    canCreateDevis: isAdmin || isCommercial,
    canCreateFacture: isAdmin || isCommercial,
    canValidateDevis: isAdmin || isDirecteur || isCommercial,
    canAddPaiement: isAdmin || isCommercial || isComptable,

    // Administration & Système
    canAccessSettings: isAdmin,
    canManageUsers: isAdmin,
    canViewAuditLogs: isAdmin || isDirecteur,
    // Abonnement (tenant)
    canManageSubscription: role === 'admin_entreprise' || isAdmin,
  }
}
