// Desktop/views/finances/budget-previsionnel.js
class BudgetPrevisionnelController {
  constructor() {}

  async init() {
    if (!window.AppState?.entreprise?.id) return;
    this.entrepriseId = window.AppState.entreprise.id;
    await this.loadChantiers();
    await this.loadBudgets();
    this.bindEvents();
  }

  async loadChantiers() {
    try {
      const result = await window.api.chantiers.invoke('list', { entrepriseId: this.entrepriseId, limit: 100 });
      const chantiers = result?.items || result?.data || [];
      const sel = document.getElementById('filterChantier');
      if (!sel) return;
      chantiers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nom || `Chantier #${c.id}`;
        sel.appendChild(opt);
      });
    } catch (e) {
      console.warn('Erreur chargement chantiers:', e);
    }
  }

  async loadBudgets() {
    try {
      const chantierId = document.getElementById('filterChantier')?.value;
      const search = document.getElementById('searchBudget')?.value?.toLowerCase() || '';
      const result = await window.api.budgetPrevisionnel.invoke('list', { entrepriseId: this.entrepriseId, chantierId: chantierId ? parseInt(chantierId) : null });
      let items = result?.data || result?.items || [];

      if (search) {
        items = items.filter(b => (b.periode || '').toLowerCase().includes(search));
      }

      const tbody = document.getElementById('budgetTableBody');
      if (!tbody) return;

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-secondary">Aucun budget prévisionnel</td></tr>`;
        return;
      }

      tbody.innerHTML = items.map(b => {
        const ecart = (b.montantRealise || 0) - (b.montantPrevu || 0);
        const taux = b.montantPrevu > 0 ? ((ecart / b.montantPrevu) * 100).toFixed(1) : '0.0';
        const ecartClass = ecart > 0 ? 'text-danger' : ecart < 0 ? 'text-success' : 'text-secondary';
        const fmt = window.formatCurrency || ((v) => `${v} Ar`);
        return `<tr>
          <td class="fw-semibold">${b.chantierNom || `Chantier #${b.chantierId}`}</td>
          <td>${b.periode || '-'}</td>
          <td>${fmt(b.montantPrevu || 0)}</td>
          <td>${fmt(b.montantRealise || 0)}</td>
          <td class="${ecartClass}">${fmt(ecart)}</td>
          <td class="${ecartClass}">${taux}%</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary btn-action" data-action="voir" data-id="${b.id}" data-permission="budgetPrevisionnel:list">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>`;
      }).join('');
    } catch (error) {
      console.error('BudgetPrevisionnelController error:', error);
      if (window.showToast) window.showToast('Erreur chargement budgets', 'error');
    }
  }

  bindEvents() {
    const filterChantier = document.getElementById('filterChantier');
    const searchBudget = document.getElementById('searchBudget');
    const btnNouveau = document.getElementById('btnNouveauBudget');

    if (filterChantier) filterChantier.addEventListener('change', () => this.loadBudgets());
    if (searchBudget) searchBudget.addEventListener('input', () => this.loadBudgets());
    if (btnNouveau) {
      btnNouveau.addEventListener('click', () => this.openModalNouveau());
    }
  }

  openModalNouveau() {
    if (!window.showToast) return;
    window.showToast('Formulaire de création de budget à implémenter', 'info');
  }
}

window.budgetPrevisionnelController = new BudgetPrevisionnelController();
