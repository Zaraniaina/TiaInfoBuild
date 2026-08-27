// Desktop/views/commercial/pipeline.js
class PipelineController {
  constructor() {}

  async init() {
    if (!window.AppState?.entreprise?.id) return;
    this.entrepriseId = window.AppState.entreprise.id;
    await this.loadPipeline();
    this.bindEvents();
  }

  async loadPipeline() {
    try {
      const result = await window.api.devis.invoke('list', { entrepriseId: this.entrepriseId, limit: 200 });
      const devis = result?.items || result?.data || [];

      const stages = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'];
      stages.forEach(stage => {
        const col = document.getElementById(`col-${stage}`);
        const count = document.getElementById(`count-${stage}`);
        if (!col) return;

        const items = devis.filter(d => d.statut === stage);
        if (count) count.textContent = items.length;

        if (items.length === 0) {
          col.innerHTML = `<div class="text-center text-secondary py-3 small">Aucun devis</div>`;
          return;
        }

        col.innerHTML = items.map(d => {
          const fmt = window.formatCurrency || ((v) => `${v} Ar`);
          return `<div class="kanban-card" data-devis-id="${d.id}" data-permission="devis:list">
            <div class="kanban-card-title">${d.numero || `Devis #${d.id}`}</div>
            <div class="kanban-card-client">${d.clientNom || d.client?.nom || 'Client inconnu'}</div>
            <div class="kanban-card-montant">${fmt(d.montantTTC || d.montantTotal || 0)}</div>
            <small class="text-secondary">${d.dateCreation ? new Date(d.dateCreation).toLocaleDateString('fr-FR') : ''}</small>
          </div>`;
        }).join('');

        col.querySelectorAll('.kanban-card').forEach(card => {
          card.addEventListener('click', () => {
            const devisId = card.dataset.devisId;
            if (devisId && window.router) {
              window.router.navigate(`#devis/${devisId}`);
            }
          });
        });
      });
    } catch (error) {
      console.error('PipelineController error:', error);
      if (window.showToast) window.showToast('Erreur chargement pipeline', 'error');
    }
  }

  bindEvents() {
    document.getElementById('btnNouveauDevisPipeline')?.addEventListener('click', () => {
      if (window.router) window.router.navigate('#devis/nouveau');
    });
  }
}

window.pipelineController = new PipelineController();
