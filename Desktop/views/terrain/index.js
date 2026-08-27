// Desktop/views/terrain/index.js
class TerrainController {
  constructor() {}

  async init() {
    if (!window.AppState?.entreprise?.id) return;
    this.entrepriseId = window.AppState.entreprise.id;
    await this.loadChantiers();
    this.bindEvents();
  }

  async loadChantiers() {
    try {
      const result = await window.api.chantiers.invoke('list', { entrepriseId: this.entrepriseId, limit: 100 });
      const chantiers = result?.items || result?.data || [];
      const select = document.getElementById('terrainChantierSelect');
      if (!select) return;

      chantiers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nom || `Chantier #${c.id}`;
        select.appendChild(opt);
      });

      if (chantiers.length > 0) {
        select.value = chantiers[0].id;
        await this.loadChantierStats(chantiers[0].id);
      }
    } catch (e) {
      console.warn('Erreur chargement chantiers:', e);
    }
  }

  async loadChantierStats(chantierId) {
    try {
      const chantierResult = await window.api.chantiers.invoke('get', chantierId);
      const chantier = chantierResult?.data || chantierResult;
      if (!chantier) return;

      document.getElementById('terrainChantierStats').style.display = 'block';
      document.getElementById('terrainAvancement').textContent = `${chantier.avancementGlobal || 0}%`;
      document.getElementById('terrainBudget').textContent = window.formatCurrency ? window.formatCurrency(chantier.budgetPrevu || 0) : `${chantier.budgetPrevu || 0} Ar`;

      const equipesResult = await window.api.equipes.invoke('list', this.entrepriseId);
      const equipes = equipesResult?.data || equipesResult || [];
      const equipeChantier = equipes.filter(e => e.chantierId === parseInt(chantierId));
      document.getElementById('terrainEquipe').textContent = equipeChantier.length;

      const incidentsResult = await window.api.incidents.invoke('list', chantierId);
      const incidents = incidentsResult?.data || incidentsResult || [];
      const incidentsOuverts = incidents.filter(i => i.statut !== 'resolu' && i.statut !== 'clos');
      document.getElementById('terrainIncidents').textContent = incidentsOuverts.length;

      const activitesDiv = document.getElementById('terrainActivites');
      if (activitesDiv) {
        const recentIncidents = incidents.slice(0, 5);
        if (recentIncidents.length === 0) {
          activitesDiv.innerHTML = `<div class="text-center text-secondary py-3">Aucune activité récente</div>`;
        } else {
          activitesDiv.innerHTML = recentIncidents.map(i => `
            <div class="d-flex align-items-start gap-2 mb-2 p-2 bg-light rounded">
              <i class="bi bi-exclamation-circle text-warning mt-1"></i>
              <div>
                <div class="fw-semibold small">${i.titre || 'Incident'}</div>
                <small class="text-secondary">${i.description || ''}</small>
                <br><small class="text-secondary">${i.dateIncident || ''}</small>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Erreur stats chantier:', e);
    }
  }

  bindEvents() {
    const select = document.getElementById('terrainChantierSelect');
    if (select) {
      select.addEventListener('change', (e) => {
        if (e.target.value) this.loadChantierStats(parseInt(e.target.value));
      });
    }

    document.getElementById('btnTerrainPointage')?.addEventListener('click', () => {
      if (window.showToast) window.showToast('Module de pointage terrain à implémenter', 'info');
    });

    document.getElementById('btnTerrainDepense')?.addEventListener('click', () => {
      if (window.router) window.router.navigate('#depenses');
    });

    document.getElementById('btnTerrainIncident')?.addEventListener('click', () => {
      if (window.router) window.router.navigate('#chantiers');
    });

    document.getElementById('btnTerrainStock')?.addEventListener('click', () => {
      if (window.router) window.router.navigate('#mouvements');
    });
  }
}

window.terrainController = new TerrainController();
