/**
 * Layout.js - App Shell avec gestion des espaces par rôle (RBAC)
 * Rôles supportés :
 *   ADMIN, DIRECTEUR, CHEF_CHANTIER, CHEF_PROJET,
 *   COMPTABLE, RESPONSABLE_RH, RESPONSABLE_MATERIEL,
 *   MAGASINIER, COMMERCIAL
 */

// ============================================================
// CONFIGURATION RBAC — Espaces par rôle
// ============================================================
const ROLE_SPACES = {
  ADMIN: {
    label: 'Administration',
    icon: 'bi-shield-lock',
    sections: ['pilotage', 'chantiers', 'rh', 'materiel', 'stocks', 'commercial', 'finance', 'administration']
  },
  DIRECTEUR: {
    label: 'Direction',
    icon: 'bi-graph-up-arrow',
    sections: ['pilotage', 'chantiers', 'finance']
  },
  CHEF_CHANTIER: {
    label: 'Terrain',
    icon: 'bi-building',
    sections: ['pilotage', 'chantiers', 'rh', 'materiel', 'stocks']
  },
  CHEF_PROJET: {
    label: 'Projets',
    icon: 'bi-kanban',
    sections: ['pilotage', 'chantiers']
  },
  COMPTABLE: {
    label: 'Comptabilité',
    icon: 'bi-calculator',
    sections: ['finance', 'commercial']
  },
  RH: {
    label: 'Ressources Humaines',
    icon: 'bi-people',
    sections: ['rh']
  },
  MATERIEL: {
    label: 'Logistique',
    icon: 'bi-tools',
    sections: ['materiel']
  },
  MAGASINIER: {
    label: 'Entrepôt',
    icon: 'bi-box-seam',
    sections: ['stocks']
  },
  COMMERCIAL: {
    label: 'Commercial',
    icon: 'bi-briefcase',
    sections: ['commercial']
  }
};

// Routes autorisées par rôle
const ROLE_ROUTES = {
  ADMIN: ['dashboard', 'chantiers', 'employes', 'pointages', 'equipes', 'heures-sup', 'materiels', 'stocks', 'fournisseurs', 'mouvements', 'clients', 'devis', 'contrats', 'factures', 'paiements', 'finances', 'depenses', 'rapports', 'alertes', 'utilisateurs', 'parametres'],
  DIRECTEUR: ['dashboard', 'chantiers', 'finances', 'depenses', 'rapports', 'alertes', 'employes', 'pointages', 'equipes', 'materiels', 'fournisseurs', 'clients', 'devis', 'contrats', 'factures'],
  CHEF_CHANTIER: ['dashboard', 'chantiers', 'pointages', 'materiels', 'stocks', 'mouvements', 'alertes'],
  CHEF_PROJET: ['dashboard', 'chantiers', 'alertes', 'pointages', 'employes', 'equipes'],
  COMPTABLE: ['dashboard', 'finances', 'depenses', 'rapports', 'alertes', 'factures', 'paiements', 'clients', 'contrats', 'fournisseurs', 'employes', 'pointages', 'equipes'],
  RH: ['dashboard', 'employes', 'pointages', 'equipes', 'heures-sup', 'alertes'],
  MATERIEL: ['dashboard', 'materiels', 'alertes', 'chantiers'],
  MAGASINIER: ['dashboard', 'stocks', 'fournisseurs', 'mouvements', 'alertes'],
  COMMERCIAL: ['dashboard', 'clients', 'devis', 'contrats', 'factures', 'paiements', 'alertes']
};

const PERMISSION_MAP = {
  'chantiers:create': ['ADMIN', 'DIRECTEUR', 'CHEF_PROJET'],
  'chantiers:update': ['ADMIN', 'DIRECTEUR', 'CHEF_PROJET'],
  'chantiers:delete': ['ADMIN', 'DIRECTEUR'],
  'employes:list': ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'],
  'employes:get': ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'],
  'employes:create': ['ADMIN', 'RH'],
  'employes:update': ['ADMIN', 'RH'],
  'employes:delete': ['ADMIN', 'RH'],
  'pointages:list': ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'],
  'pointages:create': ['ADMIN', 'RH', 'CHEF_CHANTIER'],
  'pointages:update': ['ADMIN', 'RH'],
  'pointages:delete': ['ADMIN', 'RH'],
  'heures-sup:list': ['ADMIN', 'RH', 'DIRECTEUR', 'COMPTABLE'],
  'heures-sup:create': ['ADMIN', 'RH'],
  'heures-sup:update': ['ADMIN', 'RH'],
  'heures-sup:delete': ['ADMIN', 'RH'],
  'equipes:list': ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'],
  'equipes:create': ['ADMIN', 'RH'],
  'equipes:update': ['ADMIN', 'RH'],
  'equipes:delete': ['ADMIN', 'RH'],
  'articles:list': ['ADMIN', 'MAGASINIER', 'CHEF_CHANTIER', 'DIRECTEUR', 'COMPTABLE'],
  'articles:create': ['ADMIN', 'MAGASINIER'],
  'articles:update': ['ADMIN', 'MAGASINIER'],
  'articles:delete': ['ADMIN', 'MAGASINIER'],
  'fournisseurs:list': ['ADMIN', 'MAGASINIER', 'DIRECTEUR', 'COMPTABLE'],
  'fournisseurs:create': ['ADMIN', 'MAGASINIER'],
  'fournisseurs:update': ['ADMIN', 'MAGASINIER'],
  'fournisseurs:delete': ['ADMIN', 'MAGASINIER'],
  'mouvements:list': ['ADMIN', 'MAGASINIER', 'CHEF_CHANTIER'],
  'mouvements:create': ['ADMIN', 'MAGASINIER', 'CHEF_CHANTIER'],
  'mouvements:delete': ['ADMIN', 'MAGASINIER'],
  'materiels:list': ['ADMIN', 'MATERIEL', 'CHEF_CHANTIER', 'DIRECTEUR'],
  'materiels:create': ['ADMIN', 'MATERIEL'],
  'materiels:update': ['ADMIN', 'MATERIEL'],
  'materiels:delete': ['ADMIN', 'MATERIEL'],
  'clients:list': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'clients:create': ['ADMIN', 'COMMERCIAL'],
  'clients:update': ['ADMIN', 'COMMERCIAL'],
  'clients:delete': ['ADMIN', 'COMMERCIAL'],
  'devis:list': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR'],
  'devis:create': ['ADMIN', 'COMMERCIAL'],
  'devis:update': ['ADMIN', 'COMMERCIAL'],
  'devis:delete': ['ADMIN', 'COMMERCIAL'],
  'contrats:list': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR'],
  'contrats:create': ['ADMIN', 'COMMERCIAL'],
  'contrats:update': ['ADMIN', 'COMMERCIAL'],
  'factures:list': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'factures:create': ['ADMIN', 'COMMERCIAL', 'COMPTABLE'],
  'factures:update': ['ADMIN', 'COMMERCIAL', 'COMPTABLE'],
  'factures:dupliquer': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'factures:envoyer': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'paiements:list': ['ADMIN', 'COMMERCIAL', 'COMPTABLE'],
  'paiements:create': ['ADMIN', 'COMMERCIAL', 'COMPTABLE'],
  'depenses:list': ['ADMIN', 'COMPTABLE', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET'],
  'depenses:create': ['ADMIN', 'COMPTABLE', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET'],
  'depenses:update': ['ADMIN', 'COMPTABLE', 'DIRECTEUR'],
  'depenses:delete': ['ADMIN', 'COMPTABLE', 'DIRECTEUR'],
  'factures:ajouterPaiement': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'devis:transformerEnContrat': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'rapports:list': ['ADMIN', 'DIRECTEUR', 'COMPTABLE'],
  'alertes:list': ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL'],
  'dashboard:list': ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL']
};

const ROLE_CODE_ALIASES = {
  ADMIN: ['admin', 'administrateur', 'administration'],
  DIRECTEUR: ['direction', 'daf', 'directeur'],
  COMPTABLE: ['comptable', 'finance'],
  RH: ['rh', 'responsable rh', 'responsablerh'],
  MATERIEL: ['materiel', 'responsable materiel', 'responsable_materiel', 'logisticien'],
  MAGASINIER: ['magasinier', 'stock'],
  COMMERCIAL: ['commercial'],
  CHEF_CHANTIER: ['chef de chantier', 'conducteur', 'chef_chantier'],
  CHEF_PROJET: ['chef de projet', 'chef_projet']
};

function normalizeRoleCode(rawRole) {
  if (!rawRole) return 'ADMIN';
  const normalized = rawRole.toString().trim().toUpperCase();
  if (ROLE_SPACES[normalized]) return normalized;
  for (const [code, aliases] of Object.entries(ROLE_CODE_ALIASES)) {
    if (aliases.some(alias => normalized.includes(alias.toUpperCase()))) return code;
  }
  return 'ADMIN';
}

function getUserRoles(roleValue) {
  if (!roleValue) return ['ADMIN'];
  const rawCodes = Array.isArray(roleValue)
    ? roleValue
    : roleValue.toString().split(/[,;|]+/);
  const roles = rawCodes.map(code => normalizeRoleCode(code)).filter(Boolean);
  return roles.length ? Array.from(new Set(roles)) : ['ADMIN'];
}

function isRoleAllowed(allowedRoles, currentRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return currentRoles.some(role => allowedRoles.includes(role));
}

function hasPermission(action, module) {
  const permissionKey = `${module}:${action}`;
  const currentRoles = getUserRoles(window.AppState.roleCode);
  const allowed = PERMISSION_MAP[permissionKey];
  return isRoleAllowed(allowed, currentRoles);
}

// État global
window.AppState = {
  user: null,
  entreprise: null,
  role: null,
  roleCode: null,
  isOnline: navigator.onLine,
  syncStatus: 'offline',
  lastSync: null
};

// ============================================================
// INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserSession();
  if (!window.AppState.user) return;

  initSidebar();
  initTopbar();
  initUserMenu();
  initSyncButton();
  initLogout();
  initOnlineDetection();
  initPermissionObserver();
  setupRouterGuards();
});

// ============================================================
// SESSION & RÔLE
// ============================================================
async function loadUserSession() {
  try {
    const stored = localStorage.getItem('currentUser');
    if (!stored) {
      window.location.href = 'index.html';
      return;
    }
    const user = JSON.parse(stored);
    if (!user || !user.id) {
      window.location.href = 'index.html';
      return;
    }

    window.AppState.user = user;
    window.AppState.entreprise = {
      id: user.entrepriseId || 1,
      nom: user.entrepriseNom || 'TIA Construction'
    };

    const roleCode = normalizeRoleCode(user.roleCode || user.roleNom || 'ADMIN');
    window.AppState.roleCode = roleCode;
    window.AppState.role = ROLE_SPACES[roleCode] || ROLE_SPACES.ADMIN;
    window.AppState.roles = getUserRoles(user.roleCode || user.roleNom || 'ADMIN');

    updateUserUI(user);
    filterSidebarByRole(roleCode);
  } catch (error) {
    console.error('Erreur chargement session:', error);
    window.location.href = 'index.html';
  }
}

function hasAccess(route) {
  const roleCode = window.AppState.roleCode || 'ADMIN';
  const allowed = ROLE_ROUTES[roleCode] || ROLE_ROUTES.ADMIN;
  return allowed.includes(route);
}

// ============================================================
// SIDEBAR — Filtrage par rôle
// ============================================================
function filterSidebarByRole(roleCode) {
  const currentRoles = getUserRoles(roleCode);
  const allowedSections = (ROLE_SPACES[roleCode] || ROLE_SPACES.ADMIN).sections;

  document.querySelectorAll('.sidebar-link[data-route]').forEach(link => {
    const route = link.dataset.route;
    const linkRoles = link.dataset.roles ? link.dataset.roles.split(',').map(r => normalizeRoleCode(r)) : null;
    const visible = linkRoles ? isRoleAllowed(linkRoles, currentRoles) : hasAccess(route);
    link.style.display = visible ? '' : 'none';
  });

  document.querySelectorAll('.sidebar-section-label').forEach(label => {
    const section = label.dataset.section;
    const labelRoles = label.dataset.roles ? label.dataset.roles.split(',').map(r => normalizeRoleCode(r)) : null;
    let visible = true;
    if (labelRoles) {
      visible = isRoleAllowed(labelRoles, currentRoles);
    } else if (section) {
      visible = allowedSections.includes(section);
    }

    label.style.display = visible ? '' : 'none';
    let next = label.nextElementSibling;
    while (next && !next.classList.contains('sidebar-section-label')) {
      if (next.classList.contains('sidebar-link')) {
        if (!visible) {
          next.style.display = 'none';
        } else if (next.dataset.route) {
          const linkRoles = next.dataset.roles ? next.dataset.roles.split(',').map(r => normalizeRoleCode(r)) : null;
          const linkVisible = linkRoles ? isRoleAllowed(linkRoles, currentRoles) : hasAccess(next.dataset.route);
          next.style.display = linkVisible ? '' : 'none';
        }
      }
      next = next.nextElementSibling;
    }
  });

  const roleSpace = ROLE_SPACES[roleCode];
  const spaceBadge = document.getElementById('roleSpaceBadge');
  if (spaceBadge && roleSpace) {
    spaceBadge.innerHTML = `<i class="bi ${roleSpace.icon} me-1"></i>${roleSpace.label}`;
    spaceBadge.style.display = 'inline-flex';
  }
}

function parsePermissionSpec(spec) {
  if (!spec) return null;
  const normalized = spec.toString().trim().toLowerCase();
  if (normalized.includes(':')) {
    const parts = normalized.split(':').map(p => p.trim());
    return { module: parts[0], action: parts[1] };
  }
  if (normalized.includes('.')) {
    const parts = normalized.split('.').map(p => p.trim());
    return { module: parts[0], action: parts[1] };
  }
  return null;
}

function shouldShowElementByPermission(el) {
  const permission = el.dataset.permission;
  const roles = el.dataset.roles;

  if (permission) {
    const specs = permission.split(',').map(p => p.trim()).filter(Boolean);
    if (specs.length === 0) return true;
    return specs.some(spec => {
      const parsed = parsePermissionSpec(spec);
      if (!parsed) return false;
      return hasPermission(parsed.action, parsed.module);
    });
  }

  if (roles) {
    const currentRoles = getUserRoles(window.AppState.roleCode);
    const allowedRoles = roles.split(',').map(r => normalizeRoleCode(r));
    return isRoleAllowed(allowedRoles, currentRoles);
  }

  return true;
}

function applyPagePermissions() {
  document.querySelectorAll('[data-permission], [data-roles]').forEach(el => {
    const visible = shouldShowElementByPermission(el);
    el.style.display = visible ? '' : 'none';
  });
}

function initPermissionObserver() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea || typeof MutationObserver === 'undefined') return;

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;

        if (node.matches('[data-permission], [data-roles]')) {
          node.style.display = shouldShowElementByPermission(node) ? '' : 'none';
        }

        node.querySelectorAll('[data-permission], [data-roles]').forEach(el => {
          el.style.display = shouldShowElementByPermission(el) ? '' : 'none';
        });
      });
    });
  });

  observer.observe(contentArea, { childList: true, subtree: true });
}

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggleBtn = document.getElementById('sidebarToggle');

  if (toggleBtn && sidebar && backdrop) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('show');
      backdrop.classList.toggle('d-none', !isOpen);
      toggleBtn.setAttribute('aria-expanded', isOpen);
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('show');
      backdrop.classList.add('d-none');
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.sidebar-link[data-route]').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 992) {
          sidebar.classList.remove('show');
          backdrop.classList.add('d-none');
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }
}

// ============================================================
// TOPBAR
// ============================================================
function initTopbar() {
  // Notifications
  loadNotifications();
}

async function loadNotifications() {
  const notifBadge = document.getElementById('notifBadge');
  if (!notifBadge || !window.AppState.entreprise) return;
  try {
    const result = await window.api.alertes.invoke('countNonLues', window.AppState.entreprise.id);
    const count = result?.data || 0;
    notifBadge.textContent = count;
    notifBadge.classList.toggle('d-none', count === 0);
  } catch (e) { /* silencieux */ }
}

// ============================================================
// USER UI
// ============================================================
function updateUserUI(user) {
  const initiales = ((user.prenom?.[0] || '') + (user.nom?.[0] || '')).toUpperCase() || 'TB';
  const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur';
  const roleLabel = user.roleNom || user.roleCode || 'Employé';

  // Sidebar
  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl) avatarEl.textContent = initiales;
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = nomComplet;
  const roleEl = document.getElementById('userRole');
  if (roleEl) roleEl.textContent = roleLabel;

  // Topbar
  const topAvatar = document.getElementById('topbarAvatar');
  if (topAvatar) topAvatar.textContent = initiales;
  const topName = document.getElementById('topbarUserName');
  if (topName) topName.textContent = nomComplet;

  // Section admin visible uniquement pour ADMIN
  const isAdmin = window.AppState.roleCode === 'ADMIN';
  const adminLabel = document.getElementById('adminSectionLabel');
  if (adminLabel) adminLabel.classList.toggle('d-none', !isAdmin);
  const usersLink = document.getElementById('utilisateursLink');
  if (usersLink) usersLink.classList.toggle('d-none', !isAdmin);
}

// ============================================================
// USER MENU & LOGOUT
// ============================================================
function initUserMenu() {
  document.querySelectorAll('#logoutLink, #btnLogout').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  });
}

async function handleLogout() {
  try {
    if (window.api?.auth) await window.api.auth.invoke('logout');
  } catch (e) { /* silencieux */ }
  localStorage.removeItem('currentUser');
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// ============================================================
// SYNC
// ============================================================
function initSyncButton() {
  const btnSync = document.getElementById('btnSync');
  if (btnSync) {
    btnSync.addEventListener('click', () => performSync());
  }
  updateSyncUI();
}

function initOnlineDetection() {
  window.addEventListener('online', () => {
    window.AppState.isOnline = true;
    updateSyncUI();
    showToast('Connexion rétablie', 'success');
  });
  window.addEventListener('offline', () => {
    window.AppState.isOnline = false;
    updateSyncUI();
    showToast('Mode hors ligne activé', 'warning');
  });
}

async function performSync() {
  if (!window.AppState.isOnline) {
    showToast('Pas de connexion internet', 'warning');
    return;
  }
  const btnSync = document.getElementById('btnSync');
  const syncIcon = document.getElementById('syncIcon');
  if (btnSync) btnSync.disabled = true;
  if (syncIcon) { syncIcon.classList.remove('bi-arrow-clockwise'); syncIcon.classList.add('bi-arrow-repeat', 'spinning'); }
  window.AppState.syncStatus = 'pending';
  updateSyncUI();

  try {
    const result = await window.api.sync.push();
    if (result.success) {
      window.AppState.syncStatus = 'synced';
      window.AppState.lastSync = new Date().toISOString();
      showToast(`Synchronisation réussie (${result.pushed || 0} envoyés)`, 'success');
    } else {
      window.AppState.syncStatus = 'error';
      showToast(`Erreur sync: ${result.error || 'Inconnue'}`, 'error');
    }
  } catch (error) {
    window.AppState.syncStatus = 'error';
    showToast('Erreur lors de la synchronisation', 'error');
  } finally {
    if (btnSync) btnSync.disabled = false;
    if (syncIcon) { syncIcon.classList.remove('bi-arrow-repeat', 'spinning'); syncIcon.classList.add('bi-arrow-clockwise'); }
    updateSyncUI();
  }
}

function updateSyncUI() {
  const syncText = document.querySelector('.sync-text');
  const syncIndicator = document.getElementById('syncIndicator');
  if (!syncText || !syncIndicator) return;

  const config = {
    offline: { text: 'Hors ligne', class: 'text-secondary' },
    pending: { text: 'Synchronisation...', class: 'text-warning' },
    synced: { text: 'Synchronisé', class: 'text-success' },
    error: { text: 'Erreur sync', class: 'text-danger' }
  }[window.AppState.syncStatus] || { text: 'Hors ligne', class: 'text-secondary' };

  syncText.textContent = config.text;
  syncText.className = `sync-text ${config.class}`;
  syncIndicator.className = `sync-indicator ms-auto ${config.class}`;
}

// ============================================================
// ROUTER GUARDS — Contrôle d'accès par rôle
// ============================================================
function setupRouterGuards() {
  if (!window.router) return;

  window.router.beforeEach(async (to, from) => {
    if (!window.AppState.user) {
      window.location.href = 'index.html';
      return false;
    }
    const routeName = to.path.split('/')[0];
    if (!hasAccess(routeName)) {
      showToast('Accès non autorisé pour votre rôle', 'error');
      return false;
    }
    return true;
  });

  window.router.afterEach(async (to, from) => {
    if (typeof window.updateCurrencySymbols === 'function') {
      window.updateCurrencySymbols();
    }
    if (typeof window.applyPagePermissions === 'function') {
      window.applyPagePermissions();
    }
    document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
    const contentArea = document.getElementById('contentArea');
    if (contentArea) contentArea.scrollTop = 0;
  });
}

// ============================================================
// HELPERS GLOBAUX
// ============================================================
window.getAppCurrency = () => localStorage.getItem('tia_devise') || 'MGA';
window.getCurrencySymbol = () => ({ MGA: 'Ar', EUR: '€', USD: '$' }[window.getAppCurrency()] || 'Ar');
window.formatCurrency = (amount) => {
  const symbol = window.getCurrencySymbol();
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
  return `${formatted} ${symbol}`;
};
window.updateCurrencySymbols = () => {
  const symbol = window.getCurrencySymbol();
  document.querySelectorAll('.currency-symbol').forEach(el => { el.textContent = symbol; });
};
window.onCurrencyChanged = (newCurrency) => {
  localStorage.setItem('tia_devise', newCurrency);
  window.updateCurrencySymbols();
  showToast(`Devise mise à jour : ${window.getCurrencySymbol()}`, 'success');
};

window.AppState = window.AppState;
window.updateSyncUI = updateSyncUI;
window.performSync = performSync;
window.handleLogout = handleLogout;
window.hasAccess = hasAccess;
window.ROLE_SPACES = ROLE_SPACES;
window.ROLE_ROUTES = ROLE_ROUTES;
window.hasPermission = hasPermission;
window.applyPagePermissions = applyPagePermissions;
window.currentRoleCode = () => window.AppState.roleCode;
window.PERMISSION_MAP = PERMISSION_MAP;