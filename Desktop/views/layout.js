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
    sections: ['pilotage', 'administration']
  },
  DIRECTEUR: {
    label: 'Direction',
    icon: 'bi-graph-up-arrow',
    sections: ['pilotage', 'chantiers', 'rh', 'materiel', 'stocks', 'commercial', 'finance']
  },
  CHEF_CHANTIER: {
    label: 'Terrain',
    icon: 'bi-building',
    sections: ['pilotage', 'chantiers', 'rh', 'materiel', 'stocks']
  },
  CHEF_PROJET: {
    label: 'Projets',
    icon: 'bi-kanban',
    sections: ['pilotage', 'chantiers', 'rh']
  },
  COMPTABLE: {
    label: 'Comptabilité',
    icon: 'bi-calculator',
    sections: ['finance', 'commercial', 'rh', 'stocks']
  },
  RH: {
    label: 'Ressources Humaines',
    icon: 'bi-people',
    sections: ['rh']
  },
  MATERIEL: {
    label: 'Logistique',
    icon: 'bi-tools',
    sections: ['materiel', 'chantiers']
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
  ADMIN: ['dashboard', 'parametres', 'historique-logins'],
  DIRECTEUR: ['dashboard', 'chantiers', 'finances', 'depenses', 'rapports', 'alertes', 'employes', 'pointages', 'equipes', 'materiels', 'fournisseurs', 'clients', 'devis', 'contrats', 'factures', 'historique-logins', 'parametres'],
  CHEF_CHANTIER: ['dashboard', 'chantiers', 'employes', 'pointages', 'equipes', 'heures-sup', 'materiels', 'stocks', 'fournisseurs', 'mouvements', 'depenses', 'alertes', 'parametres'],
  CHEF_PROJET: ['dashboard', 'chantiers', 'alertes', 'pointages', 'employes', 'equipes', 'parametres'],
  COMPTABLE: ['dashboard', 'finances', 'depenses', 'rapports', 'alertes', 'factures', 'paiements', 'clients', 'contrats', 'fournisseurs', 'employes', 'pointages', 'equipes', 'devis', 'parametres'],
  RH: ['dashboard', 'employes', 'pointages', 'equipes', 'heures-sup', 'parametres'],
  MATERIEL: ['dashboard', 'materiels', 'alertes', 'chantiers', 'parametres'],
  MAGASINIER: ['dashboard', 'stocks', 'fournisseurs', 'mouvements', 'alertes', 'parametres'],
  COMMERCIAL: ['dashboard', 'clients', 'devis', 'contrats', 'factures', 'paiements', 'alertes', 'parametres']
};

const PERMISSION_MAP = {
  'chantiers:create': ['ADMIN', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMMERCIAL'],
  'chantiers:update': ['ADMIN', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMMERCIAL'],
  'chantiers:delete': ['ADMIN', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMMERCIAL'], 
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
  'clients:create': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'clients:update': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'clients:delete': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'devis:list': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'devis:create': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'devis:update': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'devis:delete': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'contrats:list': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'contrats:create': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'],
  'contrats:update': ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'], 
  'factures:list': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'factures:create': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'factures:update': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'], 
  'factures:dupliquer': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'factures:envoyer': ['ADMIN', 'COMMERCIAL', 'COMPTABLE', 'DIRECTEUR'],
  'paiements:list': ['ADMIN', 'COMMERCIAL', 'COMPTABLE'],
  'paiements:create': ['ADMIN', 'COMMERCIAL', 'COMPTABLE'],
  'utilisateurs:list': ['ADMIN'],
  'utilisateurs:create': ['ADMIN'],
  'utilisateurs:update': ['ADMIN'],
  'utilisateurs:delete': ['ADMIN'],
  'entreprises:update': ['ADMIN'],
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
  DIRECTEUR: ['direction', 'daf', 'directeur', 'direction générale'],
  COMPTABLE: ['comptable', 'finance', 'responsable financier'],
  RH: ['rh', 'responsable rh', 'responsablerh', 'responsable rh'],
  MATERIEL: ['materiel', 'responsable materiel', 'responsable_materiel', 'logisticien'],
  MAGASINIER: ['magasinier', 'stock', 'magasin'],
  COMMERCIAL: ['commercial', 'responsable commercial'],
  CHEF_CHANTIER: ['chef de chantier', 'conducteur', 'chef_chantier', 'chef chantier'],
  CHEF_PROJET: ['chef de projet', 'chef_projet', 'chef de projet', 'directeur technique']
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

function getCurrentRoleCodes() {
  if (window.AppState && Array.isArray(window.AppState.roles) && window.AppState.roles.length) {
    return window.AppState.roles;
  }
  return [window.AppState?.roleCode || 'ADMIN'];
}

function isRoleAllowed(allowedRoles, currentRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return currentRoles.some(role => allowedRoles.includes(role));
}

function hasPermission(action, module) {
  const permissionKey = `${module}:${action}`;
  const currentRoles = getCurrentRoleCodes();
  const allowed = PERMISSION_MAP[permissionKey];
  return isRoleAllowed(allowed, currentRoles);
}

// État global
window.AppState = {
  user: null,
  entreprise: null,
  role: null,
  roleCode: null,
  roles: [],
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
  if (!route) return false;
  const normalizedRoute = route.toString().trim();
  const currentRoles = getCurrentRoleCodes();
  return currentRoles.some(roleCode => {
    const allowed = ROLE_ROUTES[roleCode] || ROLE_ROUTES.ADMIN;
    if (allowed.includes(normalizedRoute)) return true;
    return allowed.some(allowedRoute => normalizedRoute === allowedRoute || normalizedRoute.startsWith(`${allowedRoute}/`));
  });
}

// ============================================================
// SIDEBAR — Filtrage par rôle
// ============================================================
function filterSidebarByRole(roleCode) {
  const currentRoles = window.AppState.roles && window.AppState.roles.length ? window.AppState.roles : getUserRoles(roleCode);
  const isAdmin = currentRoles.includes('ADMIN');

  if (isAdmin) {
    const ADMIN_ALLOWED_ROUTES = ['dashboard', 'parametres', 'historique-logins'];
    document.querySelectorAll('.sidebar-link[data-route]').forEach(link => {
      const route = link.dataset.route;
      link.style.display = ADMIN_ALLOWED_ROUTES.includes(route) ? '' : 'none';
    });

    document.querySelectorAll('.sidebar-section-label').forEach(label => {
      const section = label.dataset.section;
      if (section === 'pilotage' || section === 'administration') {
        label.style.display = '';
        let next = label.nextElementSibling;
        while (next && !next.classList.contains('sidebar-section-label')) {
          if (next.classList.contains('sidebar-link') && next.dataset.route) {
            next.style.display = ADMIN_ALLOWED_ROUTES.includes(next.dataset.route) ? '' : 'none';
          }
          next = next.nextElementSibling;
        }
      } else {
        label.style.display = 'none';
        let next = label.nextElementSibling;
        while (next && !next.classList.contains('sidebar-section-label')) {
          if (next.classList.contains('sidebar-link')) next.style.display = 'none';
          next = next.nextElementSibling;
        }
      }
    });

    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) syncStatus.style.display = 'none';

    const roleSpace = ROLE_SPACES['ADMIN'];
    const spaceBadge = document.getElementById('roleSpaceBadge');
    if (spaceBadge && roleSpace) {
      spaceBadge.innerHTML = `<i class="bi ${roleSpace.icon} me-1"></i>${roleSpace.label}`;
      spaceBadge.style.display = 'inline-flex';
    }
    return;
  }

  const allowedSections = Array.from(new Set(currentRoles.flatMap(role => (ROLE_SPACES[role] || ROLE_SPACES.ADMIN).sections || [])));

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
  const route = el.dataset.route;

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

  if (route) {
    return hasAccess(route);
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
  // Charger les notifications au démarrage
  loadNotifications();

  // Rafraîchir à chaque ouverture du dropdown
  const notifBtn = document.getElementById('notifBtn');
  if (notifBtn) {
    notifBtn.addEventListener('show.bs.dropdown', () => loadNotifications());
  }
}

async function loadNotifications() {
  const notifBadge = document.getElementById('notifBadge');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifEmpty = document.getElementById('notifEmpty');
  if (!notifBadge || !window.AppState?.entreprise) return;

  try {
    const entrepriseId = window.AppState.entreprise.id;
    const result = await window.api.alertes.invoke('nonLues', entrepriseId, 10);
    const alertes = (result?.data || []);

    // Badge
    const count = alertes.length;
    notifBadge.textContent = count > 9 ? '9+' : count;
    notifBadge.classList.toggle('d-none', count === 0);

    // Vider le dropdown (garder le header)
    if (!notifDropdown) return;
    // Reconstruire les items
    const header = `
      <li><h6 class="dropdown-header d-flex justify-content-between align-items-center">
        <span><i class="bi bi-bell me-1"></i>Notifications</span>
        ${count > 0 ? `<button class="btn btn-link btn-sm p-0 text-secondary text-decoration-none" id="btnMarkAllReadDropdown">Tout marquer lu</button>` : ''}
      </h6></li>
      <li><hr class="dropdown-divider"></li>
    `;

    let items = '';
    if (alertes.length === 0) {
      items = `<li class="text-center text-secondary py-3 px-3" id="notifEmpty">
        <i class="bi bi-bell-slash d-block mb-1" style="font-size:1.5rem;"></i>
        <small>Aucune notification</small>
      </li>`;
    } else {
      const graviteIcones = {
        critique: 'bi-exclamation-circle-fill text-danger',
        elevee: 'bi-exclamation-triangle-fill text-warning',
        moyenne: 'bi-info-circle-fill text-info',
        faible: 'bi-info-circle text-secondary',
        info: 'bi-bell-fill text-primary'
      };

      // Mapper le typeEntite vers une route (avec entiteId si dispo)
      const typeRoutes = {
        Employe: (a) => a.entiteId ? `employes/${a.entiteId}` : 'employes',
        Utilisateur: (a) => a.entiteId ? `employes/${a.entiteId}` : 'employes',
        Chantier: (a) => a.entiteId ? `chantiers/${a.entiteId}` : 'chantiers',
        Facture: (a) => 'factures',
        Stock: (a) => 'stocks',
        systeme: () => null
      };

      items = alertes.map(a => {
        const icone = graviteIcones[a.niveauGravite] || 'bi-bell-fill text-primary';
        const titre = a.titre || 'Notification';
        const msg = (a.message || '').length > 70 ? a.message.substring(0, 70) + '…' : (a.message || '');
        const routeFn = typeRoutes[a.typeEntite];
        const route = routeFn ? routeFn(a) : null;
        const timeStr = a.dateAlerte ? new Date(a.dateAlerte).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

        return `<li>
          <div class="dropdown-item notif-item d-flex align-items-start gap-2 py-2 px-3" style="white-space:normal; min-width:280px; max-width:340px; cursor:pointer;" data-alerte-id="${a.id}" data-route="${route || ''}">
            <i class="bi ${icone} mt-1 flex-shrink-0"></i>
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex justify-content-between align-items-start gap-1">
                <strong class="small text-truncate">${titre}</strong>
                <small class="text-secondary flex-shrink-0">${timeStr}</small>
              </div>
              <p class="mb-1 small text-secondary" style="font-size:0.78rem; line-height:1.3;">${msg}</p>
              <div class="d-flex gap-2">
                ${route ? `<a href="#${route}" data-route="${route}" class="btn btn-link btn-sm p-0 text-primary text-decoration-none" style="font-size:0.75rem;" onclick="event.stopPropagation()"><i class="bi bi-arrow-right me-1"></i>Voir</a>` : ''}
                <button class="btn btn-link btn-sm p-0 text-secondary text-decoration-none notif-mark-read" data-id="${a.id}" style="font-size:0.75rem;"><i class="bi bi-check2 me-1"></i>Marquer lu</button>
              </div>
            </div>
          </div>
        </li>
        <li><hr class="dropdown-divider my-0"></li>`;
      }).join('');
    }

    notifDropdown.innerHTML = header + items;

    // Events — marquer une alerte comme lue
    notifDropdown.querySelectorAll('.notif-mark-read').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        await window.api.alertes.invoke('markAsRead', id);
        loadNotifications();
      });
    });

    // Clic sur l'item → naviguer + marquer lu
    notifDropdown.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = parseInt(item.dataset.alerteId);
        const route = item.dataset.route;
        await window.api.alertes.invoke('markAsRead', id);
        if (route && window.router) window.router.navigate(route);
        loadNotifications();
      });
    });

    // Tout marquer lu
    const btnMarkAll = notifDropdown.querySelector('#btnMarkAllReadDropdown');
    if (btnMarkAll) {
      btnMarkAll.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.alertes.invoke('markAllAsRead', entrepriseId);
        loadNotifications();
        if (window.showToast) window.showToast('Toutes les notifications marquées comme lues', 'success');
      });
    }

  } catch (e) {
    console.warn('loadNotifications error:', e);
  }
}

// Rafraîchir les notifications toutes les 60 secondes
setInterval(loadNotifications, 60000);

// Exposer globalement pour mise à jour après création d'utilisateur
window.updateDashboardAlertsBadge = loadNotifications;


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
  const canManageUsers = window.hasPermission ? window.hasPermission('list', 'utilisateurs') : false;
  const canUpdateEntreprise = window.hasPermission ? window.hasPermission('update', 'entreprises') : false;
  const showSettings = canManageUsers || canUpdateEntreprise;

  const adminLabel = document.getElementById('adminSectionLabel');
  if (adminLabel) adminLabel.classList.toggle('d-none', !showSettings);
  const usersLink = document.getElementById('utilisateursLink');
  if (usersLink) usersLink.classList.toggle('d-none', !canManageUsers);
  const historiqueLink = document.getElementById('historiqueLoginsLink');
  const currentRole = window.AppState?.roleCode || 'ADMIN';
  if (historiqueLink) historiqueLink.classList.toggle('d-none', !['ADMIN', 'DIRECTEUR'].includes(currentRole));

  const topbarSettingsLink = document.getElementById('topbarSettingsLink');
  if (topbarSettingsLink) topbarSettingsLink.style.display = showSettings ? '' : 'none';
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
window.formatCurrencyGlobal = window.formatCurrency;
window.PERMISSION_MAP = PERMISSION_MAP;