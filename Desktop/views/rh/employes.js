/**
 * Employes View Controller (Module RH)
 */
class EmployesController {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.filters = {
            search: '',
            statut: ''
        };
    }

    async init() {
        this.bindEvents();
        await this.loadEmployes();
    }

    bindEvents() {
        document.getElementById('searchEmploye')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.loadEmployes();
        });

        document.getElementById('filterStatutEmploye')?.addEventListener('change', (e) => {
            this.filters.statut = e.target.value;
            this.currentPage = 1;
            this.loadEmployes();
        });

        document.getElementById('btnNouvelEmploye')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnFirstEmploye')?.addEventListener('click', () => this.openModalNouveau());
        document.getElementById('btnRefreshEmployes')?.addEventListener('click', () => this.loadEmployes());

        const form = document.getElementById('formEmploye');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmitEmploye(e));
        }
    }

    async loadEmployes() {
        try {
            const entrepriseId = window.AppState?.entreprise?.id || 1;
            const res = await window.api.employes.invoke('list', {
                entrepriseId,
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                statut: this.filters.statut || undefined,
                search: this.filters.search || undefined
            });

            const data = res.data || res;
            const items = data.items || [];
            this.totalItems = data.total || 0;
            this.renderEmployesTable(items);
            this.toggleEmptyState(items.length === 0);
        } catch (error) {
            console.error('Erreur chargement employés:', error);
        }
    }

    renderEmployesTable(employes) {
        const tbody = document.getElementById('employesTbody');
        if (!tbody) return;

        if (!employes || employes.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = employes.map((emp, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td class="fw-semibold">${this.escapeHtml(emp.prenom || '')} ${this.escapeHtml(emp.nom || '')}</td>
                <td>${this.escapeHtml(emp.poste || 'Ouvrier')}</td>
                <td class="d-none d-md-table-cell">${this.escapeHtml(emp.telephone || emp.email || '—')}</td>
<td class="d-none d-lg-table-cell">${window.formatCurrencyGlobal ? window.formatCurrencyGlobal(emp.salaireBase || 0) : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(emp.salaireBase || 0)}</td>
                <td><span class="badge bg-success">Actif</span></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-edit" data-id="${emp.id}"><i class="bi bi-pencil"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    toggleEmptyState(isEmpty) {
        document.getElementById('employesEmpty')?.classList.toggle('d-none', !isEmpty);
        document.getElementById('employesTable')?.classList.toggle('d-none', isEmpty);
    }

    openModalNouveau() {
        const form = document.getElementById('formEmploye');
        if (form) form.reset();
        document.getElementById('employeId').value = '';
        const modalEl = document.getElementById('modalEmploye');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }

    async handleSubmitEmploye(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const entrepriseId = window.AppState?.entreprise?.id || 1;

        try {
            const res = await window.api.employes.invoke('create', data, entrepriseId);
            if (res.success || res.id) {
                if (typeof window.showToast === 'function') window.showToast('Employé enregistré avec succès !', 'success');
                const modalEl = document.getElementById('modalEmploye');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal?.hide();
                await this.loadEmployes();
            }
        } catch (error) {
            console.error('Erreur enregistrement employé:', error);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }
}

window.employesController = new EmployesController();
