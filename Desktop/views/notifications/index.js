// Desktop/views/notifications/index.js
class NotificationsController {
  constructor() {}

  async init() {
    if (!window.AppState?.user?.id || !window.AppState?.entreprise?.id) return;
    this.userId = window.AppState.user.id;
    this.entrepriseId = window.AppState.entreprise.id;
    await this.loadNotifications();
    this.bindEvents();
  }

  async loadNotifications() {
    try {
      const lu = document.getElementById('filterLu')?.value;
      const result = await window.api.notifications.invoke('list', {
        utilisateurId: this.userId,
        entrepriseId: this.entrepriseId,
        lu: lu !== '' ? (lu === '1' ? true : false) : null,
        limit: 100
      });
      const items = result?.data || result?.items || [];
      const tbody = document.getElementById('notifTableBody');
      if (!tbody) return;

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-secondary">Aucune notification</td></tr>`;
        return;
      }

      const typeBadge = { info: 'bg-info', succes: 'bg-success', avertissement: 'bg-warning', erreur: 'bg-danger' };
      tbody.innerHTML = items.map((n, idx) => {
        const luBadge = n.lu ? '<span class="badge bg-success">Lue</span>' : '<span class="badge bg-danger">Non lue</span>';
        const typeCls = typeBadge[n.type] || 'bg-secondary';
        const dateStr = n.dateCreation ? new Date(n.dateCreation).toLocaleString('fr-FR') : '-';
        return `<tr>
          <td>${idx + 1}</td>
          <td class="fw-semibold">${n.titre}</td>
          <td class="text-truncate" style="max-width:300px;">${n.message || '-'}</td>
          <td><span class="badge ${typeCls}">${n.type || 'info'}</span></td>
          <td>${luBadge}</td>
          <td>${dateStr}</td>
          <td class="text-end">
            ${!n.lu ? `<button class="btn btn-sm btn-outline-primary btn-action" data-action="marquerLu" data-id="${n.id}" data-permission="notifications:update"><i class="bi bi-check2"></i></button>` : ''}
            <button class="btn btn-sm btn-outline-danger btn-action" data-action="supprimer" data-id="${n.id}" data-permission="notifications:delete"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
      }).join('');
    } catch (error) {
      console.error('NotificationsController error:', error);
      if (window.showToast) window.showToast('Erreur chargement notifications', 'error');
    }
  }

  bindEvents() {
    const filterLu = document.getElementById('filterLu');
    const btnMarquerToutes = document.getElementById('btnMarquerToutesLues');
    const btnPurge = document.getElementById('btnPurge');

    if (filterLu) filterLu.addEventListener('change', () => this.loadNotifications());

    if (btnMarquerToutes) {
      btnMarquerToutes.addEventListener('click', async () => {
        try {
          await window.api.notifications.invoke('markAllAsRead', this.userId, this.entrepriseId);
          if (window.showToast) window.showToast('Toutes les notifications marquées comme lues', 'success');
          await this.loadNotifications();
        } catch (e) {
          if (window.showToast) window.showToast('Erreur', 'error');
        }
      });
    }

    if (btnPurge) {
      btnPurge.addEventListener('click', async () => {
        try {
          const result = await window.api.notifications.invoke('list', { utilisateurId: this.userId, entrepriseId: this.entrepriseId, lu: true, limit: 1000 });
          const items = result?.data || result?.items || [];
          for (const n of items) {
            await window.api.notifications.invoke('delete', n.id);
          }
          if (window.showToast) window.showToast(`${items.length} notification(s) supprimée(s)`, 'success');
          await this.loadNotifications();
        } catch (e) {
          if (window.showToast) window.showToast('Erreur purge', 'error');
        }
      });
    }
  }
}

window.notificationsController = new NotificationsController();
