const ROLE_CODES = {
  ADMIN: 'ADMIN',
  COMPTABLE: 'COMPTABLE',
  DIRECTEUR: 'DIRECTEUR',
  CHEF_CHANTIER: 'CHEF_CHANTIER',
  CHEF_PROJET: 'CHEF_PROJET',
  RH: 'RH',
  MATERIEL: 'MATERIEL',
  MAGASINIER: 'MAGASINIER',
  COMMERCIAL: 'COMMERCIAL'
};

const ROLE_NAMES = {
  ADMIN: 'Administrateur d\'Entreprise',
  COMPTABLE: 'Comptable / Responsable Financier',
  DIRECTEUR: 'Direction Générale / DAF',
  CHEF_CHANTIER: 'Chef de Chantier / Conducteur de Travaux',
  CHEF_PROJET: 'Chef de Projet / Directeur Technique',
  RH: 'Responsable RH',
  MATERIEL: 'Responsable Matériel / Logisticien',
  MAGASINIER: 'Magasinier / Responsable Stock',
  COMMERCIAL: 'Commercial / Responsable Commercial'
};

const ROLE_ALIASES = {
  DIRECTION: 'DIRECTEUR'
};

const PERMISSIONS = {
  utilisateurs: ['ADMIN'],
  entreprises: { read: ['ADMIN', 'DIRECTEUR'], write: ['ADMIN', 'DIRECTEUR'] },
  chantiers: { read: ['DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'], write: ['DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET'] },
  employes: { read: ['RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'], write: ['ADMIN', 'RH'] },
  pointages: { read: ['RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'], write: ['ADMIN', 'RH', 'CHEF_CHANTIER'] },
  equipes: { read: ['RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'], write: ['ADMIN', 'RH'] },
  heuresSup: { read: ['RH', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'], write: ['ADMIN', 'RH'] },
  articles: { read: ['MAGASINIER', 'CHEF_CHANTIER'], write: ['ADMIN', 'MAGASINIER'] },
  fournisseurs: { read: ['MAGASINIER'], write: ['ADMIN', 'MAGASINIER'] },
  mouvements: { read: ['MAGASINIER', 'CHEF_CHANTIER'], write: ['ADMIN', 'MAGASINIER'] },
  materiels: { read: ['MATERIEL', 'CHEF_CHANTIER', 'CHEF_PROJET'], write: ['ADMIN', 'MATERIEL'] },
  clients: { read: ['COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'], write: ['ADMIN', 'COMMERCIAL'] },
  devis: { read: ['COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'], write: ['ADMIN', 'COMMERCIAL'] },
  contrats: { read: ['COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'], write: ['ADMIN', 'COMMERCIAL'] },
  factures: { read: ['COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'], write: ['ADMIN', 'COMMERCIAL', 'COMPTABLE'] },
  paiements: { read: ['COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'], create: ['ADMIN', 'COMMERCIAL', 'COMPTABLE'], update: ['ADMIN', 'COMMERCIAL', 'COMPTABLE'], delete: ['ADMIN', 'COMPTABLE'] },
  depenses: { read: ['COMPTABLE', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET'], write: ['ADMIN', 'COMPTABLE', 'DIRECTEUR'], validate: ['ADMIN', 'COMPTABLE', 'DIRECTEUR'] },
  alertes: { read: ['DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL'], write: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'], delete: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
  dashboard: ['DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL'],
  budgets: { read: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'CHEF_PROJET'], write: ['ADMIN', 'COMPTABLE', 'CHEF_PROJET'] },
  sousTraitants: { read: ['ADMIN', 'CHEF_CHANTIER', 'CHEF_PROJET'], write: ['ADMIN', 'CHEF_CHANTIER'] },
  catalogues: { read: ['ADMIN', 'COMMERCIAL'], write: ['ADMIN', 'COMMERCIAL'] },
  notifications: { read: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL'], write: ['ADMIN'], delete: ['ADMIN'] }
};

function normalizeRoleCode(code) {
  if (!code) return null;
  const upper = code.toUpperCase().trim();
  return ROLE_ALIASES[upper] || upper;
}

function hasPermission(module, action, roleCodes) {
  const normalized = roleCodes.map(r => normalizeRoleCode(r)).filter(Boolean);
  const isAdmin = normalized.includes('ADMIN');
  if (isAdmin) return true;

  const perm = PERMISSIONS[module];
  if (!perm) return false;

  const required = Array.isArray(perm) ? perm : (perm[action] || perm.read || []);
  return normalized.some(r => required.includes(r));
}

function getRoleLabel(roleId) {
  const labels = {
    1: 'Administrateur',
    2: 'Comptable',
    3: 'Direction Générale',
    4: 'Chef de Chantier',
    5: 'Chef de Projet',
    6: 'Responsable RH',
    7: 'Responsable Matériel',
    8: 'Magasinier',
    9: 'Commercial'
  };
  return labels[roleId] || 'Collaborateur';
}

module.exports = {
  ROLE_CODES,
  ROLE_NAMES,
  ROLE_ALIASES,
  PERMISSIONS,
  normalizeRoleCode,
  hasPermission,
  getRoleLabel
};
