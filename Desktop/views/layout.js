/**
 * Layout.js - Logique de l'App Shell (sidebar, topbar, user menu, sync)
 * Dépend de router.js et tia-design.css
 */

// État global de l'application
window.AppState = {
    user: null,
    entreprise: null,
    isOnline: navigator.onLine,
    syncStatus: 'offline', // 'offline' | 'pending' | 'synced' | 'conflict' | 'error'
    lastSync: null
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
    initSidebar();
    initTopbar();
    initUserMenu();
    initSyncButton();
    initLogout();
    initOnlineDetection();
    await loadUserSession();
    setupRouterGuards();
});

/**
 * Initialiser la sidebar (toggle, responsive)
 */
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

        // Fermer sidebar au clic sur un lien (mobile)
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

/**
 * Initialiser la topbar (recherche, actions globales)
 */
function initTopbar() {
    // La topbar est principalement gérée par le router pour le titre
    // Les boutons (notifications, sync, user menu) sont gérés séparément
}

/**
 * Initialiser le menu utilisateur
 */
function initUserMenu() {
    const logoutLinks = document.querySelectorAll('#logoutLink, #btnLogout');
    logoutLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    });
}

/**
 * Initialiser le bouton de synchronisation
 */
function initSyncButton() {
    const btnSync = document.getElementById('btnSync');
    const syncIcon = document.getElementById('syncIcon');

    if (btnSync) {
        btnSync.addEventListener('click', async () => {
            await performSync();
        });
    }

    // Mettre à jour l'indicateur de sync initial
    updateSyncUI();
}

/**
 * Initialiser la détection online/offline
 */
function initOnlineDetection() {
    window.addEventListener('online', () => {
        AppState.isOnline = true;
        updateSyncUI();
        showToast('Connexion rétablie', 'success');
        // Auto-sync si configuré
        if (getSyncConfig().autoSync) {
            performSync();
        }
    });

    window.addEventListener('offline', () => {
        AppState.isOnline = false;
        updateSyncUI();
        showToast('Mode hors ligne activé', 'warning');
    });
}

/**
 * Charger la session utilisateur depuis localStorage / IPC
 */
async function loadUserSession() {
    try {
        // Lire uniquement la clé unifiée 'currentUser'
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            const user = JSON.parse(stored);
            if (user && user.id) {
                AppState.user = user;
                AppState.entreprise = {
                    id: user.entrepriseId || 1,
                    nom: user.entrepriseNom || 'TIA Construction'
                };
                updateUserUI(user, AppState.entreprise);
                return;
            }
        }

        // Aucune session valide → rediriger vers la page de login
        console.warn('Aucune session utilisateur — redirection vers index.html');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erreur chargement session:', error);
        window.location.href = 'index.html';
    }
}

/**
 * Mettre à jour l'UI utilisateur (sidebar + topbar)
 */
function updateUserUI(user, entreprise) {
    if (!user) return;

    const initiales = (user.prenom?.[0] || '') + (user.nom?.[0] || '') || 'TB';
    const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur';

    // Le user object a roleNom et roleCode (ex: 'Administrateur', 'ADMIN') depuis la BDD
    // Pas de nested role object
    const roleLabel = user.roleNom || user.roleCode || 'Employé';

    // Sidebar
    document.getElementById('userAvatar').textContent = initiales.toUpperCase();
    document.getElementById('userName').textContent = nomComplet;
    document.getElementById('userRole').textContent = roleLabel;

    // Topbar
    document.getElementById('topbarAvatar').textContent = initiales.toUpperCase();
    document.getElementById('topbarUserName').textContent = nomComplet;

    // Afficher section admin si rôle admin/directeur
    const isAdmin = ['administrateur', 'directeur', 'admin'].some(r =>
        roleLabel.toLowerCase().includes(r)
    );
    document.getElementById('adminSectionLabel').classList.toggle('d-none', !isAdmin);
    document.getElementById('utilisateursLink').classList.toggle('d-none', !isAdmin);
}

/**
 * Configurer les guards du router (auth, rôles)
 */
function setupRouterGuards() {
    if (!window.router) return;

    window.router.beforeEach(async (to, from) => {
        if (!AppState.user) {
            sessionStorage.setItem('tia_redirect_after_login', to.hash || '');
            window.location.href = 'index.html';
            return false;
        }
        if (to.path.startsWith('utilisateurs') || to.path.startsWith('parametres')) {
            const roleLabel = AppState.user.roleNom || AppState.user.roleCode || String(AppState.user.roleId || '');
            const isAdmin = ['administrateur', 'directeur', 'admin'].some(r => roleLabel.toLowerCase().includes(r));
            if (!isAdmin) {
                try { showToast('Accès non autorisé', 'error'); } catch (e) { }
                return false;
            }
        }
        return true;
    });

    window.router.afterEach(async (to, from) => {
        // CORRECTION : Forcer la mise à jour des symboles monétaires à chaque vue
        if (typeof window.updateCurrencySymbols === 'function') {
            window.updateCurrencySymbols();
        }

        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });

        const contentArea = document.getElementById('contentArea');
        if (contentArea) contentArea.scrollTop = 0;
    });
}

/**
 * Gérer la déconnexion
 */
async function handleLogout() {
    try {
        // Appeler IPC pour signaler la déconnexion au main process
        if (window.api && window.api.auth) {
            await window.api.auth.invoke('logout');
        }
    } catch (error) {
        console.error('Erreur logout IPC:', error);
    }

    // Nettoyer l'état mémoire
    AppState.user = null;
    AppState.entreprise = null;

    // Nettoyer le stockage local (toutes les clés de session)
    localStorage.removeItem('currentUser');
    localStorage.removeItem('tia_user_session');
    sessionStorage.clear();

    // Rediriger vers la page de login (navigation file-level)
    window.location.href = 'index.html';
}

/**
 * Effectuer la synchronisation avec le serveur
 */
async function performSync() {
    if (!AppState.isOnline) {
        showToast('Pas de connexion internet', 'warning');
        return;
    }

    if (!window.api || !window.api.sync) {
        showToast('Fonction de synchronisation non disponible', 'error');
        return;
    }

    const btnSync = document.getElementById('btnSync');
    const syncIcon = document.getElementById('syncIcon');

    // UI loading
    if (btnSync) btnSync.disabled = true;
    if (syncIcon) {
        syncIcon.classList.remove('bi-arrow-clockwise');
        syncIcon.classList.add('bi-arrow-repeat', 'spinning');
    }

    AppState.syncStatus = 'pending';
    updateSyncUI();

    try {
        const result = await window.api.sync.push();

        if (result.success) {
            AppState.syncStatus = 'synced';
            AppState.lastSync = new Date().toISOString();
            localStorage.setItem('tia_last_sync', AppState.lastSync);
            showToast(`Synchronisation réussie (${result.pushed || 0} envoyés, ${result.pulled || 0} reçus)`, 'success');
        } else {
            AppState.syncStatus = 'error';
            showToast(`Erreur sync: ${result.error || 'Inconnue'}`, 'error');
        }
    } catch (error) {
        AppState.syncStatus = 'error';
        console.error('Erreur sync:', error);
        showToast('Erreur lors de la synchronisation', 'error');
    } finally {
        if (btnSync) btnSync.disabled = false;
        if (syncIcon) {
            syncIcon.classList.remove('bi-arrow-repeat', 'spinning');
            syncIcon.classList.add('bi-arrow-clockwise');
        }
        updateSyncUI();
    }
}

/**
 * Mettre à jour l'UI de statut de synchronisation
 */
async function updateSyncUI() {
    const syncText = document.querySelector('.sync-text');
    const syncIndicator = document.getElementById('syncIndicator');
    const syncIcon = document.getElementById('syncIcon');
    const notifBtn = document.getElementById('notifBtn');

    if (!syncText || !syncIndicator) return;

    const statusConfig = {
        offline: { text: 'Hors ligne', class: 'text-secondary', icon: 'bi-cloud-slash' },
        pending: { text: 'Synchronisation...', class: 'text-warning', icon: 'bi-arrow-repeat spinning' },
        synced: { text: 'Synchronisé', class: 'text-success', icon: 'bi-cloud-check' },
        conflict: { text: 'Conflits', class: 'text-danger', icon: 'bi-exclamation-triangle' },
        error: { text: 'Erreur sync', class: 'text-danger', icon: 'bi-x-circle' }
    };

    const config = statusConfig[AppState.syncStatus] || statusConfig.offline;

    syncText.textContent = config.text;
    syncText.className = `sync-text ${config.class}`;
    syncIndicator.className = `sync-indicator ms-auto ${config.class}`;

    if (syncIcon && AppState.syncStatus !== 'pending') {
        syncIcon.className = `bi ${config.icon}`;
    }

    // Badge notifications (alertes non lues)
    if (notifBtn && AppState.entreprise && window.api && window.api.alertes) {
        try {
            const result = await window.api.alertes.invoke('countNonLues', AppState.entreprise.id);
            const count = result?.data || 0;
            const badge = document.getElementById('notifBadge');
            if (badge) {
                badge.textContent = count;
                badge.classList.toggle('d-none', count === 0);
            }
        } catch (e) {
            // Ignorer
        }
    }
}

/**
 * Récupérer la config de sync depuis localStorage
 */
function getSyncConfig() {
    try {
        const stored = localStorage.getItem('tia_sync_config');
        return stored ? JSON.parse(stored) : { autoSync: true, interval: 300000 }; // 5 min par défaut
    } catch {
        return { autoSync: true, interval: 300000 };
    }
}

/**
 * Démarrer la sync automatique périodique
 */
function startAutoSync() {
    const config = getSyncConfig();
    if (!config.autoSync) return;

    setInterval(async () => {
        if (AppState.isOnline && AppState.user && AppState.syncStatus !== 'pending') {
            await performSync();
        }
    }, config.interval);
}

/**
 * Récupérer la devise active de l'application
 * @returns {string} Code ISO devise (MGA, EUR, USD...)
 */
function getAppCurrency() {
    try {
        return localStorage.getItem('tia_devise') || 'MGA';
    } catch {
        return 'MGA';
    }
}

/**
 * Formater un montant avec la devise active
 * @param {number} amount - Montant
 * @returns {string} Montant formaté
 */
function formatCurrencyGlobal(amount) {
    const currency = getAppCurrency();
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: currency === 'MGA' ? 0 : 2
    }).format(amount || 0);
}

window.getAppCurrency = getAppCurrency;
window.formatCurrencyGlobal = formatCurrencyGlobal;

// ============================================================
// SYSTÈME DE DEVISE DYNAMIQUE
// ============================================================

/**
 * Récupérer la devise active de l'application
 * @returns {string} Code ISO devise (MGA, EUR, USD)
 */
function getAppCurrency() {
    try {
        return localStorage.getItem('tia_devise') || 'MGA';
    } catch {
        return 'MGA';
    }
}

/**
 * Récupérer le symbole de la devise active
 * @returns {string} Symbole (Ar, €, $)
 */
function getCurrencySymbol() {
    const symbols = {
        'MGA': 'Ar',
        'EUR': '€',
        'USD': '$'
    };
    return symbols[getAppCurrency()] || 'Ar';
}

/**
 * Formater un montant avec le symbole de la devise active
 * @param {number} amount - Montant
 * @returns {string} Montant formaté avec symbole
 */
function formatCurrency(amount) {
    const symbol = getCurrencySymbol();
    const formatted = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
    return `${formatted} ${symbol}`;
}

/**
 * Mettre à jour tous les symboles de devise dans le DOM
 * Appeler après chaque navigation et après changement de devise
 */
function updateCurrencySymbols() {
    const symbol = getCurrencySymbol();

    // Mettre à jour les labels avec classe .currency-symbol
    document.querySelectorAll('.currency-symbol').forEach(el => {
        el.textContent = symbol;
    });

    // Mettre à jour les input-group-text avec classe .currency-symbol
    document.querySelectorAll('.input-group-text.currency-symbol').forEach(el => {
        el.textContent = symbol;
    });

    // Mettre à jour les labels contenant "(€)" ou "($)" ou "(Ar)"
    document.querySelectorAll('label.form-label').forEach(label => {
        const text = label.textContent;
        if (text.includes('(€)') || text.includes('($)') || text.includes('(Ar)')) {
            label.textContent = text.replace(/\(€\)|\(\$\)|\(Ar\)/g, `(${symbol})`);
        }
    });

    // Mettre à jour les headers de tableaux contenant € ou $
    document.querySelectorAll('th').forEach(th => {
        const text = th.textContent;
        if (text.includes('€') || text.includes('$') || text.includes('Ar')) {
            th.textContent = text.replace(/€|\$|Ar/g, symbol);
        }
    });

    // Mettre à jour les placeholders
    document.querySelectorAll('input[placeholder]').forEach(input => {
        const ph = input.getAttribute('placeholder');
        if (ph && (ph.includes('€') || ph.includes('$') || ph.includes('Ar'))) {
            input.setAttribute('placeholder', ph.replace(/€|\$|Ar/g, symbol));
        }
    });

    // Mettre à jour les titles/aria-labels
    document.querySelectorAll('[title]').forEach(el => {
        const title = el.getAttribute('title');
        if (title && (title.includes('€') || title.includes('$') || title.includes('Ar'))) {
            el.setAttribute('title', title.replace(/€|\$|Ar/g, symbol));
        }
    });
}

/**
 * Appeler après changement de devise dans les préférences
 */
function onCurrencyChanged(newCurrency) {
    localStorage.setItem('tia_devise', newCurrency);
    updateCurrencySymbols();
    if (window.showToast) {
        window.showToast(`Devise mise à jour : ${getCurrencySymbol()}`, 'success');
    }
}

// Exposer globalement
window.getAppCurrency = getAppCurrency;
window.getCurrencySymbol = getCurrencySymbol;
window.formatCurrency = formatCurrency;
window.updateCurrencySymbols = updateCurrencySymbols;
window.onCurrencyChanged = onCurrencyChanged;

// Démarrer auto-sync après chargement
setTimeout(startAutoSync, 5000);

// Exposer des fonctions utilitaires globalement
window.AppState = AppState;
window.updateSyncUI = updateSyncUI;
window.performSync = performSync;
window.handleLogout = handleLogout;