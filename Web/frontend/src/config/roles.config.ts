/* =========================================================================
   TIA INFO BUILD - Configuration des Rôles & Permissions (RBAC)
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
    '/super-admin/email',
    '/super-admin/paiement',
    '/super-admin/parametres',
    '/dashboard',
    // NB : pas de '/risques-climatiques' — donnée métier des entreprises BTP,
    // gérée par leurs rôles responsables (directeur, chef_projet, chef_chantier,
    // admin_entreprise). Le super admin est propriétaire du SaaS, pas du chantier.
  ].map((p) => `/app${p}`),
  admin_entreprise: [
    // Restreint selon roles_tia_builds/01_admin_entreprise.md :
    // accès uniquement à l'administration (utilisateurs, paramètres), KPI/dashboard,
    // historique de connexion et page tarifs (pricing).
    // + Risques climatiques : responsable de l'entreprise (pénalités de retard
    // contractuelles liées aux aléas — sujet de direction).
    '/dashboard',
    '/risques-climatiques',
    '/historique-logins',
    '/settings',
    '/pricing',
  ].map((p) => `/app${p}`),
  directeur: [
    '/dashboard',
    '/chantiers',
    '/risques-climatiques',
    '/achats',
    '/finance',
    '/commercial',
    '/rh',
    '/materiels',
    '/stocks',
    '/alertes',
  ].map((p) => `/app${p}`),
  comptable: [
    '/dashboard',
    '/finance',
    '/commercial',
    '/chantiers',
    '/achats',
    '/rh',
    '/alertes',
  ].map((p) => `/app${p}`),
  chef_projet: [
    '/dashboard',
    '/chantiers',
    '/risques-climatiques',
    '/achats',
    '/rh',
    '/materiels',
    '/stocks',
    '/alertes',
  ].map((p) => `/app${p}`),
  chef_chantier: [
    '/dashboard',
    '/chantiers',
    '/risques-climatiques',
    '/rh',
    '/materiels',
    '/stocks',
    '/alertes',
  ].map((p) => `/app${p}`),
  rh: [
    '/dashboard',
    '/rh',
    '/chantiers',
    '/alertes',
  ].map((p) => `/app${p}`),
  materiel: [
    '/dashboard',
    '/materiels',
    '/chantiers',
    '/alertes',
  ].map((p) => `/app${p}`),
  magasinier: [
    '/dashboard',
    '/stocks',
    '/achats',
    '/chantiers',
    '/alertes',
  ].map((p) => `/app${p}`),
  commercial: [
    '/dashboard',
    '/commercial',
    '/chantiers',
    '/alertes',
  ].map((p) => `/app${p}`),
  employe: [
    '/employe',
    '/employe/profil',
    '/employe/chantiers',
    '/employe/taches',
    '/employe/travaux',
    '/employe/rapports',
    '/employe/photos',
    '/employe/signalements',
    '/employe/notifications',
    '/employe/planning',
    '/employe/documents',
    '/employe/badge',
    '/employe/conges',
  ].map((p) => `/app${p}`),
  client: [
    '/client',
    '/client/profil',
    '/client/demandes',
    '/client/projets',
    '/client/devis',
    '/client/contrats',
    '/client/avenants',
    '/client/chantiers',
    '/client/avancement',
    '/client/situations',
    '/client/factures',
    '/client/paiements',
    '/client/documents',
    '/client/notifications',
    '/client/parametres',
  ].map((p) => `/app${p}`),
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
  employe: ['Ouvrier Qualifié', 'Manoeuvre', "Conducteur d'Engin", 'Apprenti / Stagiaire'],
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
  // Actions terrain & tâches
  canReportTask: boolean
  canDeclareConsumption: boolean

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

  // Cycle commercial (Demandes, Projets, Métrés, Situations)
  canCreateDemande: boolean
  canCreateProjet: boolean
  canCreateMetre: boolean
  canCreateSituation: boolean

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

      // Cycle commercial (Demandes, Projets, Métrés, Situations)
      canCreateDemande: false,
      canCreateProjet: false,
      canCreateMetre: false,
      canCreateSituation: false,

      // Administration & Système
      canAccessSettings: true,
      canManageUsers: true,
      canViewAuditLogs: true,
      // Gestion abonnement tenant
      canManageSubscription: true,
      // Actions terrain non autorisées
      canReportTask: false,
      canDeclareConsumption: false,
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
    // Actions terrain & tâches
    canReportTask: isChefChantier || isChefProjet || isEmploye,
    canDeclareConsumption: isChefChantier || isMagasinier || isEmploye,

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
    canCreateFacture: isAdmin || isCommercial || isComptable,
    canValidateDevis: isAdmin || isDirecteur || isCommercial,
    canAddPaiement: isAdmin || isDirecteur || isComptable,

    // Cycle commercial
    canCreateDemande: isAdmin || isCommercial,
    canCreateProjet: isAdmin || isCommercial || isChefProjet,
    canCreateMetre: isAdmin || isCommercial || isChefProjet || isChefChantier,
    canCreateSituation: isAdmin || isCommercial || isChefProjet || isChefChantier,

    // Administration & Système
    canAccessSettings: isAdmin,
    canManageUsers: isAdmin,
    canViewAuditLogs: isAdmin || isDirecteur,
    // Abonnement (tenant)
    canManageSubscription: role === 'admin_entreprise' || isAdmin,
  }
}
