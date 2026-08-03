/**
 * Alertes View Controller
 * Affiche et gère les alertes financières/opérationnelles
 */

class AlertesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 15;
        this.filters = { search: '', gravite: '', type: '', statut: 'non_lue' };
        this.alertesData = [];
    }

    async init() {
        this.bindEvents();
        await this.loadAlertes();
    }

    bindEvents() {
        let debounce;
        document.getElementById('searchAlerte')?.addEventListener('input', e => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this.filters.search = e.target.value; this.currentPage = 1; this.renderFiltered(); }, 300);
        });
        document.getElementById('filterGraviteAlerte')?.addEventListener('change', e => { this.filters.gravite = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterTypeAlerte')?.addEventListener('change', e => { this.filters.type = e.target.value; this.currentPage = 1; this.renderFiltered(); });
        document.getElementById('filterStatutAlerte')?.addEventListener('change', e => { this.filters.statut = e.target.value; this.loadAlertes(); });
        document.getElementById('btnRefreshAlertes')?.addEventListener('click', () => this.loadAlertes());
        document.getElementById('btnMarquerToutesLues')?.addEventListener('click', () => this.marquerToutesLues());
    }

    formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: window.getAppCurrency ? window.getAppCurrency() : 'MGA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}
    async loadAlertes() {
        this.showLoader(true);
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            let result;
            if (this.filters.statut === 'non_lue') {
                result = await window.api.alertes.invoke('nonLues', entrepriseId);
            } else {
                // Essai API list générique
                try {
                    result = await window.api.alertes.invoke('list', { entrepriseId, limit: 500 });
                } catch {
                    result = await window.api.alertes.invoke('nonLues', entrepriseId);
                }
            }
            this.alertesData = Array.isArray(result) ? result : (result.items || result.data || []);
            if (this.filters.statut === 'lue') {
                this.alertesData = this.alertesData.filter(a => a.lue === 1 || a.lue === true);
            }
            this.updateKPIs();
            this.renderFiltered();
        } catch (error) {
            console.error('Erreur alertes:', error);
            showToast('Erreur lors du chargement des alertes', 'error');
        } finally {
            this.showLoader(false);
        }
    }

    updateKPIs() {
        const nonLues = this.alertesData.filter(a => !a.lue);
        const critiques = nonLues.filter(a => a.gravite === 'critique').length;
        const importantes = nonLues.filter(a => a.gravite === 'importante').length;
        const infos = nonLues.filter(a => a.gravite === 'info' || (!a.gravite)).length;
        const today = new Date().toDateString();
        const luesAujdhui = this.alertesData.filter(a => a.lue && a.dateLecture && new Date(a.dateLecture).toDateString() === today).length;

        document.getElementById('kpiAlerteCritique').textContent = critiques;
        document.getElementById('kpiAlerteImportante').textContent = importantes;
        document.getElementById('kpiAlerteInfo').textContent = infos;
        document.getElementById('kpiAlerteLues').textContent = luesAujdhui;
    }

    renderFiltered() {
        let filtered = this.alertesData;
        if (this.filters.search) {
            const s = this.filters.search.toLowerCase();
            filtered = filtered.filter(a => (a.message || a.titre || '').toLowerCase().includes(s));
        }
        if (this.filters.gravite) filtered = filtered.filter(a => a.gravite === this.filters.gravite);
        if (this.filters.type) filtered = filtered.filter(a => a.type === this.filters.type);

        const start = (this.currentPage - 1) * this.pageSize;
        const paginated = filtered.slice(start, start + this.pageSize);
        this.renderAlertes(paginated);
        this.renderPagination(filtered.length);
        this.toggleEmptyState(filtered.length === 0);
    }

    renderAlertes(alertes) {
        const container = document.getElementById('alertesContainer');
        if (!container) return;
        if (alertes.length === 0) { container.innerHTML = ''; return; }

        const graviteConfig = {
            'critique': { class: 'border-danger', badgeClass: 'bg-danger', icon: 'bi-exclamation-octagon', label: 'Critique' },
            'importante': { class: 'border-warning', badgeClass: 'bg-warning text-dark', icon: 'bi-exclamation-triangle', label: 'Importante' },
            'info': { class: 'border-info', badgeClass: 'bg-info', icon: 'bi-info-circle', label: 'Info' }
        };

        container.innerHTML = alertes.map(a => {
            const gc = graviteConfig[a.gravite] || graviteConfig['info'];
            const isLue = a.lue === 1 || a.lue === true;

            return `
                <div class="card mb-3 border-start border-3 ${gc.class} ${isLue ? 'opacity-75' : ''}" data-id="${a.id}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex gap-3 flex-grow-1">
                                <div class="mt-1">
                                    <span class="badge ${gc.badgeClass} rounded-pill">
                                        <i class="bi ${gc.icon} me-1"></i>${gc.label}
                                    </span>
                                </div>
                                <div class="flex-grow-1">
                                    <div class="fw-semibold ${isLue ? 'text-secondary' : ''}">${this.escapeHtml(a.titre || a.message || 'Alerte')}</div>
                                    ${a.message && a.titre ? `<div class="text-secondary small mt-1">${this.escapeHtml(a.message)}</div>` : ''}
                                    <div class="mt-2 d-flex gap-2 flex-wrap">
                                        ${a.type ? `<span class="badge bg-secondary">${this.escapeHtml(a.type)}</span>` : ''}
                                        <small class="text-secondary">
                                            <i class="bi bi-clock me-1"></i>${this.formatDatetime(a.createdAt || a.dateCreation)}
                                        </small>
                                        ${isLue ? '<span class="badge bg-success"><i class="bi bi-check me-1"></i>Lue</span>' : '<span class="badge bg-warning text-dark">Non lue</span>'}
                                    </div>
                                </div>
                            </div>
                            <div class="ms-3">
                                ${!isLue ? `
                                <button class="btn btn-sm btn-outline-success btn-marquer-lue" data-id="${a.id}" title="Marquer comme lue">
                                    <i class="bi bi-check"></i>
                                </button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-marquer-lue').forEach(btn => {
            btn.addEventListener('click', e => this.marquerLue(e.currentTarget.dataset.id));
        });
    }

    renderPagination(total) {
        const container = document.getElementById('alertesPagination');
        if (!container) return;
        const totalPages = Math.ceil(total / this.pageSize);
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = '<nav><ul class="pagination pagination-sm mb-0 justify-content-center">';
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage - 1}"><i class="bi bi-chevron-left"></i></a></li>`;
        for (let i = Math.max(1, this.currentPage - 2); i <= Math.min(totalPages, this.currentPage + 2); i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
        html += `<li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${this.currentPage + 1}"><i class="bi bi-chevron-right"></i></a></li>`;
        html += '</ul></nav>';
        container.innerHTML = html;
        container.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (page && page !== this.currentPage) { this.currentPage = page; this.renderFiltered(); }
            });
        });
    }

    toggleEmptyState(isEmpty) {
        document.getElementById('alertesEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('alertesContainer')?.classList.toggle('d-none', isEmpty);
    }

    async marquerLue(id) {
        try {
            await window.api.alertes.invoke('marquerLue', parseInt(id));
            const alerte = this.alertesData.find(a => String(a.id) === String(id));
            if (alerte) alerte.lue = true;
            showToast('Alerte marquée comme lue', 'success');
            this.updateKPIs();
            this.renderFiltered();

            // Mettre à jour le badge dans le layout
            if (typeof window.layoutController?.updateAlertBadge === 'function') {
                window.layoutController.updateAlertBadge();
            }
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    async marquerToutesLues() {
        if (!confirm('Marquer toutes les alertes comme lues ?')) return;
        const nonLues = this.alertesData.filter(a => !a.lue);
        try {
            for (const alerte of nonLues) {
                await window.api.alertes.invoke('marquerLue', alerte.id);
            }
            showToast(`${nonLues.length} alerte(s) marquée(s) comme lues`, 'success');
            await this.loadAlertes();
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
        }
    }

    showLoader(show) {
        const container = document.getElementById('alertesContainer');
        if (container) container.style.opacity = show ? '0.5' : '1';
    }

    formatDatetime(d) {
        if (!d) return '—';
        try { return new Date(d).toLocaleString('fr-FR'); } catch { return d; }
    }

    escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

window.alertesController = new AlertesController();
