// Desktop/views/commercial/catalogue-devis.js
class CatalogueDevisController {
  constructor() {}

  async init() {
    if (!window.AppState?.entreprise?.id) return;
    this.entrepriseId = window.AppState.entreprise.id;
    await this.loadCategories();
    await this.loadCatalogue();
    this.bindEvents();
  }

  async loadCategories() {
    try {
      const result = await window.api.catalogueDevis.invoke('categories', this.entrepriseId);
      const categories = result?.data || result?.items || [];
      const sel = document.getElementById('filterCategorie');
      if (!sel) return;
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.categorie;
        opt.textContent = cat.categorie;
        sel.appendChild(opt);
      });
    } catch (e) {
      console.warn('Erreur chargement catégories:', e);
    }
  }

  async loadCatalogue() {
    try {
      const categorie = document.getElementById('filterCategorie')?.value;
      const search = document.getElementById('searchCatalogue')?.value?.toLowerCase() || '';
      const result = await window.api.catalogueDevis.invoke('list', { entrepriseId: this.entrepriseId, categorie: categorie || null });
      let items = result?.data || result?.items || [];

      if (search) {
        items = items.filter(m => (m.nom || '').toLowerCase().includes(search) || (m.categorie || '').toLowerCase().includes(search));
      }

      const tbody = document.getElementById('catalogueTableBody');
      if (!tbody) return;

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-secondary">Aucun modèle de devis</td></tr>`;
        return;
      }

      tbody.innerHTML = items.map((m, idx) => {
        const statutBadge = m.statut === 'actif' ? 'bg-success' : 'bg-secondary';
        return `<tr>
          <td>${idx + 1}</td>
          <td class="fw-semibold">${m.nom}</td>
          <td>${m.categorie || '-'}</td>
          <td>${m.tva || 20}%</td>
          <td><span class="badge ${statutBadge}">${m.statut || 'N/A'}</span></td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary btn-action" data-action="voir" data-id="${m.id}" data-permission="catalogueDevis:list">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>`;
      }).join('');
    } catch (error) {
      console.error('CatalogueDevisController error:', error);
      if (window.showToast) window.showToast('Erreur chargement catalogue', 'error');
    }
  }

  bindEvents() {
    const filterCategorie = document.getElementById('filterCategorie');
    const searchCatalogue = document.getElementById('searchCatalogue');
    const btnNouveau = document.getElementById('btnNouveauModele');

    if (filterCategorie) filterCategorie.addEventListener('change', () => this.loadCatalogue());
    if (searchCatalogue) searchCatalogue.addEventListener('input', () => this.loadCatalogue());
    if (btnNouveau) {
      btnNouveau.addEventListener('click', () => {
        if (window.showToast) window.showToast('Formulaire de création de modèle à implémenter', 'info');
      });
    }
  }
}

window.catalogueController = new CatalogueDevisController();
