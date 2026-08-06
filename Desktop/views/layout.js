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
    sections: ['chantiers', 'rh_pointage', 'materiel', 'stocks']
  },
  CHEF_PROJET: {
    label: 'Projets',
    icon: 'bi-kanban',
    sections: ['pilotage', 'chantiers']
  },
  COMPTABLE: {
    label: 'Comptabilité',
    icon: 'bi-calculator',
    sections: ['finance', 'commercial_facturation']
  },
  RESPONSABLE_RH: {
    label: 'Ressources Humaines',
    icon: 'bi-people',
    sections: ['rh']
  },
  RESPONSABLE_MATERIEL: {
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
  DIRECTEUR: ['dashboard', 'chantiers', 'finances', 'rapports', 'alertes'],
  CHEF_CHANTIER: ['dashboard', 'chantiers', 'pointages', 'materiels', 'stocks', 'mouvements'],
  CHEF_PROJET: ['dashboard', 'chantiers'],
  COMPTABLE: ['dashboard', 'finances', 'depenses', 'rapports', 'factures', 'paiements', 'alertes'],
  RESPONSABLE_RH: ['dashboard', 'employes', 'pointages', 'equipes', 'heures-sup'],
  RESPONSABLE_MATERIEL: ['dashboard', 'materiels'],
  MAGASINIER: ['dashboard', 'stocks', 'fournisseurs', 'mouvements'],
  COMMERCIAL: ['dashboard', 'clients', 'devis', 'contrats', 'factures', 'paiements']
};

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

    // Déterminer le rôle
    const roleCode = (user.roleCode || 'ADMIN').toUpperCase();
    window.AppState.roleCode = roleCode;
    window.AppState.role = ROLE_SPACES[roleCode] || ROLE_SPACES.ADMIN;

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
  const allowedRoutes = ROLE_ROUTES[roleCode] || ROLE_ROUTES.ADMIN;
  const allowedSections = (ROLE_SPACES[roleCode] || ROLE_SPACES.ADMIN).sections;

  // Masquer les liens non autorisés
  document.querySelectorAll('.sidebar-link[data-route]').forEach(link => {
    const route = link.dataset.route;
    if (!allowedRoutes.includes(route)) {
      link.style.display = 'none';
    }
  });

  // Masquer les sections vides
  document.querySelectorAll('.sidebar-section-label').forEach(label => {
    const section = label.dataset.section;
    if (section && !allowedSections.includes(section)) {
      label.style.display = 'none';
      // Masquer les liens jusqu'à la prochaine section
      let next = label.nextElementSibling;
      while (next && !next.classList.contains('sidebar-section-label')) {
        if (next.classList.contains('sidebar-link')) {
          next.style.display = 'none';
        }
        next = next.nextElementSibling;
      }
    }
  });

  // Afficher l'espace du rôle dans le header sidebar
  const roleSpace = ROLE_SPACES[roleCode];
  const spaceBadge = document.getElementById('roleSpaceBadge');
  if (spaceBadge && roleSpace) {
    spaceBadge.innerHTML = `<i class="bi ${roleSpace.icon} me-1"></i>${roleSpace.label}`;
    spaceBadge.style.display = 'inline-flex';
  }
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