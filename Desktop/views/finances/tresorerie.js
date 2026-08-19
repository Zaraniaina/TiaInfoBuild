// Desktop/views/finances/tresorerie.js
class TresorerieController {
  constructor() {}

  async init() {
    if (!window.AppState?.entreprise?.id) return;
    const entrepriseId = window.AppState.entreprise.id;
    await this.loadTrésorerie(entrepriseId);
  }

  async loadTrésorerie(entrepriseId) {
    try {
      const result = await window.api.dashboard.invoke('getTrésorerie', entrepriseId);
      if (!result?.success) throw new Error(result?.error || 'Erreur chargement trésorerie');

      const data = result.data || {};
      const fmt = window.formatCurrency || ((v) => `${v} Ar`);

      document.getElementById('tresoDate').textContent = data.aujourdhui ? new Date(data.aujourdhui).toLocaleDateString('fr-FR') : '';

      const setCard = (id, countId, item) => {
        const el = document.getElementById(id);
        const cEl = document.getElementById(countId);
        if (el) el.textContent = fmt(item.montant || 0);
        if (cEl) cEl.textContent = `${item.count || 0} élément(s)`;
      };

      setCard('encaissementsJ30', 'encaissementsJ30Count', data.facturesJ30 || {});
      setCard('encaissementsJ60', 'encaissementsJ60Count', data.facturesJ60 || {});
      setCard('encaissementsJ90', 'encaissementsJ90Count', data.facturesJ90 || {});
      setCard('depensesJ30', 'depensesJ30Count', data.depensesJ30 || {});
      setCard('depensesJ60', 'depensesJ60Count', data.depensesJ60 || {});
      setCard('depensesJ90', 'depensesJ90Count', data.depensesJ90 || {});

      const soldeEl = document.getElementById('soldePrevisionnel');
      if (soldeEl) {
        soldeEl.textContent = fmt(data.soldePrevisionnel || 0);
        soldeEl.className = 'h3 mb-0 ' + ((data.soldePrevisionnel || 0) >= 0 ? 'text-success' : 'text-danger');
      }

      const retardEl = document.getElementById('facturesEnRetard');
      if (retardEl) retardEl.textContent = fmt(data.totalEnRetard || 0);

      const tbody = document.getElementById('tresoTableBody');
      if (tbody) {
        const rows = [
          { periode: 'J+0 à J+30', enc: data.facturesJ30, dep: data.depensesJ30 },
          { periode: 'J+31 à J+60', enc: data.facturesJ60, dep: data.depensesJ60 },
          { periode: 'J+61 à J+90', enc: data.facturesJ90, dep: data.depensesJ90 }
        ];
        tbody.innerHTML = rows.map(r => {
          const net = (r.enc?.montant || 0) - (r.dep?.montant || 0);
          return `<tr>
            <td class="fw-semibold">${r.periode}</td>
            <td class="text-success">${fmt(r.enc?.montant || 0)}</td>
            <td class="text-danger">${fmt(r.dep?.montant || 0)}</td>
            <td class="fw-semibold ${net >= 0 ? 'text-success' : 'text-danger'}">${fmt(net)}</td>
          </tr>`;
        }).join('');
      }
    } catch (error) {
      console.error('TresorerieController error:', error);
      if (window.showToast) window.showToast('Erreur chargement trésorerie', 'error');
    }
  }
}

window.tresorerieController = new TresorerieController();
