// Desktop/views/sous-traitants/index.js
class SousTraitantsController {
  constructor() {}

  async init() {
    if (!window.AppState?.entreprise?.id) return;
    this.entrepriseId = window.AppState.entreprise.id;
    await this.loadChantiers();
    await this.loadSousTraitants();
    this.bindEvents();
  }

  async loadChantiers() {
    try {
      const result = await window.api.chantiers.invoke('list', { entrepriseId: this.entrepriseId, limit: 100 });
      const chantiers = result?.items || result?.data || [];
      const sel = document.getElementById('filterChantierST');
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

  async loadSousTraitants() {
    try {
      const chantierId = document.getElementById('filterChantierST')?.value;
      const search = document.getElementById('searchST')?.value?.toLowerCase() || '';
      let result, items;
      if (chantierId) {
        result = await window.api.sousTraitants.invoke('list', { entrepriseId: this.entrepriseId, chantierId: parseInt(chantierId) });
      } else {
        result = await window.api.sousTraitants.invoke('list', { entrepriseId: this.entrepriseId });
      }
      items = result?.data || result?.items || [];

      if (search) {
        items = items.filter(st => (st.nom || '').toLowerCase().includes(search) || (st.specialite || '').toLowerCase().includes(search));
      }

      const tbody = document.getElementById('stTableBody');
      if (!tbody) return;

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-secondary">Aucun sous-traitant</td></tr>`;
        return;
      }

      const fmt = window.formatCurrency || ((v) => `${v} Ar`);
      tbody.innerHTML = items.map((st, idx) => {
        const statutBadge = st.statut === 'actif' ? 'bg-success' : st.statut === 'inactif' ? 'bg-secondary' : 'bg-warning';
        return `<tr>
          <td>${idx + 1}</td>
          <td class="fw-semibold">${st.nom}</td>
          <td>${st.contact || '-'}</td>
          <td>${st.specialite || '-'}</td>
          <td><span class="badge ${statutBadge}">${st.statut || 'N/A'}</span></td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary btn-action" data-action="voir" data-id="${st.id}" data-permission="sousTraitants:list">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>`;
      }).join('');
    } catch (error) {
      console.error('SousTraitantsController error:', error);
      if (window.showToast) window.showToast('Erreur chargement sous-traitants', 'error');
    }
  }

  bindEvents() {
    const filterChantier = document.getElementById('filterChantierST');
    const searchST = document.getElementById('searchST');
    const btnNouveau = document.getElementById('btnNouveauST');

    if (filterChantier) filterChantier.addEventListener('change', () => this.loadSousTraitants());
    if (searchST) searchST.addEventListener('input', () => this.loadSousTraitants());
    if (btnNouveau) {
      btnNouveau.addEventListener('click', () => {
        if (window.showToast) window.showToast('Formulaire de création de sous-traitant à implémenter', 'info');
      });
    }
  }
}

window.sousTraitantsController = new SousTraitantsController();
