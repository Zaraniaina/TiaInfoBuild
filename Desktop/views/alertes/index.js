class AlertesController {
    constructor() {
        this.alertes = [];
        this.currentFilter = 'non_lue';
    }

    async init() {
        this.bindEvents();
        await this.loadAlertes();
    }

    bindEvents() {
        document.getElementById('btnRefreshAlertes')?.addEventListener('click', () => this.loadAlertes());
        document.getElementById('btnMarkAllRead')?.addEventListener('click', () => this.markAllAsRead());
        
        document.getElementById('searchAlerte')?.addEventListener('input', (e) => this.filterAlertes(e.target.value));
        document.getElementById('filterAlerteStatut')?.addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.renderAlertes();
        });
        document.getElementById('filterAlerteGravite')?.addEventListener('change', () => this.renderAlertes());
    }

    async loadAlertes() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            // Get all alertes to allow filtering by read/unread on client side
            const result = await window.api.alertes.invoke('list', { entrepriseId });
            this.alertes = result?.data || [];
            this.renderAlertes();
        } catch (error) {
            console.error('Erreur chargement alertes:', error);
            if (window.showToast) window.showToast('Erreur lors du chargement des alertes', 'error');
        }
    }

    filterAlertes(searchTerm = '') {
        this.renderAlertes(searchTerm.toLowerCase());
    }

    renderAlertes(searchTerm = document.getElementById('searchAlerte')?.value?.toLowerCase() || '') {
        const tbody = document.getElementById('alertesTbody');
        const emptyState = document.getElementById('alertesEmpty');
        const tableContainer = tbody?.closest('.card');
        
        if (!tbody) return;

        const statutFilter = this.currentFilter;
        const graviteFilter = document.getElementById('filterAlerteGravite')?.value;

        const filtered = this.alertes.filter(a => {
            const matchSearch = (a.titre?.toLowerCase() || '').includes(searchTerm) || 
                                (a.message?.toLowerCase() || '').includes(searchTerm);
            const matchStatut = statutFilter ? a.statut === statutFilter : true;
            const matchGravite = graviteFilter ? a.niveauGravite === graviteFilter : true;
            return matchSearch && matchStatut && matchGravite;
        });

        if (filtered.length === 0) {
            if (tableContainer) tableContainer.classList.add('d-none');
            if (emptyState) emptyState.classList.remove('d-none');
            return;
        }

        if (tableContainer) tableContainer.classList.remove('d-none');
        if (emptyState) emptyState.classList.add('d-none');

        const graviteBadges = {
            critique: 'bg-danger',
            elevee: 'bg-warning',
            moyenne: 'bg-info',
            faible: 'bg-secondary',
            info: 'bg-primary'
        };

        tbody.innerHTML = filtered.map((a, i) => `
            <tr class="${a.statut === 'non_lue' ? 'fw-bold' : ''}" data-id="${a.id}">
                <td>${i + 1}</td>
                <td><span class="badge ${graviteBadges[a.niveauGravite] || 'bg-secondary'}">${a.niveauGravite || 'info'}</span></td>
                <td>${this.escapeHtml(a.titre)}</td>
                <td>${this.escapeHtml(a.message)}</td>
                <td><small>${this.formatDate(a.dateAlerte || a.created_at)}</small></td>
                <td>
                    <span class="badge ${a.statut === 'non_lue' ? 'bg-danger' : 'bg-success'}">
                        ${a.statut === 'non_lue' ? 'Non lue' : 'Lue'}
                    </span>
                </td>
                <td>
                    ${a.statut === 'non_lue' ? `
                    <button class="btn btn-sm btn-outline-success btn-mark-read" data-id="${a.id}" title="Marquer lue">
                        <i class="bi bi-check2"></i>
                    </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-danger btn-delete-alerte" data-id="${a.id}" title="Supprimer">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-mark-read').forEach(btn => {
            btn.addEventListener('click', (e) => this.markAsRead(e.currentTarget.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete-alerte').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteAlerte(e.currentTarget.dataset.id));
        });
    }

    async markAsRead(id) {
        try {
            await window.api.alertes.invoke('markAsRead', parseInt(id));
            await this.loadAlertes();
            if (window.updateDashboardAlertsBadge) window.updateDashboardAlertsBadge();
        } catch (error) {
            console.error('Erreur markAsRead:', error);
        }
    }

    async markAllAsRead() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            await window.api.alertes.invoke('markAllAsRead', entrepriseId);
            await this.loadAlertes();
            if (window.updateDashboardAlertsBadge) window.updateDashboardAlertsBadge();
            if (window.showToast) window.showToast('Toutes les notifications marquées comme lues', 'success');
        } catch (error) {
            console.error('Erreur markAllAsRead:', error);
        }
    }

    async deleteAlerte(id) {
        if (!confirm('Supprimer cette notification ?')) return;
        try {
            await window.api.alertes.invoke('delete', parseInt(id));
            await this.loadAlertes();
        } catch (error) {
            console.error('Erreur deleteAlerte:', error);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('fr-FR');
    }
}

// Export the controller class
window.AlertesController = AlertesController;
