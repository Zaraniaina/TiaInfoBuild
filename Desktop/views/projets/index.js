// Desktop/views/projets/index.js
class ProjetsController {
  constructor() {}

  async init() {
    if (!window.AppState?.entreprise?.id) return;
    this.entrepriseId = window.AppState.entreprise.id;
    await this.loadProjets();
    this.bindEvents();
  }

  async loadProjets() {
    try {
      const result = await window.api.chantiers.invoke('list', { entrepriseId: this.entrepriseId, limit: 100 });
      const chantiers = result?.items || result?.data || [];

      const today = new Date().toISOString().split('T')[0];
      const actifs = chantiers.filter(c => c.statut === 'en_cours' || c.statut === 'planification').length;
      const retards = chantiers.filter(c => c.dateFinPrevue && c.dateFinPrevue < today && c.statut !== 'termine').length;
      const budgetTotal = chantiers.reduce((s, c) => s + (parseFloat(c.budgetPrevu) || 0), 0);
      const budgetConsomme = chantiers.reduce((s, c) => s + (parseFloat(c.budgetReel) || 0), 0);

      document.getElementById('projetsDate').textContent = new Date().toLocaleDateString('fr-FR');
      document.getElementById('projetsActifs').textContent = actifs;
      document.getElementById('projetsRetard').textContent = retards;
      document.getElementById('projetsBudgetTotal').textContent = window.formatCurrency ? window.formatCurrency(budgetTotal) : `${budgetTotal} Ar`;
      document.getElementById('projetsBudgetConsomme').textContent = window.formatCurrency ? window.formatCurrency(budgetConsomme) : `${budgetConsomme} Ar`;

      const tbody = document.getElementById('projetsTableBody');
      if (!tbody) return;

      if (chantiers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-secondary">Aucun chantier</td></tr>`;
        return;
      }

      const fmt = window.formatCurrency || ((v) => `${v} Ar`);
      tbody.innerHTML = chantiers.map((c, idx) => {
        const statutBadge = {
          'planification': 'bg-secondary', 'en_cours': 'bg-primary', 'termine': 'bg-success',
          'en_pause': 'bg-warning', 'annule': 'bg-danger'
        }[c.statut] || 'bg-secondary';
        const statutLabel = {
          'planification': 'Planification', 'en_cours': 'En cours', 'termine': 'Terminé',
          'en_pause': 'En pause', 'annule': 'Annulé'
        }[c.statut] || c.statut;
        const avancement = c.avancementGlobal || 0;
        const isRetard = c.dateFinPrevue && c.dateFinPrevue < today && c.statut !== 'termine';
        return `<tr>
          <td>${idx + 1}</td>
          <td class="fw-semibold">${c.nom}</td>
          <td>${c.clientNom || '-'}</td>
          <td>
            <small>${c.dateDebut ? new Date(c.dateDebut).toLocaleDateString('fr-FR') : '-'}</small>
            <br><small class="text-secondary">au ${c.dateFinPrevue ? new Date(c.dateFinPrevue).toLocaleDateString('fr-FR') : '-'}</small>
          </td>
          <td>
            <div class="fw-semibold">${fmt(c.budgetPrevu || 0)}</div>
            <small class="text-secondary">${fmt(c.budgetReel || 0)} consommé</small>
          </td>
          <td>
            <div class="d-flex align-items-center gap-2">
              <div class="progress flex-grow-1" style="height: 6px; min-width: 80px;">
                <div class="progress-bar ${avancement >= 80 ? 'bg-success' : avancement >= 40 ? 'bg-primary' : 'bg-warning'}" style="width: ${Math.min(avancement, 100)}%"></div>
              </div>
              <small class="fw-semibold">${avancement}%</small>
            </div>
          </td>
          <td><span class="badge ${statutBadge} ${isRetard ? 'border border-danger' : ''}">${isRetard ? '⚠ ' : ''}${statutLabel}</span></td>
          <td class="text-end">
            <a href="#chantiers/${c.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i></a>
          </td>
        </tr>`;
      }).join('');
    } catch (error) {
      console.error('ProjetsController error:', error);
      if (window.showToast) window.showToast('Erreur chargement projets', 'error');
    }
  }

  bindEvents() {
    document.getElementById('btnRefreshProjets')?.addEventListener('click', () => this.loadProjets());
  }
}

window.projetsController = new ProjetsController();
