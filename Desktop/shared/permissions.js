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
  chantiers: ['ADMIN', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET'],
  employes: { read: ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'], write: ['ADMIN', 'RH'] },
  pointages: ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'],
  equipes: ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'],
  heuresSup: ['ADMIN', 'RH', 'DIRECTEUR', 'COMPTABLE'],
  articles: ['ADMIN', 'MAGASINIER', 'CHEF_CHANTIER'],
  fournisseurs: ['ADMIN', 'MAGASINIER'],
  mouvements: ['ADMIN', 'MAGASINIER', 'CHEF_CHANTIER'],
  materiels: ['ADMIN', 'MATERIEL', 'CHEF_CHANTIER'],
  clients: ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  devis: ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  contrats: ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  factures: ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  paiements: ['ADMIN', 'COMMERCIAL', 'COMPTABLE'],
  depenses: { read: ['ADMIN', 'COMPTABLE', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET'], write: ['ADMIN', 'COMPTABLE', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET'], validate: ['ADMIN', 'COMPTABLE', 'DIRECTEUR'] },
  alertes: { read: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL'], write: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'], delete: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
  dashboard: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL']
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
