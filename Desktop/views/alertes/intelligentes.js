// Desktop/views/alertes/intelligentes.js
class AlertesIntelligentesController {
  constructor() {}

  async init() {
    if (!window.AppState?.entreprise?.id) return;
    this.entrepriseId = window.AppState.entreprise.id;
    await this.loadAlertesIntelligentes();
    this.bindEvents();
  }

  async loadAlertesIntelligentes() {
    try {
      const entrepriseId = this.entrepriseId;
      const alertes = [];

      const facturesRetard = await window.api.factures.invoke('enRetard', entrepriseId);
      const factures = facturesRetard?.data || facturesRetard || [];
      const critiques = factures.filter(f => {
        const joursRetard = Math.floor((new Date() - new Date(f.dateEcheance)) / 86400000);
        return joursRetard > 30;
      });
      alertes.push(...critiques.map(f => ({
        type: 'facture_retard', priorite: 'critique',
        message: `Facture ${f.numero} en retard de ${Math.floor((new Date() - new Date(f.dateEcheance)) / 86400000)} jours`,
        entite: `Facture #${f.id}`, date: f.dateEcheance,
        lien: `#factures/${f.id}`
      })));

      const depensesResult = await window.api.depenses.invoke('list', {});
      const depenses = depensesResult?.data || depensesResult || [];
      alertes.push(...depenses.filter(d => {
        const budgetPrevu = 10000;
        return parseFloat(d.montant) > budgetPrevu * 0.8;
      }).map(d => ({
        type: 'depense_depassement', priorite: 'warning',
        message: `Dépense ${d.description || d.categorie} dépasse 80% du budget`,
        entite: `Dépense #${d.id}`, date: d.dateDepense,
        lien: `#depenses`
      })));

      const employesResult = await window.api.employes.invoke('list', { entrepriseId, limit: 200 });
      const employes = employesResult?.items || employesResult?.data || [];
      const habilitationsExpirees = employes.filter(e => {
        if (!e.dateFinContrat) return false;
        const joursRestants = Math.floor((new Date(e.dateFinContrat) - new Date()) / 86400000);
        return joursRestants > 0 && joursRestants < 60;
      });
      alertes.push(...habilitationsExpirees.map(e => ({
        type: 'habilitation', priorite: 'info',
        message: `Contrat de ${e.nom} ${e.prenom || ''} expire dans ${Math.floor((new Date(e.dateFinContrat) - new Date()) / 86400000)} jours`,
        entite: `Employé #${e.id}`, date: e.dateFinContrat,
        lien: `#employes/${e.id}`
      })));

      const facturesRetardCount = alertes.filter(a => a.type === 'facture_retard' && a.priorite === 'critique').length;
      const depensesDepassement = alertes.filter(a => a.type === 'depense_depassement').length;
      const habilitations = alertes.filter(a => a.type === 'habilitation').length;

      document.getElementById('aiFacturesRetard').textContent = facturesRetardCount;
      document.getElementById('aiDepensesDepassement').textContent = depensesDepassement;
      document.getElementById('aiHabilitations').textContent = habilitations;

      this.renderAlertes(alertes);
    } catch (error) {
      console.error('AlertesIntelligentesController error:', error);
      if (window.showToast) window.showToast('Erreur chargement alertes intelligentes', 'error');
    }
  }

  renderAlertes(alertes) {
    const tbody = document.getElementById('alertesIATbody');
    if (!tbody) return;

    if (alertes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-secondary">Aucune alerte intelligente</td></tr>`;
      return;
    }

    const prioriteBadge = { critique: 'bg-danger', warning: 'bg-warning text-dark', info: 'bg-info', success: 'bg-success' };
    const prioriteLabel = { critique: 'Critique', warning: 'Attention', info: 'Info', success: 'OK' };

    tbody.innerHTML = alertes.map(a => `
      <tr>
        <td><span class="badge bg-secondary">${a.type.replace(/_/g, ' ')}</span></td>
        <td><span class="badge ${prioriteBadge[a.priorite] || 'bg-secondary'}">${prioriteLabel[a.priorite] || a.priorite}</span></td>
        <td>${a.message}</td>
        <td><small>${a.entite}</small></td>
        <td><small>${a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '-'}</small></td>
        <td class="text-end">
          ${a.lien ? `<a href="${a.lien}" class="btn btn-sm btn-outline-primary"><i class="bi bi-arrow-right"></i></a>` : ''}
        </td>
      </tr>
    `).join('');
  }

  bindEvents() {
    document.getElementById('btnRefreshAlertesIA')?.addEventListener('click', () => this.loadAlertesIntelligentes());
  }
}

window.alertesIntelligentesController = new AlertesIntelligentesController();
