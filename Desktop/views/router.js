/**
 * Router SPA simple basé sur hash (#route)
 * Gère la navigation sans rechargement de page
 */

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.beforeEachHooks = [];
        this.afterEachHooks = [];

        // Écouter les changements de hash
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('load', () => this.handleRouteChange());
    }

    /**
     * Ajouter une route
     * @param {string} path - Ex: 'chantiers', 'chantiers/:id', 'chantiers/:id/edit'
     * @param {Function} handler - Fonction async qui retourne le HTML ou gère l'affichage
     */
    add(path, handler) {
        this.routes.set(path, handler);
        return this;
    }

    /**
     * Ajouter un hook avant navigation (guard)
     * @param {Function} hook - (to, from, next) => void
     */
    beforeEach(hook) {
        this.beforeEachHooks.push(hook);
    }

    /**
     * Ajouter un hook après navigation
     * @param {Function} hook - (to, from) => void
     */
    afterEach(hook) {
        this.afterEachHooks.push(hook);
                window.router.afterEach(async (to, from) => {
        // Mettre à jour les symboles de devise
        if (window.updateCurrencySymbols) {
            window.updateCurrencySymbols();
        }

        // Fermer les dropdowns ouverts
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });

        // Scroll en haut
        const contentArea = document.getElementById('contentArea');
        if (contentArea) contentArea.scrollTop = 0;
        });
    }

    /**
     * Naviguer vers une route
     * @param {string} path - Chemin avec hash (ex: '#/chantiers/123')
     */
    navigate(path) {
        if (!path.startsWith('#')) path = '#' + path;
        window.location.hash = path;
    }

    /**
     * Gérer le changement de route
     */
    async handleRouteChange() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const [path, queryString] = hash.split('?');

        // Parser les paramètres de query
        const query = new URLSearchParams(queryString || '');
        const params = Object.fromEntries(query.entries());

        // Trouver la route correspondante
        const match = this.matchRoute(path);

        if (!match) {
            console.warn(`Route non trouvée: ${path}`);
            this.navigate('#dashboard');
            return;
        }

        const { handler, routeParams } = match;
        const to = { path, params: { ...routeParams, ...params }, hash };
        const from = this.currentRoute;

        // Exécuter les guards
        for (const hook of this.beforeEachHooks) {
            const result = await hook(to, from);
            if (result === false) {
                // Navigation annulée
                if (from) {
                    window.location.hash = from.hash;
                }
                return;
            }
            if (typeof result === 'string') {
                // Redirection
                this.navigate(result);
                return;
            }
        }

        // Mettre à jour la route courante
        this.currentRoute = to;

        try {
            // Afficher un loader
            this.showLoader(true);

            // Exécuter le handler
            await handler(to, from);

            // Mettre à jour l'UI (navigation active, titre)
            this.updateActiveLink(path);
            this.updatePageTitle(to);

        } catch (error) {
            console.error('Erreur navigation:', error);
            this.showError('Erreur lors du chargement de la page');
        } finally {
            this.showLoader(false);

            // Hooks afterEach
            for (const hook of this.afterEachHooks) {
                await hook(to, from);
            }
        }
    }

    /**
     * Trouver la route correspondante avec extraction des params
     * @param {string} path - Chemin demandé
     * @returns {Object|null} - { handler, routeParams }
     */
    matchRoute(path) {
        // Essayer match exact d'abord
        if (this.routes.has(path)) {
            return { handler: this.routes.get(path), routeParams: {} };
        }

        // Essayer match avec paramètres (:param)
        for (const [routePath, handler] of this.routes.entries()) {
            const regex = this.pathToRegex(routePath);
            const match = path.match(regex);
            if (match) {
                const paramNames = this.getParamNames(routePath);
                const routeParams = {};
                paramNames.forEach((name, i) => {
                    routeParams[name] = match[i + 1];
                });
                return { handler, routeParams };
            }
        }

        return null;
    }

    /**
     * Convertir un path avec :param en regex
     */
    pathToRegex(path) {
        const regexStr = path
            .replace(/\//g, '\\/')
            .replace(/:(\w+)/g, '([^/]+)');
        return new RegExp(`^${regexStr}$`);
    }

    /**
     * Extraire les noms des paramètres d'un path
     */
    getParamNames(path) {
        const matches = path.match(/:(\w+)/g);
        return matches ? matches.map(m => m.slice(1)) : [];
    }

    /**
     * Mettre à jour le lien actif dans la sidebar
     */
    updateActiveLink(path) {
        document.querySelectorAll('.sidebar-link[data-route]').forEach(link => {
            const route = link.dataset.route;
            const isActive = path.startsWith(route) && route !== 'dashboard' ||
                (route === 'dashboard' && path === 'dashboard');
            link.classList.toggle('active', isActive);
        });
    }

    /**
     * Mettre à jour le titre de la page
     */
    updatePageTitle(to) {
        const titles = {
            dashboard: 'Tableau de bord',
            chantiers: 'Chantiers',
            'chantiers/nouveau': 'Nouveau chantier',
            employes: 'Employés',
            materiels: 'Matériels',
            stocks: 'Stocks',
            clients: 'Clients',
            devis: 'Devis & Contrats',
            finances: 'Finances',
            utilisateurs: 'Utilisateurs',
            profil: 'Mon profil',
            parametres: 'Paramètres'
        };

        // Chercher le titre le plus spécifique
        let title = 'TIA INFO BUILD';
        for (const [route, t] of Object.entries(titles)) {
            if (to.path.startsWith(route)) {
                title = t;
            }
        }

        document.getElementById('pageTitle').textContent = title;
        document.title = `${title} — TIA INFO BUILD`;
    }

    /**
     * Afficher/masquer le loader
     */
    showLoader(show) {
        const contentArea = document.getElementById('contentArea');
        if (show) {
            contentArea.classList.add('loading');
        } else {
            contentArea.classList.remove('loading');
        }
    }

    /**
     * Afficher une erreur
     */
    showError(message) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="alert alert-danger m-4" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${message}
                <button class="btn btn-sm btn-outline-danger ms-3" onclick="router.navigate('#dashboard')">
                    Retour au dashboard
                </button>
            </div>
        `;
    }
}

// Instance globale
window.router = new Router();

// ============================================================
// HELPERS GLOBAUX
// ============================================================

/**
 * Charger un script JS dynamiquement si non déjà présent
 * @param {string} scriptPath - Chemin relatif au script
 * @returns {Promise}
 */
window.loadScript = function (scriptPath) {
    return new Promise((resolve) => {
        if (document.querySelector(`script[src="${scriptPath}"]`)) {
            return resolve();
        }
        const script = document.createElement('script');
        script.src = scriptPath;
        script.onload = resolve;
        script.onerror = () => {
            console.warn(`Script ${scriptPath} non trouvé ou facultatif.`);
            resolve();
        };
        document.body.appendChild(script);
    });
};

// ============================================================
// ENREGISTREMENT DES ROUTES
// ============================================================

// Dashboard
window.router.add('dashboard', async (to) => {
    const html = await loadView('dashboard.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('dashboard.js');
    if (window.dashboardController && typeof window.dashboardController.init === 'function') {
        await window.dashboardController.init();
    }
});

// Chantiers
window.router.add('chantiers', async (to) => {
    const html = await loadView('chantiers/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('chantiers/index.js');
    if (window.chantiersController && typeof window.chantiersController.init === 'function') {
        await window.chantiersController.init();
    }
});

window.router.add('chantiers/nouveau', async (to) => {
    const html = await loadView('chantiers/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('chantiers/index.js');
    if (window.chantiersController && typeof window.chantiersController.init === 'function') {
        await window.chantiersController.init();
        if (typeof window.chantiersController.openModalNouveau === 'function') {
            window.chantiersController.openModalNouveau();
        }
    }
});

window.router.add('chantiers/:id', async (to) => {
    const html = await loadView('chantiers/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('chantiers/index.js');
    if (window.chantiersController && typeof window.chantiersController.init === 'function') {
        await window.chantiersController.init();
        if (typeof window.chantiersController.openModalEdition === 'function') {
            window.chantiersController.openModalEdition(to.params.id);
        }
    }
});

window.router.add('chantiers/:id/detail', async (to) => {
    const html = await loadView('chantiers/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('chantiers/index.js');
    if (window.chantiersController && typeof window.chantiersController.init === 'function') {
        await window.chantiersController.init();
        if (typeof window.chantiersController.viewChantier === 'function') {
            window.chantiersController.viewChantier(to.params.id);
        }
    }
});

// Employés
window.router.add('employes', async (to) => {
    const html = await loadView('rh/employes/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('rh/employes/index.js');
    if (window.employesController && typeof window.employesController.init === 'function') {
        await window.employesController.init();
    }
});

// Pointages
window.router.add('pointages', async (to) => {
    const html = await loadView('rh/pointages/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('rh/pointages/index.js');
    if (window.pointagesController && typeof window.pointagesController.init === 'function') {
        await window.pointagesController.init();
    }
});

// Matériels
window.router.add('materiels', async (to) => {
    const html = await loadView('materiels/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('materiels/index.js');
    if (window.materielsController && typeof window.materielsController.init === 'function') {
        await window.materielsController.init();
    }
});

// Stocks / Articles
window.router.add('stocks', async (to) => {
    const html = await loadView('stocks/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('stocks/index.js');
    if (window.stocksController && typeof window.stocksController.init === 'function') {
        await window.stocksController.init();
    }
});

// Fournisseurs
window.router.add('fournisseurs', async (to) => {
    const html = await loadView('stocks/fournisseurs/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('stocks/fournisseurs/index.js');
    if (window.fournisseursController && typeof window.fournisseursController.init === 'function') {
        await window.fournisseursController.init();
    }
});

// Clients
window.router.add('clients', async (to) => {
    const html = await loadView('commercial/clients/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('commercial/clients/index.js');
    if (window.clientsController && typeof window.clientsController.init === 'function') {
        await window.clientsController.init();
    }
});

// Devis & Contrats
window.router.add('devis', async (to) => {
    const html = await loadView('commercial/devis/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('commercial/devis/index.js');
    if (window.devisController && typeof window.devisController.init === 'function') {
        await window.devisController.init();
    }
});

// Factures
window.router.add('factures', async (to) => {
    const html = await loadView('commercial/factures/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('commercial/factures/index.js');
    if (window.facturesController && typeof window.facturesController.init === 'function') {
        await window.facturesController.init();
    }
});

// Finances
window.router.add('finances', async (to) => {
    const html = await loadView('finance/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('finance/index.js');
    if (window.financesController && typeof window.financesController.init === 'function') {
        await window.financesController.init();
    }
});

// Paramètres
window.router.add('parametres', async (to) => {
    const html = await loadView('settings.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('settings.js');
    if (window.parametresController && typeof window.parametresController.init === 'function') {
        await window.parametresController.init();
    }
});

// Helper pour charger une vue HTML dynamiquement
window.loadView = async function (viewPath) {
    try {
        const response = await fetch(viewPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
    } catch (error) {
        console.error(`Erreur chargement vue ${viewPath}:`, error);
        return `<div class="alert alert-danger">Impossible de charger la vue: ${viewPath}</div>`;
    }
};

// Helper pour afficher un toast
window.showToast = function (message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const id = 'toast-' + Date.now();
    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-x-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill'
    };
    const bgClass = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-info'
    };

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast ${bgClass[type]} text-white`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="toast-header ${bgClass[type]} text-white border-0">
            <i class="bi ${icons[type]} me-2"></i>
            <strong class="me-auto">TIA INFO BUILD</strong>
            <small>à l'instant</small>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">${message}</div>
    `;

    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: duration });
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => toast.remove());
};

// Helper pour afficher une modale
window.showModal = async function (modalPath, data = {}) {
    const container = document.getElementById('modalsContainer');
    const html = await loadView(modalPath);
    container.innerHTML = html;

    const modalEl = container.querySelector('.modal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Nettoyer après fermeture
        modalEl.addEventListener('hidden.bs.modal', () => {
            container.innerHTML = '';
        });

        return modal;
    }
    return null;
};

// Export pour utilisation dans les vues
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Router;
}