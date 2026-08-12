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

  beforeEach(hook) { this.beforeEachHooks.push(hook); }
  afterEach(hook) { this.afterEachHooks.push(hook); }

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
    if (this.routes.has(path)) return { handler: this.routes.get(path), routeParams: {} };
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
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${scriptPath}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = scriptPath;
    script.onload = resolve;
    script.onerror = () => { 
      console.warn(`Script ${scriptPath} non trouvé.`); 
      reject(new Error(`Script ${scriptPath} introuvable`)); 
    };
    document.body.appendChild(script);
  });
};

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

// ============================================================
// ROUTES — Toutes les vues
// ============================================================
window.router.add('dashboard', async (to) => {
  const html = await loadView('dashboard.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('dashboard.js');
  if (window.dashboardController) await window.dashboardController.init();
});

window.router.add('chantiers', async () => {
  const html = await loadView('chantiers/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('chantiers/index.js');
  if (window.chantiersController) await window.chantiersController.init();
});

window.router.add('chantiers/:id', async (to) => {
  const html = await loadView('chantiers/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('chantiers/index.js');
  if (window.chantiersController) {
    await window.chantiersController.init();
    if (window.chantiersController.openModalEdition) window.chantiersController.openModalEdition(to.params.id);
  }
});

window.router.add('employes', async () => {
  const html = await loadView('rh/employes/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('rh/employes/index.js');
  if (window.employesController) await window.employesController.init();
});

window.router.add('pointages', async () => {
  const html = await loadView('rh/pointages/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('rh/pointages/index.js');
  if (window.pointagesController) await window.pointagesController.init();
});

window.router.add('equipes', async () => {
  const html = await loadView('rh/equipes/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('rh/equipes/index.js');
  if (window.equipesController) await window.equipesController.init();
});

window.router.add('heures-sup', async () => {
  const html = await loadView('rh/heures-sup/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('rh/heures-sup/index.js');
  if (window.heuresSupController) await window.heuresSupController.init();
});

window.router.add('materiels', async () => {
  const html = await loadView('materiels/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('materiels/index.js');
  if (window.materielsController) await window.materielsController.init();
});

window.router.add('stocks', async () => {
  const html = await loadView('stocks/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('stocks/index.js');
  if (window.stocksController) await window.stocksController.init();
});

window.router.add('fournisseurs', async () => {
  const html = await loadView('stocks/fournisseurs/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('stocks/fournisseurs/index.js');
  if (window.fournisseursController) await window.fournisseursController.init();
});

window.router.add('mouvements', async () => {
  const html = await loadView('stocks/mouvements/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('stocks/mouvements/index.js');
  if (window.mouvementsController) await window.mouvementsController.init();
});

window.router.add('clients', async () => {
  const html = await loadView('commercial/clients/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('commercial/clients/index.js');
  if (window.clientsController) await window.clientsController.init();
});

window.router.add('devis', async () => {
  const html = await loadView('commercial/devis/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('commercial/devis/index.js');
  if (window.devisController) await window.devisController.init();
});

window.router.add('devis/nouveau', async (to) => {
  const html = await loadView('commercial/devis/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('commercial/devis/index.js');
  if (window.devisController) {
    await window.devisController.init();
    // Petit délai pour laisser le DOM se stabiliser
    await new Promise(resolve => setTimeout(resolve, 100));
    const clientId = to.params?.clientId ? parseInt(to.params.clientId) : null;
    await window.devisController.openModalNouveauDevis();
    if (clientId) {
      const sel = document.getElementById('devisClient');
      if (sel) {
        sel.value = String(clientId);
        sel.dispatchEvent(new Event('change'));
      }
      const hidden = document.getElementById('devisClientId');
      if (hidden) hidden.value = String(clientId);
    }
  }
});

window.router.add('contrats', async () => {
  const html = await loadView('commercial/contrats/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('commercial/contrats/index.js');
  if (window.contratsController) await window.contratsController.init();
});

window.router.add('factures', async () => {
  const html = await loadView('commercial/factures/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('commercial/factures/index.js');
  if (window.facturesController) await window.facturesController.init();
});

window.router.add('paiements', async () => {
  const html = await loadView('commercial/paiements/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('commercial/paiements/index.js');
  if (window.paiementsController) await window.paiementsController.init();
});

window.router.add('finances', async () => {
  const html = await loadView('finance/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('finance/index.js');
  if (window.financesController) await window.financesController.init();
});

window.router.add('depenses', async () => {
  const html = await loadView('finance/depenses/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('finance/depenses/index.js');
  if (window.depensesController) await window.depensesController.init();
});

window.router.add('rapports', async () => {
  const html = await loadView('finance/rapports/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('finance/rapports/index.js');
  if (window.rapportsController) await window.rapportsController.init();
});

window.router.add('alertes', async () => {
  const html = await loadView('alertes/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('alertes/index.js');
  if (window.AlertesController) {
      window.alertesController = new window.AlertesController();
      await window.alertesController.init();
  }
});

window.router.add('parametres', async (to) => {
  const html = await loadView('settings.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('settings.js');
  if (window.parametresController) {
    await window.parametresController.init();
    window.parametresController.selectTab(to.params?.tab);
  }
});

window.router.add('historique-logins', async () => {
  const html = await loadView('historique-logins/index.html');
  document.getElementById('contentArea').innerHTML = html;
  await window.loadScript('historique-logins/index.js');
  if (window.historiqueConnexionsController) await window.historiqueConnexionsController.init();
});

// Helpers globaux
window.showToast = function (message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const id = 'toast-' + Date.now();
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
  const bgClass = { success: 'bg-success', error: 'bg-danger', warning: 'bg-warning', info: 'bg-info' };
  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `toast ${bgClass[type]} text-white`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-header ${bgClass[type]} text-white border-0">
      <i class="bi ${icons[type]} me-2"></i>
      <strong class="me-auto">TIA INFO BUILD</strong>
      <small>à l'instant</small>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body">${message}</div>`;
  container.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: duration });
  bsToast.show();
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Router;
}