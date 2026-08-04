// Desktop/views/router.js
class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.beforeEachHooks = [];
        this.afterEachHooks = [];

        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('load', () => this.handleRouteChange());
    }

    add(path, handler) {
        this.routes.set(path, handler);
        return this;
    }

    beforeEach(hook) {
        this.beforeEachHooks.push(hook);
    }

    afterEach(hook) {
        // CORRECTION: L'implémentation propre du hook
        this.afterEachHooks.push(hook);
    }

    navigate(path) {
        if (!path.startsWith('#')) path = '#' + path;
        window.location.hash = path;
    }

    async handleRouteChange() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const [path, queryString] = hash.split('?');
        const query = new URLSearchParams(queryString || '');
        const params = Object.fromEntries(query.entries());
        const match = this.matchRoute(path);

        if (!match) {
            console.warn(`Route non trouvée: ${path}`);
            this.navigate('#dashboard');
            return;
        }

        const { handler, routeParams } = match;
        const to = { path, params: { ...routeParams, ...params }, hash };
        const from = this.currentRoute;

        for (const hook of this.beforeEachHooks) {
            const result = await hook(to, from);
            if (result === false) {
                if (from) window.location.hash = from.hash;
                return;
            }
            if (typeof result === 'string') {
                this.navigate(result);
                return;
            }
        }

        this.currentRoute = to;

        try {
            this.showLoader(true);
            await handler(to, from);
            this.updateActiveLink(path);
            this.updatePageTitle(to);
        } catch (error) {
            console.error('Erreur navigation:', error);
            this.showError('Erreur lors du chargement de la page');
        } finally {
            this.showLoader(false);
            for (const hook of this.afterEachHooks) {
                await hook(to, from);
            }
        }
    }

    matchRoute(path) {
        if (this.routes.has(path)) {
            return { handler: this.routes.get(path), routeParams: {} };
        }
        for (const [routePath, handler] of this.routes.entries()) {
            const regex = this.pathToRegex(routePath);
            const match = path.match(regex);
            if (match) {
                const paramNames = this.getParamNames(routePath);
                const routeParams = {};
                paramNames.forEach((name, i) => routeParams[name] = match[i + 1]);
                return { handler, routeParams };
            }
        }
        return null;
    }

    pathToRegex(path) {
        const regexStr = path.replace(/\//g, '\\/').replace(/:(\w+)/g, '([^/]+)');
        return new RegExp(`^${regexStr}$`);
    }

    getParamNames(path) {
        const matches = path.match(/:(\w+)/g);
        return matches ? matches.map(m => m.slice(1)) : [];
    }

    updateActiveLink(path) {
        document.querySelectorAll('.sidebar-link[data-route]').forEach(link => {
            const route = link.dataset.route;
            const isActive = path.startsWith(route) && route !== 'dashboard' || (route === 'dashboard' && path === 'dashboard');
            link.classList.toggle('active', isActive);
        });
    }

    updatePageTitle(to) {
        const titles = {
            dashboard: 'Tableau de bord', chantiers: 'Chantiers',
            employes: 'Employés', pointages: 'Pointages', equipes: 'Équipes',
            'heures-sup': 'Heures supplémentaires', materiels: 'Matériels',
            stocks: 'Stocks', fournisseurs: 'Fournisseurs', mouvements: 'Mouvements',
            clients: 'Clients', devis: 'Devis & Contrats', contrats: 'Contrats',
            factures: 'Factures', paiements: 'Paiements', finances: 'Finances',
            depenses: 'Dépenses', rapports: 'Rapports financiers', alertes: 'Alertes',
            utilisateurs: 'Utilisateurs', parametres: 'Paramètres'
        };

        let title = 'TIA INFO BUILD';
        for (const [route, t] of Object.entries(titles)) {
            if (to.path.startsWith(route)) title = t;
        }

        const titleEl = document.getElementById('pageTitle');
        if (titleEl) titleEl.textContent = title;
        document.title = `${title} — TIA INFO BUILD`;
    }

    showLoader(show) {
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            if (show) contentArea.classList.add('loading');
            else contentArea.classList.remove('loading');
        }
    }

    showError(message) {
        const contentArea = document.getElementById('contentArea');
        if (contentArea) contentArea.innerHTML = `
            <div class="alert alert-danger m-4" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>${message}
                <button class="btn btn-sm btn-outline-danger ms-3" onclick="router.navigate('#dashboard')">Retour</button>
            </div>`;
    }
}

window.router = new Router();

window.loadScript = function (scriptPath) {
    return new Promise((resolve) => {
        if (document.querySelector(`script[src="${scriptPath}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = scriptPath;
        script.onload = resolve;
        script.onerror = () => { console.warn(`Script ${scriptPath} non trouvé.`); resolve(); };
        document.body.appendChild(script);
    });
};

// ... Le reste des Routes (inchangé)
window.router.add('dashboard', async (to) => {
    const html = await loadView('dashboard.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('dashboard.js');
    if (window.dashboardController) await window.dashboardController.init();
});
// (Les autres routes restent identiques, référez-vous au fichier existant)
// ...

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

// Équipes
window.router.add('equipes', async (to) => {
    const html = await loadView('rh/equipes/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('rh/equipes/index.js');
    if (window.equipesController && typeof window.equipesController.init === 'function') {
        await window.equipesController.init();
    }
});

// Heures supplémentaires
window.router.add('heures-sup', async (to) => {
    const html = await loadView('rh/heures-sup/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('rh/heures-sup/index.js');
    if (window.heuresSupController && typeof window.heuresSupController.init === 'function') {
        await window.heuresSupController.init();
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

// Mouvements de stock
window.router.add('mouvements', async (to) => {
    const html = await loadView('stocks/mouvements/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('stocks/mouvements/index.js');
    if (window.mouvementsController && typeof window.mouvementsController.init === 'function') {
        await window.mouvementsController.init();
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

// Contrats
window.router.add('contrats', async (to) => {
    const html = await loadView('commercial/contrats/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('commercial/contrats/index.js');
    if (window.contratsController && typeof window.contratsController.init === 'function') {
        await window.contratsController.init();
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

// Paiements
window.router.add('paiements', async (to) => {
    const html = await loadView('commercial/paiements/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('commercial/paiements/index.js');
    if (window.paiementsController && typeof window.paiementsController.init === 'function') {
        await window.paiementsController.init();
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

// Dépenses
window.router.add('depenses', async (to) => {
    const html = await loadView('finance/depenses/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('finance/depenses/index.js');
    if (window.depensesController && typeof window.depensesController.init === 'function') {
        await window.depensesController.init();
    }
});

// Rapports financiers
window.router.add('rapports', async (to) => {
    const html = await loadView('finance/rapports/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('finance/rapports/index.js');
    if (window.rapportsController && typeof window.rapportsController.init === 'function') {
        await window.rapportsController.init();
    }
});

// Alertes
window.router.add('alertes', async (to) => {
    const html = await loadView('finance/alertes/index.html');
    document.getElementById('contentArea').innerHTML = html;
    await window.loadScript('finance/alertes/index.js');
    if (window.alertesController && typeof window.alertesController.init === 'function') {
        await window.alertesController.init();
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