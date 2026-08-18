// ============================================================================
// RBAC PERMISSIONS - TIA INFO BUILD Web
// Mapping identique au Desktop (shared/permissions.js) + nouveau rôle Super Admin
// ============================================================================

export type RoleCode =
  | "super_admin"
  | "admin_entreprise"
  | "directeur"
  | "chef_chantier"
  | "chef_projet"
  | "comptable"
  | "rh"
  | "materiel"
  | "magasinier"
  | "commercial"
  | "employe"
  | "client";

export type Role = RoleCode;

// Permissions par module - mappées depuis Desktop shared/permissions.js
export const PERMISSION_MODULES = {
  entreprises: "entreprises",
  utilisateurs: "utilisateurs",
  chantiers: "chantiers",
  phases: "phases",
  incidents: "incidents",
  affectations: "affectations",
  employes: "employes",
  pointages: "pointages",
  heures_sup: "heures_sup",
  equipes: "equipes",
  historique_postes: "historique_postes",
  materiels: "materiels",
  maintenances: "maintenances",
  alertes_materiel: "alertes_materiel",
  articles: "articles",
  mouvements_stock: "mouvements_stock",
  fournisseurs: "fournisseurs",
  clients: "clients",
  client_adresses: "client_adresses",
  devis: "devis",
  lignes_devis: "lignes_devis",
  contrats: "contrats",
  factures: "factures",
  paiements: "paiements",
  depenses: "depenses",
  rapports: "rapports",
  alertes: "alertes",
  parametres: "parametres",
  historique_connexions: "historique_connexions",
  dashboard: "dashboard",
  sync: "sync",
} as const;

// Permission map - identique Desktop + super_admin global
export const PERMISSION_MAP: Record<RoleCode, Record<string, string>> = {
  super_admin: {
    // Accès absolu à tout (nouveau rôle SaaS owner)
    "*": "*",
    entreprises: "*",
    utilisateurs: "*",
    chantiers: "*",
    phases: "*",
    incidents: "*",
    affectations: "*",
    employes: "*",
    pointages: "*",
    heures_sup: "*",
    equipes: "*",
    historique_postes: "*",
    materiels: "*",
    maintenances: "*",
    alertes_materiel: "*",
    articles: "*",
    mouvements_stock: "*",
    fournisseurs: "*",
    clients: "*",
    client_adresses: "*",
    devis: "*",
    lignes_devis: "*",
    contrats: "*",
    factures: "*",
    paiements: "*",
    depenses: "*",
    rapports: "*",
    alertes: "*",
    parametres: "*",
    historique_connexions: "*",
    dashboard: "*",
    sync: "*",
  },
  admin_entreprise: {
    // Toutes permissions entreprise (sauf gestion entreprises)
    entreprises: "read,write",
    utilisateurs: "read,write,delete",
    chantiers: "*",
    phases: "*",
    incidents: "*",
    affectations: "*",
    employes: "*",
    pointages: "*",
    heures_sup: "*",
    equipes: "*",
    historique_postes: "*",
    materiels: "*",
    maintenances: "*",
    alertes_materiel: "*",
    articles: "*",
    mouvements_stock: "*",
    fournisseurs: "*",
    clients: "*",
    client_adresses: "*",
    devis: "*",
    lignes_devis: "*",
    contrats: "*",
    factures: "*",
    paiements: "*",
    depenses: "*",
    rapports: "*",
    alertes: "*",
    parametres: "read,write",
    historique_connexions: "read",
    dashboard: "*",
    sync: "*",
  },
  directeur: {
    dashboard: "read",
    chantiers: "read",
    phases: "read",
    incidents: "read",
    employes: "read",
    pointages: "read",
    heures_sup: "read",
    equipes: "read",
    materiels: "read",
    articles: "read",
    mouvements_stock: "read",
    fournisseurs: "read",
    clients: "read",
    devis: "read",
    contrats: "read",
    factures: "read",
    paiements: "read",
    depenses: "read",
    rapports: "read",
    alertes: "read",
    historique_connexions: "read",
  },
  chef_chantier: {
    chantiers: "read,write",
    phases: "read,write",
    incidents: "read,write",
    employes: "read",
    pointages: "read,write",
    heures_sup: "read,write",
    equipes: "read",
    materiels: "read",
    affectations: "read,write",
    articles: "read",
    mouvements_stock: "read",
    depenses: "read",
    alertes: "read",
    dashboard: "read",
  },
  chef_projet: {
    chantiers: "read,write",
    phases: "read,write",
    incidents: "read,write",
    employes: "read",
    equipes: "read",
    affectations: "read,write",
    clients: "read",
    devis: "read",
    factures: "read",
    paiements: "read",
    depenses: "read",
    rapports: "read",
    dashboard: "read",
  },
  comptable: {
    finance: "read,write",
    factures: "read,write",
    paiements: "read,write",
    depenses: "read,write",
    clients: "read",
    fournisseurs: "read",
    articles: "read",
    mouvements_stock: "read",
    rapports: "read",
    alertes: "read",
    dashboard: "read",
  },
  rh: {
    employes: "read,write",
    pointages: "read,write",
    heures_sup: "read,write",
    equipes: "read,write",
    historique_postes: "read,write",
    affectation_chantiers: "read,write",
    membres_equipe: "read,write",
    chantiers: "read",
    alertes: "read",
    dashboard: "read",
  },
  materiel: {
    materiels: "read,write",
    maintenances: "read,write",
    alertes_materiel: "read,write",
    affectation_materiaux: "read,write",
    chantiers: "read",
    depenses: "read",
    rapport_financier: "read",
    alertes: "read",
    dashboard: "read",
  },
  magasinier: {
    articles: "read,write",
    mouvements_stock: "read,write",
    fournisseurs: "read,write",
    chantiers: "read",
    clients: "read",
    alertes: "read",
    depenses: "read",
    rapport_financier: "read",
    dashboard: "read",
  },
  commercial: {
    clients: "read,write",
    client_adresses: "read,write",
    devis: "read,write",
    lignes_devis: "read,write",
    contrats: "read,write",
    factures: "read,write",
    paiements: "read,write",
    chantiers: "read",
    fournisseurs: "read",
    articles: "read",
    alertes: "read",
    dashboard: "read",
  },
  employe: {
    rh: "read",
    chantiers: "read",
    pointages: "read,write",
    heures_sup: "read,write",
  },
  client: {
    commercial: "read",
    devis: "read",
    factures: "read",
  },
};

// Vérifie si l'utilisateur a la permission donnée
export function hasPermission(
  userRole: RoleCode | undefined,
  module: keyof typeof PERMISSION_MODULES,
  action: "read" | "write" | "delete" | string
): boolean {
  if (!userRole) return false;

  const rolePermissions = PERMISSION_MAP[userRole];
  if (!rolePermissions) return false;

  // Super Admin a tout
  if (rolePermissions["*"] === "*") return true;

  const modulePermission = rolePermissions[module as string];
  if (!modulePermission) return false;

  // "*" means all actions for this module
  if (modulePermission === "*") return true;

  // Parse "read,write" format
  const allowedActions = modulePermission.split(",").map((a) => a.trim());
  return allowedActions.includes(action) || allowedActions.includes("*");
}

// Vérifie si l'utilisateur peut accéder à un module entier
export function canAccessModule(
  userRole: RoleCode | undefined,
  module: keyof typeof PERMISSION_MODULES
): boolean {
  if (!userRole) return false;
  const rolePermissions = PERMISSION_MAP[userRole];
  if (!rolePermissions) return false;
  if (rolePermissions["*"] === "*") return true;
  return !!rolePermissions[module as string];
}
